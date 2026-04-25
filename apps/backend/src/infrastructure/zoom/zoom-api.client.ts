import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';

export interface ZoomMeetingRequest {
  topic: string;
  startTime: string;
  durationMins: number;
}

export interface ZoomMeetingResponse {
  id: number;
  join_url: string;
  start_url: string;
}

interface ZoomTokenResponse {
  access_token: string;
  expires_in: number;
}

@Injectable()
export class ZoomApiClient {
  private readonly logger = new Logger(ZoomApiClient.name);
  private readonly tokenCache = new Map<string, { token: string; expiresAt: number }>();

  async getAccessToken(
    orgId: string,
    clientId: string,
    clientSecret: string,
    accountId: string,
  ): Promise<string> {
    const cached = this.tokenCache.get(orgId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.token;
    }

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const res = await this.fetchWithRetry(
      `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${accountId}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
    );

    if (!res.ok) {
      const error = await res.text();
      this.logger.error(`Zoom auth failed for org ${orgId}: ${res.status} ${error}`);
      throw new InternalServerErrorException(`Zoom authentication failed`);
    }

    const data: ZoomTokenResponse = await res.json();
    // Cache with 60s buffer
    this.tokenCache.set(orgId, {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in - 60) * 1000,
    });

    return data.access_token;
  }

  async createMeeting(
    token: string,
    opts: ZoomMeetingRequest,
    timezone: string,
  ): Promise<ZoomMeetingResponse> {
    const res = await this.fetchWithRetry('https://api.zoom.us/v2/users/me/meetings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        topic: opts.topic,
        type: 2,
        start_time: opts.startTime,
        duration: opts.durationMins,
        timezone,
        settings: {
          join_before_host: true,
          waiting_room: false,
          jbh_time: 0,
        },
      }),
    });

    if (!res.ok) {
      const error = await res.text();
      this.logger.error(`Failed to create Zoom meeting: ${res.status} ${error}`);
      throw new InternalServerErrorException(`Zoom meeting creation failed: ${res.statusText}`);
    }

    return res.json();
  }

  async deleteMeeting(token: string, meetingId: string): Promise<void> {
    const res = await this.fetchWithRetry(`https://api.zoom.us/v2/meetings/${meetingId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok && res.status !== 404) {
      const error = await res.text();
      this.logger.error(`Failed to delete Zoom meeting ${meetingId}: ${res.status} ${error}`);
    }
  }

  async updateMeeting(
    token: string,
    meetingId: string,
    opts: Partial<ZoomMeetingRequest>,
    timezone: string,
  ): Promise<void> {
    const body: Record<string, string | number> = {};
    if (opts.topic) body.topic = opts.topic;
    if (opts.startTime) body.start_time = opts.startTime;
    if (opts.durationMins) body.duration = opts.durationMins;
    if (timezone) body.timezone = timezone;

    const res = await this.fetchWithRetry(`https://api.zoom.us/v2/meetings/${meetingId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const error = await res.text();
      this.logger.error(`Failed to update Zoom meeting ${meetingId}: ${res.status} ${error}`);
    }
  }

  private async fetchWithRetry(url: string, init?: RequestInit, retries = 3): Promise<Response> {
    const backoffs = [250, 750, 1500];
    let lastError: unknown;

    for (let i = 0; i <= retries; i++) {
      try {
        const res = await fetch(url, init);
        // Retry on 429 or 5xx
        if (res.status === 429 || (res.status >= 500 && res.status <= 599)) {
          if (i < retries) {
            await new Promise((resolve) => setTimeout(resolve, backoffs[i]));
            continue;
          }
        }
        return res;
      } catch (e) {
        lastError = e;
        if (i < retries) {
          await new Promise((resolve) => setTimeout(resolve, backoffs[i]));
          continue;
        }
      }
    }
    throw lastError || new Error('Fetch failed after retries');
  }
}

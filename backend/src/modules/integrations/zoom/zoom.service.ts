import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ZoomMeeting {
  meetingId: string;
  joinUrl: string;
  hostUrl: string;
}

interface ZoomTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface ZoomMeetingResponse {
  id: number;
  join_url: string;
  start_url: string;
}

@Injectable()
export class ZoomService {
  private readonly logger = new Logger(ZoomService.name);
  private accessToken: string | null = null;
  private tokenExpiresAt = 0;

  constructor(private readonly config: ConfigService) {}

  async createMeeting(
    topic?: string,
    startTime?: string,
    duration?: number,
  ): Promise<ZoomMeeting> {
    if (!this.isConfigured()) {
      this.logger.warn('Zoom not configured — returning placeholder links');
      const id = Math.random().toString(36).substring(2, 12);
      return {
        meetingId: `zoom-stub-${id}`,
        joinUrl: `https://zoom.us/j/${id}`,
        hostUrl: `https://zoom.us/s/${id}`,
      };
    }

    const token = await this.getAccessToken();

    const response = await fetch('https://api.zoom.us/v2/users/me/meetings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        topic: topic ?? 'CareKit Video Consultation',
        type: startTime ? 2 : 1, // 2 = scheduled, 1 = instant
        start_time: startTime,
        duration: duration ?? 30,
        timezone: 'Asia/Riyadh',
        settings: {
          host_video: true,
          participant_video: true,
          join_before_host: false,
          mute_upon_entry: true,
          waiting_room: true,
          auto_recording: 'none',
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(
        `Zoom create meeting failed: ${response.status} — ${error}`,
      );
      throw new Error(`Zoom API error: ${response.status}`);
    }

    const data = (await response.json()) as ZoomMeetingResponse;

    return {
      meetingId: String(data.id),
      joinUrl: data.join_url,
      hostUrl: data.start_url,
    };
  }

  async deleteMeeting(meetingId: string): Promise<void> {
    if (!this.isConfigured() || meetingId.startsWith('zoom-stub-')) {
      return;
    }

    const token = await this.getAccessToken();

    const response = await fetch(
      `https://api.zoom.us/v2/meetings/${meetingId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!response.ok && response.status !== 404) {
      this.logger.warn(
        `Zoom delete meeting ${meetingId} failed: ${response.status}`,
      );
    }
  }

  private isConfigured(): boolean {
    return !!(
      this.config.get<string>('ZOOM_ACCOUNT_ID') &&
      this.config.get<string>('ZOOM_CLIENT_ID') &&
      this.config.get<string>('ZOOM_CLIENT_SECRET')
    );
  }

  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid (with 60s buffer)
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 60_000) {
      return this.accessToken;
    }

    const accountId = this.config.get<string>('ZOOM_ACCOUNT_ID');
    const clientId = this.config.get<string>('ZOOM_CLIENT_ID');
    const clientSecret = this.config.get<string>('ZOOM_CLIENT_SECRET');

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
      'base64',
    );

    const response = await fetch(
      `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${accountId}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
    );

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(
        `Zoom token request failed: ${response.status} — ${error}`,
      );
      throw new Error(`Zoom OAuth error: ${response.status}`);
    }

    const data = (await response.json()) as ZoomTokenResponse;
    this.accessToken = data.access_token;
    this.tokenExpiresAt = Date.now() + data.expires_in * 1000;

    return this.accessToken;
  }
}

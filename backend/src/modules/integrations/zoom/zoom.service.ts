import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../../../common/services/cache.service.js';
import { resilientFetch } from '../../../common/helpers/resilient-fetch.helper.js';

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

const ZOOM_TOKEN_CACHE_KEY = 'zoom:access_token';
const TOKEN_BUFFER_SECONDS = 60;

@Injectable()
export class ZoomService {
  private readonly logger = new Logger(ZoomService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly cache: CacheService,
  ) {}

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

    const response = await resilientFetch(
      'https://api.zoom.us/v2/users/me/meetings',
      {
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
      },
      { circuit: 'zoom', timeoutMs: 10_000 },
    );

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

    const response = await resilientFetch(
      `https://api.zoom.us/v2/meetings/${meetingId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      { circuit: 'zoom', timeoutMs: 10_000 },
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
    // Return cached token from Redis if still valid
    const cached = await this.cache.get<string>(ZOOM_TOKEN_CACHE_KEY);
    if (cached) {
      return cached;
    }

    const accountId = this.config.get<string>('ZOOM_ACCOUNT_ID');
    const clientId = this.config.get<string>('ZOOM_CLIENT_ID');
    const clientSecret = this.config.get<string>('ZOOM_CLIENT_SECRET');

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
      'base64',
    );

    const response = await resilientFetch(
      `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${accountId}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
      { circuit: 'zoom', timeoutMs: 10_000 },
    );

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(
        `Zoom token request failed: ${response.status} — ${error}`,
      );
      throw new Error(`Zoom OAuth error: ${response.status}`);
    }

    const data = (await response.json()) as ZoomTokenResponse;
    const ttl = Math.max(data.expires_in - TOKEN_BUFFER_SECONDS, 1);
    await this.cache.set(ZOOM_TOKEN_CACHE_KEY, data.access_token, ttl);

    return data.access_token;
  }
}

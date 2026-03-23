import { Injectable, Logger } from '@nestjs/common';

interface ZoomMeeting {
  meetingId: string;
  joinUrl: string;
  hostUrl: string;
}

/**
 * TODO: Replace with real Zoom API integration.
 * Required: ZOOM_API_KEY, ZOOM_API_SECRET, ZOOM_ACCOUNT_ID env vars.
 * See: https://developers.zoom.us/docs/api/
 * Current implementation generates placeholder links for development only.
 */
@Injectable()
export class ZoomService {
  private readonly logger = new Logger(ZoomService.name);

  async createMeeting(): Promise<ZoomMeeting> {
    this.logger.warn('Using Zoom STUB — replace with real API before production');
    const id = Math.random().toString(36).substring(2, 12);
    return {
      meetingId: `zoom-stub-${id}`,
      joinUrl: `https://zoom.us/j/${id}`,
      hostUrl: `https://zoom.us/s/${id}`,
    };
  }
}

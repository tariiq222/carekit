import { Injectable } from '@nestjs/common';

interface ZoomMeeting {
  meetingId: string;
  joinUrl: string;
  hostUrl: string;
}

@Injectable()
export class ZoomService {
  async createMeeting(): Promise<ZoomMeeting> {
    // Stub: generates placeholder Zoom-like links.
    // Replace with real Zoom API integration when ready.
    const id = Math.random().toString(36).substring(2, 12);
    return {
      meetingId: `zoom-${id}`,
      joinUrl: `https://zoom.us/j/${id}`,
      hostUrl: `https://zoom.us/s/${id}`,
    };
  }
}

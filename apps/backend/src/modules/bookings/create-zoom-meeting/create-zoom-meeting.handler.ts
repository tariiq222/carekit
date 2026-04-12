import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface CreateZoomMeetingCommand {
  tenantId: string;
  bookingId: string;
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
export class CreateZoomMeetingHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: CreateZoomMeetingCommand) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: cmd.bookingId, tenantId: cmd.tenantId },
    });
    if (!booking) {
      throw new NotFoundException(`Booking ${cmd.bookingId} not found`);
    }
    if (booking.bookingType !== 'ONLINE') {
      throw new BadRequestException(
        'Zoom meetings can only be created for ONLINE bookings',
      );
    }

    const integration = await this.prisma.integration.findUnique({
      where: {
        tenantId_provider: {
          tenantId: cmd.tenantId,
          provider: 'zoom',
        },
      },
    });
    if (!integration || !integration.isActive) {
      throw new BadRequestException(
        'Zoom integration is not configured for this clinic',
      );
    }

    const config = integration.config as Record<string, string>;
    const { zoomClientId, zoomClientSecret, zoomAccountId } = config;

    const token = await this.getAccessToken(
      zoomClientId,
      zoomClientSecret,
      zoomAccountId,
    );

    const meeting = await this.createMeeting(token, {
      topic: `Booking ${booking.id}`,
      startTime: booking.scheduledAt.toISOString(),
      durationMins: booking.durationMins,
    });

    return this.prisma.booking.update({
      where: { id: cmd.bookingId },
      data: {
        zoomMeetingId: String(meeting.id),
        zoomJoinUrl: meeting.join_url,
        zoomHostUrl: meeting.start_url,
      },
    });
  }

  private async getAccessToken(
    clientId: string,
    clientSecret: string,
    accountId: string,
  ): Promise<string> {
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
      'base64',
    );
    const res = await fetch(
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
      throw new BadRequestException(
        `Zoom authentication failed: ${res.statusText}`,
      );
    }
    const data: ZoomTokenResponse = await res.json();
    return data.access_token;
  }

  private async createMeeting(
    accessToken: string,
    opts: { topic: string; startTime: string; durationMins: number },
  ): Promise<ZoomMeetingResponse> {
    const res = await fetch('https://api.zoom.us/v2/users/me/meetings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        topic: opts.topic,
        type: 2,
        start_time: opts.startTime,
        duration: opts.durationMins,
        timezone: 'Asia/Riyadh',
        settings: { join_before_host: true, waiting_room: false },
      }),
    });
    if (!res.ok) {
      throw new BadRequestException(
        `Failed to create Zoom meeting: ${res.statusText}`,
      );
    }
    return res.json();
  }
}

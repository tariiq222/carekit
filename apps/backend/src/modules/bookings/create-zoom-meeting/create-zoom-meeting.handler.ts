import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { ZoomApiClient } from '../../../infrastructure/zoom/zoom-api.client';
import { ZoomCredentialsService } from '../../../infrastructure/zoom/zoom-credentials.service';
import { FeatureCheckService } from '../../platform/billing/feature-check.service';
import { FeatureKey } from '@deqah/shared/constants/feature-keys';
import { ZoomMeetingStatus } from '@prisma/client';

export interface CreateZoomMeetingCommand {
  bookingId: string;
}

@Injectable()
export class CreateZoomMeetingHandler {
  private readonly logger = new Logger(CreateZoomMeetingHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly zoomApi: ZoomApiClient,
    private readonly zoomCredentials: ZoomCredentialsService,
    private readonly featureCheck: FeatureCheckService,
  ) {}

  async execute(cmd: CreateZoomMeetingCommand) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: cmd.bookingId },
    });
    if (!booking) {
      throw new NotFoundException(`Booking ${cmd.bookingId} not found`);
    }

    // Feature gate: skip Zoom meeting creation if ZOOM_INTEGRATION is disabled
    if (!(await this.featureCheck.isEnabled(booking.organizationId, FeatureKey.ZOOM_INTEGRATION))) {
      this.logger.debug(
        `feature_disabled_skip: org=${booking.organizationId} feature=ZOOM_INTEGRATION`,
      );
      return this.prisma.booking.update({
        where: { id: cmd.bookingId },
        data: {
          zoomMeetingStatus: ZoomMeetingStatus.FAILED,
          zoomMeetingError: 'Zoom integration is not available on your current plan',
        },
      });
    }

    // Idempotency: skip if already CREATED
    if (
      booking.zoomMeetingId &&
      booking.zoomMeetingStatus === ZoomMeetingStatus.CREATED
    ) {
      return booking;
    }

    if (booking.bookingType !== 'ONLINE') {
      throw new BadRequestException(
        'Zoom meetings can only be created for ONLINE bookings',
      );
    }

    // SaaS-02g: Integration.provider is composite-unique per org; findFirst + Proxy auto-scopes.
    const integration = await this.prisma.integration.findFirst({
      where: { provider: 'zoom' },
    });
    if (!integration || !integration.isActive) {
      this.logger.warn(`Zoom integration not configured for booking ${booking.id}`);
      return this.prisma.booking.update({
        where: { id: cmd.bookingId },
        data: {
          zoomMeetingStatus: ZoomMeetingStatus.FAILED,
          zoomMeetingError: 'Zoom integration is not configured for this clinic',
        },
      });
    }

    const config = integration.config as { ciphertext?: string } | null;
    const ciphertext = config?.ciphertext;

    if (!ciphertext) {
      this.logger.error(`Zoom config missing ciphertext for org ${booking.organizationId}`);
      return this.prisma.booking.update({
        where: { id: cmd.bookingId },
        data: {
          zoomMeetingStatus: ZoomMeetingStatus.FAILED,
          zoomMeetingError: 'Zoom integration configuration is invalid',
        },
      });
    }

    try {
      const { zoomClientId, zoomClientSecret, zoomAccountId } =
        this.zoomCredentials.decrypt<{
          zoomClientId: string;
          zoomClientSecret: string;
          zoomAccountId: string;
        }>(ciphertext, booking.organizationId);

      const settings = await this.prisma.organizationSettings.findFirst({
        where: { organizationId: booking.organizationId },
      });
      const timezone = settings?.timezone || 'Asia/Riyadh';

      const token = await this.zoomApi.getAccessToken(
        booking.organizationId,
        zoomClientId,
        zoomClientSecret,
        zoomAccountId,
      );

      const meeting = await this.zoomApi.createMeeting(
        token,
        {
          topic: `Booking ${booking.id}`,
          startTime: booking.scheduledAt.toISOString(),
          durationMins: booking.durationMins,
        },
        timezone,
      );

      return await this.prisma.booking.update({
        where: { id: cmd.bookingId },
        data: {
          zoomMeetingId: String(meeting.id),
          zoomJoinUrl: meeting.join_url,
          zoomHostUrl: meeting.start_url,
          zoomStartUrl: meeting.start_url,
          zoomMeetingStatus: ZoomMeetingStatus.CREATED,
          zoomMeetingCreatedAt: new Date(),
          zoomMeetingError: null,
        },
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      this.logger.error(
        `Failed to create Zoom meeting for booking ${booking.id}: ${message}`,
      );
      return await this.prisma.booking.update({
        where: { id: cmd.bookingId },
        data: {
          zoomMeetingStatus: ZoomMeetingStatus.FAILED,
          zoomMeetingError: message,
        },
      });
    }
  }
}

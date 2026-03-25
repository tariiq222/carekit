import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { BookingType } from '@prisma/client';

export interface ResolvedPricing {
  price: number;        // halalat
  duration: number;     // minutes
  source: 'practitioner_option' | 'service_option' | 'practitioner_type' | 'service_type';
  durationOptionId?: string;
}

@Injectable()
export class PriceResolverService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(params: {
    serviceId: string;
    practitionerServiceId: string;
    bookingType: BookingType;
    durationOptionId?: string;
  }): Promise<ResolvedPricing> {
    // 1. Get ServiceBookingType (the service-level config for this booking type)
    const sbt = await this.prisma.serviceBookingType.findUnique({
      where: {
        serviceId_bookingType: {
          serviceId: params.serviceId,
          bookingType: params.bookingType,
        },
      },
      include: { durationOptions: { orderBy: { sortOrder: 'asc' } } },
    });

    if (!sbt || !sbt.isActive) {
      throw new BadRequestException({
        statusCode: 400,
        message: `Booking type '${params.bookingType}' is not available for this service`,
        error: 'BOOKING_TYPE_NOT_AVAILABLE',
      });
    }

    // 2. Get PractitionerServiceType (practitioner override for this booking type)
    const pst = await this.prisma.practitionerServiceType.findUnique({
      where: {
        practitionerServiceId_bookingType: {
          practitionerServiceId: params.practitionerServiceId,
          bookingType: params.bookingType,
        },
      },
      include: { durationOptions: { orderBy: { sortOrder: 'asc' } } },
    });

    if (pst && !pst.isActive) {
      throw new BadRequestException({
        statusCode: 400,
        message: `Booking type '${params.bookingType}' is not available for this practitioner`,
        error: 'PRACTITIONER_TYPE_NOT_AVAILABLE',
      });
    }

    // 3. Resolve with specific duration option if provided
    if (params.durationOptionId) {
      return this.resolveWithOptionId(params.durationOptionId, pst, sbt);
    }

    // 4. Check if practitioner has custom duration options
    if (pst?.useCustomOptions && pst.durationOptions.length > 0) {
      const defaultOpt = pst.durationOptions.find(o => o.isDefault) || pst.durationOptions[0];
      return {
        price: defaultOpt.price,
        duration: defaultOpt.durationMinutes,
        source: 'practitioner_option',
        durationOptionId: defaultOpt.id,
      };
    }

    // 5. Check service-level duration options
    if (sbt.durationOptions.length > 0) {
      const defaultOpt = sbt.durationOptions.find(o => o.isDefault) || sbt.durationOptions[0];
      return {
        price: defaultOpt.price,
        duration: defaultOpt.durationMinutes,
        source: 'service_option',
        durationOptionId: defaultOpt.id,
      };
    }

    // 6. No options — use flat price/duration from practitioner override
    if (pst) {
      return {
        price: pst.price ?? sbt.price,
        duration: pst.duration ?? sbt.duration,
        source: pst.price != null || pst.duration != null ? 'practitioner_type' : 'service_type',
      };
    }

    // 7. No practitioner override at all — pure service defaults
    return {
      price: sbt.price,
      duration: sbt.duration,
      source: 'service_type',
    };
  }

  private resolveWithOptionId(
    durationOptionId: string,
    pst: { useCustomOptions: boolean; durationOptions: Array<{ id: string; price: number; durationMinutes: number }> } | null,
    sbt: { durationOptions: Array<{ id: string; price: number; durationMinutes: number }> },
  ): ResolvedPricing {
    // First check practitioner options
    if (pst?.useCustomOptions) {
      const opt = pst.durationOptions.find(o => o.id === durationOptionId);
      if (opt) {
        return {
          price: opt.price,
          duration: opt.durationMinutes,
          source: 'practitioner_option',
          durationOptionId: opt.id,
        };
      }
    }

    // Then check service options
    const opt = sbt.durationOptions.find(o => o.id === durationOptionId);
    if (opt) {
      return {
        price: opt.price,
        duration: opt.durationMinutes,
        source: 'service_option',
        durationOptionId: opt.id,
      };
    }

    throw new BadRequestException({
      statusCode: 400,
      message: 'Duration option not found',
      error: 'DURATION_OPTION_NOT_FOUND',
    });
  }
}

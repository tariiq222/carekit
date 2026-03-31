import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';

export interface PublicClinicSettings {
  bankName: string | null;
  bankIban: string | null;
  accountHolder: string | null;
}

export type BookingFlowOrder = 'service_first' | 'practitioner_first';

@Injectable()
export class ClinicSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getPublicSettings(): Promise<PublicClinicSettings> {
    const keys = ['bank_name', 'bank_iban', 'bank_account_holder'];
    const configs = await this.prisma.whiteLabelConfig.findMany({
      where: { key: { in: keys } },
      select: { key: true, value: true },
    });

    const map = Object.fromEntries(configs.map((c) => [c.key, c.value]));

    return {
      bankName: map['bank_name'] ?? null,
      bankIban: map['bank_iban'] ?? null,
      accountHolder: map['bank_account_holder'] ?? null,
    };
  }

  async getBookingFlowOrder(): Promise<BookingFlowOrder> {
    const settings = await this.prisma.bookingSettings.findFirst({
      where: { branchId: null },
      select: { bookingFlowOrder: true },
    });
    return (settings?.bookingFlowOrder as BookingFlowOrder) ?? 'service_first';
  }

  async updateBookingFlowOrder(order: BookingFlowOrder): Promise<BookingFlowOrder> {
    const current = await this.prisma.bookingSettings.findFirst({
      where: { branchId: null },
    });

    const updated = current
      ? await this.prisma.bookingSettings.update({
          where: { id: current.id },
          data: { bookingFlowOrder: order },
          select: { bookingFlowOrder: true },
        })
      : await this.prisma.bookingSettings.create({
          data: { bookingFlowOrder: order, branchId: null },
          select: { bookingFlowOrder: true },
        });

    return updated.bookingFlowOrder as BookingFlowOrder;
  }
}

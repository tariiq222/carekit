import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database';
import { MoyasarApiClient } from '../finance/moyasar-api/moyasar-api.client';

interface PurchaseSubscriptionCommand {
  planId: string;
  clientId: string;
  branchId: string;
  successUrl: string;
  failUrl: string;
}

export interface PurchaseSubscriptionResult {
  subscriptionId: string;
  paymentUrl: string;
  invoiceId: string;
}

@Injectable()
export class PurchaseSubscriptionHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moyasarClient: MoyasarApiClient,
  ) {}

  async execute(cmd: PurchaseSubscriptionCommand): Promise<PurchaseSubscriptionResult> {
    const plan = await this.prisma.subscriptionPlan.findFirst({
      where: {
        id: cmd.planId,
        isPublic: true,
        isActive: true,
      },
    });

    if (!plan) {
      throw new NotFoundException('Subscription plan not found');
    }

    const client = await this.prisma.client.findFirst({
      where: { id: cmd.clientId },
      select: { id: true, name: true, email: true, phone: true },
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    const price = Number(plan.price);

    const invoice = await this.prisma.invoice.create({
      data: {
        branchId: cmd.branchId,
        clientId: cmd.clientId,
        employeeId: 'SYSTEM',
        bookingId: `SUB-${plan.id}-${Date.now()}`,
        subtotal: price,
        vatRate: 0.15,
        vatAmt: price * 0.15,
        total: price * 1.15,
        currency: plan.currency,
        status: 'DRAFT',
      },
    });

    const amountHalalas = Math.round(price * 1.15 * 100);

    const moyasarPayment = await this.moyasarClient.createPayment({
      amountHalalas,
      currency: plan.currency,
      description: `${plan.nameEn} - Subscription`,
      callbackUrl: `${cmd.successUrl}?invoiceId=${invoice.id}`,
      metadata: {
        invoiceId: invoice.id,
        planId: plan.id,
        clientId: cmd.clientId,
        type: 'SUBSCRIPTION',
      },
    });

    await this.prisma.payment.create({
      data: {
        invoiceId: invoice.id,
        amount: price,
        currency: plan.currency,
        method: 'ONLINE_CARD',
        status: 'PENDING',
        gatewayRef: moyasarPayment.id,
      },
    });

    const subscription = await this.prisma.clientSubscription.create({
      data: {
        clientId: cmd.clientId,
        planId: plan.id,
        status: 'PENDING',
        invoiceId: invoice.id,
        totalPaid: price,
      },
    });

    return {
      subscriptionId: subscription.id,
      paymentUrl: moyasarPayment.redirectUrl ?? '',
      invoiceId: invoice.id,
    };
  }
}
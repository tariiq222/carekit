import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentMethod, PaymentStatus } from '@prisma/client';

export const MOYASAR_API_CLIENT = Symbol('MOYASAR_API_CLIENT');

export interface MoyasarCreatePaymentParams {
  amountHalalas: number;
  currency: string;
  description: string;
  callbackUrl: string;
  metadata: Record<string, string>;
}

export interface MoyasarPayment {
  id: string;
  amount: number;
  currency: string;
  status: 'initiated' | 'paid' | 'failed' | 'refunded';
  description: string | null;
  metadata: Record<string, string>;
  redirectUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MoyasarRefund {
  id: string;
  amount: number;
  currency: string;
  status: 'refunded';
  paymentId: string;
  createdAt: string;
}

interface MoyasarApiResponse {
  id: string;
  object: string;
  amount: number;
  currency: string;
  status: MoyasarPayment['status'];
  description: string | null;
  metadata: Record<string, string>;
  redirect_url: string | null;
  created_at: string;
  updated_at: string;
}

interface MoyasarErrorResponse {
  type: string;
  message: string;
  status: number;
}

@Injectable()
export class MoyasarApiClient {
  private readonly baseUrl = 'https://api.moyasar.com/v1';

  constructor(private readonly config: ConfigService) {}

  private getApiKey(): string {
    const key = this.config.get<string>('MOYASAR_API_KEY');
    if (!key) {
      throw new InternalServerErrorException('MOYASAR_API_KEY is not configured');
    }
    return key;
  }

  private authHeader(): string {
    return `Bearer ${this.getApiKey()}`;
  }

  private async request<T>(path: string, options: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        'Authorization': this.authHeader(),
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText })) as MoyasarErrorResponse;
      throw new InternalServerErrorException(
        `Moyasar API error: ${error.message} (status: ${response.status})`,
      );
    }

    return response.json() as Promise<T>;
  }

  async createPayment(params: MoyasarCreatePaymentParams): Promise<MoyasarPayment> {
    const body = {
      amount: params.amountHalalas,
      currency: params.currency,
      description: params.description,
      callback_url: params.callbackUrl,
      metadata: params.metadata,
      source: {
        type: 'card',
      },
    };

    const data = await this.request<MoyasarApiResponse>('/payments', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    return {
      id: data.id,
      amount: data.amount,
      currency: data.currency,
      status: data.status,
      description: data.description,
      metadata: data.metadata,
      redirectUrl: data.redirect_url,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  toPaymentStatus(moyasarStatus: MoyasarPayment['status']): PaymentStatus {
    switch (moyasarStatus) {
      case 'paid':
        return PaymentStatus.COMPLETED;
      case 'failed':
        return PaymentStatus.FAILED;
      case 'refunded':
        return PaymentStatus.REFUNDED;
      case 'initiated':
      default:
        return PaymentStatus.PENDING;
    }
  }

  toPaymentMethod(): PaymentMethod {
    return PaymentMethod.ONLINE_CARD;
  }

  async createRefund(params: { paymentId: string; amount: number }): Promise<MoyasarRefund> {
    const body = {
      payment_id: params.paymentId,
      amount: params.amount,
    };

    const data = await this.request<{
      id: string;
      amount: number;
      currency: string;
      status: string;
      payment_id: string;
      created_at: string;
    }>('/refunds', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    return {
      id: data.id,
      amount: data.amount,
      currency: data.currency,
      status: 'refunded',
      paymentId: data.payment_id,
      createdAt: data.created_at,
    };
  }
}
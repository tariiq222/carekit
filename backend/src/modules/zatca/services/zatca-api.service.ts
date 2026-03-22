import { Injectable, Logger } from '@nestjs/common';
import {
  ZATCA_API_BASE,
  ZATCA_ENDPOINTS,
  ZATCA_API_VERSION,
} from '../constants/zatca.constants.js';

interface ZatcaRequestBody {
  invoiceHash: string;
  uuid: string;
  invoice: string;  // Base64-encoded XML
}

interface ZatcaApiResponse {
  status: string;
  validationResults?: {
    status: string;
    infoMessages?: unknown[];
    warningMessages?: unknown[];
    errorMessages?: unknown[];
  };
  reportingStatus?: string;
  clearanceStatus?: string;
  clearedInvoice?: string;
}

interface ZatcaCredentials {
  csid: string;   // binarySecurityToken
  secret: string;
}

@Injectable()
export class ZatcaApiService {
  private readonly logger = new Logger(ZatcaApiService.name);

  private buildAuthHeader(credentials: ZatcaCredentials): string {
    const raw = `${credentials.csid}:${credentials.secret}`;
    return `Basic ${Buffer.from(raw).toString('base64')}`;
  }

  private buildHeaders(credentials: ZatcaCredentials, language = 'ar'): HeadersInit {
    return {
      'Content-Type': 'application/json',
      Authorization: this.buildAuthHeader(credentials),
      'Accept-Version': ZATCA_API_VERSION,
      'Accept-Language': language,
    };
  }

  async reportInvoice(
    body: ZatcaRequestBody,
    credentials: ZatcaCredentials,
  ): Promise<ZatcaApiResponse> {
    const url = `${ZATCA_API_BASE}${ZATCA_ENDPOINTS.reportingInvoice}`;
    return this.post(url, body, credentials);
  }

  async clearInvoice(
    body: ZatcaRequestBody,
    credentials: ZatcaCredentials,
  ): Promise<ZatcaApiResponse> {
    const url = `${ZATCA_API_BASE}${ZATCA_ENDPOINTS.clearanceInvoice}`;
    return this.post(url, body, credentials);
  }

  async checkCompliance(
    body: ZatcaRequestBody,
    credentials: ZatcaCredentials,
  ): Promise<ZatcaApiResponse> {
    const url = `${ZATCA_API_BASE}${ZATCA_ENDPOINTS.complianceInvoice}`;
    return this.post(url, body, credentials);
  }

  private async post(
    url: string,
    body: ZatcaRequestBody,
    credentials: ZatcaCredentials,
  ): Promise<ZatcaApiResponse> {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.buildHeaders(credentials),
        body: JSON.stringify(body),
      });

      const data = (await response.json()) as ZatcaApiResponse;

      if (!response.ok) {
        this.logger.warn(`ZATCA API error ${response.status}: ${JSON.stringify(data)}`);
      }

      return data;
    } catch (error) {
      this.logger.error(`ZATCA API request failed: ${String(error)}`);
      throw error;
    }
  }
}

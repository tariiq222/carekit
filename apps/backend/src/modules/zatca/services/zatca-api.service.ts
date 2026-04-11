import { Injectable, Logger } from '@nestjs/common';
import {
  ZATCA_SANDBOX_BASE,
  ZATCA_ENDPOINTS,
  ZATCA_API_VERSION,
} from '../constants/zatca.constants.js';

export interface ZatcaRequestBody {
  invoiceHash: string;
  uuid: string;
  invoice: string; // Base64-encoded XML
}

export interface ZatcaApiResponse {
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

export interface ZatcaCredentials {
  csid: string; // binarySecurityToken
  secret: string;
}

export interface CsidResponse {
  requestID: string;
  binarySecurityToken: string;
  secret: string;
  tokenType?: string;
  dispositionMessage?: string;
}

@Injectable()
export class ZatcaApiService {
  private readonly logger = new Logger(ZatcaApiService.name);

  private buildAuthHeader(credentials: ZatcaCredentials): string {
    const raw = `${credentials.csid}:${credentials.secret}`;
    return `Basic ${Buffer.from(raw).toString('base64')}`;
  }

  private buildHeaders(
    credentials: ZatcaCredentials,
    language = 'ar',
  ): HeadersInit {
    return {
      'Content-Type': 'application/json',
      Authorization: this.buildAuthHeader(credentials),
      'Accept-Version': ZATCA_API_VERSION,
      'Accept-Language': language,
    };
  }

  // ── Invoice endpoints ─────────────────────────────────────

  async reportInvoice(
    body: ZatcaRequestBody,
    credentials: ZatcaCredentials,
    baseUrl?: string,
  ): Promise<ZatcaApiResponse> {
    const url = `${baseUrl ?? ZATCA_SANDBOX_BASE}${ZATCA_ENDPOINTS.reportingInvoice}`;
    return this.postInvoice(url, body, credentials);
  }

  async clearInvoice(
    body: ZatcaRequestBody,
    credentials: ZatcaCredentials,
    baseUrl?: string,
  ): Promise<ZatcaApiResponse> {
    const url = `${baseUrl ?? ZATCA_SANDBOX_BASE}${ZATCA_ENDPOINTS.clearanceInvoice}`;
    return this.postInvoice(url, body, credentials);
  }

  async checkCompliance(
    body: ZatcaRequestBody,
    credentials: ZatcaCredentials,
    baseUrl?: string,
  ): Promise<ZatcaApiResponse> {
    const url = `${baseUrl ?? ZATCA_SANDBOX_BASE}${ZATCA_ENDPOINTS.complianceInvoice}`;
    return this.postInvoice(url, body, credentials);
  }

  // ── Onboarding CSID endpoints ─────────────────────────────

  /**
   * Step 1 of onboarding: request a compliance CSID from ZATCA.
   * No auth header — just the OTP in a custom header.
   */
  async requestComplianceCsid(
    csrBase64: string,
    otp: string,
    baseUrl?: string,
  ): Promise<CsidResponse> {
    const url = `${baseUrl ?? ZATCA_SANDBOX_BASE}${ZATCA_ENDPOINTS.complianceCsid}`;

    const response = await this.fetchJson<CsidResponse>(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept-Version': ZATCA_API_VERSION,
        OTP: otp,
      },
      body: JSON.stringify({ csr: csrBase64 }),
    });

    return response;
  }

  /**
   * Step 3 of onboarding: exchange compliance CSID for production CSID.
   * Auth: Basic(complianceBST:secret).
   */
  async requestProductionCsid(
    complianceRequestId: string,
    credentials: ZatcaCredentials,
    baseUrl?: string,
  ): Promise<CsidResponse> {
    const url = `${baseUrl ?? ZATCA_SANDBOX_BASE}${ZATCA_ENDPOINTS.productionCsid}`;

    const response = await this.fetchJson<CsidResponse>(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept-Version': ZATCA_API_VERSION,
        Authorization: this.buildAuthHeader(credentials),
      },
      body: JSON.stringify({ compliance_request_id: complianceRequestId }),
    });

    return response;
  }

  // ── Private helpers ────────────────────────────────────────

  private async postInvoice(
    url: string,
    body: ZatcaRequestBody,
    credentials: ZatcaCredentials,
  ): Promise<ZatcaApiResponse> {
    return this.fetchJson<ZatcaApiResponse>(url, {
      method: 'POST',
      headers: this.buildHeaders(credentials),
      body: JSON.stringify(body),
    });
  }

  private async fetchJson<T>(url: string, init: RequestInit): Promise<T> {
    try {
      const response = await fetch(url, init);
      const data = (await response.json()) as T;

      if (!response.ok) {
        this.logger.warn(
          `ZATCA API error ${response.status}: ${JSON.stringify(data)}`,
        );
        throw new Error(`ZATCA API request failed: ${response.status}`);
      }

      return data;
    } catch (error) {
      this.logger.error(`ZATCA API request failed: ${String(error)}`);
      throw error;
    }
  }
}

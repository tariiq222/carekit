/**
 * CareKit — ZatcaApiService Unit Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ZatcaApiService } from '../../../src/modules/zatca/services/zatca-api.service.js';
import {
  ZATCA_SANDBOX_BASE,
  ZATCA_ENDPOINTS,
  ZATCA_API_VERSION,
} from '../../../src/modules/zatca/constants/zatca.constants.js';
import type {
  ZatcaRequestBody,
  ZatcaCredentials,
  ZatcaApiResponse,
  CsidResponse,
} from '../../../src/modules/zatca/services/zatca-api.service.js';

// ── Helpers ──────────────────────────────────────────────────────────────

const mockCredentials: ZatcaCredentials = {
  csid: 'test-csid-token',
  secret: 'test-secret',
};

const mockRequestBody: ZatcaRequestBody = {
  invoiceHash: 'a1b2c3d4',
  uuid: 'uuid-123',
  invoice: 'PGludm9pY2U+PC9pbnZvaWNlPg==',
};

const mockSuccessResponse: ZatcaApiResponse = {
  status: '200',
  reportingStatus: 'REPORTED',
  validationResults: {
    status: 'PASS',
    infoMessages: [],
    warningMessages: [],
    errorMessages: [],
  },
};

const mockClearanceResponse: ZatcaApiResponse = {
  status: '200',
  clearanceStatus: 'CLEARED',
  clearedInvoice: 'Y2xlYXJlZEludm9pY2U=',
  validationResults: {
    status: 'PASS',
    infoMessages: [],
    warningMessages: [],
    errorMessages: [],
  },
};

const mockComplianceResponse: ZatcaApiResponse = {
  status: '200',
  validationResults: {
    status: 'PASS',
    infoMessages: [],
    warningMessages: [],
    errorMessages: [],
  },
};

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

function mockFetchSuccess(data: unknown, status = 200) {
  mockFetch.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  });
}

function mockFetchError(status: number, data: unknown) {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    json: () => Promise.resolve(data),
  });
}

function mockFetchNetworkError(error: Error) {
  mockFetch.mockRejectedValueOnce(error);
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('ZatcaApiService', () => {
  let service: ZatcaApiService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [ZatcaApiService],
    }).compile();
    service = module.get<ZatcaApiService>(ZatcaApiService);
  });

  // ─── checkCompliance ───────────────────────────────────────────────

  describe('checkCompliance', () => {
    it('should return successful compliance response', async () => {
      mockFetchSuccess(mockComplianceResponse);

      const result = await service.checkCompliance(
        mockRequestBody,
        mockCredentials,
      );

      expect(result).toEqual(mockComplianceResponse);
      expect(result.validationResults?.status).toBe('PASS');
    });

    it('should call correct compliance endpoint', async () => {
      mockFetchSuccess(mockComplianceResponse);

      await service.checkCompliance(mockRequestBody, mockCredentials);

      const expectedUrl = `${ZATCA_SANDBOX_BASE}${ZATCA_ENDPOINTS.complianceInvoice}`;
      expect(mockFetch).toHaveBeenCalledWith(
        expectedUrl,
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('should use custom baseUrl when provided', async () => {
      mockFetchSuccess(mockComplianceResponse);
      const customBase = 'https://custom-gateway.example.com';

      await service.checkCompliance(
        mockRequestBody,
        mockCredentials,
        customBase,
      );

      const expectedUrl = `${customBase}${ZATCA_ENDPOINTS.complianceInvoice}`;
      expect(mockFetch).toHaveBeenCalledWith(expectedUrl, expect.anything());
    });

    it('should include correct auth and version headers', async () => {
      mockFetchSuccess(mockComplianceResponse);

      await service.checkCompliance(mockRequestBody, mockCredentials);

      const callArgs = mockFetch.mock.calls[0][1] as RequestInit;
      const headers = callArgs.headers as Record<string, string>;
      const expectedAuth = `Basic ${Buffer.from(`${mockCredentials.csid}:${mockCredentials.secret}`).toString('base64')}`;

      expect(headers['Authorization']).toBe(expectedAuth);
      expect(headers['Accept-Version']).toBe(ZATCA_API_VERSION);
      expect(headers['Content-Type']).toBe('application/json');
    });

    it('should throw on API error response', async () => {
      mockFetchError(400, {
        status: '400',
        validationResults: { status: 'FAIL', errorMessages: ['Invalid hash'] },
      });

      await expect(
        service.checkCompliance(mockRequestBody, mockCredentials),
      ).rejects.toThrow('ZATCA API request failed: 400');
    });

    it('should throw on network timeout/error', async () => {
      mockFetchNetworkError(new Error('Network timeout'));

      await expect(
        service.checkCompliance(mockRequestBody, mockCredentials),
      ).rejects.toThrow('Network timeout');
    });
  });

  // ─── reportInvoice ─────────────────────────────────────────────────

  describe('reportInvoice', () => {
    it('should return successful reporting response', async () => {
      mockFetchSuccess(mockSuccessResponse);

      const result = await service.reportInvoice(
        mockRequestBody,
        mockCredentials,
      );

      expect(result).toEqual(mockSuccessResponse);
      expect(result.reportingStatus).toBe('REPORTED');
    });

    it('should call correct reporting endpoint', async () => {
      mockFetchSuccess(mockSuccessResponse);

      await service.reportInvoice(mockRequestBody, mockCredentials);

      const expectedUrl = `${ZATCA_SANDBOX_BASE}${ZATCA_ENDPOINTS.reportingInvoice}`;
      expect(mockFetch).toHaveBeenCalledWith(
        expectedUrl,
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('should use custom baseUrl when provided', async () => {
      mockFetchSuccess(mockSuccessResponse);
      const customBase = 'https://custom.example.com/api';

      await service.reportInvoice(mockRequestBody, mockCredentials, customBase);

      const expectedUrl = `${customBase}${ZATCA_ENDPOINTS.reportingInvoice}`;
      expect(mockFetch).toHaveBeenCalledWith(expectedUrl, expect.anything());
    });

    it('should throw on API rejection (e.g. 400)', async () => {
      mockFetchError(400, {
        status: '400',
        validationResults: {
          status: 'FAIL',
          errorMessages: ['Invalid invoice'],
        },
      });

      await expect(
        service.reportInvoice(mockRequestBody, mockCredentials),
      ).rejects.toThrow('ZATCA API request failed: 400');
    });

    it('should throw on network error', async () => {
      mockFetchNetworkError(new TypeError('Failed to fetch'));

      await expect(
        service.reportInvoice(mockRequestBody, mockCredentials),
      ).rejects.toThrow('Failed to fetch');
    });

    it('should send body as JSON string', async () => {
      mockFetchSuccess(mockSuccessResponse);

      await service.reportInvoice(mockRequestBody, mockCredentials);

      const callArgs = mockFetch.mock.calls[0][1] as RequestInit;
      expect(callArgs.body).toBe(JSON.stringify(mockRequestBody));
    });
  });

  // ─── clearInvoice ──────────────────────────────────────────────────

  describe('clearInvoice', () => {
    it('should return successful clearance response', async () => {
      mockFetchSuccess(mockClearanceResponse);

      const result = await service.clearInvoice(
        mockRequestBody,
        mockCredentials,
      );

      expect(result).toEqual(mockClearanceResponse);
      expect(result.clearanceStatus).toBe('CLEARED');
      expect(result.clearedInvoice).toBe('Y2xlYXJlZEludm9pY2U=');
    });

    it('should call correct clearance endpoint', async () => {
      mockFetchSuccess(mockClearanceResponse);

      await service.clearInvoice(mockRequestBody, mockCredentials);

      const expectedUrl = `${ZATCA_SANDBOX_BASE}${ZATCA_ENDPOINTS.clearanceInvoice}`;
      expect(mockFetch).toHaveBeenCalledWith(
        expectedUrl,
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('should throw on clearance rejection', async () => {
      mockFetchError(403, {
        status: '403',
        clearanceStatus: 'REJECTED',
        validationResults: {
          status: 'FAIL',
          errorMessages: ['Not authorized for clearance'],
        },
      });

      await expect(
        service.clearInvoice(mockRequestBody, mockCredentials),
      ).rejects.toThrow('ZATCA API request failed: 403');
    });

    it('should throw on network error', async () => {
      mockFetchNetworkError(new Error('ECONNREFUSED'));

      await expect(
        service.clearInvoice(mockRequestBody, mockCredentials),
      ).rejects.toThrow('ECONNREFUSED');
    });
  });

  // ─── requestComplianceCsid ─────────────────────────────────────────

  describe('requestComplianceCsid', () => {
    const mockCsidResponse: CsidResponse = {
      requestID: 'req-123',
      binarySecurityToken: 'bst-token-base64',
      secret: 'csid-secret',
      tokenType: 'Bearer',
      dispositionMessage: 'Success',
    };

    it('should return CSID response on success', async () => {
      mockFetchSuccess(mockCsidResponse);

      const result = await service.requestComplianceCsid(
        'csr-base64-string',
        '123456',
      );

      expect(result).toEqual(mockCsidResponse);
      expect(result.binarySecurityToken).toBe('bst-token-base64');
      expect(result.secret).toBe('csid-secret');
    });

    it('should send OTP in headers (not in body)', async () => {
      mockFetchSuccess(mockCsidResponse);

      await service.requestComplianceCsid('csr-base64', '654321');

      const callArgs = mockFetch.mock.calls[0][1] as RequestInit;
      const headers = callArgs.headers as Record<string, string>;
      expect(headers['OTP']).toBe('654321');
      expect(callArgs.body).toBe(JSON.stringify({ csr: 'csr-base64' }));
    });

    it('should not include Authorization header', async () => {
      mockFetchSuccess(mockCsidResponse);

      await service.requestComplianceCsid('csr', 'otp');

      const callArgs = mockFetch.mock.calls[0][1] as RequestInit;
      const headers = callArgs.headers as Record<string, string>;
      expect(headers['Authorization']).toBeUndefined();
    });

    it('should throw on API error', async () => {
      mockFetchError(401, { error: 'Invalid OTP' });

      await expect(
        service.requestComplianceCsid('csr', 'bad-otp'),
      ).rejects.toThrow('ZATCA API request failed: 401');
    });
  });

  // ─── requestProductionCsid ─────────────────────────────────────────

  describe('requestProductionCsid', () => {
    const mockProdCsidResponse: CsidResponse = {
      requestID: 'prod-req-456',
      binarySecurityToken: 'prod-bst-token',
      secret: 'prod-secret',
    };

    it('should return production CSID on success', async () => {
      mockFetchSuccess(mockProdCsidResponse);

      const result = await service.requestProductionCsid(
        'compliance-req-id',
        mockCredentials,
      );

      expect(result).toEqual(mockProdCsidResponse);
      expect(result.requestID).toBe('prod-req-456');
    });

    it('should include Basic auth header with compliance credentials', async () => {
      mockFetchSuccess(mockProdCsidResponse);

      await service.requestProductionCsid('req-id', mockCredentials);

      const callArgs = mockFetch.mock.calls[0][1] as RequestInit;
      const headers = callArgs.headers as Record<string, string>;
      const expectedAuth = `Basic ${Buffer.from(`${mockCredentials.csid}:${mockCredentials.secret}`).toString('base64')}`;
      expect(headers['Authorization']).toBe(expectedAuth);
    });

    it('should send compliance_request_id in body', async () => {
      mockFetchSuccess(mockProdCsidResponse);

      await service.requestProductionCsid('comp-req-123', mockCredentials);

      const callArgs = mockFetch.mock.calls[0][1] as RequestInit;
      expect(callArgs.body).toBe(
        JSON.stringify({ compliance_request_id: 'comp-req-123' }),
      );
    });

    it('should throw on API error', async () => {
      mockFetchError(500, { error: 'Internal Server Error' });

      await expect(
        service.requestProductionCsid('req-id', mockCredentials),
      ).rejects.toThrow('ZATCA API request failed: 500');
    });
  });

  // ─── Auth header construction ───────────────────────────────────────

  describe('auth header construction', () => {
    it('should build Basic auth from csid:secret', async () => {
      mockFetchSuccess(mockSuccessResponse);

      await service.reportInvoice(mockRequestBody, mockCredentials);

      const callArgs = mockFetch.mock.calls[0][1] as RequestInit;
      const headers = callArgs.headers as Record<string, string>;
      const expected = `Basic ${Buffer.from('test-csid-token:test-secret').toString('base64')}`;
      expect(headers['Authorization']).toBe(expected);
    });
  });
});

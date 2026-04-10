// Sandbox (developer portal)
export const ZATCA_SANDBOX_BASE =
  'https://gw-apic-gov.gazt.gov.sa/e-invoicing/developer-portal';

// Production
export const ZATCA_PRODUCTION_BASE =
  'https://gw-apic-gov.gazt.gov.sa/e-invoicing/core';

/** @deprecated Use ZATCA_SANDBOX_BASE or ZATCA_PRODUCTION_BASE directly */
export const ZATCA_API_BASE = ZATCA_SANDBOX_BASE;

export const ZATCA_ENDPOINTS = {
  complianceCsid: '/compliance/csids',
  productionCsid: '/production/csids',
  complianceInvoice: '/compliance/invoices',
  reportingInvoice: '/invoices/reporting/single',
  clearanceInvoice: '/invoices/clearance/single',
} as const;

export const ZATCA_API_VERSION = 'V2';

// QR Code TLV tag IDs (Phase 1 — 5 fields)
export const QR_TAGS = {
  SELLER_NAME: 1,
  VAT_NUMBER: 2,
  INVOICE_DATETIME: 3,
  TOTAL_WITH_VAT: 4,
  VAT_AMOUNT: 5,
} as const;

export {
  VAT_RATE_DEFAULT,
  VAT_RATE_NONE,
} from '../../../config/constants/tax.js';

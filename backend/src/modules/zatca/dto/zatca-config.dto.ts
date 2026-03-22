export interface ZatcaConfig {
  phase: 'phase1' | 'phase2';
  vatRate: number;              // 0 or 15
  vatRegistrationNumber: string;
  businessRegistration: string;
  sellerName: string;
  sellerAddress: string;
  city: string;
}

export interface GenerateZatcaDataInput {
  invoiceNumber: string;
  uuid: string;
  issueDate: string;
  issueTime: string;
  buyerName: string;
  serviceDescription: string;
  baseAmount: number;     // halalat (before VAT)
  previousInvoiceHash: string | null;
  config: ZatcaConfig;
}

export interface ZatcaInvoiceData {
  vatAmount: number;
  vatRate: number;
  totalAmount: number;
  invoiceHash: string;
  previousHash: string;
  qrCodeData: string;
  xmlContent: string | null;
  status: 'not_applicable' | 'pending' | 'reported' | 'failed';
}

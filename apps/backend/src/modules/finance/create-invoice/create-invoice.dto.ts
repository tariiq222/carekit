export interface CreateInvoiceDto {
  tenantId: string;
  branchId: string;
  clientId: string;
  employeeId: string;
  bookingId: string;
  subtotal: number;
  discountAmt?: number;
  vatRate?: number;
  notes?: string;
  dueAt?: Date;
}

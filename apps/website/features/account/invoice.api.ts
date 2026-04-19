const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5100';

export interface InvoiceDetail {
  id: string;
  branchId: string;
  clientId: string;
  employeeId: string;
  bookingId: string;
  subtotal: number;
  discountAmt: number;
  vatRate: number;
  vatAmt: number;
  total: number;
  currency: string;
  status: string;
  issuedAt: string | null;
  dueAt: string | null;
  paidAt: string | null;
  createdAt: string;
  qrCode: string | null;
  zatcaStatus: string | null;
}

export async function getInvoice(
  invoiceId: string,
  accessToken: string,
): Promise<InvoiceDetail> {
  const res = await fetch(`${API_BASE}/public/invoices/${encodeURIComponent(invoiceId)}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    credentials: 'include',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error((err as { message?: string }).message ?? 'Failed to fetch invoice');
  }
  const json = await res.json();
  return (json.data ?? json) as InvoiceDetail;
}
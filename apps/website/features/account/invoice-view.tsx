'use client';

import { useState, useEffect } from 'react';
import type { InvoiceDetail } from './invoice.api';

interface InvoiceViewProps {
  invoiceId: string;
  accessToken: string;
}

export function InvoiceView({ invoiceId, accessToken }: InvoiceViewProps) {
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchInvoice() {
      try {
        const res = await fetch(`/api/proxy/public/invoices/${encodeURIComponent(invoiceId)}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          credentials: 'include',
        });
        if (!res.ok) throw new Error('Failed to fetch invoice');
        const data = await res.json();
        setInvoice(data.data ?? data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load invoice');
      } finally {
        setIsLoading(false);
      }
    }

    fetchInvoice();
  }, [invoiceId, accessToken]);

  if (isLoading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <div style={{ opacity: 0.6 }}>Loading invoice...</div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--destructive)' }}>
        {error || 'Invoice not found'}
      </div>
    );
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('ar-SA', {
      style: 'currency',
      currency,
    }).format(amount);
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '2rem' }}>
      <div
        style={{
          background: 'var(--card)',
          borderRadius: '16px',
          border: '1px solid var(--border)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            background: 'var(--primary)',
            color: 'var(--primary-foreground)',
            padding: '1.5rem',
            textAlign: 'center',
          }}
        >
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem' }}>
            Invoice
          </h1>
          <p style={{ opacity: 0.8, fontSize: '0.875rem' }}>#{invoice.id.slice(0, 8)}</p>
        </div>

        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.875rem' }}>
            <div>
              <span style={{ opacity: 0.6, display: 'block' }}>Issue Date</span>
              <span>{formatDate(invoice.issuedAt)}</span>
            </div>
            <div>
              <span style={{ opacity: 0.6, display: 'block' }}>Status</span>
              <span
                style={{
                  color:
                    invoice.status === 'PAID'
                      ? 'var(--success)'
                      : invoice.status === 'PENDING'
                      ? 'var(--warning)'
                      : 'var(--muted-foreground)',
                }}
              >
                {invoice.status}
              </span>
            </div>
          </div>

          <div
            style={{
              borderTop: '1px solid var(--border)',
              borderBottom: '1px solid var(--border)',
              padding: '1rem 0',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              fontSize: '0.875rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ opacity: 0.6 }}>Subtotal</span>
              <span>{formatCurrency(invoice.subtotal, invoice.currency)}</span>
            </div>
            {invoice.discountAmt > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--success)' }}>
                <span>Discount</span>
                <span>-{formatCurrency(invoice.discountAmt, invoice.currency)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ opacity: 0.6 }}>VAT ({(invoice.vatRate * 100).toFixed(0)}%)</span>
              <span>{formatCurrency(invoice.vatAmt, invoice.currency)}</span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontWeight: 700,
                fontSize: '1.125rem',
                paddingTop: '0.5rem',
              }}
            >
              <span>Total</span>
              <span>{formatCurrency(invoice.total, invoice.currency)}</span>
            </div>
          </div>

          {invoice.qrCode && (
            <div style={{ textAlign: 'center', padding: '1rem', borderTop: '1px solid var(--border)' }}>
              <p style={{ fontSize: '0.75rem', opacity: 0.6, marginBottom: '0.5rem' }}>
                ZATCA QR Code
              </p>
              <img
                src={invoice.qrCode}
                alt="ZATCA QR Code"
                style={{ width: '150px', height: '150px', borderRadius: '8px' }}
              />
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', paddingTop: '0.5rem' }}>
            <button
              onClick={() => window.print()}
              style={{
                padding: '0.5rem 1rem',
                background: 'var(--primary)',
                color: 'var(--primary-foreground)',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              Print Invoice
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
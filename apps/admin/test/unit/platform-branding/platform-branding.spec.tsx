import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api-client', () => {
  class ApiError extends Error {
    constructor(message: string) { super(message); this.name = 'ApiError'; }
  }
  return { adminRequest: vi.fn(), ApiError };
});
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { adminRequest } from '@/lib/api-client';
import { BrandingForm } from '@/features/platform-branding/branding-form';

const mockBrand = {
  logoUrl: 'https://cdn.example.com/logo.svg',
  primaryColor: '#354FD8',
  accentColor: '#82CC17',
  locale: {
    default: 'ar',
    rtlDefault: true,
    dateFormat: 'dd/MM/yyyy',
    currencyFormat: 'SAR',
  },
};

describe('BrandingForm', () => {
  beforeEach(() => {
    vi.mocked(adminRequest).mockReset();
  });

  it('renders brand identity section after loading', async () => {
    vi.mocked(adminRequest).mockResolvedValue(mockBrand);
    render(<BrandingForm />);
    await waitFor(() => {
      expect(screen.getByText(/brand identity/i)).toBeInTheDocument();
    });
  });

  it('renders logo URL field with loaded value', async () => {
    vi.mocked(adminRequest).mockResolvedValue(mockBrand);
    render(<BrandingForm />);
    await waitFor(() => {
      expect(screen.getByDisplayValue('https://cdn.example.com/logo.svg')).toBeInTheDocument();
    });
  });

  it('renders locale defaults section', async () => {
    vi.mocked(adminRequest).mockResolvedValue(mockBrand);
    render(<BrandingForm />);
    await waitFor(() => {
      expect(screen.getByText(/locale defaults/i)).toBeInTheDocument();
    });
  });

  it('renders save button', async () => {
    vi.mocked(adminRequest).mockResolvedValue(mockBrand);
    render(<BrandingForm />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save branding/i })).toBeInTheDocument();
    });
  });

  it('shows error message when API fails to load', async () => {
    // Throw any error — the form catches all errors and shows a generic message
    vi.mocked(adminRequest).mockRejectedValue(new Error('Failed to load branding settings.'));
    render(<BrandingForm />);
    await waitFor(() => {
      expect(screen.getByText(/failed to load branding settings/i)).toBeInTheDocument();
    });
  });

  it('shows success message after saving', async () => {
    vi.mocked(adminRequest)
      .mockResolvedValueOnce(mockBrand) // GET
      .mockResolvedValueOnce(undefined); // PUT
    render(<BrandingForm />);
    await waitFor(() => expect(screen.getByRole('button', { name: /save branding/i })).toBeInTheDocument());
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /save branding/i }));
    await waitFor(() => {
      expect(screen.getByText(/branding settings saved/i)).toBeInTheDocument();
    });
  });

  it('shows error message when save fails', async () => {
    vi.mocked(adminRequest)
      .mockResolvedValueOnce(mockBrand) // GET
      .mockRejectedValueOnce(new Error('Save failed')); // PUT
    render(<BrandingForm />);
    await waitFor(() => expect(screen.getByRole('button', { name: /save branding/i })).toBeInTheDocument());
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /save branding/i }));
    await waitFor(() => {
      expect(screen.getByText(/save failed/i)).toBeInTheDocument();
    });
  });

  it('allows editing logo URL', async () => {
    vi.mocked(adminRequest).mockResolvedValue(mockBrand);
    render(<BrandingForm />);
    await waitFor(() => expect(screen.getByLabelText(/logo url/i)).toBeInTheDocument());
    const user = userEvent.setup();
    await user.clear(screen.getByLabelText(/logo url/i));
    await user.type(screen.getByLabelText(/logo url/i), 'https://new.example.com/logo.png');
    expect(screen.getByDisplayValue('https://new.example.com/logo.png')).toBeInTheDocument();
  });
});

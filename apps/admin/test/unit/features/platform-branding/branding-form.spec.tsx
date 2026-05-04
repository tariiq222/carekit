import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { BrandingForm } from '@/features/platform-branding/branding-form';

vi.mock('@/features/platform-branding/platform-branding.api', () => ({
  getPlatformBrand: vi.fn(),
  updatePlatformBrand: vi.fn(),
  type PlatformBrand: vi.fn(),
}));

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

const defaultBrand = {
  logoUrl: '',
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
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    const { getPlatformBrand } = vi.mocked(
      require('@/features/platform-branding/platform-branding.api'),
    );
    let resolvePromise: (value: typeof defaultBrand) => void;
    (getPlatformBrand as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise((resolve) => {
        resolvePromise = resolve;
      }),
    );

    wrap(<BrandingForm />);
    expect(screen.queryByText(/Loading.../)).not.toBeInTheDocument();
  });

  it('renders error state when load fails', async () => {
    const { getPlatformBrand } = vi.mocked(
      require('@/features/platform-branding/platform-branding.api'),
    );
    (getPlatformBrand as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Load failed'));

    wrap(<BrandingForm />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to load branding settings/i)).toBeInTheDocument();
    });
  });

  it('renders form with default values when loaded', async () => {
    const { getPlatformBrand } = vi.mocked(
      require('@/features/platform-branding/platform-branding.api'),
    );
    (getPlatformBrand as ReturnType<typeof vi.fn>).mockResolvedValue(defaultBrand);

    wrap(<BrandingForm />);

    await waitFor(() => {
      expect(screen.getByLabelText(/Logo URL/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Primary Color/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Accent Color/i)).toBeInTheDocument();
    });
  });

  it('updates logo URL field', async () => {
    const user = userEvent.setup();
    const { getPlatformBrand } = vi.mocked(
      require('@/features/platform-branding/platform-branding.api'),
    );
    (getPlatformBrand as ReturnType<typeof vi.fn>).mockResolvedValue(defaultBrand);

    wrap(<BrandingForm />);

    await waitFor(async () => {
      const logoInput = screen.getByLabelText(/Logo URL/i);
      await user.clear(logoInput);
      await user.type(logoInput, 'https://example.com/logo.svg');
      expect(logoInput).toHaveValue('https://example.com/logo.svg');
    });
  });

  it('updates primary color field', async () => {
    const user = userEvent.setup();
    const { getPlatformBrand } = vi.mocked(
      require('@/features/platform-branding/platform-branding.api'),
    );
    (getPlatformBrand as ReturnType<typeof vi.fn>).mockResolvedValue(defaultBrand);

    wrap(<BrandingForm />);

    await waitFor(async () => {
      const colorInputs = screen.getAllByDisplayValue('#354FD8');
      expect(colorInputs.length).toBeGreaterThan(0);
    });
  });

  it('updates locale default field', async () => {
    const user = userEvent.setup();
    const { getPlatformBrand } = vi.mocked(
      require('@/features/platform-branding/platform-branding.api'),
    );
    (getPlatformBrand as ReturnType<typeof vi.fn>).mockResolvedValue(defaultBrand);

    wrap(<BrandingForm />);

    await waitFor(async () => {
      const localeInput = screen.getByLabelText(/Default Locale/i);
      await user.clear(localeInput);
      await user.type(localeInput, 'en');
      expect(localeInput).toHaveValue('en');
    });
  });

  it('updates currency format field', async () => {
    const user = userEvent.setup();
    const { getPlatformBrand } = vi.mocked(
      require('@/features/platform-branding/platform-branding.api'),
    );
    (getPlatformBrand as ReturnType<typeof vi.fn>).mockResolvedValue(defaultBrand);

    wrap(<BrandingForm />);

    await waitFor(async () => {
      const currencyInput = screen.getByLabelText(/Currency Format/i);
      await user.clear(currencyInput);
      await user.type(currencyInput, 'USD');
      expect(currencyInput).toHaveValue('USD');
    });
  });

  it('updates date format field', async () => {
    const user = userEvent.setup();
    const { getPlatformBrand } = vi.mocked(
      require('@/features/platform-branding/platform-branding.api'),
    );
    (getPlatformBrand as ReturnType<typeof vi.fn>).mockResolvedValue(defaultBrand);

    wrap(<BrandingForm />);

    await waitFor(async () => {
      const dateInput = screen.getByLabelText(/Date Format/i);
      await user.clear(dateInput);
      await user.type(dateInput, 'MM/dd/yyyy');
      expect(dateInput).toHaveValue('MM/dd/yyyy');
    });
  });

  it('toggles RTL default checkbox', async () => {
    const user = userEvent.setup();
    const { getPlatformBrand } = vi.mocked(
      require('@/features/platform-branding/platform-branding.api'),
    );
    (getPlatformBrand as ReturnType<typeof vi.fn>).mockResolvedValue(defaultBrand);

    wrap(<BrandingForm />);

    await waitFor(async () => {
      const rtlCheckbox = screen.getByLabelText(/RTL by default/i);
      await user.click(rtlCheckbox);
      expect(rtlCheckbox).not.toBeChecked();
    });
  });

  it('saves branding settings successfully', async () => {
    const user = userEvent.setup();
    const { getPlatformBrand, updatePlatformBrand } = vi.mocked(
      require('@/features/platform-branding/platform-branding.api'),
    );
    (getPlatformBrand as ReturnType<typeof vi.fn>).mockResolvedValue(defaultBrand);
    (updatePlatformBrand as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    wrap(<BrandingForm />);

    await waitFor(async () => {
      const saveButton = screen.getByRole('button', { name: /save branding settings/i });
      await user.click(saveButton);
    });

    await waitFor(() => {
      expect(updatePlatformBrand).toHaveBeenCalled();
    });
  });

  it('shows error message when save fails', async () => {
    const user = userEvent.setup();
    const { getPlatformBrand, updatePlatformBrand } = vi.mocked(
      require('@/features/platform-branding/platform-branding.api'),
    );
    (getPlatformBrand as ReturnType<typeof vi.fn>).mockResolvedValue(defaultBrand);
    (updatePlatformBrand as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Save failed'));

    wrap(<BrandingForm />);

    await waitFor(async () => {
      const saveButton = screen.getByRole('button', { name: /save branding settings/i });
      await user.click(saveButton);
    });

    await waitFor(() => {
      expect(screen.getByText(/Save failed/i)).toBeInTheDocument();
    });
  });

  it('disables save button while saving', async () => {
    const user = userEvent.setup();
    const { getPlatformBrand, updatePlatformBrand } = vi.mocked(
      require('@/features/platform-branding/platform-branding.api'),
    );
    (getPlatformBrand as ReturnType<typeof vi.fn>).mockResolvedValue(defaultBrand);
    (updatePlatformBrand as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(undefined), 100)),
    );

    wrap(<BrandingForm />);

    await waitFor(async () => {
      const saveButton = screen.getByRole('button', { name: /save branding settings/i });
      await user.click(saveButton);
      expect(saveButton).toBeDisabled();
    });
  });
});
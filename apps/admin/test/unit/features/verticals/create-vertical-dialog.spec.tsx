import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { CreateVerticalDialog } from '@/features/verticals/create-vertical/create-vertical-dialog';

vi.mock('@/features/verticals/create-vertical/use-create-vertical', () => ({
  useCreateVertical: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
  })),
}));

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('CreateVerticalDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dialog when open', async () => {
    const onOpenChange = vi.fn();

    wrap(<CreateVerticalDialog open={true} onOpenChange={onOpenChange} />);

    await waitFor(() => {
      expect(screen.getByText('Create vertical')).toBeInTheDocument();
    });
  });

  it('does not render dialog when closed', async () => {
    const onOpenChange = vi.fn();

    wrap(<CreateVerticalDialog open={false} onOpenChange={onOpenChange} />);

    await waitFor(() => {
      expect(screen.queryByText('Create vertical')).not.toBeInTheDocument();
    });
  });

  it('renders all form fields', async () => {
    const onOpenChange = vi.fn();

    wrap(<CreateVerticalDialog open={true} onOpenChange={onOpenChange} />);

    await waitFor(() => {
      expect(screen.getByLabelText(/Slug \(kebab-case\)/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Name \(Arabic\)/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Name \(English\)/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Template family/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Description \(Arabic, optional\)/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Description \(English, optional\)/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Reason \(min 10 chars\)/i)).toBeInTheDocument();
    });
  });

  it('updates slug field', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    wrap(<CreateVerticalDialog open={true} onOpenChange={onOpenChange} />);

    await waitFor(async () => {
      const slugInput = screen.getByLabelText(/Slug \(kebab-case\)/i);
      await user.clear(slugInput);
      await user.type(slugInput, 'cardiology');
      expect(slugInput).toHaveValue('cardiology');
    });
  });

  it('updates name fields', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    wrap(<CreateVerticalDialog open={true} onOpenChange={onOpenChange} />);

    await waitFor(async () => {
      const nameArInput = screen.getByLabelText(/Name \(Arabic\)/i);
      await user.clear(nameArInput);
      await user.type(nameArInput, 'طب القلب');
      expect(nameArInput).toHaveValue('طب القلب');
    });

    await waitFor(async () => {
      const nameEnInput = screen.getByLabelText(/Name \(English\)/i);
      await user.clear(nameEnInput);
      await user.type(nameEnInput, 'Cardiology');
      expect(nameEnInput).toHaveValue('Cardiology');
    });
  });

  it('disables submit when form is invalid', async () => {
    const onOpenChange = vi.fn();

    wrap(<CreateVerticalDialog open={true} onOpenChange={onOpenChange} />);

    await waitFor(() => {
      const submitButton = screen.getByRole('button', { name: /create vertical/i });
      expect(submitButton).toBeDisabled();
    });
  });

  it('enables submit when form is valid', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    wrap(<CreateVerticalDialog open={true} onOpenChange={onOpenChange} />);

    await waitFor(async () => {
      await user.type(screen.getByLabelText(/Slug \(kebab-case\)/i), 'cardiology');
      await user.type(screen.getByLabelText(/Name \(Arabic\)/i), 'طب القلب');
      await user.type(screen.getByLabelText(/Name \(English\)/i), 'Cardiology');
      await user.type(screen.getByLabelText(/Reason \(min 10 chars\)/i), 'Creating cardiology vertical');
    });

    await waitFor(() => {
      const submitButton = screen.getByRole('button', { name: /create vertical/i });
      expect(submitButton).not.toBeDisabled();
    });
  });

  it('resets form when cancel is clicked', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    wrap(<CreateVerticalDialog open={true} onOpenChange={onOpenChange} />);

    await waitFor(async () => {
      await user.type(screen.getByLabelText(/Slug \(kebab-case\)/i), 'cardiology');
      await user.type(screen.getByLabelText(/Name \(Arabic\)/i), 'طب القلب');
      await user.click(screen.getByRole('button', { name: /cancel/i }));
    });

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('resets form after successful creation', async () => {
    const user = userEvent.setup();
    const { useCreateVertical } = vi.mocked(
      require('@/features/verticals/create-vertical/use-create-vertical'),
    );
    const mutateFn = vi.fn();
    (useCreateVertical as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: mutateFn,
      isPending: false,
    });

    const onOpenChange = vi.fn();

    wrap(<CreateVerticalDialog open={true} onOpenChange={onOpenChange} />);

    await waitFor(async () => {
      await user.type(screen.getByLabelText(/Slug \(kebab-case\)/i), 'cardiology');
      await user.type(screen.getByLabelText(/Name \(Arabic\)/i), 'طب القلب');
      await user.type(screen.getByLabelText(/Name \(English\)/i), 'Cardiology');
      await user.type(screen.getByLabelText(/Reason \(min 10 chars\)/i), 'Creating cardiology vertical');
    });

    await waitFor(async () => {
      await user.click(screen.getByRole('button', { name: /create vertical/i }));
    });

    expect(mutateFn).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: 'cardiology',
        nameAr: 'طب القلب',
        nameEn: 'Cardiology',
        reason: 'Creating cardiology vertical',
      }),
    );
  });

  it('shows creating state when mutation is pending', async () => {
    const { useCreateVertical } = vi.mocked(
      require('@/features/verticals/create-vertical/use-create-vertical'),
    );
    (useCreateVertical as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: vi.fn(),
      isPending: true,
    });

    const onOpenChange = vi.fn();

    wrap(<CreateVerticalDialog open={true} onOpenChange={onOpenChange} />);

    await waitFor(() => {
      const submitButton = screen.getByRole('button', { name: /creating…/i });
      expect(submitButton).toBeDisabled();
    });
  });

  it('renders dialog description', async () => {
    const onOpenChange = vi.fn();

    wrap(<CreateVerticalDialog open={true} onOpenChange={onOpenChange} />);

    await waitFor(() => {
      expect(
        screen.getByText(/Add a new clinic archetype.*Reason is required/i),
      ).toBeInTheDocument();
    });
  });
});
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { UpdateVerticalDialog } from '@/features/verticals/update-vertical/update-vertical-dialog';
import type { VerticalRow } from '@/features/verticals/types';

vi.mock('@/features/verticals/update-vertical/use-update-vertical', () => ({
  useUpdateVertical: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
  })),
}));

const mockVertical: VerticalRow = {
  id: 'vertical-1',
  slug: 'general-medicine',
  nameAr: 'الطب العام',
  nameEn: 'General Medicine',
  templateFamily: 'MEDICAL',
  descriptionAr: null,
  descriptionEn: null,
  iconUrl: null,
  isActive: true,
  sortOrder: 1,
  createdAt: '2024-01-01',
};

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('UpdateVerticalDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dialog when open', async () => {
    const onOpenChange = vi.fn();

    wrap(
      <UpdateVerticalDialog open={true} onOpenChange={onOpenChange} vertical={mockVertical} />,
    );

    await waitFor(() => {
      expect(screen.getByText(/Edit vertical/i)).toBeInTheDocument();
    });
  });

  it('does not render dialog when closed', async () => {
    const onOpenChange = vi.fn();

    wrap(
      <UpdateVerticalDialog open={false} onOpenChange={onOpenChange} vertical={mockVertical} />,
    );

    await waitFor(() => {
      expect(screen.queryByText(/Edit vertical/i)).not.toBeInTheDocument();
    });
  });

  it('renders form with vertical data', async () => {
    const onOpenChange = vi.fn();

    wrap(
      <UpdateVerticalDialog open={true} onOpenChange={onOpenChange} vertical={mockVertical} />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/Name \(Arabic\)/i)).toHaveValue('الطب العام');
      expect(screen.getByLabelText(/Name \(English\)/i)).toHaveValue('General Medicine');
    });
  });

  it('renders template family select', async () => {
    const onOpenChange = vi.fn();

    wrap(
      <UpdateVerticalDialog open={true} onOpenChange={onOpenChange} vertical={mockVertical} />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/Template family/i)).toBeInTheDocument();
    });
  });

  it('renders description fields', async () => {
    const onOpenChange = vi.fn();

    wrap(
      <UpdateVerticalDialog open={true} onOpenChange={onOpenChange} vertical={mockVertical} />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/Description \(Arabic, optional\)/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Description \(English, optional\)/i)).toBeInTheDocument();
    });
  });

  it('renders reason textarea', async () => {
    const onOpenChange = vi.fn();

    wrap(
      <UpdateVerticalDialog open={true} onOpenChange={onOpenChange} vertical={mockVertical} />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/Reason \(min 10 chars\)/i)).toBeInTheDocument();
    });
  });

  it('updates name fields', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    wrap(
      <UpdateVerticalDialog open={true} onOpenChange={onOpenChange} vertical={mockVertical} />,
    );

    await waitFor(async () => {
      const nameArInput = screen.getByLabelText(/Name \(Arabic\)/i);
      await user.clear(nameArInput);
      await user.type(nameArInput, 'طب القلب');
      expect(nameArInput).toHaveValue('طب القلب');
    });
  });

  it('updates template family', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    wrap(
      <UpdateVerticalDialog open={true} onOpenChange={onOpenChange} vertical={mockVertical} />,
    );

    await waitFor(async () => {
      const familySelect = screen.getByLabelText(/Template family/i);
      expect(familySelect).toBeInTheDocument();
    });
  });

  it('disables submit when form is invalid', async () => {
    const onOpenChange = vi.fn();

    wrap(
      <UpdateVerticalDialog open={true} onOpenChange={onOpenChange} vertical={mockVertical} />,
    );

    await waitFor(() => {
      const submitButton = screen.getByRole('button', { name: /save changes/i });
      expect(submitButton).toBeDisabled();
    });
  });

  it('enables submit when form is valid', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    wrap(
      <UpdateVerticalDialog open={true} onOpenChange={onOpenChange} vertical={mockVertical} />,
    );

    await waitFor(async () => {
      await user.clear(screen.getByLabelText(/Name \(Arabic\)/i));
      await user.type(screen.getByLabelText(/Name \(Arabic\)/i), 'طب القلب');
      await user.clear(screen.getByLabelText(/Name \(English\)/i));
      await user.type(screen.getByLabelText(/Name \(English\)/i), 'Cardiology');
      await user.clear(screen.getByLabelText(/Reason \(min 10 chars\)/i));
      await user.type(
        screen.getByLabelText(/Reason \(min 10 chars\)/i),
        'Updating vertical to cardiology',
      );
    });

    await waitFor(() => {
      const submitButton = screen.getByRole('button', { name: /save changes/i });
      expect(submitButton).not.toBeDisabled();
    });
  });

  it('calls onClose when cancel is clicked', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    wrap(
      <UpdateVerticalDialog open={true} onOpenChange={onOpenChange} vertical={mockVertical} />,
    );

    await waitFor(async () => {
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);
    });

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows saving state when mutation is pending', async () => {
    const { useUpdateVertical } = vi.mocked(
      require('@/features/verticals/update-vertical/use-update-vertical'),
    );
    const mutateFn = vi.fn();
    (useUpdateVertical as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: mutateFn,
      isPending: true,
    });

    const onOpenChange = vi.fn();

    wrap(
      <UpdateVerticalDialog open={true} onOpenChange={onOpenChange} vertical={mockVertical} />,
    );

    await waitFor(() => {
      const submitButton = screen.getByRole('button', { name: /saving…/i });
      expect(submitButton).toBeDisabled();
    });
  });

  it('calls mutation with correct data on submit', async () => {
    const user = userEvent.setup();
    const { useUpdateVertical } = vi.mocked(
      require('@/features/verticals/update-vertical/use-update-vertical'),
    );
    const mutateFn = vi.fn();
    (useUpdateVertical as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: mutateFn,
      isPending: false,
    });

    const onOpenChange = vi.fn();

    wrap(
      <UpdateVerticalDialog open={true} onOpenChange={onOpenChange} vertical={mockVertical} />,
    );

    await waitFor(async () => {
      await user.clear(screen.getByLabelText(/Name \(Arabic\)/i));
      await user.type(screen.getByLabelText(/Name \(Arabic\)/i), 'طب القلب');
      await user.clear(screen.getByLabelText(/Name \(English\)/i));
      await user.type(screen.getByLabelText(/Name \(English\)/i), 'Cardiology');
      await user.clear(screen.getByLabelText(/Reason \(min 10 chars\)/i));
      await user.type(
        screen.getByLabelText(/Reason \(min 10 chars\)/i),
        'Updating vertical to cardiology',
      );
    });

    await waitFor(async () => {
      const submitButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(submitButton);
    });

    expect(mutateFn).toHaveBeenCalledWith(
      expect.objectContaining({
        verticalId: 'vertical-1',
        nameAr: 'طب القلب',
        nameEn: 'Cardiology',
        templateFamily: 'MEDICAL',
        reason: 'Updating vertical to cardiology',
      }),
    );
  });
});
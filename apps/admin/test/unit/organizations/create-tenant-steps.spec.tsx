import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import { OrgStep, isOrgStepValid } from '@/features/organizations/create-tenant/steps/org-step';
import { OwnerStep, isOwnerStepValid } from '@/features/organizations/create-tenant/steps/owner-step';
import { PlanStep, isPlanStepValid } from '@/features/organizations/create-tenant/steps/plan-step';
import { ReviewStep, isReviewStepValid } from '@/features/organizations/create-tenant/steps/review-step';
import type { WizardForm } from '@/features/organizations/create-tenant/create-tenant-dialog';

vi.mock('@/lib/api-client', () => ({ adminRequest: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock('@/features/verticals/list-verticals/use-list-verticals', () => ({
  useListVerticals: () => ({
    data: [{ slug: 'general', nameAr: 'عام', nameEn: 'General', isActive: true }],
  }),
}));

vi.mock('@/features/plans/list-plans/use-list-plans', () => ({
  useListPlans: () => ({
    data: [{ id: 'plan-basic', slug: 'basic', nameAr: 'الأساسية', nameEn: 'Basic', isActive: true }],
  }),
}));

vi.mock('@/features/users/search-users/use-search-users', () => ({
  useSearchUsers: () => ({
    data: {
      items: [{ id: '11111111-1111-4111-8111-111111111111', name: 'Test User', email: 'test@example.com' }],
      meta: { total: 1, page: 1, perPage: 10, totalPages: 1 },
    },
    isFetching: false,
  }),
}));

const MESSAGES = {
  organizations: {
    create: {
      slug: 'Slug',
      slugPlaceholder: 'riyadh-clinic',
      nameAr: 'Arabic name',
      nameEn: 'English name',
      verticalSlug: 'Vertical slug',
      ownerUserId: 'Owner user ID',
      ownerModeExisting: 'Existing user',
      ownerModeNew: 'New user',
      ownerName: 'Full name',
      ownerEmail: 'Email address',
      ownerPhone: 'Phone (optional)',
      ownerPassword: 'Temporary password',
      ownerPasswordHint: 'Leave blank to auto-generate and email a password.',
      planId: 'Plan ID',
      billingCycle: 'Billing cycle',
      monthly: 'Monthly',
      annual: 'Annual',
      trialDays: 'Trial days',
      reviewOwner: 'Owner',
      reviewOrg: 'Organization',
      reviewPlan: 'Plan & Billing',
      noPlan: 'No plan selected',
      noVertical: 'No vertical selected',
      editStep: 'Edit',
    },
  },
};

const DEFAULT_FORM: WizardForm = {
  ownerMode: 'existing',
  ownerUserId: '',
  ownerLabel: '',
  ownerName: '',
  ownerEmail: '',
  ownerPhone: '',
  ownerPassword: '',
  slug: '',
  nameAr: '',
  nameEn: '',
  verticalSlug: '',
  planId: '',
  billingCycle: 'MONTHLY',
  trialDays: '14',
};

function makeQc() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={MESSAGES}>
      <QueryClientProvider client={makeQc()}>{children}</QueryClientProvider>
    </NextIntlClientProvider>
  );
}

// ─── isOrgStepValid ───────────────────────────────────────────────────────────

describe('isOrgStepValid', () => {
  it('returns false when slug is empty', () => {
    expect(isOrgStepValid({ ...DEFAULT_FORM, slug: '', nameAr: 'عيادة' })).toBe(false);
  });

  it('returns false when slug has invalid chars (uppercase)', () => {
    expect(isOrgStepValid({ ...DEFAULT_FORM, slug: 'MyClinic', nameAr: 'عيادة' })).toBe(false);
  });

  it('returns false when nameAr has fewer than 2 chars', () => {
    expect(isOrgStepValid({ ...DEFAULT_FORM, slug: 'my-clinic', nameAr: 'ع' })).toBe(false);
  });

  it('returns true for valid slug and nameAr', () => {
    expect(isOrgStepValid({ ...DEFAULT_FORM, slug: 'riyadh-clinic', nameAr: 'عيادة الرياض' })).toBe(true);
  });

  it('returns false for slug with spaces', () => {
    expect(isOrgStepValid({ ...DEFAULT_FORM, slug: 'my clinic', nameAr: 'عيادة' })).toBe(false);
  });
});

// ─── OrgStep component ────────────────────────────────────────────────────────

describe('OrgStep component', () => {
  it('renders slug and nameAr inputs', () => {
    const set = vi.fn(() => vi.fn());
    render(
      <Wrapper>
        <OrgStep form={DEFAULT_FORM} set={set} />
      </Wrapper>,
    );
    expect(screen.getByLabelText(/^slug$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/arabic name/i)).toBeInTheDocument();
  });

  it('calls set when slug input changes', async () => {
    const user = userEvent.setup();
    const innerFn = vi.fn();
    const set = vi.fn(() => innerFn);
    render(
      <Wrapper>
        <OrgStep form={DEFAULT_FORM} set={set} />
      </Wrapper>,
    );
    await user.type(screen.getByLabelText(/^slug$/i), 'r');
    expect(set).toHaveBeenCalledWith('slug');
  });

  it('renders vertical select with active verticals', () => {
    const set = vi.fn(() => vi.fn());
    render(
      <Wrapper>
        <OrgStep form={DEFAULT_FORM} set={set} />
      </Wrapper>,
    );
    expect(screen.getByLabelText(/vertical slug/i)).toBeInTheDocument();
  });
});

// ─── isOwnerStepValid ─────────────────────────────────────────────────────────

describe('isOwnerStepValid', () => {
  it('returns false for existing mode when ownerUserId is empty', () => {
    expect(isOwnerStepValid({ ...DEFAULT_FORM, ownerMode: 'existing', ownerUserId: '' })).toBe(false);
  });

  it('returns false for existing mode when ownerUserId is not a valid UUID', () => {
    expect(isOwnerStepValid({ ...DEFAULT_FORM, ownerMode: 'existing', ownerUserId: 'not-a-uuid' })).toBe(false);
  });

  it('returns true for existing mode with valid UUID', () => {
    expect(
      isOwnerStepValid({
        ...DEFAULT_FORM,
        ownerMode: 'existing',
        ownerUserId: '11111111-1111-4111-8111-111111111111',
      }),
    ).toBe(true);
  });

  it('returns false for new mode when ownerName is empty', () => {
    expect(
      isOwnerStepValid({
        ...DEFAULT_FORM,
        ownerMode: 'new',
        ownerName: '',
        ownerEmail: 'test@example.com',
      }),
    ).toBe(false);
  });

  it('returns false for new mode when ownerEmail is invalid', () => {
    expect(
      isOwnerStepValid({
        ...DEFAULT_FORM,
        ownerMode: 'new',
        ownerName: 'Dr. Ahmed',
        ownerEmail: 'not-an-email',
      }),
    ).toBe(false);
  });

  it('returns true for new mode with valid name and email (blank password is ok)', () => {
    expect(
      isOwnerStepValid({
        ...DEFAULT_FORM,
        ownerMode: 'new',
        ownerName: 'Dr. Ahmed',
        ownerEmail: 'ahmed@clinic.com',
        ownerPassword: '',
      }),
    ).toBe(true);
  });

  it('returns false for new mode when password is too short', () => {
    expect(
      isOwnerStepValid({
        ...DEFAULT_FORM,
        ownerMode: 'new',
        ownerName: 'Dr. Ahmed',
        ownerEmail: 'ahmed@clinic.com',
        ownerPassword: 'short1A',
      }),
    ).toBe(false);
  });
});

// ─── OwnerStep component ──────────────────────────────────────────────────────

describe('OwnerStep component', () => {
  it('shows existing user mode by default', () => {
    const set = vi.fn(() => vi.fn());
    render(
      <Wrapper>
        <OwnerStep form={DEFAULT_FORM} set={set} />
      </Wrapper>,
    );
    expect(screen.getByRole('button', { name: /existing user/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /new user/i })).toBeInTheDocument();
  });

  it('shows name/email inputs in new owner mode', () => {
    const set = vi.fn(() => vi.fn());
    render(
      <Wrapper>
        <OwnerStep form={{ ...DEFAULT_FORM, ownerMode: 'new' }} set={set} />
      </Wrapper>,
    );
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
  });
});

// ─── isPlanStepValid ──────────────────────────────────────────────────────────

describe('isPlanStepValid', () => {
  it('returns true when trialDays is empty (treated as 0)', () => {
    expect(isPlanStepValid({ ...DEFAULT_FORM, trialDays: '' })).toBe(true);
  });

  it('returns true when trialDays is 0', () => {
    expect(isPlanStepValid({ ...DEFAULT_FORM, trialDays: '0' })).toBe(true);
  });

  it('returns true when trialDays is 14', () => {
    expect(isPlanStepValid({ ...DEFAULT_FORM, trialDays: '14' })).toBe(true);
  });

  it('returns true when trialDays is 90 (max)', () => {
    expect(isPlanStepValid({ ...DEFAULT_FORM, trialDays: '90' })).toBe(true);
  });

  it('returns false when trialDays is 91 (over max)', () => {
    expect(isPlanStepValid({ ...DEFAULT_FORM, trialDays: '91' })).toBe(false);
  });

  it('returns false when trialDays is -1 (negative)', () => {
    expect(isPlanStepValid({ ...DEFAULT_FORM, trialDays: '-1' })).toBe(false);
  });

  it('returns false when trialDays is not a number', () => {
    expect(isPlanStepValid({ ...DEFAULT_FORM, trialDays: 'abc' })).toBe(false);
  });
});

// ─── PlanStep component ───────────────────────────────────────────────────────

describe('PlanStep component', () => {
  it('renders plan select with active plans', () => {
    const set = vi.fn(() => vi.fn());
    render(
      <Wrapper>
        <PlanStep form={DEFAULT_FORM} set={set} />
      </Wrapper>,
    );
    expect(screen.getByLabelText(/plan id/i)).toBeInTheDocument();
  });

  it('renders trial days input', () => {
    const set = vi.fn(() => vi.fn());
    render(
      <Wrapper>
        <PlanStep form={DEFAULT_FORM} set={set} />
      </Wrapper>,
    );
    expect(screen.getByLabelText(/trial days/i)).toBeInTheDocument();
  });
});

// ─── isReviewStepValid ────────────────────────────────────────────────────────

describe('isReviewStepValid', () => {
  it('always returns true', () => {
    expect(isReviewStepValid(DEFAULT_FORM)).toBe(true);
  });
});

// ─── ReviewStep component ─────────────────────────────────────────────────────

describe('ReviewStep component', () => {
  const reviewProps = {
    form: {
      ...DEFAULT_FORM,
      slug: 'new-clinic',
      nameAr: 'عيادة جديدة',
      ownerMode: 'existing' as const,
      ownerUserId: '11111111-1111-4111-8111-111111111111',
      ownerLabel: 'Dr. Ahmed',
    },
    onEditStep: vi.fn() as (step: 1 | 2 | 3) => void,
    errorMessage: null,
  };

  it('renders owner, org, and plan summary cards', () => {
    render(
      <Wrapper>
        <ReviewStep {...reviewProps} />
      </Wrapper>,
    );
    expect(screen.getByText('Owner')).toBeInTheDocument();
    expect(screen.getByText('Organization')).toBeInTheDocument();
    expect(screen.getByText('Plan & Billing')).toBeInTheDocument();
  });

  it('shows org slug in summary', () => {
    render(
      <Wrapper>
        <ReviewStep {...reviewProps} />
      </Wrapper>,
    );
    expect(screen.getByText('new-clinic')).toBeInTheDocument();
  });

  it('shows error message when errorMessage prop is set', () => {
    render(
      <Wrapper>
        <ReviewStep {...reviewProps} errorMessage="Something went wrong" />
      </Wrapper>,
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('calls onEditStep(1) when Owner edit button is clicked', async () => {
    const user = userEvent.setup();
    const onEditStep = vi.fn();
    render(
      <Wrapper>
        <ReviewStep {...reviewProps} onEditStep={onEditStep} />
      </Wrapper>,
    );
    const editButtons = screen.getAllByRole('button', { name: /edit/i });
    await user.click(editButtons[0]);
    expect(onEditStep).toHaveBeenCalledWith(1);
  });

  it('shows new owner summary (name — email) when ownerMode is new', () => {
    render(
      <Wrapper>
        <ReviewStep
          form={{
            ...DEFAULT_FORM,
            slug: 'new-clinic',
            nameAr: 'عيادة جديدة',
            ownerMode: 'new',
            ownerName: 'أحمد محمد',
            ownerEmail: 'ahmed@clinic.com',
          }}
          onEditStep={vi.fn()}
          errorMessage={null}
        />
      </Wrapper>,
    );
    expect(screen.getByText('أحمد محمد — ahmed@clinic.com')).toBeInTheDocument();
  });
});

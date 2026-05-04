/**
 * Additional step component tests — focusing on Select interactions
 * (Radix UI Select requires pointer polyfills in jsdom)
 * Kept separate to stay under the 350-line file cap.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OrgStep } from '@/features/organizations/create-tenant/steps/org-step';
import { OwnerStep } from '@/features/organizations/create-tenant/steps/owner-step';
import { PlanStep } from '@/features/organizations/create-tenant/steps/plan-step';
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
    data: { items: [], meta: { total: 0, page: 1, perPage: 10, totalPages: 0 } },
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

beforeEach(() => {
  if (!HTMLElement.prototype.hasPointerCapture) {
    HTMLElement.prototype.hasPointerCapture = () => false;
  }
  if (!HTMLElement.prototype.setPointerCapture) {
    HTMLElement.prototype.setPointerCapture = () => undefined;
  }
  if (!HTMLElement.prototype.releasePointerCapture) {
    HTMLElement.prototype.releasePointerCapture = () => undefined;
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => undefined;
  }
});

// ─── OrgStep Select interactions ──────────────────────────────────────────────

describe('OrgStep — vertical Select interaction', () => {
  it('calls set("verticalSlug") when vertical is selected', async () => {
    const user = userEvent.setup();
    const innerFn = vi.fn();
    const set = vi.fn(() => innerFn);
    render(
      <Wrapper>
        <OrgStep form={DEFAULT_FORM} set={set} />
      </Wrapper>,
    );
    const [trigger] = screen.getAllByRole('combobox');
    await user.click(trigger);
    const option = await screen.findByRole('option', { name: /عام \(general\)/i });
    await user.click(option);
    expect(set).toHaveBeenCalledWith('verticalSlug');
    expect(innerFn).toHaveBeenCalledWith('general');
  });

  it('calls set("verticalSlug")("") when None is selected', async () => {
    const user = userEvent.setup();
    const innerFn = vi.fn();
    const set = vi.fn(() => innerFn);
    render(
      <Wrapper>
        <OrgStep form={{ ...DEFAULT_FORM, verticalSlug: 'general' }} set={set} />
      </Wrapper>,
    );
    const [trigger] = screen.getAllByRole('combobox');
    await user.click(trigger);
    const option = await screen.findByRole('option', { name: /— none —/i });
    await user.click(option);
    expect(innerFn).toHaveBeenCalledWith('');
  });
});

// ─── PlanStep Select interactions ─────────────────────────────────────────────

describe('PlanStep — plan Select interaction', () => {
  it('calls set("planId") with plan id when plan is selected', async () => {
    const user = userEvent.setup();
    const innerFn = vi.fn();
    const set = vi.fn(() => innerFn);
    render(
      <Wrapper>
        <PlanStep form={DEFAULT_FORM} set={set} />
      </Wrapper>,
    );
    const [planTrigger] = screen.getAllByRole('combobox');
    await user.click(planTrigger);
    const option = await screen.findByRole('option', { name: /الأساسية — basic/i });
    await user.click(option);
    expect(set).toHaveBeenCalledWith('planId');
    expect(innerFn).toHaveBeenCalledWith('plan-basic');
  });

  it('calls set("planId")("") when None plan is selected', async () => {
    const user = userEvent.setup();
    const innerFn = vi.fn();
    const set = vi.fn(() => innerFn);
    render(
      <Wrapper>
        <PlanStep form={{ ...DEFAULT_FORM, planId: 'plan-basic' }} set={set} />
      </Wrapper>,
    );
    const [planTrigger] = screen.getAllByRole('combobox');
    await user.click(planTrigger);
    const option = await screen.findByRole('option', { name: /— none —/i });
    await user.click(option);
    expect(innerFn).toHaveBeenCalledWith('');
  });

  it('calls set("billingCycle") when billing cycle is changed to Annual', async () => {
    const user = userEvent.setup();
    const innerFn = vi.fn();
    const set = vi.fn(() => innerFn);
    render(
      <Wrapper>
        <PlanStep form={DEFAULT_FORM} set={set} />
      </Wrapper>,
    );
    const [, billingTrigger] = screen.getAllByRole('combobox');
    await user.click(billingTrigger);
    const option = await screen.findByRole('option', { name: /annual/i });
    await user.click(option);
    expect(set).toHaveBeenCalledWith('billingCycle');
    expect(innerFn).toHaveBeenCalledWith('ANNUAL');
  });

  it('calls set("trialDays") when trial days input changes', async () => {
    const user = userEvent.setup();
    const innerFn = vi.fn();
    const set = vi.fn(() => innerFn);
    render(
      <Wrapper>
        <PlanStep form={DEFAULT_FORM} set={set} />
      </Wrapper>,
    );
    await user.clear(screen.getByLabelText(/trial days/i));
    await user.type(screen.getByLabelText(/trial days/i), '30');
    expect(set).toHaveBeenCalledWith('trialDays');
  });
});

// ─── OwnerStep mode switching ─────────────────────────────────────────────────

describe('OwnerStep — mode switching', () => {
  it('calls set("ownerMode") with "existing" when Existing user button clicked', async () => {
    const user = userEvent.setup();
    const innerFn = vi.fn();
    const set = vi.fn(() => innerFn);
    render(
      <Wrapper>
        <OwnerStep form={{ ...DEFAULT_FORM, ownerMode: 'new' }} set={set} />
      </Wrapper>,
    );
    await user.click(screen.getByRole('button', { name: /existing user/i }));
    expect(set).toHaveBeenCalledWith('ownerMode');
    expect(innerFn).toHaveBeenCalledWith('existing');
  });

  it('calls set("ownerMode") with "new" when New user button clicked', async () => {
    const user = userEvent.setup();
    const innerFn = vi.fn();
    const set = vi.fn(() => innerFn);
    render(
      <Wrapper>
        <OwnerStep form={DEFAULT_FORM} set={set} />
      </Wrapper>,
    );
    await user.click(screen.getByRole('button', { name: /new user/i }));
    expect(set).toHaveBeenCalledWith('ownerMode');
    expect(innerFn).toHaveBeenCalledWith('new');
  });

  it('calls set("ownerPassword") when password field changes in new mode', async () => {
    const user = userEvent.setup();
    const innerFn = vi.fn();
    const set = vi.fn(() => innerFn);
    render(
      <Wrapper>
        <OwnerStep form={{ ...DEFAULT_FORM, ownerMode: 'new' }} set={set} />
      </Wrapper>,
    );
    await user.type(screen.getByLabelText(/temporary password/i), 'Pass123!');
    expect(set).toHaveBeenCalledWith('ownerPassword');
  });
});

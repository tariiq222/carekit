import { useTranslations } from 'next-intl';
import type { SubscriptionPlan } from './subscriptions.api';

interface SubscriptionCardProps {
  plan: SubscriptionPlan;
  onSelect?: (plan: SubscriptionPlan) => void;
  isSelected?: boolean;
}

export function SubscriptionCard({ plan, onSelect, isSelected }: SubscriptionCardProps) {
  const t = useTranslations();

  const formatPrice = (price: number, currency: string) => {
    return new Intl.NumberFormat('ar-SA', {
      style: 'currency',
      currency,
    }).format(price);
  };

  const getBenefitLabel = (benefit: { type: string; value: number }) => {
    switch (benefit.type) {
      case 'DISCOUNT_PERCENT':
        return `${benefit.value}% discount`;
      case 'DISCOUNT_FIXED':
        return `${formatPrice(benefit.value, plan.currency)} discount`;
      case 'SESSION_CREDITS':
        return `${benefit.value} session credits`;
      case 'FREE_SESSIONS':
        return `${benefit.value} free sessions`;
      default:
        return benefit.type;
    }
  };

  return (
    <div
      className={`relative rounded-2xl border p-6 transition-all ${
        isSelected
          ? 'border-primary bg-primary/5 shadow-lg'
          : 'border-border bg-card hover:border-primary/50 hover:shadow-md'
      }`}
      onClick={() => onSelect?.(plan)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect?.(plan)}
    >
      {isSelected && (
        <div className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}

      <div className="mb-4">
        <h3 className="text-lg font-semibold">{plan.nameAr}</h3>
        {plan.nameEn && <p className="text-sm text-muted-foreground">{plan.nameEn}</p>}
      </div>

      <div className="mb-4">
        <span className="text-3xl font-bold">{formatPrice(plan.price, plan.currency)}</span>
        <span className="text-muted-foreground">/{plan.durationDays} days</span>
      </div>

      {plan.descriptionAr && (
        <p className="mb-4 text-sm text-muted-foreground">{plan.descriptionAr}</p>
      )}

      {plan.benefits.length > 0 && (
        <ul className="space-y-2">
          {plan.benefits.map((benefit, index) => (
            <li key={index} className="flex items-center gap-2 text-sm">
              <svg className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {getBenefitLabel(benefit)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
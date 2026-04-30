export type ProrationInput = {
  currentPriceSar: string | number;
  targetPriceSar: string | number;
  periodStart: Date;
  periodEnd: Date;
  now?: Date;
};

export type ProrationResult = {
  amountSar: string;
  amountHalalas: number;
  remainingRatio: number;
  periodStart: Date;
  periodEnd: Date;
  isUpgrade: boolean;
};

const HALALAS_PER_SAR = 100;

export function computeProrationAmountSar(input: ProrationInput): ProrationResult {
  const now = input.now ?? new Date();
  const currentHalalas = toHalalas(input.currentPriceSar);
  const targetHalalas = toHalalas(input.targetPriceSar);
  const diffHalalas = targetHalalas - currentHalalas;
  const periodMs = Math.max(input.periodEnd.getTime() - input.periodStart.getTime(), 0);
  const remainingMs = Math.min(
    Math.max(input.periodEnd.getTime() - now.getTime(), 0),
    periodMs,
  );
  const remainingRatio = periodMs === 0 ? 0 : remainingMs / periodMs;
  const isUpgrade = diffHalalas > 0;
  const amountHalalas = isUpgrade
    ? Math.max(0, Math.round(diffHalalas * remainingRatio))
    : 0;

  return {
    amountSar: formatSar(amountHalalas),
    amountHalalas,
    remainingRatio,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    isUpgrade,
  };
}

function toHalalas(value: string | number): number {
  const normalized = String(value);
  const [whole = '0', decimal = ''] = normalized.split('.');
  const paddedDecimal = `${decimal}00`.slice(0, 2);
  return Number(whole) * HALALAS_PER_SAR + Number(paddedDecimal);
}

function formatSar(halalas: number): string {
  const whole = Math.trunc(halalas / HALALAS_PER_SAR);
  const decimal = String(Math.abs(halalas % HALALAS_PER_SAR)).padStart(2, '0');
  return `${whole}.${decimal}`;
}

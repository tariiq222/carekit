import { formatCurrency } from "@/lib/utils"

const RIYAL = "⃁"

interface SarSymbolProps {
  className?: string
}

export function SarSymbol({ className }: SarSymbolProps) {
  return (
    <span className={`inline-block align-middle${className ? ` ${className}` : ""}`}>
      {RIYAL}
    </span>
  )
}

interface FormattedCurrencyProps {
  /** Amount in halalat (1 SAR = 100 halalat) */
  amount: number
  locale: "ar" | "en"
  decimals?: number
  className?: string
}

export function FormattedCurrency({
  amount,
  locale,
  decimals = 0,
  className,
}: FormattedCurrencyProps) {
  const value = formatCurrency(amount, locale, decimals)
  return (
    <span className={`inline-flex items-center gap-1 ${className ?? ""}`}>
      <span>{value}</span>
      <span>{RIYAL}</span>
    </span>
  )
}

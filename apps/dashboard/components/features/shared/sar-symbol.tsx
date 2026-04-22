import Image from "next/image"
import { formatCurrency } from "@/lib/utils"

interface SarSymbolProps {
  size?: number
  className?: string
  alt?: string
}

/**
 * Official Saudi Riyal symbol from SAMA.
 * SVG source: /public/Saudi_Riyal.svg
 */
export function SarSymbol({ size = 16, className, alt = "ريال" }: SarSymbolProps) {
  return (
    <Image
      src="/Saudi_Riyal.svg"
      alt={alt}
      width={size}
      height={size}
      className={`inline-block align-middle${className ? ` ${className}` : ""}`}
    />
  )
}

interface FormattedCurrencyProps {
  /** Amount in halalat (1 SAR = 100 halalat) */
  amount: number
  locale: "ar" | "en"
  decimals?: number
  symbolSize?: number
  className?: string
}

/**
 * Renders an amount with the official Saudi Riyal symbol.
 * Example: <SarSymbol /> 150
 */
export function FormattedCurrency({
  amount,
  locale,
  decimals = 0,
  symbolSize = 14,
  className,
}: FormattedCurrencyProps) {
  const value = formatCurrency(amount, locale, decimals)
  const symbol = <SarSymbol size={symbolSize} alt={locale === "ar" ? "ريال" : "Riyal"} />
  return (
    <span className={`inline-flex items-center gap-1 ${className ?? ""}`}>
      <span>{value}</span>{symbol}
    </span>
  )
}

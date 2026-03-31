'use client'

import { cn } from '@/lib/utils'

interface WizardCardProps {
  onClick: () => void
  selected?: boolean
  disabled?: boolean
  className?: string
  children: React.ReactNode
}

/**
 * Base card for wizard steps. Click to select and advance.
 * Use for both vertical list cards and grid cards.
 */
export function WizardCard({
  onClick,
  selected = false,
  disabled = false,
  className,
  children,
}: WizardCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'group relative w-full rounded-xl border border-border bg-surface',
        'px-4 py-3 text-right transition-all duration-150',
        'hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm',
        'active:scale-[0.98]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-40',
        selected && 'border-primary bg-primary/8 ring-1 ring-primary/30',
        className,
      )}
    >
      {children}
    </button>
  )
}

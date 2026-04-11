import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface FormShellProps {
  /** Page title */
  title: string
  /** Short description shown below title */
  description?: string
  /** Back link path */
  backTo: string
  /** Back link label */
  backLabel?: string
  /** The form element — must include onSubmit */
  children: React.ReactNode
  /** Submit handler — called when primary button clicked */
  onSubmit: (e: React.FormEvent) => void
  /** Submit button label */
  submitLabel?: string
  /** Whether mutation is in-flight */
  isPending?: boolean
  /** Global mutation error message */
  error?: string | null
  /** Max width of the form card — default max-w-2xl */
  maxWidth?: string
  className?: string
}

/**
 * Shared shell for all /new and /edit pages.
 * Enforces: PageHeader with back button, glass card, sticky footer actions.
 */
export function FormShell({
  title,
  description,
  backTo,
  backLabel = 'رجوع',
  children,
  onSubmit,
  submitLabel = 'حفظ',
  isPending,
  error,
  maxWidth = 'max-w-2xl',
  className,
}: FormShellProps) {
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 bg-surface border border-border rounded-lg shadow-sm px-6 py-4">
        <div className="flex items-center gap-3">
          <Link to={backTo}>
            <button
              type="button"
              className="flex items-center justify-center w-8 h-8 rounded-md border border-border bg-surface hover:bg-surface-muted transition-colors text-muted-foreground hover:text-foreground"
            >
              <ArrowRight className="w-4 h-4 rtl:rotate-180" />
            </button>
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-foreground">{title}</h1>
            {description && (
              <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
            )}
          </div>
        </div>
      </div>

      {/* Form card */}
      <form
        onSubmit={onSubmit}
        className={cn(
          'glass rounded-lg p-6 space-y-6',
          maxWidth,
          className,
        )}
        noValidate
      >
        {children}

        {/* Error */}
        {error && (
          <p className="text-sm text-error bg-error/8 border border-error/20 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2 border-t border-border">
          <Button type="submit" disabled={isPending}>
            {isPending ? 'جارٍ الحفظ...' : submitLabel}
          </Button>
          <Link to={backTo}>
            <Button type="button" variant="outline">
              إلغاء
            </Button>
          </Link>
        </div>
      </form>
    </div>
  )
}

/** Section divider with label inside the form */
interface FormSectionProps {
  label: string
  description?: string
  children: React.ReactNode
  className?: string
}

export function FormSection({ label, description, children, className }: FormSectionProps) {
  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-border" />
        <div className="text-center">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2">
            {label}
          </p>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
        <div className="flex-1 h-px bg-border" />
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  )
}

/** Labeled field row */
interface FormFieldProps {
  label: string
  required?: boolean
  error?: string
  hint?: string
  children: React.ReactNode
  className?: string
}

export function FormField({ label, required, error, hint, children, className }: FormFieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-error ms-1">*</span>}
      </label>
      {children}
      {hint && !error && (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}
      {error && (
        <p className="text-xs text-error">{error}</p>
      )}
    </div>
  )
}

/** Toggle row — label on start, switch on end */
interface FormToggleProps {
  label: string
  description?: string
  children: React.ReactNode
}

export function FormToggle({ label, description, children }: FormToggleProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 px-3 rounded-md bg-surface-muted border border-border">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      {children}
    </div>
  )
}

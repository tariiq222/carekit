import { useState, useEffect, useRef } from 'react'
import { HIcon } from '@/components/shared/hicon'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'

interface CommandItem {
  id: string
  label: string
  description?: string
  icon: string
  action: () => void
}

const QUICK_LINKS: CommandItem[] = [
  { id: 'bookings',     label: 'الحجوزات',       description: 'إدارة حجوزات المرضى',      icon: 'hgi-calendar-03',        action: () => { window.location.href = '/bookings' } },
  { id: 'patients',     label: 'المرضى',          description: 'قائمة المرضى المسجلين',    icon: 'hgi-user-multiple-02',   action: () => { window.location.href = '/patients' } },
  { id: 'practitioners',label: 'الأطباء',         description: 'إدارة الكوادر الطبية',     icon: 'hgi-doctor-02',          action: () => { window.location.href = '/practitioners' } },
  { id: 'invoices',     label: 'الفواتير',        description: 'الفواتير والمدفوعات',      icon: 'hgi-invoice-01',         action: () => { window.location.href = '/invoices' } },
  { id: 'payments',     label: 'المدفوعات',       description: 'سجل المعاملات المالية',    icon: 'hgi-money-bag-01',       action: () => { window.location.href = '/payments' } },
  { id: 'services',     label: 'الخدمات',         description: 'كتالوج خدمات العيادة',    icon: 'hgi-stethoscope-02',     action: () => { window.location.href = '/services' } },
  { id: 'branches',     label: 'الفروع',          description: 'إدارة فروع العيادة',       icon: 'hgi-building-04',        action: () => { window.location.href = '/branches' } },
  { id: 'coupons',      label: 'الكوبونات',       description: 'رموز الخصم والعروض',      icon: 'hgi-discount-tag-01',    action: () => { window.location.href = '/coupons' } },
  { id: 'gift-cards',   label: 'بطاقات الهدايا',  description: 'إدارة بطاقات الهدايا',    icon: 'hgi-gift-01',            action: () => { window.location.href = '/gift-cards' } },
  { id: 'departments',  label: 'الأقسام',         description: 'أقسام وتخصصات العيادة',   icon: 'hgi-hierarchy-01',       action: () => { window.location.href = '/departments' } },
]

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const filtered = query.trim()
    ? QUICK_LINKS.filter(
        (item) =>
          item.label.includes(query) ||
          (item.description?.includes(query) ?? false)
      )
    : QUICK_LINKS

  // Global ⌘K / Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        onOpenChange(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onOpenChange])

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery('')
      setActiveIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Keyboard navigation
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex((i) => Math.min(i + 1, filtered.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const item = filtered[activeIndex]
        if (item) { item.action(); onOpenChange(false) }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, filtered, activeIndex, onOpenChange])

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${activeIndex}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  // Reset active index on query change
  useEffect(() => { setActiveIndex(0) }, [query])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="cmd-modal" aria-describedby={undefined}>
        <DialogTitle className="sr-only">بحث سريع</DialogTitle>

        {/* Search Input */}
        <div className="cmd-modal-search">
          <HIcon name="hgi-search-01" className="cmd-modal-search-icon" />
          <input
            ref={inputRef}
            className="cmd-modal-input"
            placeholder="ابحث أو انتقل إلى..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            dir="rtl"
          />
          {query && (
            <button
              className="cmd-modal-clear"
              onClick={() => { setQuery(''); inputRef.current?.focus() }}
              aria-label="مسح البحث"
            >
              <HIcon name="hgi-cancel-01" />
            </button>
          )}
          <kbd className="cmd-modal-esc" onClick={() => onOpenChange(false)}>Esc</kbd>
        </div>

        {/* Results */}
        <div className="cmd-modal-section-label">
          {query ? `نتائج "${query}"` : 'الانتقال السريع'}
        </div>

        <div className="cmd-modal-list" ref={listRef} role="listbox" aria-label="نتائج البحث">
          {filtered.length === 0 ? (
            <div className="cmd-modal-empty">
              <HIcon name="hgi-search-remove-01" />
              <span>لا توجد نتائج لـ "{query}"</span>
            </div>
          ) : (
            filtered.map((item, idx) => (
              <button
                key={item.id}
                data-index={idx}
                role="option"
                aria-selected={idx === activeIndex}
                className={`cmd-modal-item${idx === activeIndex ? ' active' : ''}`}
                onClick={() => { item.action(); onOpenChange(false) }}
                onMouseEnter={() => setActiveIndex(idx)}
              >
                <span className="cmd-modal-item-icon">
                  <HIcon name={item.icon} />
                </span>
                <span className="cmd-modal-item-text">
                  <span className="cmd-modal-item-label">{item.label}</span>
                  {item.description && (
                    <span className="cmd-modal-item-desc">{item.description}</span>
                  )}
                </span>
                <HIcon name="hgi-arrow-left-01" className="cmd-modal-item-arrow" />
              </button>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="cmd-modal-footer">
          <span><kbd>↑↓</kbd> للتنقل</span>
          <span><kbd>↵</kbd> للانتقال</span>
          <span><kbd>Esc</kbd> للإغلاق</span>
        </div>
      </DialogContent>
    </Dialog>
  )
}

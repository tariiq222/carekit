"use client"

/**
 * Widget Datetime — 3 Design Concepts Preview
 * Static mock data only — no real API calls
 * Used for design selection before implementation
 */

import { useState } from "react"
import { Calendar } from "@/components/ui/calendar"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Calendar01Icon, Clock01Icon, Location04Icon,
  UserCircleIcon, Money01Icon, Tick02Icon,
  Time01Icon, CheckmarkCircle01Icon,
} from "@hugeicons/core-free-icons"
import { arSA } from "date-fns/locale"
import { format, addDays, startOfWeek } from "date-fns"

/* ─── Mock Data ─── */
const MOCK_DATE = new Date(2026, 3, 7)
const MOCK_SLOTS = [
  { startTime: "09:00", endTime: "09:30", available: true },
  { startTime: "09:30", endTime: "10:00", available: true },
  { startTime: "10:00", endTime: "10:30", available: true },
  { startTime: "10:30", endTime: "11:00", available: false },
  { startTime: "11:00", endTime: "11:30", available: true },
  { startTime: "11:30", endTime: "12:00", available: true },
  { startTime: "13:00", endTime: "13:30", available: true },
  { startTime: "13:30", endTime: "14:00", available: true },
  { startTime: "14:00", endTime: "14:30", available: true },
  { startTime: "14:30", endTime: "15:00", available: false },
  { startTime: "15:00", endTime: "15:30", available: true },
  { startTime: "15:30", endTime: "16:00", available: true },
]
const MOCK_SUMMARY = {
  branch: "فرع الرياض", service: "استشارة عامة",
  practitioner: "د. أحمد الشمري", duration: "30 دقيقة", price: "150 ر.س",
}
const CAL_CLASSES = {
  day_selected: "bg-primary text-primary-foreground hover:bg-primary",
  day_today: "border border-primary/60 text-primary font-semibold",
  head_cell: "text-muted-foreground font-medium text-xs flex-1 text-center",
  head_row: "flex w-full", row: "flex w-full mt-1", cell: "flex-1 text-center",
  day: "w-full h-8 rounded-lg text-xs font-medium transition-colors hover:bg-muted",
  nav_button: "h-6 w-6 rounded-md border border-border/60 hover:bg-muted",
  caption: "text-xs font-semibold text-foreground", table: "w-full border-collapse",
}

/* ─── DesignOption Wrapper ─── */
function DesignOption({ number, title, subtitle, selected, onSelect, children }: {
  number: number; title: string; subtitle: string
  selected: boolean; onSelect: () => void; children: React.ReactNode
}) {
  return (
    <div className={cn(
      "relative flex flex-col rounded-xl border-2 bg-surface shadow-sm transition-all duration-200 hover:shadow-md",
      selected ? "border-primary ring-2 ring-primary/20" : "border-border",
    )}>
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border">
        <div className="flex items-center gap-2">
          <span className={cn(
            "h-7 w-7 rounded-full flex items-center justify-center text-sm font-bold shrink-0",
            selected ? "bg-primary text-primary-foreground" : "bg-surface-muted text-muted-foreground",
          )}>{number}</span>
          <div>
            <p className="text-sm font-semibold text-foreground">{title}</p>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        {selected && (
          <span className="flex items-center gap-1 text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-full">
            <HugeiconsIcon icon={CheckmarkCircle01Icon} size={13} />محدد
          </span>
        )}
      </div>
      <div className="flex-1 p-3 overflow-hidden">{children}</div>
      <div className="px-4 pb-4 pt-2 border-t border-border">
        <Button variant={selected ? "default" : "outline"} className="w-full text-sm" onClick={onSelect}>
          {selected ? "✓ هذا هو اختياري" : "اختر هذا التصميم"}
        </Button>
      </div>
    </div>
  )
}

/* ─── Design 1: Split + Summary ─── */
function Design1() {
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  return (
    <div className="flex flex-col gap-3" dir="rtl">
      {/* Top: Calendar + Summary side by side */}
      <div className="flex gap-3">
        <div className="flex-1 min-w-0">
          <Calendar mode="single" selected={MOCK_DATE} locale={arSA} disabled={() => false}
            classNames={CAL_CLASSES}
            className="rounded-lg border border-border/60 w-full [&_.rdp]:w-full [&_.rdp-month]:w-full [&_.rdp-table]:w-full"
          />
        </div>
        {/* Summary card */}
        <div className="w-32 shrink-0 bg-surface-muted rounded-lg p-3 flex flex-col gap-2">
          <p className="text-xs font-bold text-foreground border-b border-border pb-1.5">ملخص الحجز</p>
          {[
            { icon: Location04Icon, val: MOCK_SUMMARY.branch },
            { icon: Calendar01Icon, val: MOCK_SUMMARY.service },
            { icon: UserCircleIcon, val: MOCK_SUMMARY.practitioner },
            { icon: Time01Icon, val: MOCK_SUMMARY.duration },
            { icon: Money01Icon, val: MOCK_SUMMARY.price },
          ].map(({ icon, val }) => (
            <div key={val} className="flex items-start gap-1.5">
              <HugeiconsIcon icon={icon} size={11} className="text-primary shrink-0 mt-0.5" />
              <span className="text-xs text-foreground leading-tight">{val}</span>
            </div>
          ))}
          {selectedSlot && (
            <div className="mt-auto pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground">الموعد المختار</p>
              <p className="text-sm font-bold text-primary font-numeric">{selectedSlot}</p>
            </div>
          )}
        </div>
      </div>
      {/* Bottom: Time chips */}
      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-semibold text-foreground flex items-center gap-1">
          <HugeiconsIcon icon={Clock01Icon} size={13} className="text-primary" />الأوقات المتاحة
        </p>
        <div className="grid grid-cols-4 gap-2">
          {MOCK_SLOTS.map((s) => (
            <button key={s.startTime} disabled={!s.available} onClick={() => setSelectedSlot(s.startTime)}
              className={cn(
                "flex flex-col items-center py-2.5 px-2 rounded-lg border transition-all",
                !s.available && "opacity-40 cursor-not-allowed border-border/30 bg-surface-muted",
                s.available && selectedSlot === s.startTime
                  ? "border-primary bg-primary text-primary-foreground"
                  : s.available ? "border-border hover:border-primary/50 hover:bg-primary/5" : "",
              )}
            >
              <span className={cn(
                "text-sm font-bold font-numeric leading-tight",
                !s.available && "line-through",
                selectedSlot === s.startTime ? "text-primary-foreground" : "text-foreground",
              )}>{s.startTime}</span>
              <span dir="ltr" className={cn(
                "text-xs mt-0.5 leading-tight font-numeric",
                selectedSlot === s.startTime ? "text-primary-foreground/60" : "text-muted-foreground",
              )}>30د</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ─── Design 2: Vertical Flow ─── */
function Design2() {
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  return (
    <div className="flex flex-col gap-3" dir="rtl">
      <Calendar mode="single" selected={MOCK_DATE} locale={arSA} disabled={() => false}
        classNames={{ ...CAL_CLASSES, row: "flex w-full mt-0.5", day: "w-full h-7 rounded-md text-xs font-medium transition-colors hover:bg-muted" }}
        className="rounded-lg border border-border/60 w-full [&_.rdp]:w-full [&_.rdp-month]:w-full [&_.rdp-table]:w-full"
      />
      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-semibold text-foreground flex items-center gap-1">
          <HugeiconsIcon icon={Clock01Icon} size={13} className="text-primary" />اختر الوقت
        </p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {MOCK_SLOTS.map((s) => (
            <button key={s.startTime} disabled={!s.available} onClick={() => setSelectedSlot(s.startTime)}
              className={cn(
                "shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-all font-numeric",
                !s.available && "opacity-40 cursor-not-allowed line-through border-border/30",
                s.available && selectedSlot === s.startTime
                  ? "border-primary bg-primary text-primary-foreground"
                  : s.available ? "border-border hover:border-primary/50 hover:bg-primary/5" : "",
              )}
            >{s.startTime}</button>
          ))}
        </div>
      </div>
      {selectedSlot ? (
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-center">
          <p className="text-xs text-muted-foreground">موعدك المختار</p>
          <p className="text-xl font-bold text-primary font-numeric">{selectedSlot}</p>
          <p className="text-xs text-muted-foreground">الثلاثاء 7 أبريل 2026</p>
        </div>
      ) : (
        <div className="bg-surface-muted rounded-lg p-2.5 text-center">
          <p className="text-xs text-muted-foreground">اختر وقتاً من الأعلى</p>
        </div>
      )}
      <div className="flex items-center gap-2 flex-wrap bg-surface-muted rounded-lg px-3 py-2">
        {[MOCK_SUMMARY.branch, MOCK_SUMMARY.service, MOCK_SUMMARY.practitioner, MOCK_SUMMARY.price].map((v, i) => (
          <span key={v} className="flex items-center gap-1 text-xs text-muted-foreground">
            {i > 0 && <span className="text-border">•</span>}{v}
          </span>
        ))}
      </div>
    </div>
  )
}

/* ─── Design 3: Card-First ─── */
function Design3() {
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const weekStart = startOfWeek(MOCK_DATE, { weekStartsOn: 0 })
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const dayNames = ["أحد", "اثن", "ثلا", "أرب", "خمس", "جمع", "سبت"]

  return (
    <div className="flex flex-col gap-3" dir="rtl">
      {/* Week strip */}
      <div className="flex gap-1 justify-between">
        {weekDays.map((d, i) => {
          const isSelected = format(d, "yyyy-MM-dd") === format(MOCK_DATE, "yyyy-MM-dd")
          return (
            <div key={i} className={cn(
              "flex-1 flex flex-col items-center py-2 rounded-lg border text-xs transition-all cursor-pointer",
              isSelected ? "bg-primary border-primary text-primary-foreground" : "border-border hover:border-primary/40 text-muted-foreground",
            )}>
              <span className="font-medium">{dayNames[i]}</span>
              <span className="font-bold font-numeric">{format(d, "d")}</span>
            </div>
          )
        })}
      </div>
      {/* Time cards — 3 columns */}
      <div className="grid grid-cols-3 gap-2 max-h-52 overflow-y-auto">
        {MOCK_SLOTS.map((s) => (
          <button key={s.startTime} disabled={!s.available} onClick={() => setSelectedSlot(s.startTime)}
            className={cn(
              "flex flex-col items-start p-2.5 rounded-lg border transition-all text-start",
              !s.available && "opacity-40 cursor-not-allowed bg-surface-muted border-border/30",
              s.available && selectedSlot === s.startTime
                ? "bg-primary border-primary text-primary-foreground"
                : s.available ? "bg-surface border-border hover:border-primary/50 hover:bg-primary/5" : "",
            )}
          >
            <span className={cn(
              "text-sm font-bold font-numeric",
              !s.available && "line-through",
              selectedSlot === s.startTime ? "text-primary-foreground" : "text-foreground",
            )}>{s.startTime}</span>
            <span className={cn(
              "text-xs font-numeric",
              selectedSlot === s.startTime ? "text-primary-foreground/70" : "text-muted-foreground",
            )}>{s.endTime}</span>
            <span className={cn(
              "mt-1 text-xs px-1.5 py-0.5 rounded-full",
              selectedSlot === s.startTime ? "bg-white/20 text-primary-foreground" : "bg-surface-muted text-muted-foreground",
            )}>30 دق</span>
          </button>
        ))}
      </div>
      {/* Info pills */}
      <div className="flex gap-1.5 flex-wrap">
        {[
          { icon: Location04Icon, val: MOCK_SUMMARY.branch },
          { icon: UserCircleIcon, val: MOCK_SUMMARY.practitioner },
          { icon: Money01Icon, val: MOCK_SUMMARY.price },
        ].map(({ icon, val }) => (
          <span key={val} className="flex items-center gap-1 text-xs bg-surface-muted border border-border rounded-full px-2.5 py-1 text-foreground">
            <HugeiconsIcon icon={icon} size={11} className="text-primary" />{val}
          </span>
        ))}
      </div>
    </div>
  )
}

/* ─── Main Preview Page ─── */
export function WidgetDatetimeDesignsPreview() {
  const [selectedDesign, setSelectedDesign] = useState<1 | 2 | 3 | null>(null)

  return (
    <div dir="rtl" className="min-h-screen bg-background p-8">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-foreground mb-2">اختر تصميم خطوة الموعد</h1>
        <p className="text-sm text-muted-foreground">ثلاثة مقترحات مختلفة — اختر الأنسب لك ثم نطبّقه</p>
      </div>
      <div className="grid grid-cols-3 gap-6 max-w-[1400px] mx-auto">
        <DesignOption number={1} title="Split + ملخص" subtitle="تقويم + ملخص جانبي + أوقات"
          selected={selectedDesign === 1} onSelect={() => setSelectedDesign(1)}>
          <Design1 />
        </DesignOption>
        <DesignOption number={2} title="تدفق عمودي" subtitle="تقويم → أوقات أفقية → ملخص"
          selected={selectedDesign === 2} onSelect={() => setSelectedDesign(2)}>
          <Design2 />
        </DesignOption>
        <DesignOption number={3} title="بطاقات مدمجة" subtitle="شريط أيام + بطاقات وقت كبيرة"
          selected={selectedDesign === 3} onSelect={() => setSelectedDesign(3)}>
          <Design3 />
        </DesignOption>
      </div>
      {selectedDesign && (
        <div className="mt-8 text-center flex flex-col items-center gap-2">
          <p className="text-sm text-muted-foreground">
            اخترت التصميم رقم <span className="font-bold text-primary">{selectedDesign}</span>
          </p>
          <Button size="lg" className="min-w-48">
            <HugeiconsIcon icon={Tick02Icon} size={16} className="me-2" />
            تأكيد وتطبيق التصميم {selectedDesign}
          </Button>
        </div>
      )}
    </div>
  )
}

"use client"

import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Search01Icon, CheckmarkCircle01Icon } from "@hugeicons/core-free-icons"

import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

import { usePatients } from "@/hooks/use-patients"
import type { Patient } from "@/lib/types/patient"
import { BookingWalkInForm } from "./booking-walkin-form"
import { useLocale } from "@/components/locale-provider"

/* ── Card styles ── */

const card = "bg-surface rounded-xl border border-border shadow-sm overflow-hidden"
const cardHeader = "px-4 py-2.5 bg-surface border-b border-border"
const cardTitle = "text-xs font-semibold text-muted-foreground uppercase tracking-wider"
const cardBody = "px-4 py-4 flex flex-col gap-3"

/* ── Patient search result row ── */

function PatientRow({ patient, onSelect }: { patient: Patient; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-start transition-colors hover:bg-surface-muted group"
    >
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
        {patient.firstName.charAt(0)}{patient.lastName.charAt(0)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">
          {patient.firstName} {patient.lastName}
        </p>
        <p className="text-xs font-numeric text-muted-foreground mt-0.5">{patient.phone}</p>
      </div>
      <HugeiconsIcon
        icon={CheckmarkCircle01Icon}
        size={16}
        className="shrink-0 text-muted-foreground group-hover:text-primary transition-colors"
      />
    </button>
  )
}

/* ── Props ── */

interface PatientStepProps {
  onSelect: (patientId: string, name: string) => void
}

/* ── Main component ── */

export function PatientStep({ onSelect }: PatientStepProps) {
  const { t } = useLocale()
  const [mode, setMode] = useState<"search" | "create">("search")
  const { patients, search, setSearch, isLoading } = usePatients()

  return (
    <Tabs value={mode} onValueChange={(v) => setMode(v as "search" | "create")} className="flex flex-col gap-3">

      <div className="flex justify-start">
        <TabsList className="h-8 p-0.5">
          <TabsTrigger value="search" className="h-7 px-3 text-xs">{t("bookings.patient.tab.search")}</TabsTrigger>
          <TabsTrigger value="create" className="h-7 px-3 text-xs">{t("bookings.patient.tab.create")}</TabsTrigger>
        </TabsList>
      </div>

      {/* Search tab */}
      <TabsContent value="search">
        <div className={card}>
          <div className={cardHeader}><p className={cardTitle}>{t("bookings.patient.search.header")}</p></div>
          <div className={cardBody}>
            <div className="relative">
              <HugeiconsIcon
                icon={Search01Icon}
                size={16}
                className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
              />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("bookings.patient.search.placeholder")}
                className="ps-9 bg-surface-muted"
              />
            </div>
            <div className="flex flex-col max-h-52 overflow-y-auto -mx-1 px-1">
              {isLoading && (
                <p className="text-sm text-center text-muted-foreground py-6">{t("bookings.patient.search.loading")}</p>
              )}
              {!isLoading && patients.length === 0 && !search && (
                <p className="text-sm text-center text-muted-foreground py-6">{t("bookings.patient.search.startTyping")}</p>
              )}
              {!isLoading && patients.length === 0 && search && (
                <p className="text-sm text-center text-muted-foreground py-6">
                  {t("bookings.patient.search.noResults")}{" "}
                  <button
                    type="button"
                    className="text-primary underline underline-offset-2 hover:opacity-80"
                    onClick={() => setMode("create")}
                  >
                    {t("bookings.patient.search.createNew")}
                  </button>
                </p>
              )}
              {patients.map((p) => (
                <PatientRow
                  key={p.id}
                  patient={p}
                  onSelect={() => onSelect(p.id, `${p.firstName} ${p.lastName}`)}
                />
              ))}
            </div>
          </div>
        </div>
      </TabsContent>

      {/* Create tab */}
      <TabsContent value="create">
        <BookingWalkInForm onSelect={onSelect} />
      </TabsContent>

    </Tabs>
  )
}

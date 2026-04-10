"use client"

import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowDown01Icon, Cancel01Icon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useLocale } from "@/components/locale-provider"
import { usePractitioners } from "@/hooks/use-practitioners"
import { cn } from "@/lib/utils"
import type { Practitioner } from "@/lib/types/practitioner"

interface PractitionerSelectFieldProps {
  value: string
  onChange: (id: string) => void
  error?: string
}

function getInitials(p: Practitioner) {
  return `${p.user.firstName[0] ?? ""}${p.user.lastName[0] ?? ""}`.toUpperCase()
}

function getPractitionerName(p: Practitioner, isAr: boolean) {
  return isAr && p.nameAr ? p.nameAr : `${p.user.firstName} ${p.user.lastName}`
}

export function PractitionerSelectField({
  value,
  onChange,
  error,
}: PractitionerSelectFieldProps) {
  const { t, locale } = useLocale()
  const isAr = locale === "ar"
  const [open, setOpen] = useState(false)

  const { practitioners, isLoading } = usePractitioners()
  const selected = practitioners.find((p) => p.id === value)

  return (
    <div className="flex flex-col gap-2">
      {/* ── Trigger button ── */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={isLoading}
            className={cn(
              "w-full justify-between font-normal",
              !selected && "text-muted-foreground",
              error && "border-destructive"
            )}
          >
            <span className="truncate">
              {isLoading
                ? t("common.loading")
                : selected
                  ? getPractitionerName(selected, isAr)
                  : t("groupSessions.selectPractitioner")}
            </span>
            <HugeiconsIcon
              icon={ArrowDown01Icon}
              size={16}
              className="shrink-0 opacity-50 ms-2"
            />
          </Button>
        </PopoverTrigger>

        <PopoverContent
          className="w-[min(360px,_calc(100vw-2rem))] p-0"
          align="start"
        >
          <Command>
            <CommandInput placeholder={t("groupSessions.searchPractitioner")} />
            <CommandList>
              <CommandEmpty>{t("groupSessions.noPractitionerFound")}</CommandEmpty>
              <CommandGroup>
                {practitioners.map((p) => {
                  const name = getPractitionerName(p, isAr)
                  const isSelected = p.id === value
                  return (
                    <CommandItem
                      key={p.id}
                      value={name}
                      onSelect={() => {
                        onChange(p.id)
                        setOpen(false)
                      }}
                      className={cn(
                        "flex items-center gap-3 py-2",
                        isSelected && "bg-primary/5"
                      )}
                    >
                      {/* Avatar */}
                      <Avatar className="size-8 shrink-0">
                        <AvatarImage src={p.avatarUrl ?? undefined} alt={name} />
                        <AvatarFallback className="text-xs bg-primary/10 text-primary">
                          {getInitials(p)}
                        </AvatarFallback>
                      </Avatar>

                      {/* Name + specialty */}
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "text-sm truncate",
                          isSelected && "font-medium text-primary"
                        )}>
                          {name}
                        </p>
                        {p.specialty && (
                          <p className="text-xs text-muted-foreground truncate">
                            {isAr && p.specialtyAr ? p.specialtyAr : p.specialty}
                          </p>
                        )}
                      </div>

                      {/* Active indicator */}
                      {isSelected && (
                        <div className="size-2 rounded-full bg-primary shrink-0" />
                      )}
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* ── Selected practitioner card ── */}
      {selected && (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2.5">
          <Avatar className="size-10 shrink-0">
            <AvatarImage
              src={selected.avatarUrl ?? undefined}
              alt={getPractitionerName(selected, isAr)}
            />
            <AvatarFallback className="bg-primary/10 text-primary font-medium">
              {getInitials(selected)}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {getPractitionerName(selected, isAr)}
            </p>
            {selected.specialty && (
              <p className="text-xs text-muted-foreground truncate">
                {isAr && selected.specialtyAr ? selected.specialtyAr : selected.specialty}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => onChange("")}
            className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-surface-muted transition-colors"
            aria-label={t("common.remove")}
          >
            <HugeiconsIcon icon={Cancel01Icon} size={14} />
          </button>
        </div>
      )}

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  )
}

"use client"

import { Controller } from "react-hook-form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DateTimeInput } from "@/components/ui/date-time-input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useLocale } from "@/components/locale-provider"
import type { UseFormReturn } from "react-hook-form"
import type { CreateGroupFormValues } from "@/lib/schemas/groups.schema"

interface SchedulingPriceTabProps {
  form: UseFormReturn<CreateGroupFormValues>
}

export function SchedulingPriceTab({ form }: SchedulingPriceTabProps) {
  const { t } = useLocale()
  const paymentType = form.watch("paymentType")
  const schedulingMode = form.watch("schedulingMode")

  return (
    <Card className="border-s-2 border-s-primary/40">
      <CardHeader>
        <CardTitle>{t("groups.create.tabs.scheduling")}</CardTitle>
        <CardDescription>{t("groups.create.tabs.scheduling")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Duration + Price */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>{t("groups.create.durationMinutes")} *</Label>
            <Input type="number" {...form.register("durationMinutes", { valueAsNumber: true })} />
            {form.formState.errors.durationMinutes && (
              <p className="text-xs text-destructive">{form.formState.errors.durationMinutes.message}</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t("groups.create.pricePerPerson")} *</Label>
            <Input type="number" {...form.register("pricePerPersonHalalat", { valueAsNumber: true })} />
            {form.formState.errors.pricePerPersonHalalat && (
              <p className="text-xs text-destructive">{form.formState.errors.pricePerPersonHalalat.message}</p>
            )}
          </div>
        </div>
        {/* Payment Type */}
        <div className="flex flex-col gap-1.5">
          <Label>{t("groups.create.paymentType")} *</Label>
          <Select
            value={paymentType}
            onValueChange={(v) => form.setValue("paymentType", v as CreateGroupFormValues["paymentType"])}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="FULL_PAYMENT">{t("groups.create.paymentType.FULL_PAYMENT")}</SelectItem>
              <SelectItem value="DEPOSIT">{t("groups.create.paymentType.DEPOSIT")}</SelectItem>
              <SelectItem value="FREE_HOLD">{t("groups.create.paymentType.FREE_HOLD")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {/* Deposit conditional fields */}
        {paymentType === "DEPOSIT" && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>{t("groups.create.depositAmount")} *</Label>
              <Input type="number" {...form.register("depositAmount", { valueAsNumber: true })} />
              {form.formState.errors.depositAmount && (
                <p className="text-xs text-destructive">{form.formState.errors.depositAmount.message}</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t("groups.create.remainingDueDate")} *</Label>
              <Controller
                control={form.control}
                name="remainingDueDate"
                render={({ field }) => (
                  <DateTimeInput value={field.value} onChange={field.onChange} error={!!form.formState.errors.remainingDueDate} />
                )}
              />
              {form.formState.errors.remainingDueDate && (
                <p className="text-xs text-destructive">{form.formState.errors.remainingDueDate.message}</p>
              )}
            </div>
          </div>
        )}
        {/* Payment Deadline */}
        <div className="flex flex-col gap-1.5">
          <Label>{t("groups.create.paymentDeadlineHours")}</Label>
          <Input type="number" {...form.register("paymentDeadlineHours", { valueAsNumber: true })} />
        </div>
        {/* Scheduling Mode */}
        <div className="flex flex-col gap-1.5">
          <Label>{t("groups.create.schedulingMode")} *</Label>
          <Select
            value={schedulingMode}
            onValueChange={(v) => form.setValue("schedulingMode", v as CreateGroupFormValues["schedulingMode"])}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="fixed_date">{t("groups.create.schedulingMode.fixed_date")}</SelectItem>
              <SelectItem value="on_capacity">{t("groups.create.schedulingMode.on_capacity")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {/* Start Time (conditional fixed_date) */}
        {schedulingMode === "fixed_date" && (
          <div className="flex flex-col gap-1.5">
            <Label>{t("groups.create.startTime")} *</Label>
            <Controller
              control={form.control}
              name="startTime"
              render={({ field }) => (
                <DateTimeInput value={field.value} onChange={field.onChange} error={!!form.formState.errors.startTime} />
              )}
            />
            {form.formState.errors.startTime && (
              <p className="text-xs text-destructive">{form.formState.errors.startTime.message}</p>
            )}
          </div>
        )}
        {/* End Date */}
        <div className="flex flex-col gap-1.5">
          <Label>{t("groups.create.endDate")}</Label>
          <Controller
            control={form.control}
            name="endDate"
            render={({ field }) => <DateTimeInput value={field.value} onChange={field.onChange} />}
          />
        </div>
      </CardContent>
    </Card>
  )
}

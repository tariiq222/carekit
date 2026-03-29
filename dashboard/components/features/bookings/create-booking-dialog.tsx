"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetBody,
  SheetFooter,
} from "@/components/ui/sheet"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { DatePicker } from "@/components/ui/date-picker"
import { useBookingMutations } from "@/hooks/use-bookings"
import { usePractitioners } from "@/hooks/use-practitioners"
import { useServices } from "@/hooks/use-services"

/* ─── Schema ─── */

const createBookingSchema = z.object({
  practitionerId: z.string().min(1, "Select a practitioner"),
  serviceId: z.string().min(1, "Select a service"),
  type: z.enum(["in_person", "online"]),
  date: z.string().min(1, "Select a date"),
  startTime: z.string().min(1, "Select a time"),
  notes: z.string().optional(),
})

type CreateBookingFormValues = z.infer<typeof createBookingSchema>

/* ─── Component ─── */

interface CreateBookingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}

export function CreateBookingDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateBookingDialogProps) {
  const { createMut } = useBookingMutations()
  const { practitioners, isLoading: practitionersLoading } = usePractitioners()
  const { services, isLoading: servicesLoading } = useServices()

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateBookingFormValues>({
    resolver: zodResolver(createBookingSchema),
    defaultValues: {
      practitionerId: "",
      serviceId: "",
      type: "in_person",
      date: "",
      startTime: "",
      notes: "",
    },
  })

  const selectedType = watch("type")
  const selectedPractitioner = watch("practitionerId")
  const selectedService = watch("serviceId")

  const onSubmit = async (data: CreateBookingFormValues) => {
    try {
      await createMut.mutateAsync({
        practitionerId: data.practitionerId,
        serviceId: data.serviceId,
        type: data.type,
        date: data.date,
        startTime: data.startTime,
        notes: data.notes || undefined,
      })
      toast.success("Booking created")
      reset()
      onCreated()
      onOpenChange(false)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create booking",
      )
    }
  }

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) reset()
    onOpenChange(isOpen)
  }

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="end">
        <SheetHeader>
          <SheetTitle>New Booking</SheetTitle>
          <SheetDescription>
            Create a new appointment for a patient.
          </SheetDescription>
        </SheetHeader>

        <SheetBody>
          <form
            id="create-booking-form"
            onSubmit={handleSubmit(onSubmit)}
            className="flex flex-col gap-5"
          >
            {/* Practitioner */}
            <div className="flex flex-col gap-1.5">
              <Label>Practitioner *</Label>
              <Select
                value={selectedPractitioner}
                onValueChange={(v) => setValue("practitionerId", v, { shouldValidate: true })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={
                      practitionersLoading ? "Loading..." : "Select practitioner"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {practitioners.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.user.firstName} {p.user.lastName}
                      {p.specialty ? ` — ${p.specialty}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.practitionerId && (
                <p className="text-sm text-destructive">
                  {errors.practitionerId.message}
                </p>
              )}
            </div>

            {/* Service */}
            <div className="flex flex-col gap-1.5">
              <Label>Service *</Label>
              <Select
                value={selectedService}
                onValueChange={(v) => setValue("serviceId", v, { shouldValidate: true })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={
                      servicesLoading ? "Loading..." : "Select service"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {services.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.nameEn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.serviceId && (
                <p className="text-sm text-destructive">
                  {errors.serviceId.message}
                </p>
              )}
            </div>

            {/* Type */}
            <div className="flex flex-col gap-1.5">
              <Label>Type *</Label>
              <Select
                value={selectedType}
                onValueChange={(v) =>
                  setValue(
                    "type",
                    v as CreateBookingFormValues["type"],
                    { shouldValidate: true },
                  )
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in_person">In Person</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                </SelectContent>
              </Select>
              {errors.type && (
                <p className="text-sm text-destructive">
                  {errors.type.message}
                </p>
              )}
            </div>

            {/* Date & Time */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Date *</Label>
                <DatePicker
                  value={watch("date")}
                  onChange={(v) => setValue("date", v, { shouldValidate: true })}
                  placeholder="Select date"
                />
                {errors.date && (
                  <p className="text-sm text-destructive">
                    {errors.date.message}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Start Time *</Label>
                <Input type="time" {...register("startTime")} />
                {errors.startTime && (
                  <p className="text-sm text-destructive">
                    {errors.startTime.message}
                  </p>
                )}
              </div>
            </div>

            {/* Notes */}
            <div className="flex flex-col gap-1.5">
              <Label>Notes</Label>
              <Textarea
                {...register("notes")}
                placeholder="Additional notes..."
                rows={3}
              />
            </div>
          </form>
        </SheetBody>

        <SheetFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleClose(false)}
          >
            Cancel
          </Button>
          <Button type="submit" form="create-booking-form" disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Create Booking"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

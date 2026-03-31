"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetBody,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { usePractitionerMutations } from "@/hooks/use-practitioners"

/* ─── Schema ─── */

const createPractitionerSchema = z.object({
  userId: z.string().uuid("Must be a valid UUID"),
  specialty: z.string().min(1, "Specialty is required"),
  specialtyAr: z.string().optional(),
  bio: z.string().optional(),
  bioAr: z.string().optional(),
  experience: z.coerce.number().int().min(0).optional(),
  education: z.string().optional(),
  educationAr: z.string().optional(),
  priceClinic: z.coerce.number().int().min(0).optional(),
  pricePhone: z.coerce.number().int().min(0).optional(),
  priceVideo: z.coerce.number().int().min(0).optional(),
})

type FormData = z.infer<typeof createPractitionerSchema>

/* ─── Props ─── */

interface CreatePractitionerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/* ─── Component ─── */

export function CreatePractitionerDialog({
  open,
  onOpenChange,
}: CreatePractitionerDialogProps) {
  const { createMutation } = usePractitionerMutations()

  const form = useForm<FormData>({
    resolver: zodResolver(createPractitionerSchema),
    defaultValues: {
      userId: "",
      specialty: "",
      specialtyAr: "",
      bio: "",
      bioAr: "",
      experience: undefined,
      education: "",
      educationAr: "",
      priceClinic: undefined,
      pricePhone: undefined,
      priceVideo: undefined,
    },
  })

  const onSubmit = form.handleSubmit(async (data) => {
    try {
      const payload = {
        userId: data.userId,
        specialty: data.specialty,
        specialtyAr: data.specialtyAr || undefined,
        bio: data.bio || undefined,
        bioAr: data.bioAr || undefined,
        experience: data.experience,
        education: data.education || undefined,
        educationAr: data.educationAr || undefined,
        priceClinic: data.priceClinic,
        pricePhone: data.pricePhone,
        priceVideo: data.priceVideo,
      }
      await createMutation.mutateAsync(payload)
      toast.success("Practitioner created")
      form.reset()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create practitioner")
    }
  })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left">
        <SheetHeader>
          <SheetTitle>New Practitioner</SheetTitle>
          <SheetDescription>
            Add a new practitioner to the system.
          </SheetDescription>
        </SheetHeader>

        <SheetBody>
          <form id="create-practitioner-form" onSubmit={onSubmit} className="flex flex-col gap-5">
            {/* User ID */}
            <div className="flex flex-col gap-1.5">
              <Label>User ID *</Label>
              <Input {...form.register("userId")} placeholder="User UUID" />
              {form.formState.errors.userId && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.userId.message}
                </p>
              )}
            </div>

            {/* Specialty */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Specialty (EN) *</Label>
                <Input {...form.register("specialty")} placeholder="e.g. Addiction Counselor" />
                {form.formState.errors.specialty && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.specialty.message}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Specialty (AR)</Label>
                <Input {...form.register("specialtyAr")} placeholder="مثال: معالج إدمان" dir="rtl" />
              </div>
            </div>

            {/* Bio */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Bio (EN)</Label>
                <Textarea {...form.register("bio")} rows={2} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Bio (AR)</Label>
                <Textarea {...form.register("bioAr")} rows={2} dir="rtl" />
              </div>
            </div>

            {/* Experience */}
            <div className="flex flex-col gap-1.5">
              <Label>Experience (years)</Label>
              <Input
                type="number"
                min={0}
                {...form.register("experience")}
                placeholder="e.g. 5"
              />
            </div>

            {/* Education */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Education (EN)</Label>
                <Input {...form.register("education")} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Education (AR)</Label>
                <Input {...form.register("educationAr")} dir="rtl" />
              </div>
            </div>

            {/* Prices */}
            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Clinic Price</Label>
                <Input
                  type="number"
                  min={0}
                  {...form.register("priceClinic")}
                  placeholder="halalat"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Phone Price</Label>
                <Input
                  type="number"
                  min={0}
                  {...form.register("pricePhone")}
                  placeholder="halalat"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Video Price</Label>
                <Input
                  type="number"
                  min={0}
                  {...form.register("priceVideo")}
                  placeholder="halalat"
                />
              </div>
            </div>
          </form>
        </SheetBody>

        <SheetFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="submit" form="create-practitioner-form" disabled={createMutation.isPending}>
            {createMutation.isPending ? "Creating..." : "Create Practitioner"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

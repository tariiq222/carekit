"use client"

import { useEffect } from "react"
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
import type { Practitioner } from "@/lib/types/practitioner"

/* ─── Schema ─── */

const editPractitionerSchema = z.object({
  specialty: z.string().optional(),
  specialtyAr: z.string().optional(),
  bio: z.string().optional(),
  bioAr: z.string().optional(),
  experience: z.coerce.number().int().min(0).optional(),
  education: z.string().optional(),
  educationAr: z.string().optional(),
  priceClinic: z.coerce.number().int().min(0).optional(),
  pricePhone: z.coerce.number().int().min(0).optional(),
  priceVideo: z.coerce.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
})

type FormData = z.infer<typeof editPractitionerSchema>

/* ─── Props ─── */

interface EditPractitionerDialogProps {
  practitioner: Practitioner | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/* ─── Component ─── */

export function EditPractitionerDialog({
  practitioner,
  open,
  onOpenChange,
}: EditPractitionerDialogProps) {
  const { updateMutation } = usePractitionerMutations()

  const form = useForm<FormData>({
    resolver: zodResolver(editPractitionerSchema),
  })

  /* Populate form when practitioner changes */
  useEffect(() => {
    if (practitioner) {
      form.reset({
        specialty: practitioner.specialty ?? "",
        specialtyAr: practitioner.specialtyAr ?? "",
        bio: practitioner.bio ?? "",
        bioAr: practitioner.bioAr ?? "",
        experience: practitioner.experience ?? undefined,
        education: practitioner.education ?? "",
        educationAr: practitioner.educationAr ?? "",
        priceClinic: practitioner.priceClinic ?? undefined,
        pricePhone: practitioner.pricePhone ?? undefined,
        priceVideo: practitioner.priceVideo ?? undefined,
        isActive: practitioner.isActive,
      })
    }
  }, [practitioner, form])

  const onSubmit = form.handleSubmit(async (data) => {
    if (!practitioner) return
    try {
      const payload = {
        id: practitioner.id,
        specialty: data.specialty || undefined,
        specialtyAr: data.specialtyAr || undefined,
        bio: data.bio || undefined,
        bioAr: data.bioAr || undefined,
        experience: data.experience,
        education: data.education || undefined,
        educationAr: data.educationAr || undefined,
        priceClinic: data.priceClinic,
        pricePhone: data.pricePhone,
        priceVideo: data.priceVideo,
        isActive: data.isActive,
      }
      await updateMutation.mutateAsync(payload)
      toast.success("Practitioner updated")
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update practitioner")
    }
  })

  const name = practitioner
    ? `${practitioner.user.firstName} ${practitioner.user.lastName}`
    : ""

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left">
        <SheetHeader>
          <SheetTitle>Edit Practitioner</SheetTitle>
          <SheetDescription>
            Update details for {name}.
          </SheetDescription>
        </SheetHeader>

        <SheetBody>
          <form id="edit-practitioner-form" onSubmit={onSubmit} className="flex flex-col gap-5">
            {/* Specialty */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Specialty (EN)</Label>
                <Input {...form.register("specialty")} placeholder="e.g. Addiction Counselor" />
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
                <Input type="number" min={0} {...form.register("priceClinic")} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Phone Price</Label>
                <Input type="number" min={0} {...form.register("pricePhone")} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Video Price</Label>
                <Input type="number" min={0} {...form.register("priceVideo")} />
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
          <Button type="submit" form="edit-practitioner-form" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

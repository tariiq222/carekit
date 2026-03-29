"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useChatbotMutations } from "@/hooks/use-chatbot"
import {
  createKbEntrySchema,
  type CreateKbEntryFormData,
} from "@/lib/schemas/chatbot.schema"

/* ─── Props ─── */

interface CreateKbEntryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/* ─── Component ─── */

export function CreateKbEntryDialog({
  open,
  onOpenChange,
}: CreateKbEntryDialogProps) {
  const { createKbEntryMut } = useChatbotMutations()

  const form = useForm<CreateKbEntryFormData>({
    resolver: zodResolver(createKbEntrySchema),
    defaultValues: {
      title: "",
      content: "",
      category: "",
    },
  })

  const onSubmit = form.handleSubmit(async (data) => {
    try {
      await createKbEntryMut.mutateAsync({
        title: data.title,
        content: data.content,
        category: data.category || undefined,
      })
      toast.success("Entry created")
      form.reset()
      onOpenChange(false)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create entry",
      )
    }
  })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="end" className="overflow-y-auto w-full sm:max-w-[45vw]">
        <SheetHeader>
          <SheetTitle>Add Knowledge Base Entry</SheetTitle>
          <SheetDescription>
            Create a new entry for the AI assistant knowledge base.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Title *</Label>
            <Input {...form.register("title")} placeholder="Entry title" />
            {form.formState.errors.title && (
              <p className="text-xs text-destructive">
                {form.formState.errors.title.message}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label>Content *</Label>
            <Textarea
              {...form.register("content")}
              placeholder="Knowledge base content..."
              rows={5}
            />
            {form.formState.errors.content && (
              <p className="text-xs text-destructive">
                {form.formState.errors.content.message}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label>Category</Label>
            <Input
              {...form.register("category")}
              placeholder="e.g. FAQ, Services, Policies"
            />
          </div>

          <SheetFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createKbEntryMut.isPending}>
              {createKbEntryMut.isPending ? "Creating..." : "Create Entry"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"

import { Button } from "@carekit/ui"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogBody,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@carekit/ui"
import { Input } from "@carekit/ui"
import { Label } from "@carekit/ui"
import { Textarea } from "@carekit/ui"
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Knowledge Base Entry</DialogTitle>
          <DialogDescription>
            Create a new entry for the AI assistant knowledge base.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <form id="create-kb-entry-form" onSubmit={onSubmit} className="flex flex-col gap-4">
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
          </form>
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="submit" form="create-kb-entry-form" disabled={createKbEntryMut.isPending}>
            {createKbEntryMut.isPending ? "Creating..." : "Create Entry"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

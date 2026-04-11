"use client"

import { useParams } from "next/navigation"
import { GroupFormPage } from "@/components/features/groups/group-form-page"

export default function EditGroupPage() {
  const { groupId } = useParams<{ groupId: string }>()
  return <GroupFormPage mode="edit" groupId={groupId} />
}

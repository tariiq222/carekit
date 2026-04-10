"use client"

import { useRouter } from "next/navigation"
import { GroupsListContent } from "@/components/features/groups/groups-list-content"
import { useGroups } from "@/hooks/use-groups"

export function GroupsTabContent() {
  const router = useRouter()
  const groupsState = useGroups()

  return (
    <GroupsListContent
      {...groupsState}
      onGroupClick={(id) => router.push(`/groups/${id}`)}
    />
  )
}

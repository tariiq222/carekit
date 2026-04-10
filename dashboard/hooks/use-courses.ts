"use client"

import { useState, useCallback } from "react"
import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { fetchCourses, fetchCourse } from "@/lib/api/courses"
import type { CourseListQuery, CourseStatus, DeliveryMode } from "@/lib/types/courses"

export function useCourses() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [practitionerId, setPractitionerId] = useState<string | undefined>()
  const [status, setStatus] = useState<CourseStatus | undefined>()
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode | undefined>()
  const [isGroup, setIsGroup] = useState<boolean | undefined>()

  const filters: CourseListQuery = {
    page,
    perPage: 20,
    search: search || undefined,
    practitionerId,
    status,
    deliveryMode,
    isGroup,
  }

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.courses.list(filters),
    queryFn: () => fetchCourses(filters),
    staleTime: 5 * 60 * 1000,
  })

  const resetFilters = useCallback(() => {
    setSearch("")
    setPractitionerId(undefined)
    setStatus(undefined)
    setDeliveryMode(undefined)
    setIsGroup(undefined)
    setPage(1)
  }, [])

  return {
    courses: data?.items ?? [],
    meta: data?.meta ?? null,
    isLoading,
    error: error instanceof Error ? error.message : null,
    page,
    setPage,
    search,
    setSearch: (s: string) => { setSearch(s); setPage(1) },
    practitionerId,
    setPractitionerId: (v: string | undefined) => { setPractitionerId(v); setPage(1) },
    status,
    setStatus: (v: CourseStatus | undefined) => { setStatus(v); setPage(1) },
    deliveryMode,
    setDeliveryMode: (v: DeliveryMode | undefined) => { setDeliveryMode(v); setPage(1) },
    isGroup,
    setIsGroup: (v: boolean | undefined) => { setIsGroup(v); setPage(1) },
    resetFilters,
    refetch,
  }
}

export function useCourseDetail(id: string) {
  return useQuery({
    queryKey: queryKeys.courses.detail(id),
    queryFn: () => fetchCourse(id),
    staleTime: 2 * 60 * 1000,
    enabled: !!id,
  })
}

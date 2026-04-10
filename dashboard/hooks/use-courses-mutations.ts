"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import {
  createCourse,
  updateCourse,
  deleteCourse,
  publishCourse,
  cancelCourse,
  markCourseAttendance,
  enrollPatientInCourse,
  dropEnrollment,
  refundEnrollment,
} from "@/lib/api/courses"
import type {
  CreateCoursePayload,
  UpdateCoursePayload,
  MarkCourseAttendancePayload,
  EnrollCourseResult,
  Course,
} from "@/lib/types/courses"

export function useCoursesMutations() {
  const queryClient = useQueryClient()

  const invalidateAll = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.courses.all })

  const createCourseMut = useMutation<Course, Error, CreateCoursePayload>({
    mutationFn: createCourse,
    onSuccess: invalidateAll,
  })

  const updateCourseMut = useMutation<Course, Error, { id: string } & UpdateCoursePayload>({
    mutationFn: ({ id, ...payload }) => updateCourse(id, payload),
    onSuccess: invalidateAll,
  })

  const deleteCourseMut = useMutation<void, Error, string>({
    mutationFn: deleteCourse,
    onSuccess: invalidateAll,
  })

  const publishCourseMut = useMutation<Course, Error, string>({
    mutationFn: publishCourse,
    onSuccess: invalidateAll,
  })

  const cancelCourseMut = useMutation<void, Error, string>({
    mutationFn: cancelCourse,
    onSuccess: invalidateAll,
  })

  const markAttendanceMut = useMutation<
    void,
    Error,
    { courseId: string } & MarkCourseAttendancePayload
  >({
    mutationFn: ({ courseId, ...payload }) => markCourseAttendance(courseId, payload),
    onSuccess: invalidateAll,
  })

  const enrollPatientMut = useMutation<
    EnrollCourseResult,
    Error,
    { courseId: string; patientId: string }
  >({
    mutationFn: ({ courseId, patientId }) => enrollPatientInCourse(courseId, patientId),
    onSuccess: invalidateAll,
  })

  const dropEnrollmentMut = useMutation<
    void,
    Error,
    { courseId: string; enrollmentId: string }
  >({
    mutationFn: ({ courseId, enrollmentId }) => dropEnrollment(courseId, enrollmentId),
    onSuccess: invalidateAll,
  })

  const refundEnrollmentMut = useMutation<
    void,
    Error,
    { courseId: string; enrollmentId: string }
  >({
    mutationFn: ({ courseId, enrollmentId }) => refundEnrollment(courseId, enrollmentId),
    onSuccess: invalidateAll,
  })

  return {
    createCourseMut,
    updateCourseMut,
    deleteCourseMut,
    publishCourseMut,
    cancelCourseMut,
    markAttendanceMut,
    enrollPatientMut,
    dropEnrollmentMut,
    refundEnrollmentMut,
  }
}

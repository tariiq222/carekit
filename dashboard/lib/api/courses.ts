import { api } from "@/lib/api"
import type {
  Course,
  CourseListQuery,
  CreateCoursePayload,
  UpdateCoursePayload,
  MarkCourseAttendancePayload,
  EnrollCourseResult,
} from "@/lib/types/courses"
import type { PaginatedResponse } from "@/lib/types/common"

// ─── Courses CRUD ───

export async function fetchCourses(
  query: CourseListQuery = {},
): Promise<PaginatedResponse<Course>> {
  return api.get("/courses", query as Record<string, string | number | boolean | undefined>)
}

export async function fetchCourse(id: string): Promise<Course> {
  return api.get(`/courses/${id}`)
}

export async function createCourse(payload: CreateCoursePayload): Promise<Course> {
  return api.post("/courses", payload)
}

export async function updateCourse(id: string, payload: UpdateCoursePayload): Promise<Course> {
  return api.patch(`/courses/${id}`, payload)
}

export async function deleteCourse(id: string): Promise<void> {
  return api.delete(`/courses/${id}`)
}

// ─── Status Transitions ───

export async function publishCourse(id: string): Promise<Course> {
  return api.patch(`/courses/${id}/publish`, {})
}

export async function cancelCourse(id: string): Promise<void> {
  return api.patch(`/courses/${id}/cancel`, {})
}

// ─── Attendance ───

export async function markCourseAttendance(
  courseId: string,
  payload: MarkCourseAttendancePayload,
): Promise<void> {
  return api.patch(`/courses/${courseId}/attendance`, payload)
}

// ─── Enrollments ───

export async function enrollPatientInCourse(
  courseId: string,
  patientId: string,
): Promise<EnrollCourseResult> {
  return api.post(`/courses/${courseId}/enroll`, { patientId })
}

export async function dropEnrollment(courseId: string, enrollmentId: string): Promise<void> {
  return api.delete(`/courses/${courseId}/enrollments/${enrollmentId}/drop`)
}

export async function refundEnrollment(courseId: string, enrollmentId: string): Promise<void> {
  return api.patch(`/courses/${courseId}/enrollments/${enrollmentId}/refund`, {})
}

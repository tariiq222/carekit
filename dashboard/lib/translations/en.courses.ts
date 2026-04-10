/**
 * English translations — Courses
 */

export const enCourses: Record<string, string> = {
  "nav.courses": "Courses",

  "courses.title": "Courses",
  "courses.description": "Manage training courses, enrollments, and attendance tracking",

  // Page actions
  "courses.addCourse": "Add Course",
  "courses.editCourse": "Edit Course",
  "courses.deleteCourse": "Delete Course",
  "courses.publishCourse": "Publish Course",
  "courses.cancelCourse": "Cancel Course",
  "courses.courseCreated": "Course created successfully",
  "courses.courseUpdated": "Course updated successfully",
  "courses.courseDeleted": "Course deleted successfully",
  "courses.coursePublished": "Course published successfully",
  "courses.courseCancelled": "Course cancelled successfully",

  // Search & filters
  "courses.searchPlaceholder": "Search courses...",
  "courses.filterByStatus": "Filter by status",
  "courses.filterByDelivery": "Filter by delivery mode",
  "courses.filterByType": "Filter by type",
  "courses.noCourses": "No courses yet",
  "courses.noCoursesDesc": "Create your first course to get started",

  // Wizard steps
  "courses.wizard.step1": "Basic Info",
  "courses.wizard.step1Desc": "Name, description and practitioner assignment",
  "courses.wizard.step2": "Sessions & Schedule",
  "courses.wizard.step2Desc": "Session count, duration and frequency",
  "courses.wizard.step3": "Pricing & Capacity",
  "courses.wizard.step3Desc": "Price, participants and delivery mode",
  "courses.wizard.step4": "Review & Create",
  "courses.wizard.step4Desc": "Review details before creating",
  "courses.wizard.submit": "Create Course",
  "courses.wizard.next": "Next",
  "courses.wizard.back": "Back",

  // Form fields
  "courses.nameAr": "Name (Arabic)",
  "courses.nameEn": "Name (English)",
  "courses.descriptionAr": "Description (Arabic)",
  "courses.descriptionEn": "Description (English)",
  "courses.practitioner": "Practitioner",
  "courses.department": "Department",
  "courses.totalSessions": "Total Sessions",
  "courses.durationPerSession": "Duration per Session (min)",
  "courses.frequency": "Session Frequency",
  "courses.startDate": "Start Date",
  "courses.price": "Price (Halalat)",
  "courses.priceHint": "Leave 0 for free courses",
  "courses.isGroup": "Group Course",
  "courses.maxParticipants": "Max Participants",
  "courses.deliveryMode": "Delivery Mode",
  "courses.location": "Location",
  "courses.locationHint": "Required for in-person or hybrid courses",
  "courses.minutes": "min",
  "courses.free": "Free",

  // Frequency options
  "courses.frequency.weekly": "Weekly",
  "courses.frequency.biweekly": "Bi-weekly",
  "courses.frequency.monthly": "Monthly",

  // Delivery mode options
  "courses.deliveryMode.in_person": "In Person",
  "courses.deliveryMode.online": "Online",
  "courses.deliveryMode.hybrid": "Hybrid",

  // Status labels
  "courses.status.draft": "Draft",
  "courses.status.published": "Published",
  "courses.status.in_progress": "In Progress",
  "courses.status.completed": "Completed",
  "courses.status.archived": "Archived",

  // Table columns
  "courses.name": "Course Name",
  "courses.sessions": "Sessions",
  "courses.enrolled": "Enrolled",
  "courses.status": "Status",
  "courses.startDateCol": "Start Date",

  // Sessions tab
  "courses.tabs.sessions": "Sessions",
  "courses.tabs.enrollments": "Enrollments",
  "courses.tabs.details": "Details",
  "courses.noSessions": "No sessions yet",
  "courses.sessionNumber": "Session #",
  "courses.scheduledAt": "Scheduled At",
  "courses.sessionStatus": "Session Status",
  "courses.sessionStatus.scheduled": "Scheduled",
  "courses.sessionStatus.completed": "Completed",
  "courses.sessionStatus.cancelled": "Cancelled",

  // Attendance
  "courses.markAttendance": "Mark Attendance",
  "courses.attendanceMarked": "Attendance marked successfully",
  "courses.selectAttendees": "Select Attendees",
  "courses.attendedSessions": "Sessions Attended",

  // Enrollments tab
  "courses.addPatient": "Enroll Patient",
  "courses.patientEnrolled": "Patient enrolled successfully",
  "courses.dropEnrollment": "Drop Enrollment",
  "courses.refundEnrollment": "Refund Enrollment",
  "courses.enrollmentDropped": "Enrollment dropped successfully",
  "courses.enrollmentRefunded": "Enrollment refunded successfully",
  "courses.noEnrollments": "No enrollments yet",
  "courses.noEnrollmentsDesc": "Enroll patients to this course to get started",
  "courses.patient": "Patient",
  "courses.enrollmentStatus": "Enrollment Status",
  "courses.paymentStatus": "Payment Status",
  "courses.enrolledAt": "Enrolled At",
  "courses.completedAt": "Completed At",

  // Enrollment status labels
  "courses.enrollmentStatus.enrolled": "Enrolled",
  "courses.enrollmentStatus.active": "Active",
  "courses.enrollmentStatus.completed": "Completed",
  "courses.enrollmentStatus.dropped": "Dropped",
  "courses.enrollmentStatus.refunded": "Refunded",

  // Confirm dialogs
  "courses.confirmCancel": "Are you sure you want to cancel this course? All active enrollments will be dropped.",
  "courses.confirmDelete": "Are you sure you want to delete this course? This action cannot be undone.",
  "courses.confirmPublish": "Publish this course and make it available to patients?",
  "courses.confirmDrop": "Are you sure you want to drop this patient's enrollment?",

  // Stats
  "courses.totalCourses": "Total Courses",
  "courses.activeCourses": "Active Courses",
  "courses.totalEnrolled": "Total Enrolled",
  "courses.completionRate": "Completion Rate",

  "courses.createTitle": "Add Course",
}

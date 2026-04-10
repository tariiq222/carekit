-- Remove department_id from group_sessions
-- Reason: GroupSessions are support/community sessions, not medical specialty-based
ALTER TABLE "group_sessions" DROP COLUMN IF EXISTS "department_id";

-- Remove department_id from courses
-- Reason: Courses are support/training programs, not medical specialty-based
ALTER TABLE "courses" DROP COLUMN IF EXISTS "department_id";

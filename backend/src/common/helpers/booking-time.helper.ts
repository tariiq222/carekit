/**
 * Shared time-slot helpers for bookings and availability.
 * Extracted to avoid duplication across bookings.service.ts
 * and practitioner-availability.service.ts.
 */

export function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function timeSlotsOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string,
): boolean {
  return toMinutes(start1) < toMinutes(end2) && toMinutes(start2) < toMinutes(end1);
}

export function shiftTime(time: string, minutes: number): string {
  const total = Math.max(0, toMinutes(time) + minutes);
  // Cap at 23:59 to prevent midnight wraparound causing false overlap results
  const capped = Math.min(total, 23 * 60 + 59);
  return `${String(Math.floor(capped / 60)).padStart(2, '0')}:${String(capped % 60).padStart(2, '0')}`;
}

export function calculateEndTime(startTime: string, durationMinutes: number): string {
  const totalMinutes = toMinutes(startTime) + durationMinutes;
  const endHours = Math.floor(totalMinutes / 60) % 24;
  const endMinutes = totalMinutes % 60;
  return `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
}

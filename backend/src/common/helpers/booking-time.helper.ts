/**
 * Shared time-slot helpers for bookings and availability.
 * Extracted to avoid duplication across bookings.service.ts
 * and practitioner-availability.service.ts.
 */

import { BadRequestException } from '@nestjs/common';

export function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
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
  const capped = Math.min(totalMinutes, 23 * 60 + 59);
  const h = Math.floor(capped / 60);
  const m = capped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function validateNoCrossMidnight(startTime: string, durationMinutes: number): void {
  const totalMinutes = toMinutes(startTime) + durationMinutes;
  if (totalMinutes >= 24 * 60) {
    throw new BadRequestException({
      statusCode: 400,
      message: 'Booking cannot cross midnight',
      error: 'BOOKING_CROSSES_MIDNIGHT',
    });
  }
}

/**
 * Pure utility functions for practitioner availability slot calculation.
 * Extracted from PractitionerAvailabilityService to keep it under the 350-line limit.
 */

import { BadRequestException } from '@nestjs/common';
import { CLINIC_TIMEZONE_DEFAULT } from '../../config/constants/index.js';

const TIME_REGEX = /^\d{2}:\d{2}$/;

/** Returns current time as minutes-since-midnight in the given clinic timezone */
export function getNowMinutesInTz(timezone: string = CLINIC_TIMEZONE_DEFAULT): number {
  const now = new Date();
  const formattedTime = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone as Intl.DateTimeFormatOptions['timeZone'],
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now);
  const [h, m] = formattedTime.split(':').map(Number);
  return h * 60 + m;
}

/** Compares two dates by local calendar day in the given clinic timezone */
export function isSameLocalDate(a: Date, b: Date, timezone: string = CLINIC_TIMEZONE_DEFAULT): boolean {
  const fmt = (d: Date) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(d);
  return fmt(a) === fmt(b);
}

export function generateSlots(
  availabilities: Array<{ startTime: string; endTime: string }>,
  duration: number,
  bufferMinutes: number = 0,
  isToday: boolean = false,
): Array<{ startTime: string; endTime: string; available: boolean }> {
  const slots: Array<{ startTime: string; endTime: string; available: boolean }> = [];
  const step = duration + bufferMinutes;
  const nowMinutes = isToday ? getNowMinutesInTz() : -1;

  for (const avail of availabilities) {
    const [startH, startM] = avail.startTime.split(':').map(Number);
    const [endH, endM] = avail.endTime.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    for (let m = startMinutes; m + duration <= endMinutes; m += step) {
      const slotEndMinutes = m + duration;
      if (isToday && slotEndMinutes <= nowMinutes) continue;

      const pad = (n: number) => String(n).padStart(2, '0');
      const slotStart = `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
      const slotEnd = `${pad(Math.floor(slotEndMinutes / 60))}:${pad(slotEndMinutes % 60)}`;
      slots.push({ startTime: slotStart, endTime: slotEnd, available: true });
    }
  }

  return slots;
}

export function validateScheduleSlots(
  schedule: Array<{ dayOfWeek: number; startTime: string; endTime: string }>,
): void {
  for (const slot of schedule) {
    if (slot.dayOfWeek < 0 || slot.dayOfWeek > 6) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'dayOfWeek must be between 0 and 6',
        error: 'VALIDATION_ERROR',
      });
    }

    if (!TIME_REGEX.test(slot.startTime) || !TIME_REGEX.test(slot.endTime)) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Time must be in HH:mm format',
        error: 'VALIDATION_ERROR',
      });
    }

    if (slot.startTime >= slot.endTime) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'startTime must be before endTime',
        error: 'VALIDATION_ERROR',
      });
    }
  }
}

export function checkOverlappingSlots(
  schedule: Array<{ dayOfWeek: number; startTime: string; endTime: string }>,
): void {
  const byDay = new Map<number, Array<{ startTime: string; endTime: string }>>();
  for (const slot of schedule) {
    const daySlots = byDay.get(slot.dayOfWeek) ?? [];
    for (const existing of daySlots) {
      if (slot.startTime < existing.endTime && slot.endTime > existing.startTime) {
        throw new BadRequestException({
          statusCode: 400,
          message: 'Overlapping time slots on the same day',
          error: 'VALIDATION_ERROR',
        });
      }
    }
    daySlots.push({ startTime: slot.startTime, endTime: slot.endTime });
    byDay.set(slot.dayOfWeek, daySlots);
  }
}

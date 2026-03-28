# Practitioners Tests Redesign

**Date:** 2026-03-29
**Scope:** backend only — `backend/src/modules/practitioners/tests/`

## Problem

`tests/practitioners.service.spec.ts` calls methods that don't exist on `PractitionersService`
(`softDelete`, `getAvailability`, `setAvailability`, `getAvailableSlots`, `createVacation`,
`listVacations`, `deleteVacation`). These methods live on separate sub-services. All related
tests currently fail.

## Decision

Delete the old file. Replace with 6 focused spec files — one per service.

## File Map

| New file | Service under test | Coverage |
|----------|--------------------|----------|
| `practitioners.service.spec.ts` | `PractitionersService` | findAll, findOne, create, update, delete |
| `practitioner-availability.service.spec.ts` | `PractitionerAvailabilityService` | getAvailability, setAvailability, getSlots (via resolveSlots) |
| `practitioner-vacation.service.spec.ts` | `PractitionerVacationService` | getVacations, createVacation, deleteVacation |
| `practitioner-breaks.service.spec.ts` | `PractitionerBreaksService` | getBreaks, setBreaks, overlap + boundary validation |
| `practitioner-service.service.spec.ts` | `PractitionerServiceService` | assignService, listServices, updateService, removeService |
| `practitioner-ratings.service.spec.ts` | `PractitionerRatingsService` | getRatings, patient name anonymization |

## Rules Per File

- Mock only `PrismaService` (and `BookingSettingsService` where needed)
- No `any` in mock objects — use typed mocks
- `jest.clearAllMocks()` in `beforeEach`
- Each `describe` block maps to one public method
- Error paths covered: NotFoundException, ConflictException, BadRequestException

## What Gets Deleted

`backend/src/modules/practitioners/tests/practitioners.service.spec.ts` — deleted entirely.

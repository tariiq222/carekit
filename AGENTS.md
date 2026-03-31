# CareKit — Project Rules

## Project Info
- **Type:** White-label clinic management platform
- **Stack:** React Native (Expo SDK 55) + Next.js Dashboard + NestJS Backend
- **Database:** PostgreSQL + Prisma
- **Design System:** Indigo #354FD8, Apple Green #82CC17, IBM Plex Sans Arabic
- **Language:** Bilingual AR/EN, RTL-first

## Code Conventions
- Backend: NestJS modules in src/modules/{module-name}/
- Frontend Mobile: Expo components in src/components/
- Frontend Dashboard: Next.js pages in src/app/
- State: Redux Toolkit + RTK Query
- Styling: NativeWind v4 (mobile), Tailwind (dashboard)
- Auth: JWT with refresh tokens
- Validation: class-validator + class-transformer

## Testing
- Unit: Jest
- E2E: Supertest (backend), Detox (mobile)
- Coverage target: 85%+

## Important Rules
- Every API endpoint must have Swagger documentation
- Every new module needs: controller, service, dto, entity, spec
- RBAC via CASL — check permissions before every operation
- Arabic content: IBM Plex Sans Arabic, RTL alignment

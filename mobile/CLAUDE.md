# CareKit Mobile — Expo React Native

## Tech

React Native 0.83, Expo SDK 55, Expo Router (file-based), Redux Toolkit + redux-persist, Axios, i18next (AR/EN), React Hook Form + Zod.

## App Structure

```
app/
├── (auth)/               # Login, registration, OTP
├── (patient)/            # Patient-facing flows
│   ├── (tabs)/           # Bottom tab navigator
│   ├── appointment/      # Appointment detail, history
│   ├── booking/          # Book appointment flow
│   ├── practitioner/     # Practitioner profile
│   └── rate/             # Rating flow
└── (practitioner)/       # Practitioner-facing flows
    ├── (tabs)/           # Bottom tab navigator
    ├── appointment/      # Manage appointments
    └── patient/          # Patient profile view
```

## Conventions

- **Routing**: Expo Router file-based — `_layout.tsx` defines navigators
- **State**: Redux Toolkit slices in `stores/` — no Context for global state
- **API**: Axios services in `services/` — one file per domain
- **i18n**: `i18next` + `react-i18next` — translation files in `i18n/`
- **Theme**: Design tokens in `theme/` — use token values, no hardcoded colors
- **Components**: Reusable in `components/`, feature-specific stay in `app/`

## Service Files (`services/`)

`api.ts` (base Axios instance), `auth.ts`, `bookings.ts`, `chatbot.ts`,
`notifications.ts`, `payments.ts`, `practitioners.ts`, `specialties.ts`

## Key Rules

- No `any` in TypeScript
- No hardcoded strings — use i18n keys
- No hardcoded colors — use theme tokens
- 350-line max per file
- Patient and Practitioner routes must stay strictly separated
- Expo Secure Store for sensitive data (tokens), AsyncStorage for preferences

## Development

```bash
npm run dev           # Expo start (Metro bundler)
npm run ios           # iOS simulator
npm run android       # Android emulator
npm run test          # Jest + jest-expo
```

# CareKit — Development Resources & Milestones

## Part 1: GitHub Resources & Boilerplates

### 🔵 Backend (NestJS + Prisma + PostgreSQL)

#### Recommended: NestJS REST API Boilerplate
**🔗 github.com/vndevteam/nestjs-boilerplate**
- NestJS + Prisma + PostgreSQL + JWT Auth + RBAC + Swagger + Docker + I18N + File uploads + Mailing + Tests
- الأقرب لاحتياجاتنا — فيه Auth + RBAC + Email + Docker + i18n جاهزة

#### Alternative: NestJS Prisma CASL
**🔗 github.com/nishk02/nestjs-prisma-casl**
- NestJS + Prisma + CASL (Permission-based RBAC)
- CASL هي المكتبة الأقوى لـ Dynamic RBAC — بالضبط اللي نحتاجه

#### Alternative: Truthy NestJS Headless CMS
**🔗 github.com/AshwinSathian/truthy-react-frontend** (CMS backend)
- User Management + Role Management + Permission Management + Email + OTP + Throttling
- فيه نظام أدوار وصلاحيات ديناميكي جاهز

#### Key NestJS Libraries (npm packages):
| Package | Purpose | Why |
|---------|---------|-----|
| `@nestjs/passport` + `passport-jwt` | JWT Authentication | Auth foundation |
| `@casl/ability` + `@casl/prisma` | Dynamic RBAC | Permission-based — matches our need |
| `@nestjs/swagger` | API Documentation | Auto-generated Swagger docs |
| `@nestjs/bull` + `bullmq` | Job Queues | Email sending, reminders, AI tasks |
| `@nestjs/schedule` | Cron Jobs | Appointment reminders, cleanup |
| `nestjs-i18n` | Internationalization | Arabic + English |
| `@nestjs/throttler` | Rate Limiting | API protection |
| `class-validator` + `class-transformer` | Validation | Request validation |
| `nestjs-prisma` | Prisma Integration | Database ORM |
| `@nestjs-modules/mailer` | Email | OTP + confirmations + reminders |
| `minio` (npm) | File Storage | MinIO S3-compatible client |

---

### 🟢 Mobile App (React Native + Expo)

#### Selected: React Native Boilerplate ✓
**🔗 github.com/wataru-maeda/react-native-boilerplate**
- Expo SDK 54 + React 19.1 + Expo Router v6 + Redux Toolkit + TypeScript
- Already decided — CI/CD, theming, CLAUDE.md included

#### Key Expo/RN Libraries:
| Package | Purpose | Why |
|---------|---------|-----|
| `expo-router` | Navigation | Already in boilerplate |
| `@reduxjs/toolkit` + `redux-persist` | State Management | Already in boilerplate + persist for auth |
| `react-hook-form` + `zod` | Form Validation | Booking forms, profile, settings |
| `expo-notifications` | Push Notifications | Firebase FCM integration |
| `expo-calendar` | Calendar Integration | Add appointments to phone calendar |
| `expo-image-picker` | Image Upload | Receipt upload for bank transfer |
| `expo-linking` | Deep Linking | Open Zoom links |
| `react-native-calendars` | Booking Calendar | Date/time picker for appointments |
| `i18next` + `react-i18next` | i18n | Arabic + English |
| `axios` or `@tanstack/react-query` | API Client | Backend communication |
| `expo-secure-store` | Secure Storage | JWT token storage |
| `react-native-gifted-chat` | Chat UI | AI chatbot interface |

---

### 🟣 Admin Dashboard (Next.js + shadcn/ui)

#### Recommended: Next.js shadcn Dashboard Starter
**🔗 github.com/Kiranism/next-shadcn-dashboard-starter**
- Next.js 16 + shadcn/ui + Tailwind + TypeScript
- 5.9K stars — RBAC navigation, analytics, data tables, Kanban, auth pages
- الأكثر نجوماً وصيانة — RTL support + dark mode + charts

#### Alternative: Shadboard (Healthcare focused)
**🔗 github.com/taverasmisael/shadboard** (or search "shadboard")
- Patient Management, Appointments, Telemedicine modules
- Healthcare-specific dashboard — أقرب لمجالنا

#### Alternative: ShadcnStore Dashboard
**🔗 github.com/shadcnstore/shadcn-dashboard-landing-template**
- Dashboard + Landing page + Mail + Tasks + Chat + Calendar
- فيه chat و calendar components جاهزة

#### Key Dashboard Libraries:
| Package | Purpose | Why |
|---------|---------|-----|
| `shadcn/ui` | UI Components | Accessible, themeable, RTL-ready |
| `@tanstack/react-table` | Data Tables | Appointments, patients, invoices tables |
| `recharts` | Charts | Revenue, bookings, performance charts |
| `react-big-calendar` | Calendar View | Appointment calendar (day/week/month) |
| `react-hook-form` + `zod` | Forms | All admin forms |
| `next-intl` or `next-i18next` | i18n | Arabic + English |
| `nuqs` | URL State | Table filters, search, pagination |
| `cmdk` | Command Palette | Quick search across dashboard |
| `sonner` | Toast Notifications | Action confirmations |
| `lucide-react` | Icons | Consistent icon set |

---

### 🤖 AI & Chatbot

#### Key Libraries:
| Package | Purpose | Why |
|---------|---------|-----|
| `openrouter` (API) | AI Gateway | Multi-model access for chatbot + receipt verification |
| `langchain` or `vercel/ai` | AI SDK | Streaming chat, function calling, tool use |
| `@langchain/community` | Vector Store | Knowledge base for chatbot |
| `pgvector` (PostgreSQL extension) | Embeddings | Store knowledge base embeddings in same DB |

#### Chatbot Architecture:
- **Function Calling** — Bot calls backend APIs to book/modify/view appointments
- **RAG (Retrieval Augmented Generation)** — Bot reads from clinic's knowledge base
- **Vision API** — Receipt verification via OpenRouter vision models

---

### 💳 Payment

| Resource | Purpose |
|----------|---------|
| Moyasar SDK (`moyasar` npm) | Electronic payment integration |
| Moyasar API Docs | https://moyasar.com/docs/api/ |
| Custom receipt upload + AI verification | Bank transfer flow |

---

### 📹 Video (Zoom)

| Resource | Purpose |
|----------|---------|
| Zoom Meeting SDK | https://developers.zoom.us/docs/meeting-sdk/ |
| `@zoom/meetingsdk` | Zoom integration |
| Zoom OAuth + Create Meeting API | Auto-generate meeting links |

---

### 🐳 DevOps & Infrastructure

| Tool | Purpose |
|------|---------|
| Docker + Docker Compose | Container per client |
| MinIO | Self-hosted S3-compatible storage |
| Redis | Caching + job queues |
| Nginx | Reverse proxy |
| Let's Encrypt / Certbot | SSL certificates |
| GitHub Actions | CI/CD |

---

## Part 2: Claude Code Agents

### Recommended Agent Structure for CareKit:

| Agent | Role | Files |
|-------|------|-------|
| **Lead Agent** | Orchestrates all agents, reviews PRs, manages priorities | `AGENTS.md` (root) |
| **Backend Agent** | NestJS API, Prisma schema, business logic, auth, RBAC | `backend/AGENTS.md` |
| **Mobile Agent** | React Native screens, navigation, state, API integration | `mobile/AGENTS.md` |
| **Dashboard Agent** | Next.js admin pages, tables, forms, charts | `dashboard/AGENTS.md` |
| **AI Agent** | Chatbot logic, function calling, knowledge base, receipt verification | `ai/AGENTS.md` |
| **Design Agent** | UI/UX consistency, RTL, theming, White Label config | `design/AGENTS.md` |
| **DevOps Agent** | Docker, CI/CD, deployment scripts, MinIO setup | `devops/AGENTS.md` |
| **QA Agent** | Tests, validation, edge cases, accessibility | `qa/AGENTS.md` |

---

## Part 3: Milestones by Phase

---

### Phase 1: Design & Planning (2 weeks)

#### Week 1: Foundation
| # | Milestone | Deliverable | Done Criteria |
|---|-----------|-------------|---------------|
| 1.1 | ERD Complete | Database schema with all tables, relations, indexes | All 18 decisions reflected in schema |
| 1.2 | API Design | OpenAPI/Swagger spec for all endpoints | All user flows covered |
| 1.3 | Wireframes | Lo-fi wireframes for all 24 patient + 8 doctor screens | Approved by product owner |
| 1.4 | Project Setup | Monorepo initialized — backend + mobile + dashboard | `npm run dev` works on all 3 |

#### Week 2: Design
| # | Milestone | Deliverable | Done Criteria |
|---|-----------|-------------|---------------|
| 1.5 | UI Design (Mobile) | Figma — all patient + doctor screens (Arabic + English) | RTL-first, White Label theming |
| 1.6 | UI Design (Dashboard) | Figma — all 16 admin pages | Responsive, dark/light mode |
| 1.7 | User Stories | All user stories with acceptance criteria | Covers all 3 roles |
| 1.8 | Sprint Planning | Sprint backlog for Phase 2 ready | Tasks estimated and assigned |

**Phase 1 Exit Criteria:**
- [ ] ERD reviewed and approved
- [ ] API spec covers all endpoints
- [ ] Figma designs for mobile + dashboard complete
- [ ] Monorepo running locally
- [ ] User stories written with acceptance criteria

---

### Phase 2: Infrastructure + Admin Dashboard (4 weeks)

#### Week 3: Backend Core
| # | Milestone | Deliverable | Done Criteria |
|---|-----------|-------------|---------------|
| 2.1 | Database Setup | PostgreSQL + Prisma schema + migrations + seed data | All tables created, seed data works |
| 2.2 | Auth System | Email+password + Email OTP login, JWT, refresh tokens | Both login methods work |
| 2.3 | Dynamic RBAC | Roles + permissions tables, CASL integration, 5 default roles | Create custom role from API works |
| 2.4 | User Management API | CRUD users, assign roles, activate/deactivate | All endpoints tested in Swagger |

#### Week 4: Business Logic APIs
| # | Milestone | Deliverable | Done Criteria |
|---|-----------|-------------|---------------|
| 2.5 | Practitioners API | CRUD practitioners, specialties, schedules, availability | Availability calendar works correctly |
| 2.6 | Services API | CRUD services, categories, pricing | Services linked to specialties |
| 2.7 | Booking API | Create, modify, cancel bookings + conflict detection | Double-booking prevented |
| 2.8 | Notifications API | Email sending (Resend/SendGrid) + Push setup (Firebase) | OTP email + booking confirmation sent |

#### Week 5: Admin Dashboard - Core
| # | Milestone | Deliverable | Done Criteria |
|---|-----------|-------------|---------------|
| 2.9 | Dashboard Layout | Sidebar, header, auth pages, theme switching (AR/EN) | RTL works, dark mode works |
| 2.10 | Dashboard Home | Stats cards, today's bookings, revenue chart | Real data from API |
| 2.11 | Appointment Management | Calendar view + table + filters + edit/cancel | All appointment states handled |
| 2.12 | Practitioner Management | CRUD + schedule editor + availability calendar | Schedule affects booking slots |

#### Week 6: Admin Dashboard - Extended
| # | Milestone | Deliverable | Done Criteria |
|---|-----------|-------------|---------------|
| 2.13 | Patient Management | Patient list + search + visit history | Search by name/email works |
| 2.14 | Users & Permissions | Role management + permission matrix + user assignment | Custom role creation works |
| 2.15 | Service Management | CRUD services + categories + pricing | Linked to booking system |
| 2.16 | White Label Settings | Logo, colors, domain, contact info, payment keys, Zoom keys | Changes reflect immediately |

**Phase 2 Exit Criteria:**
- [ ] All backend APIs working and documented in Swagger
- [ ] Auth with both methods (password + OTP) working
- [ ] Dynamic RBAC with custom roles working
- [ ] Admin dashboard fully functional with real data
- [ ] White Label settings changeable from dashboard
- [ ] 5 default roles seeded and tested

---

### Phase 3: Website + Booking System (3 weeks)

#### Week 7: Booking System + Payments
| # | Milestone | Deliverable | Done Criteria |
|---|-----------|-------------|---------------|
| 3.1 | Booking Widget | Embeddable booking component — specialty → practitioner → date → time | Full booking flow works |
| 3.2 | Moyasar Integration | Payment processing — Mada, Apple Pay, cards | Test payment succeeds |
| 3.3 | Bank Transfer Flow | Upload receipt + status tracking (pending → approved/rejected) | Receipt upload + admin review works |
| 3.4 | AI Receipt Verification | Vision API reads receipt → compares with booking → generates tags | Tags appear in admin dashboard |

#### Week 8: Invoice + Cancellation
| # | Milestone | Deliverable | Done Criteria |
|---|-----------|-------------|---------------|
| 3.5 | Invoice System | Auto-generate invoice after payment + PDF export | Invoice sent to patient email |
| 3.6 | Cancellation Flow | Patient requests → admin reviews → approve/reject + refund | Full cancellation cycle works |
| 3.7 | Payment Dashboard | Payment log + bank transfer verification page + reports | AI tags displayed, filter by status |
| 3.8 | Financial Reports | Revenue reports + export Excel/PDF | Date range + practitioner filters |

#### Week 9: Website (First Client)
| # | Milestone | Deliverable | Done Criteria |
|---|-----------|-------------|---------------|
| 3.9 | Website Design | Custom design for first client in Figma | Client approved |
| 3.10 | Website Development | Next.js website — all pages pulling from API | All 10 pages working |
| 3.11 | Booking Widget Embed | Booking widget embedded in website + inherits site theme | Books appointment from website |
| 3.12 | AI Chat Widget | Floating chatbot on website | Answers questions + books appointments |

**Phase 3 Exit Criteria:**
- [ ] Complete booking flow (browse → book → pay → confirm)
- [ ] Moyasar payments working (test mode)
- [ ] Bank transfer with AI verification working
- [ ] Invoice auto-generation working
- [ ] Cancellation flow with admin approval working
- [ ] First client website live with booking + chatbot
- [ ] Financial reports exportable

---

### Phase 4: Mobile App (3 weeks)

#### Week 10: Patient App - Core
| # | Milestone | Deliverable | Done Criteria |
|---|-----------|-------------|---------------|
| 4.1 | App Setup | Boilerplate configured — splash, onboarding, auth screens | Login with both methods works |
| 4.2 | Content Screens | Home, services, specialties, practitioner list, practitioner profile | Data from API, Arabic + English |
| 4.3 | About + FAQ | Center info + FAQ screens | White Label content from API |
| 4.4 | i18n Setup | Arabic + English throughout the app | Language switch works |

#### Week 11: Patient App - Booking + Payment
| # | Milestone | Deliverable | Done Criteria |
|---|-----------|-------------|---------------|
| 4.5 | Booking Flow | Type → practitioner → date → confirm → pay | Full flow works on mobile |
| 4.6 | Payment Screen | Moyasar + bank transfer + receipt upload (camera/gallery) | Both payment methods work |
| 4.7 | My Appointments | Upcoming + past + cancelled + details + Zoom link | All states displayed correctly |
| 4.8 | Push Notifications | Firebase FCM — booking confirmations, reminders | Notifications received on device |

#### Week 12: Doctor App + Shared Modules
| # | Milestone | Deliverable | Done Criteria |
|---|-----------|-------------|---------------|
| 4.9 | Doctor Screens | Home, today's schedule, calendar, patient records, availability | All 8 doctor screens working |
| 4.10 | Role-based Routing | Login detects role → routes to correct interface | Patient ↔ Doctor switch works |
| 4.11 | Rating + Feedback | Stars + text + problem report after each appointment | Rating affects practitioner ranking |
| 4.12 | Profile + Settings | Edit profile, language, notifications, about, logout | Both roles share settings |

**Phase 4 Exit Criteria:**
- [ ] Patient can browse, book, pay, view appointments on mobile
- [ ] Doctor can view schedule, manage availability, see patient records
- [ ] Role-based routing works correctly
- [ ] Push notifications working
- [ ] Arabic + English working throughout
- [ ] Rating + feedback system working
- [ ] App builds successfully for iOS + Android (EAS Build)

---

### Phase 5: AI Chatbot + Zoom + Rating (2 weeks)

#### Week 13: AI Chatbot
| # | Milestone | Deliverable | Done Criteria |
|---|-----------|-------------|---------------|
| 5.1 | Chat Engine | OpenRouter integration + streaming responses | Bot responds in Arabic + English |
| 5.2 | Knowledge Base | FAQ + services + practitioners data indexed | Bot answers clinic-specific questions |
| 5.3 | Function Calling | Bot books appointments via API calls | "Book me with Dr. Ahmed Sunday" works |
| 5.4 | Bot Actions | Modify appointment + view appointments + request cancellation | All 4 actions work correctly |

#### Week 14: Zoom + Rating + Polish
| # | Milestone | Deliverable | Done Criteria |
|---|-----------|-------------|---------------|
| 5.5 | Zoom Integration | Auto-generate Zoom link on video booking + send to both parties | Link works, opens Zoom |
| 5.6 | Bot Handoff | Transfer to Live Chat or show contact number (per settings) | Both fallback modes work |
| 5.7 | Chatbot Dashboard | Conversation log + most-asked analytics + knowledge base editor | Admin can review + edit |
| 5.8 | Rating Reports | Patient satisfaction dashboard + practitioner rankings | Reports show in admin |

**Phase 5 Exit Criteria:**
- [ ] Chatbot books, modifies, views, and requests cancellation
- [ ] Chatbot reads from clinic knowledge base
- [ ] Zoom links auto-generated and sent
- [ ] Handoff to human works (both modes)
- [ ] Rating system complete with admin reports
- [ ] Bot works on mobile app + website widget

---

### Phase 6: Testing & Delivery (2 weeks)

#### Week 15: Testing
| # | Milestone | Deliverable | Done Criteria |
|---|-----------|-------------|---------------|
| 6.1 | Integration Testing | All user flows tested end-to-end | 0 critical bugs |
| 6.2 | Security Audit | Auth, permissions, API protection, data validation | No vulnerabilities found |
| 6.3 | Performance Testing | Load testing API + mobile + dashboard | Acceptable response times |
| 6.4 | RTL + i18n Testing | All screens tested in Arabic + English | No layout breaks |

#### Week 16: Delivery
| # | Milestone | Deliverable | Done Criteria |
|---|-----------|-------------|---------------|
| 6.5 | Docker Image | Production Docker Compose with all services | `docker compose up` works |
| 6.6 | Documentation | Installation guide + API docs + user guide (Arabic) | Non-technical admin can use guide |
| 6.7 | App Store Submission | iOS + Android builds submitted to stores | Apps approved by Apple + Google |
| 6.8 | Client Training | Training session for client team + handoff | Client team can operate independently |
| 6.9 | Go Live | Production deployment on client's server | System live and accepting bookings |

**Phase 6 Exit Criteria:**
- [ ] All critical and major bugs fixed
- [ ] Security audit passed
- [ ] Docker deployment tested on clean server
- [ ] iOS + Android apps published on stores
- [ ] Documentation complete
- [ ] Client team trained
- [ ] System live in production
- [ ] 30-day support period started

---

## Summary

### Total Milestones: 49
| Phase | Milestones | Duration |
|-------|-----------|----------|
| 1. Design & Planning | 8 | 2 weeks |
| 2. Infrastructure + Dashboard | 16 | 4 weeks |
| 3. Website + Booking + Payment | 12 | 3 weeks |
| 4. Mobile App | 12 | 3 weeks |
| 5. AI + Zoom + Rating | 8 | 2 weeks |
| 6. Testing & Delivery | 9 | 2 weeks |
| **Total** | **65** | **16 weeks** |

### Critical Path
The following milestones are on the critical path — delays here delay the entire project:
1. **ERD (1.1)** → everything depends on the database schema
2. **Auth + RBAC (2.2, 2.3)** → every feature needs auth
3. **Booking API (2.7)** → core product functionality
4. **Moyasar Integration (3.2)** → payment is essential for launch
5. **App Store Submission (6.7)** → Apple review can take 1-2 weeks

---

*CareKit — WebVue Technology Solutions — March 2026*

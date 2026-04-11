# CareKit — Product Requirements Document (PRD)

**Product:** CareKit — Smart Clinic Management Platform (White Label)
**Company:** WebVue Technology Solutions
**Version:** 1.0 (MVP)
**Date:** March 2026
**Classification:** Confidential

---

## 1. Overview

### 1.1 Product Description

CareKit is a comprehensive White Label product for managing clinics and medical centers. It includes a mobile app (iOS + Android), a custom-designed website per client, an admin dashboard, and an AI assistant. Deployed on the client's server with their branding and visual identity.

### 1.2 Business Model

The product consists of two layers:

- **Product (White Label):** Mobile app + admin dashboard + backend + AI — same codebase for every client, customized via the admin dashboard
- **Service (Custom):** The website is designed from scratch for each client with a unique design by WebVue

### 1.3 Target Market

- Clinics and medical centers
- Mental health and addiction centers
- Rehabilitation and physiotherapy centers
- Any health center offering appointment-based services

### 1.4 Product Goals

- Provide a complete digital experience for clients (booking + payment + consultations + AI chat)
- Enable centers to manage all operations from a single dashboard
- Sell the product to multiple clients as a White Label product
- Offer custom website design as an additional revenue stream

---

## 2. Core Components

### 2.1 Mobile App (Clients + Doctors)

Single app with dual roles running on iOS and Android via React Native (Expo). The system detects the user's role at login and displays the appropriate interface automatically.

- **Client:** Browses services and employees, books appointments, pays, communicates with AI chatbot
- **Employee:** Views their schedule, manages availability, views client records, receives notifications

### 2.2 Website (Custom Design Per Client)

Professional website designed from scratch for each client with a completely different identity and design. Connects to the same API, pulling services, employees, booking, and chatbot data automatically.

### 2.3 Admin Dashboard

Comprehensive dashboard for managing appointments, doctors, clients, invoices, services, reports, notifications, White Label settings, and a flexible permissions system.

### 2.4 AI Assistant (Chatbot)

Smart chatbot that reads from the center's database directly, answers client inquiries 24/7, and books appointments as a complete booking channel. Works in Arabic and English.

---

## 3. User Flows

### 3.1 Client — Content Browsing + Manual Booking

1. Open app — Home screen shows center services, featured employees, latest offers
2. Browse content — Services, employee profiles, about the center, prices (no login required)
3. Sign in / Sign up — When ready to book: email + password or email + OTP (code sent to email)
4. Select specialty and employee — Browse specialties → choose employee by rating and availability
5. Select booking type — Clinic visit or phone/video consultation
6. Select appointment — Calendar showing available slots only
7. Payment — Moyasar (Mada, Apple Pay, card) or bank transfer (upload receipt)
8. Confirmation — Instant confirmation + Push notification + email + calendar add

### 3.2 Client — AI Chatbot Booking

1. Open chat — From app or website
2. Describe need — "I want to book a psychology appointment" or "I have a question about your services"
3. Bot reads center data — Shows available services, suitable employees, open time slots
4. Suggestion and confirmation — Bot suggests a employee and time
5. Client confirms — Bot creates the booking automatically
6. Redirect to payment — Moyasar link or bank account details for transfer
7. Follow-up or handoff — Bot answers further questions. Complex issues → Live Chat or contact number (per client settings)

### 3.3 Phone Consultation

1. Select "Phone Consultation" at booking
2. Select employee and appointment
3. Payment — Moyasar or bank transfer
4. Confirmation + reminder via Push + email
5. Employee calls client — Call happens outside the platform. System shows client's phone number to employee
6. Rating and Feedback — Stars + notes + problem report

### 3.4 Video Consultation (Zoom)

1. Select "Video Consultation" at booking
2. Select employee and appointment
3. Payment
4. Receive Zoom link — System generates link automatically and sends to both parties
5. Join via Zoom — Opens directly
6. Rating and Feedback

### 3.5 Employee / Doctor

1. Login — Email + password (account created by admin)
2. View schedule — Daily/weekly
3. Manage availability — Working hours, vacations, break periods
4. Remote consultations — Phone: client's number displayed. Video: Zoom link
5. View client records — Visit history
6. Receive notifications — New bookings, cancellations, modifications

### 3.6 System Admin

Manages all operations from the dashboard: appointments, doctors, clients, services, invoices, payments, reports, notifications, chatbot, permissions, White Label settings.

---

## 4. App Screens

### 4.1 Client Screens (24 screens)

**Browsing & Content (no login required — synced with website):**

| Screen | Description | Notes |
|--------|-------------|-------|
| Splash Screen | Loading screen with clinic logo | White Label |
| Onboarding | 3 introductory screens | First time only |
| Home | Banner + services + featured employees + offers | Main tab |
| Services | All center services with detailed pricing | Synced with website |
| Specialties | Specialty list with icons | Filter and search |
| Employees List | Employees by specialty with rating and price | Advanced filtering |
| Employee Profile | Photo, specialty, experience, ratings, available times | Book + chat buttons |
| About the Center | Center info, vision, mission | White Label |
| FAQ | FAQ with search | Also feeds chatbot |

**Booking & Payment (login required):**

| Screen | Description | Notes |
|--------|-------------|-------|
| Login | Email + password or email + OTP (email code) | No SMS |
| Sign Up | Name, gender, date of birth, email | Basic fields |
| Booking Type | Clinic visit or phone/video consultation | Different prices |
| Booking Calendar | Day and time selection | Calendar picker |
| Booking Confirmation | Summary before payment | Optional notes |
| Payment | Moyasar or bank transfer + receipt upload | Transfer: pending confirmation |
| Payment Confirmation | Success message + reference number | Add to calendar |
| My Appointments | Upcoming + past + cancelled | Cancel/modify |
| Appointment Details | Details + Zoom link (video) or employee number (phone) | By consultation type |
| Rating + Feedback | Stars + notes + problem report | After every appointment |

**AI Chat:**

| Screen | Description | Notes |
|--------|-------------|-------|
| AI Chat | Answers about services, books appointments, shows appointments, requests cancellation | Complete booking channel |

**General:**

| Screen | Description |
|--------|-------------|
| Notifications | Appointments, reminders, offers |
| Profile | My info + edit |
| Settings | Language, notifications, privacy |

### 4.2 Employee Screens (8 screens)

| Screen | Description | Notes |
|--------|-------------|-------|
| Employee Login | Email + password | Account from admin |
| Home (Employee) | Today's summary: appointment count, next up, stats | Main tab |
| Today's Schedule | All today's appointments in order + status | Color-coded status |
| Weekly/Monthly Calendar | All appointments on calendar | Week/month navigation |
| Appointment Details | Client data + phone number (phone) or Zoom link (video) | By type |
| Client Records | Client list + visit history | Search by name or number |
| Availability Management | Working hours + vacations + breaks | Affects booking availability |
| Earnings Summary | Session count + earnings | Optional |

### 4.3 Shared Modules (6)

| Module | Description |
|--------|-------------|
| Consultation Link | Auto Zoom (video) or client number (phone) |
| Notifications | Push — content varies by role |
| Chat | Client with bot. Employee receives handoffs |
| Profile | Fields vary by role |
| Settings | Unified |
| About Center | White Label |

---

## 5. Website Pages

**Note:** Design, layout, sections, and styling differ per client — WebVue designs each website uniquely. Pages below are the baseline.

| Page | Description | Notes |
|------|-------------|-------|
| Home | Hero + services + employees + testimonials + CTA | Unique design per client |
| Our Services | All services with pricing | Data from API |
| Our Employees | List + detailed profiles | Data from API |
| Book Appointment | Embedded booking system | Shared Booking Widget |
| About Us | Center story, vision, mission | Custom content |
| Contact Us | Form + map + contact info | Google Maps |
| FAQ | FAQ with search | Also feeds chatbot |
| Blog | Health articles (optional) | CMS from dashboard |
| Privacy Policy | Data protection | Saudi PDPL compliant |
| Terms & Conditions | Platform terms | Legal |
| Booking Widget | Embedded booking — any page | Inherits site colors |
| AI Chat Widget | Floating chatbot — all pages | Inherits site colors |

---

## 6. Admin Dashboard Pages

| Page | Description | Permissions |
|------|-------------|-------------|
| Dashboard | Quick stats: today's bookings, revenue, upcoming | All |
| General Calendar | Full calendar — daily/weekly/monthly | All |
| Appointment Management | Table + filter + search + edit + cancel | Admin, Reception |
| Doctor Management | Add/edit/delete + work schedules + vacations | Admin |
| Client Management | Records + visit history + search | Admin, Reception |
| Service Management | Services and prices + categories | Admin |
| Invoices | Create + track payment + send | Admin, Accountant |
| Payments | Payment log (Moyasar + transfers) + reports | Admin, Accountant |
| Bank Transfer Verification | Uploaded receipts + AI Tags (matched/different/suspicious) + approve/reject | Admin, Accountant |
| Reports | Bookings, revenue, doctor performance + export | Admin |
| Ratings & Feedback | Client ratings + notes + problem reports | Admin |
| Notifications | Send group or individual Push notifications | Admin |
| Chatbot Settings | Knowledge base + auto-replies + conversation log | Admin |
| Users & Permissions | 5 default roles + custom roles + granular permissions (view, create, edit, delete) per section | Admin only |
| White Label Settings | Logo, colors, domain, contact info, payment config | Admin only |
| Activity Log | Audit log — all system operations | Admin only |

---

## 7. Detailed Features

### 7.1 Advanced Booking System

- Book clinic appointments with specialty, employee, day, and time selection
- Book phone and video consultations
- Smart calendar showing available slots only
- Automatic double-booking protection
- Automatic reminders before appointments (Push + email)
- Cancellation and rescheduling — request goes to admin for approval
- Waitlist when appointments are full
- Multi-service booking in single session

### 7.2 Remote Consultations

- Phone consultation = appointment booking only — employee calls outside the platform
- Video consultation = booking + automatic Zoom link generation
- System generates Zoom link and sends to both parties (Push + email)
- System shows client's phone number to employee (for phone consultations)
- Automatic reminders before appointment for both parties
- Prepayment required for both types
- Zoom account provided by client — API keys entered in dashboard

### 7.3 AI Assistant (Chatbot)

**Capabilities:**
- Book new appointment
- Modify appointment (change time)
- Show upcoming appointments
- Request cancellation — does NOT execute, sends request to admin (involves refund)
- Answer questions about services, prices, and employees

**Fallback:**
- Handoff to Live Chat or provide contact number (per client settings)

**Technical:**
- Reads from center's database directly
- Customizable knowledge base per clinic
- Works in Arabic and English
- Full conversation log in dashboard
- Most-asked questions analytics

### 7.4 Invoicing & Payments

- Electronic payment via Moyasar (Mada, Apple Pay, Visa/MC)
- Manual bank transfer — client uploads receipt photo
- AI receipt verification via Vision API (OpenRouter):
  - Matched (green) — receipt amount = booking amount
  - Amount differs (orange) — discrepancy in amount
  - Old date (orange) — transfer older than 48 hours
  - Suspicious (red) — not a bank receipt, duplicate, name mismatch
  - Unreadable (gray) — unclear image
- Final decision always with admin — approve or reject
- Automatic electronic invoices
- Refund from dashboard
- Financial reports + Excel/PDF export
- VAT support (15%)

### 7.5 Rating & Feedback

- Star rating (1-5) after every appointment — shown on employee profile, affects ranking
- Optional text feedback — visible to admin
- Problem report (employee didn't call, late, technical issue) — instant alert to admin
- Client satisfaction reports in dashboard

### 7.6 Cancellation & Refund Policy

- Each client sets their own policy from dashboard (text shown to client)
- No automatic rules — client requests cancellation → goes to admin → admin decides: full/partial/no refund
- Chatbot requests cancellation but does not execute it

### 7.7 Permissions System (Dynamic RBAC)

- Permission-based flexible system
- 5 default roles: System Admin, Receptionist, Accountant, Employee/Doctor, Client/Client
- Client can create custom roles from dashboard
- Set permissions per role (view, create, edit, delete) for each section
- User management and role assignment

### 7.8 White Label System

**From dashboard (no code):**
- App identity: Logo, colors, font, app icon, Splash Screen
- Domain & app: Domain name, app name on stores
- Contact info: Phone, email, address, social media
- Payment gateway: Client's Moyasar API keys, bank account details
- Chatbot: Knowledge base, auto-replies, OpenRouter API key
- Notifications: Email templates, reminder settings, Firebase keys
- Content: "About Us", Privacy Policy, Terms, FAQ
- General settings: Timezone, language, cancellation policy, session duration, working hours
- Zoom: Client's Zoom API keys

---

## 8. Technical Architecture

### 8.1 Core Stack

| Layer | Technology | Reason |
|-------|-----------|--------|
| Mobile App | React Native (Expo SDK 54) | Single codebase for iOS + Android |
| Website + Dashboard | Next.js 14 + Tailwind CSS | SEO + performance + native RTL |
| Backend | NestJS + Prisma ORM | Strong architecture + full TypeScript |
| Database | PostgreSQL | Reliable + open source |
| Styling | Tailwind CSS | Native RTL + rapid development |
| Containerization | Docker + Docker Compose | Easy deployment on any server |

### 8.2 External Services

| Service | Technology | Description |
|---------|-----------|-------------|
| AI Engine | OpenRouter | Multi-model — chatbot + receipt verification |
| Video Consultations | Zoom API | Auto-generated link per session |
| Electronic Payment | Moyasar | Mada, Apple Pay, cards |
| Push Notifications | Firebase FCM | Instant notifications |
| File Storage | MinIO | Self-hosted — on client's server |
| Email | Resend / SendGrid | Confirmations + OTP + notifications |
| Cache | Redis | Cache + Rate Limiting |

### 8.3 Development Tools

| Tool | Description |
|------|-------------|
| TypeScript | Strict typing across all code |
| ESLint + Prettier | Code quality and formatting |
| Jest | Unit + Integration tests |
| GitHub Actions | CI/CD Pipelines |
| Prisma Migrate | Database migration management |
| Swagger / OpenAPI | Automatic API documentation |
| Husky | Pre-commit hooks |
| Claude Code | AI-assisted development |

### 8.4 Mobile Boilerplate

[wataru-maeda/react-native-boilerplate](https://github.com/wataru-maeda/react-native-boilerplate) — Expo SDK 54 + React 19.1 + Expo Router v6 + Redux Toolkit + TypeScript + CI/CD + Light/Dark theme + CLAUDE.md. MIT License.

**Included:** Project structure, navigation, state management, theming, CI/CD, environment variables, ESLint/Prettier/Jest

**To build on top:** All business logic (Auth, API, booking, payment, chat, Zoom, notifications, screens)

### 8.5 Language

Arabic + English from the start (i18n) — RTL-first design

---

## 9. Timeline

**Total Duration: 14-18 weeks (3.5 - 4.5 months)**

| Phase | Duration | Deliverables |
|-------|----------|-------------|
| 1. Design & Planning | 2 weeks | Figma Design, ERD, API Spec, User Stories |
| 2. Infrastructure + Dashboard | 4 weeks | NestJS API, PostgreSQL + Prisma, Admin Dashboard, Auth + Dynamic RBAC |
| 3. Website + Booking System | 3 weeks | Next.js Website, Booking System, Moyasar + Bank Transfer, AI Receipt Verification, Invoice System |
| 4. Mobile App | 3 weeks | React Native App, Push Notifications, App Store Ready |
| 5. AI Chatbot + Zoom + Rating | 2 weeks | AI Chatbot, Zoom Integration, Knowledge Base, Rating System, Feedback + Reports |
| 6. Testing & Delivery | 2 weeks | QA Testing, Documentation, User Guide (Arabic), Docker Image, Training Session |

---

## 10. Final Deliverables

- Complete project source code with usage rights
- Mobile app ready for App Store and Google Play publishing
- Custom-designed website, installed and configured
- Full admin dashboard
- Docker Image ready for deployment on any server
- Installation Guide
- Arabic User Guide
- Client team training session
- 30-day post-delivery technical support

---

## 11. Delivery & Operations Model

### Deployment

Each instance runs as an independent Docker Container:

```bash
git clone [repo-url] clinic-app
cp .env.example .env   # Edit settings
docker compose up -d
```

### App Store Accounts

- Client opens Apple Developer ($99/year) + Google Play Console ($25 one-time)
- WebVue publishes the app as a service

### Zoom Account

- Client provides their Zoom Pro account and enters API keys in dashboard

### Updates

- Manual for now — WebVue updates each client within maintenance contract
- Automatic in the future when 10+ clients

### Pricing

- Custom quote per client based on their needs
- No fixed packages

### Revenue Streams Per Client

1. Product license (app + dashboard + backend + AI)
2. Website design service (custom per client)
3. Annual maintenance (optional)
4. Additional development on request
5. App store publishing service

---

## 12. Decision Log

| # | Decision | Result | Reason |
|---|----------|--------|--------|
| 1 | Product name | CareKit (internal) | Short, expresses toolkit |
| 2 | Client login | Email + password and Email + OTP (email) | Simpler — no SMS needed |
| 3 | Employee login | Email + password (from admin) | Role-based routing |
| 4 | Payment gateway | Moyasar + manual bank transfer | Moyasar most popular + transfer covers the rest |
| 5 | Transfer verification | AI Vision + Tags + admin decision | Assists without replacing humans |
| 6 | Phone consultation | Call outside platform | Simplest |
| 7 | Video consultation | Zoom only — client provides account | Zoom is well-known |
| 8 | App architecture | Single app with dual roles | Saves time + one app per store |
| 9 | Website | Custom design per client | Additional revenue stream |
| 10 | Language | Arabic + English | Saudi market needs both |
| 11 | AI | OpenRouter | Flexibility + better pricing |
| 12 | Storage | MinIO (self-hosted) | Aligns with White Label model |
| 13 | Bot capabilities | Book + modify + view + request cancel (no execution) | Cancellation involves refund |
| 14 | Cancellation policy | Client sets it — admin decides each case | Simplest + most flexible |
| 15 | Store accounts | Client opens + WebVue publishes | White Label |
| 16 | Pricing | Custom quote per client | Negotiation flexibility |
| 17 | Updates | Manual now — automatic later | MVP first |
| 18 | Permissions | Dynamic RBAC — 5 default + custom | White Label needs flexibility |

---

*CareKit — A product by WebVue Technology Solutions*
*Confidential — March 2026*

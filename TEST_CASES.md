# TEST CASES — SaaS-06b/c/d: P0 Tenant Settings

**Kiwi Product:** CareKit (id=1)  
**Version:** main  
**Date:** 2026-04-23

---

## PR1 — SaaS-06b: Organization Profile (Kiwi: `CareKit / Organization / Manual QA`)

### Unit Tests (colocated with handlers)

| File | Cases |
|------|-------|
| `get-org-profile.handler.spec.ts` | Returns merged profile from Organization + BrandingConfig; handles missing BrandingConfig (upsert fallback) |
| `update-org-profile.handler.spec.ts` | Updates name + slug + tagline atomically; slug conflict throws SLUG_TAKEN; syncs BrandingConfig.organizationNameAr/En |

### Manual QA Gate (Chrome DevTools MCP)

| # | Summary | Steps | Expected |
|---|---------|-------|----------|
| OP-01 | Page loads with current org data | Navigate to /settings/organization | Shows nameAr, slug, tagline, logo |
| OP-02 | Edit org name (AR + EN) | Change nameAr → Save | Toast "تم حفظ الملف"; values persist on reload |
| OP-03 | Edit tagline | Type description → Save | Saved; visible on reload |
| OP-04 | Change slug to available value | Type new slug → Save | Success; slug updated |
| OP-05 | Change slug to taken value | Type existing org slug → Save | Inline error "هذا المعرّف مستخدم" |
| OA-06 | Slug caution banner | Type new value in slug field | Yellow caution banner appears |
| OP-07 | Logo upload | Click upload → select PNG → Save | Logo updates in header/page |
| OP-08 | Invalid logo (PDF) | Upload PDF as logo | Error toast; logo unchanged |
| OP-09 | RTL layout | View in Arabic locale | All fields right-aligned; labels correct |
| OP-10 | EN locale | View in English locale | All labels in English; LTR fields |

---

## PR2 — SaaS-06c: Members Management (Kiwi: `CareKit / Members / Manual QA`)

### Unit Tests

| File | Cases |
|------|-------|
| `list-members.handler.spec.ts` | Returns members with joined User data; filters by role; filters by isActive |
| `invite-member.handler.spec.ts` | Creates Invitation + sends email; rejects duplicate (ALREADY_MEMBER); revokes prior pending invite for same email |
| `update-member-role.handler.spec.ts` | Updates role; rejects change on sole OWNER |
| `deactivate-member.handler.spec.ts` | Sets isActive=false; rejects deactivate self; rejects deactivate sole OWNER |
| `list-invitations.handler.spec.ts` | Returns PENDING + EXPIRED; marks expired correctly |
| `revoke-invitation.handler.spec.ts` | Sets REVOKED; rejects if already ACCEPTED |

### Tenant Isolation Tests (e2e)

| File | Cases |
|------|-------|
| `members.e2e-spec.ts` | Org A user cannot list Org B members (403/empty); Org A user cannot deactivate Org B membership via direct ID (404); Cross-org FK injection on membershipId rejected |

### Manual QA Gate (Chrome DevTools MCP)

| # | Summary | Steps | Expected |
|---|---------|-------|----------|
| MB-01 | Page loads with member list | Navigate to /settings/members | Members table with current users |
| MB-02 | Stats grid shows correct counts | View page | Total / Active / Pending / Owners correct |
| MB-03 | Search by name | Type partial name in search | Table filters live |
| MB-04 | Filter by role | Select RECEPTIONIST | Only receptionists shown |
| MB-05 | Invite new user | Click "دعوة عضو" → enter email + role → Submit | Toast "تم إرسال الدعوة"; invitation appears in pending list |
| MB-06 | Invite existing member | Enter email of current member | Error "هذا المستخدم عضو بالفعل" |
| MB-07 | Revoke invitation | Click revoke on pending invite | Invitation removed from list |
| MB-08 | Change member role | Change RECEPTIONIST → ADMIN | Role badge updates; no page reload |
| MB-09 | Deactivate member | Click deactivate → confirm | Member status → inactive; row grayed |
| MB-10 | Cannot deactivate self | Logged-in user tries to deactivate own account | Action disabled / error toast |
| MB-11 | Cannot change sole OWNER | Try to change only OWNER's role | Error toast |
| MB-12 | Accept invitation (happy path) | Open invite link in email → register/login | Auto-joined org; dashboard access granted |
| MB-13 | Accept expired invitation | Open link after 72h | Error page "الدعوة منتهية الصلاحية" |
| MB-14 | RTL layout | View in Arabic | Table RTL; badges correct |

---

## PR3 — SaaS-06d: Payment Methods (Kiwi: `CareKit / Billing / Manual QA`)

### Unit Tests

| File | Cases |
|------|-------|
| `save-payment-method.handler.spec.ts` | Creates Moyasar customer if missing; saves card token + meta; maps INVALID_CARD error |
| `get-payment-method.handler.spec.ts` | Returns hasCard=false when no token; returns display data when card exists; never returns raw token |
| `remove-payment-method.handler.spec.ts` | Nulls out token + meta; calls MoyasarApiClient.deleteCard; rejects removal within 7-day renewal window |

### Manual QA Gate (Chrome DevTools MCP)

| # | Summary | Steps | Expected |
|---|---------|-------|----------|
| PM-01 | No card state | Navigate to /settings/billing (no card) | Section shows "لا توجد بطاقة محفوظة" + "إضافة بطاقة" |
| PM-02 | Add card (valid Moyasar test card) | Click "إضافة بطاقة" → enter test card details → Submit | Card chip shows brand + ●●●● last4 + MM/YY |
| PM-03 | Add invalid card | Enter invalid card number | Error "بيانات البطاقة غير صحيحة" |
| PM-04 | Card display after save | Reload /settings/billing | Card chip still visible; data persists |
| PM-05 | Remove card | Click "حذف البطاقة" → confirm | Back to no-card state |
| PM-06 | Remove blocked near renewal | Subscription renews in 3 days → try remove | Error "لا يمكن الحذف قبل التجديد القادم" |
| PM-07 | Change card | Click "تغيير البطاقة" → enter new card | Old card replaced; new last4 shown |
| PM-08 | Only OWNER can manage card | Login as ADMIN → /settings/billing | No add/remove card buttons visible |
| PM-09 | Raw token never exposed | Check network responses | No card token in any API response body |
| PM-10 | RTL layout | View in Arabic | Section RTL; brand icon + last4 correct |

---

## Regression Tests (all PRs)

| # | Summary | Check |
|---|---------|-------|
| REG-01 | Existing branding tab unaffected | /settings → Branding tab still works |
| REG-02 | Tenant switcher unaffected | Multi-org user can still switch orgs |
| REG-03 | Billing page layout unaffected (PR3) | CurrentPlanCard + UsageBars still visible |
| REG-04 | Users page unaffected | /users still lists staff correctly |
| REG-05 | Auth flow unaffected | Login / logout / token refresh still work |

---

## Kiwi JSON Templates

### PR1
```json
{
  "domain": "Organization",
  "version": "main",
  "build": "saas-06b-org-profile",
  "planName": "CareKit / Organization / Manual QA",
  "planSummary": "Manual QA for Organization Profile settings page (SaaS-06b)",
  "runSummary": "10 test cases — name/slug/logo editing",
  "cases": []
}
```

### PR2
```json
{
  "domain": "Members",
  "version": "main",
  "build": "saas-06c-members",
  "planName": "CareKit / Members / Manual QA",
  "planSummary": "Manual QA for Members Management settings page (SaaS-06c)",
  "runSummary": "14 test cases — invite/deactivate/role management",
  "cases": []
}
```

### PR3
```json
{
  "domain": "Billing",
  "version": "main",
  "build": "saas-06d-payment-methods",
  "planName": "CareKit / Billing / Manual QA",
  "planSummary": "Manual QA for Payment Methods in billing settings (SaaS-06d)",
  "runSummary": "10 test cases — add/change/remove saved card",
  "cases": []
}
```

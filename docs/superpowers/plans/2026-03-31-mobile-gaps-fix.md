# Mobile Gaps Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** إصلاح 6 ثغرات في تطبيق Deqah Mobile + Backend — ربط شاشات بـ API حقيقي، إكمال navigation، وإضافة `@ApiTags` مفقود.

**Architecture:** كل ثغرة مستقلة. نبدأ بالأولوية العالية (شاشات الممارس → navigation المريض → واجهة التوفر → backend). لا يوجد schema أو migration جديد — فقط تعديلات على ملفات موجودة.

**Tech Stack:** React Native 0.83, Expo Router, Redux Toolkit, Axios, NestJS 11, Prisma 7

---

## ملخص الثغرات

| # | الثغرة | الملف | الأولوية |
|---|--------|-------|---------|
| A | سجل المريض عند الممارس = بيانات وهمية | `mobile/app/(employee)/client/[id].tsx` | 🔴 عالية |
| B | قائمة مرضى الممارس بدون API | `mobile/app/(employee)/(tabs)/clients.tsx` | 🟠 متوسطة |
| C | أزرار Profile بدون وظائف | `mobile/app/(client)/(tabs)/profile.tsx` | 🟡 متوسطة |
| D | زر "احجز" في تفاصيل الممارس غير مربوط | `mobile/app/(client)/employee/[id].tsx` | 🟡 متوسطة |
| E | إدارة التوفر للممارس غير موجودة | `mobile/app/(employee)/(tabs)/calendar.tsx` | 🟡 متوسطة |
| F | Specialties controller بدون `@ApiTags` | `backend/src/modules/specialties/specialties.controller.ts` | 🟢 منخفض |

---

## File Map

```
MODIFY:
  mobile/app/(employee)/client/[id].tsx          # Task A — ربط API
  mobile/app/(employee)/(tabs)/clients.tsx        # Task B — ربط API
  mobile/services/clients.ts                          # Task B — إضافة getEmployeeClients (NEW FILE)
  mobile/app/(client)/(tabs)/profile.tsx              # Task C — ربط navigation
  mobile/app/(client)/employee/[id].tsx           # Task D — ربط زر الحجز
  mobile/app/(employee)/(tabs)/calendar.tsx        # Task E — ربط إدارة التوفر
  mobile/app/(employee)/availability.tsx           # Task E — شاشة جديدة
  backend/src/modules/specialties/specialties.controller.ts  # Task F — @ApiTags
```

---

## Task A: ربط شاشة سجل المريض بـ API

**الملف:** `mobile/app/(employee)/client/[id].tsx`

الشاشة تعرض حالياً بيانات hardcoded. المطلوب: جلب بيانات المريض الحقيقية من:
- `GET /clients/:id` → بيانات المريض
- `GET /bookings?clientId=:id` → تاريخ الزيارات

**نمط API الموجود في المشروع:**
```typescript
import api from '@/services/api';

const response = await api.get<ApiResponse<Client>>(`/clients/${id}`);
return response.data;
```

- [ ] **Step 1: إضافة دالة getById في clients service**

في `mobile/services/clients.ts` (أنشئ الملف إذا غير موجود أو عدّل الموجود):

```typescript
import api from './api';
import type { ApiResponse, PaginatedResponse } from '@/types/api';
import type { Client } from '@/types/clients';
import type { Booking } from '@/types/bookings';

export const clientsService = {
  async getById(id: string) {
    const response = await api.get<ApiResponse<Client>>(`/clients/${id}`);
    return response.data;
  },

  async getEmployeeBookings(clientId: string) {
    const response = await api.get<PaginatedResponse<Booking>>('/bookings', {
      params: { clientId, limit: 50 },
    });
    return response.data;
  },
};
```

- [ ] **Step 2: استبدال البيانات الوهمية بـ useEffect في [id].tsx**

استبدل كتلة `const client = { ... }` و `const visits: Visit[] = []` بـ:

```typescript
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { clientsService } from '@/services/clients';
import type { Client } from '@/types/clients';
import type { Booking } from '@/types/bookings';

// داخل المكوّن:
const { id } = useLocalSearchParams<{ id: string }>();
const [client, setClient] = useState<Client | null>(null);
const [visits, setVisits] = useState<Booking[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

useEffect(() => {
  if (!id) return;
  setLoading(true);
  Promise.allSettled([
    clientsService.getById(id),
    clientsService.getEmployeeBookings(id),
  ]).then(([clientResult, bookingsResult]) => {
    if (clientResult.status === 'fulfilled' && clientResult.value.success) {
      setClient(clientResult.value.data);
    } else {
      setError('تعذّر تحميل بيانات المريض');
    }
    if (bookingsResult.status === 'fulfilled' && bookingsResult.value.success) {
      setVisits(bookingsResult.value.data.items ?? []);
    }
    setLoading(false);
  });
}, [id]);
```

- [ ] **Step 3: عرض loading و error states**

قبل return الرئيسي، أضف:

```typescript
if (loading) {
  return (
    <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" />
    </SafeAreaView>
  );
}
if (error || !client) {
  return (
    <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ThemedText>{error ?? 'مريض غير موجود'}</ThemedText>
    </SafeAreaView>
  );
}
```

- [ ] **Step 4: تحديث عرض البيانات لاستخدام client الحقيقي**

حدّث عرض اسم المريض من:
```typescript
// قديم
<ThemedText>{client.firstName} {client.lastName}</ThemedText>
<ThemedText>{client.phone}</ThemedText>
<ThemedText>{client.email}</ThemedText>
```
إلى نفس الحقول ولكن مع النوع الصحيح من الـ API. تأكد أن حقول `client` تتطابق مع نموذج `Client` في `@/types/clients`.

- [ ] **Step 5: تحديث عرض الزيارات**

استبدل `Visit[]` بـ `Booking[]`. لكل booking في القائمة اعرض:
```typescript
// داخل FlatList أو map:
<ThemedText>{new Date(visit.scheduledAt).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' })}</ThemedText>
<ThemedText>{visit.service?.nameAr ?? ''}</ThemedText>
<ThemedText>{visit.status}</ThemedText>
```

- [ ] **Step 6: Commit**

```bash
git add mobile/services/clients.ts mobile/app/\(employee\)/client/\[id\].tsx
git commit -m "feat(mobile/employee): wire client record screen to real API"
```

---

## Task B: ربط قائمة مرضى الممارس بـ API

**الملف:** `mobile/app/(employee)/(tabs)/clients.tsx`

الـ Backend لا يملك endpoint لمرضى ممارس محدد — يوجد `GET /clients` عام. نستخدمه مع تصفية بالبحث.

- [ ] **Step 1: إضافة دالة getAll في clients service**

في `mobile/services/clients.ts`، أضف:

```typescript
async getAll(params?: { search?: string; page?: number; limit?: number }) {
  const response = await api.get<PaginatedResponse<Client>>('/clients', { params });
  return response.data;
},
```

- [ ] **Step 2: استبدال الـ state الفارغ بـ useEffect مع API**

في `clients.tsx`، احذف `const [clients, setClients] = useState<ClientItem[]>([])` واستبدله بـ:

```typescript
import { useCallback, useEffect, useState } from 'react';
import { clientsService } from '@/services/clients';

const [clients, setClients] = useState<ClientItem[]>([]);
const [loading, setLoading] = useState(true);
const [search, setSearch] = useState('');

const fetchClients = useCallback(async (searchTerm: string) => {
  setLoading(true);
  try {
    const res = await clientsService.getAll({ search: searchTerm || undefined, limit: 50 });
    if (res.success) {
      setClients(
        (res.data.items ?? []).map((p) => ({
          id: p.id,
          name: `${p.firstName} ${p.lastName}`,
          avatarUrl: p.profile?.avatarUrl ?? null,
          lastVisit: p.lastBookingAt ?? null,
          visitCount: p.bookingCount ?? 0,
        }))
      );
    }
  } finally {
    setLoading(false);
  }
}, []);

useEffect(() => {
  fetchClients('');
}, [fetchClients]);
```

- [ ] **Step 3: ربط حقل البحث بـ API call**

ابحث عن `setSearch` أو `onChangeText` في clients.tsx. عدّله ليستدعي `fetchClients` بعد تأخير (debounce بسيط):

```typescript
const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

const handleSearch = (text: string) => {
  setSearch(text);
  if (searchTimeout.current) clearTimeout(searchTimeout.current);
  searchTimeout.current = setTimeout(() => fetchClients(text), 400);
};
```

ثم مرّر `handleSearch` إلى `onChangeText` بدل `setSearch` المباشر.

- [ ] **Step 4: إضافة loading indicator**

```typescript
{loading && clients.length === 0 && (
  <ActivityIndicator style={{ marginTop: 40 }} size="large" />
)}
```

- [ ] **Step 5: Commit**

```bash
git add mobile/services/clients.ts mobile/app/\(employee\)/\(tabs\)/clients.tsx
git commit -m "feat(mobile/employee): wire clients list to real API with search"
```

---

## Task C: ربط أزرار Profile بـ Navigation

**الملف:** `mobile/app/(client)/(tabs)/profile.tsx`

الأزرار فارغة `onPress={() => {}}`. المطلوب ربطها بـ routes موجودة.

**Routes الموجودة في `mobile/app/(client)/`:**
- `settings.tsx` → إعدادات المريض

**ملاحظة:** بعض الشاشات (الدفع، الإشعارات، اللغة، الخصوصية، الشروط، FAQ) غير موجودة بعد → نتعامل معها بـ `Alert.alert('قريباً', 'هذه الميزة ستكون متاحة قريباً')`.

- [ ] **Step 1: استيراد router و Alert**

في profile.tsx، تأكد من وجود:

```typescript
import { router } from 'expo-router';
import { Alert } from 'react-native';
```

- [ ] **Step 2: ربط "المعلومات الشخصية" بـ settings**

```typescript
onPress={() => router.push('/(client)/settings')}
```

- [ ] **Step 3: ربط الأزرار غير المكتملة بـ "قريباً"**

```typescript
// الدفع
onPress={() => Alert.alert('قريباً', 'إدارة طرق الدفع ستكون متاحة قريباً')}

// الإشعارات
onPress={() => Alert.alert('قريباً', 'إعدادات الإشعارات ستكون متاحة قريباً')}

// اللغة
onPress={() => Alert.alert('قريباً', 'تغيير اللغة سيكون متاحاً قريباً')}

// حول
onPress={() => Alert.alert('قريباً', 'صفحة حول التطبيق ستكون متاحة قريباً')}

// الأسئلة الشائعة
onPress={() => Alert.alert('قريباً', 'الأسئلة الشائعة ستكون متاحة قريباً')}

// الخصوصية
onPress={() => Alert.alert('قريباً', 'سياسة الخصوصية ستكون متاحة قريباً')}

// الشروط
onPress={() => Alert.alert('قريباً', 'شروط الاستخدام ستكون متاحة قريباً')}
```

- [ ] **Step 4: Commit**

```bash
git add mobile/app/\(client\)/\(tabs\)/profile.tsx
git commit -m "feat(mobile/client): connect profile menu buttons to routes and placeholders"
```

---

## Task D: ربط زر "احجز" في تفاصيل الممارس

**الملف:** `mobile/app/(client)/employee/[id].tsx`

الزر يحتاج navigate إلى booking flow. الـ booking flow يبدأ من `/(client)/booking/[serviceId]`.

لأن زر "احجز" هنا عام (غير مرتبط بخدمة محددة)، ننتقل إلى شاشة الممارس مع تمرير `employeeId` — أو نفتح modal لاختيار الخدمة.

**الحل الأبسط (YAGNI):** نمرر `employeeId` كـ param إلى أول خطوة في الـ booking flow.

- [ ] **Step 1: تحديث `onPress` لزر الحجز**

ابحث عن زر الحجز في `[id].tsx` (الجزء الأخير من الملف):

```typescript
// قديم:
onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }}

// جديد:
onPress={() => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  router.push({ pathname: '/(client)/booking/[serviceId]', params: { serviceId: 'select', employeeId: employee.id } });
}}
```

تأكد من أن `router` مستورد من `expo-router`:
```typescript
import { router, useLocalSearchParams } from 'expo-router';
```

- [ ] **Step 2: تحديث `booking/[serviceId].tsx` لقبول employeeId**

في `mobile/app/(client)/booking/[serviceId].tsx`، تأكد من قراءة `employeeId` من الـ params:

```typescript
const { serviceId, employeeId } = useLocalSearchParams<{ serviceId: string; employeeId?: string }>();
```

إذا كان `serviceId === 'select'`، اعرض قائمة خدمات الممارس المحدد:

```typescript
useEffect(() => {
  if (serviceId === 'select' && employeeId) {
    // جلب خدمات الممارس
    employeesService.getById(employeeId).then((res) => {
      if (res.success) setEmployee(res.data);
    });
  }
}, [serviceId, employeeId]);
```

- [ ] **Step 3: Commit**

```bash
git add mobile/app/\(client\)/employee/\[id\].tsx mobile/app/\(client\)/booking/\[serviceId\].tsx
git commit -m "feat(mobile/client): connect book button to booking flow with employeeId"
```

---

## Task E: شاشة إدارة التوفر للممارس

**الملف الجديد:** `mobile/app/(employee)/availability.tsx`  
**الملف المعدّل:** `mobile/app/(employee)/(tabs)/calendar.tsx`

Backend endpoints متاحة:
- `GET /employees/:id/availability` → جدول العمل الأسبوعي
- `PUT /employees/:id/availability` → تحديث الجدول

- [ ] **Step 1: إضافة employee availability service**

في `mobile/services/employees.ts` أضف:

```typescript
async getAvailabilitySchedule(id: string) {
  const response = await api.get<ApiResponse<EmployeeAvailability[]>>(
    `/employees/${id}/availability`
  );
  return response.data;
},

async updateAvailabilitySchedule(id: string, schedule: EmployeeAvailability[]) {
  const response = await api.put<ApiResponse<EmployeeAvailability[]>>(
    `/employees/${id}/availability`,
    { schedule }
  );
  return response.data;
},
```

- [ ] **Step 2: إنشاء شاشة availability.tsx**

أنشئ `mobile/app/(employee)/availability.tsx`:

```typescript
import { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, Switch, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { useAppSelector } from '@/hooks/use-redux';
import { employeesService } from '@/services/employees';
import { ThemedText } from '@/components/themed-text';
import { ThemedButton } from '@/components/themed-button';
import { useTranslation } from 'react-i18next';

const DAYS_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

type DaySchedule = {
  dayOfWeek: number; // 0=Sunday ... 6=Saturday
  isWorking: boolean;
  startTime: string; // "08:00"
  endTime: string;   // "17:00"
};

export default function AvailabilityScreen() {
  const { t } = useTranslation();
  const user = useAppSelector((state) => state.auth.user);
  const [schedule, setSchedule] = useState<DaySchedule[]>(
    DAYS_AR.map((_, i) => ({ dayOfWeek: i, isWorking: i >= 0 && i <= 4, startTime: '08:00', endTime: '17:00' }))
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?.employeeId) return;
    employeesService.getAvailabilitySchedule(user.employeeId).then((res) => {
      if (res.success && res.data.length > 0) {
        setSchedule(
          DAYS_AR.map((_, i) => {
            const found = res.data.find((d: DaySchedule) => d.dayOfWeek === i);
            return found ?? { dayOfWeek: i, isWorking: false, startTime: '08:00', endTime: '17:00' };
          })
        );
      }
      setLoading(false);
    });
  }, [user?.employeeId]);

  const toggleDay = useCallback((dayIndex: number) => {
    setSchedule((prev) =>
      prev.map((d) => (d.dayOfWeek === dayIndex ? { ...d, isWorking: !d.isWorking } : d))
    );
  }, []);

  const handleSave = async () => {
    if (!user?.employeeId) return;
    setSaving(true);
    try {
      const res = await employeesService.updateAvailabilitySchedule(
        user.employeeId,
        schedule.filter((d) => d.isWorking)
      );
      if (res.success) {
        Alert.alert('تم الحفظ', 'تم تحديث جدول عملك بنجاح');
        router.back();
      } else {
        Alert.alert('خطأ', 'تعذّر حفظ الجدول');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'إدارة التوفر', headerBackTitle: '' }} />
      <ScrollView contentContainerStyle={styles.content}>
        {schedule.map((day) => (
          <View key={day.dayOfWeek} style={styles.row}>
            <ThemedText style={styles.dayLabel}>{DAYS_AR[day.dayOfWeek]}</ThemedText>
            <Switch value={day.isWorking} onValueChange={() => toggleDay(day.dayOfWeek)} />
            {day.isWorking && (
              <ThemedText style={styles.timeLabel}>
                {day.startTime} - {day.endTime}
              </ThemedText>
            )}
          </View>
        ))}
      </ScrollView>
      <View style={styles.footer}>
        <ThemedButton onPress={handleSave} loading={saving} variant="primary" size="lg" full>
          حفظ الجدول
        </ThemedButton>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  dayLabel: { flex: 1, fontSize: 16 },
  timeLabel: { fontSize: 14, opacity: 0.7, marginStart: 12 },
  footer: { padding: 16, paddingBottom: 8 },
});
```

- [ ] **Step 3: ربط زر "إدارة التوفر" في calendar.tsx**

في `mobile/app/(employee)/(tabs)/calendar.tsx`، ابحث عن:

```typescript
<ThemedButton onPress={() => {}} variant="outline" size="md" full>
```

غيّره إلى:

```typescript
<ThemedButton onPress={() => router.push('/(employee)/availability')} variant="outline" size="md" full>
```

تأكد من استيراد `router` من `expo-router`.

- [ ] **Step 4: Commit**

```bash
git add mobile/app/\(employee\)/availability.tsx mobile/app/\(employee\)/\(tabs\)/calendar.tsx mobile/services/employees.ts
git commit -m "feat(mobile/employee): add availability management screen and wire calendar button"
```

---

## Task F: إضافة @ApiTags لـ Specialties Controller

**الملف:** `backend/src/modules/specialties/specialties.controller.ts`

- [ ] **Step 1: إضافة import و decorator**

في أعلى `specialties.controller.ts`، أضف `ApiTags` إلى import الـ swagger:

```typescript
// قبل:
import { ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';

// بعد (أضف ApiTags):
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
```

ثم قبل `@Controller('specialties')` مباشرة أضف:

```typescript
@ApiTags('specialties')
@Controller('specialties')
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/modules/specialties/specialties.controller.ts
git commit -m "fix(backend/specialties): add @ApiTags decorator to Specialties controller"
```

---

## الترتيب الموصى به للتنفيذ

```
Task F  (5 دقائق)   → سريع ومستقل
Task A  (30 دقيقة)  → أولوية عالية
Task B  (20 دقيقة)  → يعتمد على clients service من Task A
Task D  (15 دقيقة)  → مستقل
Task C  (15 دقيقة)  → مستقل
Task E  (45 دقيقة)  → الأكبر (شاشة جديدة)
```

**الوقت الإجمالي المقدر:** ~2 ساعة

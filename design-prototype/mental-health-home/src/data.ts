import { C } from "./theme";

export const QUICK_ACTIONS = [
  { id: "1", label: { ar: "استشارات", en: "Consult" }, icon: "person-outline" as const },
  { id: "2", label: { ar: "جلسات علاجية", en: "Therapy" }, icon: "leaf-outline" as const },
  { id: "3", label: { ar: "المعالجين", en: "Therapists" }, icon: "people-outline" as const },
];

// Unsplash CDN direct URLs — neutral, warm interiors
export const CLINICS = [
  {
    id: "1",
    title: { ar: "عيادة التوازن النفسي", en: "Balance Clinic" },
    city: { ar: "الرياض", en: "Riyadh" },
    rating: 4.8,
    icon: "leaf-outline" as const,
    image:
      "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=600&q=80&auto=format&fit=crop",
  },
  {
    id: "2",
    title: { ar: "عيادة الدعم الأسري", en: "Family Support" },
    city: { ar: "جدة", en: "Jeddah" },
    rating: 4.7,
    icon: "people-outline" as const,
    image:
      "https://images.unsplash.com/photo-1567016376408-0226e4d0c1ea?w=600&q=80&auto=format&fit=crop",
  },
  {
    id: "3",
    title: { ar: "عيادة الصحة العقلية", en: "Mental Health Center" },
    city: { ar: "الدمام", en: "Dammam" },
    rating: 4.9,
    icon: "medical-outline" as const,
    image:
      "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&q=80&auto=format&fit=crop",
  },
  {
    id: "4",
    title: { ar: "عيادة الوعي الذهني", en: "Mindful Clinic" },
    city: { ar: "مكة", en: "Makkah" },
    rating: 4.6,
    icon: "flower-outline" as const,
    image:
      "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=600&q=80&auto=format&fit=crop",
  },
];

export const SUPPORTS = [
  {
    id: "1",
    title: { ar: "دعم القلق والتوتر", en: "Anxiety support" },
    subtitle: { ar: "جلسات فردية", en: "1-on-1 sessions" },
    rating: 4.8,
    iconColor: "#16A34A",
    tint: "rgba(163,220,178,0.16)",
    icon: "heart-outline" as const,
  },
  {
    id: "2",
    title: { ar: "دعم العلاقات", en: "Relationships" },
    subtitle: { ar: "جلسات زوجية", en: "Couples therapy" },
    rating: 4.7,
    iconColor: "#D96A3E",
    tint: "rgba(240,186,160,0.16)",
    icon: "people-outline" as const,
  },
  {
    id: "3",
    title: { ar: "دعم الاكتئاب", en: "Depression" },
    subtitle: { ar: "جلسات فردية", en: "1-on-1 sessions" },
    rating: 4.9,
    iconColor: "#2E7B88",
    tint: "rgba(162,210,218,0.18)",
    icon: "sunny-outline" as const,
  },
];

// randomuser.me — stable portrait CDN
export const THERAPISTS = [
  {
    id: "1",
    name: { ar: "د. فيصل السبيعي", en: "Dr. Faisal Alsubaie" },
    role: { ar: "استشاري نفسي", en: "Psychologist" },
    rating: 4.9,
    image: "https://randomuser.me/api/portraits/men/32.jpg",
  },
  {
    id: "2",
    name: { ar: "أ. نورة عبدالله", en: "Noura Abdullah" },
    role: { ar: "أخصائية علاج أسري", en: "Family therapist" },
    rating: 4.7,
    image: "https://randomuser.me/api/portraits/women/44.jpg",
  },
  {
    id: "3",
    name: { ar: "د. أحمد محمد", en: "Dr. Ahmed Mohammed" },
    role: { ar: "استشاري نفسي", en: "Psychologist" },
    rating: 4.8,
    image: "https://randomuser.me/api/portraits/men/75.jpg",
  },
  {
    id: "4",
    name: { ar: "أ. سارة علي", en: "Sarah Ali" },
    role: { ar: "أخصائية نفسية", en: "Psychotherapist" },
    rating: 4.9,
    image: "https://randomuser.me/api/portraits/women/63.jpg",
  },
];

export const USER_AVATAR = "https://randomuser.me/api/portraits/women/68.jpg";

export const TABS = [
  { id: "home", label: { ar: "الرئيسية", en: "Home" }, icon: "home" as const, active: true },
  { id: "sessions", label: { ar: "جلساتي", en: "Sessions" }, icon: "calendar-outline" as const },
  { id: "chat", label: { ar: "المحادثات", en: "Chat" }, icon: "chatbubble-ellipses-outline" as const },
  { id: "notif", label: { ar: "الإشعارات", en: "Alerts" }, icon: "notifications-outline" as const, dot: true },
  { id: "profile", label: { ar: "حسابي", en: "Me" }, icon: "person-outline" as const },
];

"use client"

import Link from "next/link"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"

const SECTIONS = [
  {
    href: "/content/home",
    title: "الصفحة الرئيسية",
    desc: "نصوص Hero، الميزات، الإحصائيات، أزرار CTA",
  },
  {
    href: "/content/blog",
    title: "المقالات",
    desc: "إضافة وتحرير مقالات المدوّنة (قريباً)",
    disabled: true,
  },
  {
    href: "/content/faq",
    title: "الأسئلة الشائعة",
    desc: "سؤال/جواب قابل للطيّ (قريباً)",
    disabled: true,
  },
  {
    href: "/content/testimonials",
    title: "الشهادات",
    desc: "آراء العملاء (قريباً)",
    disabled: true,
  },
  {
    href: "/content/support-groups",
    title: "مجموعات الدعم",
    desc: "CRUD لمجموعات الدعم (قريباً)",
    disabled: true,
  },
  {
    href: "/content/media",
    title: "مكتبة الوسائط",
    desc: "الصور المرفوعة (قريباً)",
    disabled: true,
  },
]

export default function ContentLandingPage() {
  return (
    <ListPageShell>
      <Breadcrumbs />
      <PageHeader
        title="المحتوى"
        description="إدارة نصوص وصور الموقع العام"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map((s) =>
          s.disabled ? (
            <div
              key={s.href}
              className="glass rounded-2xl p-6 opacity-50 cursor-not-allowed"
            >
              <h3 className="text-base font-semibold mb-1">{s.title}</h3>
              <p className="text-sm text-muted-foreground">{s.desc}</p>
            </div>
          ) : (
            <Link
              key={s.href}
              href={s.href}
              className="glass rounded-2xl p-6 transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <h3 className="text-base font-semibold mb-1">{s.title}</h3>
              <p className="text-sm text-muted-foreground">{s.desc}</p>
            </Link>
          ),
        )}
      </div>
    </ListPageShell>
  )
}

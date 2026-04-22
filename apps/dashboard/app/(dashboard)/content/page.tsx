"use client"

import Link from "next/link"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { useLocale } from "@/components/locale-provider"

const SECTIONS = [
  { href: "/content/home", titleKey: "content.landing.section.home.title", descKey: "content.landing.section.home.desc" },
  { href: "/content/blog", titleKey: "content.landing.section.blog.title", descKey: "content.landing.section.blog.desc", disabled: true },
  { href: "/content/faq", titleKey: "content.landing.section.faq.title", descKey: "content.landing.section.faq.desc", disabled: true },
  { href: "/content/testimonials", titleKey: "content.landing.section.testimonials.title", descKey: "content.landing.section.testimonials.desc", disabled: true },
  { href: "/content/support-groups", titleKey: "content.landing.section.supportGroups.title", descKey: "content.landing.section.supportGroups.desc", disabled: true },
  { href: "/content/media", titleKey: "content.landing.section.media.title", descKey: "content.landing.section.media.desc", disabled: true },
] as const

export default function ContentLandingPage() {
  const { t } = useLocale()
  return (
    <ListPageShell>
      <Breadcrumbs />
      <PageHeader
        title={t("content.landing.title")}
        description={t("content.landing.description")}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map((s) =>
          s.disabled ? (
            <div
              key={s.href}
              className="glass rounded-2xl p-6 opacity-50 cursor-not-allowed"
            >
              <h3 className="text-base font-semibold mb-1">{t(s.titleKey)}</h3>
              <p className="text-sm text-muted-foreground">{t(s.descKey)}</p>
            </div>
          ) : (
            <Link
              key={s.href}
              href={s.href}
              className="glass rounded-2xl p-6 transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <h3 className="text-base font-semibold mb-1">{t(s.titleKey)}</h3>
              <p className="text-sm text-muted-foreground">{t(s.descKey)}</p>
            </Link>
          ),
        )}
      </div>
    </ListPageShell>
  )
}

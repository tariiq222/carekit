"use client"

import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { ar } from "date-fns/locale"
import { HugeiconsIcon } from "@hugeicons/react"
import { Notification03Icon } from "@hugeicons/core-free-icons"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { useLocale } from "@/components/locale-provider"
import {
  useNotifications,
  useUnreadCount,
  useNotificationMutations,
} from "@/hooks/use-notifications"
import type { Notification } from "@/lib/types/notification"

/* ─── Single notification row ─── */

function NotificationRow({
  notification,
  locale,
  onMarkRead,
}: {
  notification: Notification
  locale: "en" | "ar"
  onMarkRead: (id: string) => void
}) {
  const isUnread = !notification.isRead
  const title =
    locale === "ar" && notification.titleAr
      ? notification.titleAr
      : notification.titleEn
  const body =
    locale === "ar" && notification.bodyAr
      ? notification.bodyAr
      : notification.bodyEn

  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-start gap-3 rounded-sm px-3 py-2 text-start transition-colors hover:bg-surface-muted",
        isUnread && "bg-primary/5"
      )}
      onClick={() => isUnread && onMarkRead(notification.id)}
    >
      {/* Unread dot */}
      <div className="mt-1.5 shrink-0">
        {isUnread ? (
          <div className="size-2 rounded-full bg-primary" />
        ) : (
          <div className="size-2" />
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-sm text-foreground line-clamp-1",
            isUnread && "font-semibold"
          )}
        >
          {title}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
          {body}
        </p>
        <p className="mt-1 text-xs text-muted-foreground font-numeric">
          {formatDistanceToNow(new Date(notification.createdAt), {
            addSuffix: true,
            locale: locale === "ar" ? ar : undefined,
          })}
        </p>
      </div>
    </button>
  )
}

/* ─── Dropdown ─── */

export function NotificationDropdown() {
  const { locale, t } = useLocale()
  const { notifications, isLoading } = useNotifications()
  const { data: unreadCount } = useUnreadCount()
  const { markAllMut, markOneMut } = useNotificationMutations()

  // Show latest 5 notifications in dropdown
  const recentNotifications = notifications.slice(0, 5)
  const hasUnread = (unreadCount ?? 0) > 0

  return (
    <Popover>
      {/* Trigger — bell button */}
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative flex size-[42px] items-center justify-center rounded-[10px] border border-border bg-card text-muted-foreground transition-all duration-300 hover:text-primary hover:bg-surface hover:shadow-sm"
          aria-label={t("notifications.title")}
        >
          <HugeiconsIcon icon={Notification03Icon} size={20} />
          {hasUnread && (
            <span className="absolute top-2 start-2 size-2 rounded-full bg-error ring-2 ring-white" />
          )}
        </button>
      </PopoverTrigger>

      {/* Dropdown content */}
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[min(380px,_calc(100vw-1rem))] p-0"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3">
          <h3 className="text-sm font-semibold text-foreground">
            {t("notifications.recent")}
          </h3>
          {hasUnread && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto px-2 py-1 text-xs text-primary"
              onClick={() => markAllMut.mutate()}
              disabled={markAllMut.isPending}
            >
              {t("notifications.markAllRead")}
            </Button>
          )}
        </div>

        <Separator />

        {/* Notification list */}
        <ScrollArea className="max-h-[320px]">
          <div className="flex flex-col py-1">
            {isLoading ? (
              <div className="flex flex-col gap-2 p-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 rounded-md" />
                ))}
              </div>
            ) : recentNotifications.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <HugeiconsIcon
                  icon={Notification03Icon}
                  size={32}
                  className="text-muted-foreground/40"
                />
                <p className="text-sm text-muted-foreground">
                  {t("notifications.empty.title")}
                </p>
              </div>
            ) : (
              recentNotifications.map((notification) => (
                <NotificationRow
                  key={notification.id}
                  notification={notification}
                  locale={locale}
                  onMarkRead={(id) => markOneMut.mutate(id)}
                />
              ))
            )}
          </div>
        </ScrollArea>

        <Separator />

        {/* Footer — view all link */}
        <div className="p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-sm text-primary"
            asChild
          >
            <Link href="/notifications">
              {t("notifications.viewAll")}
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

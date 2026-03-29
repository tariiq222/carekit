"use client"

import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useRoleMutations } from "@/hooks/use-users"
import { useLocale } from "@/components/locale-provider"
import { toast } from "sonner"
import type { Role, Permission } from "@/lib/types/user"

const ACTIONS = ["view", "create", "edit", "delete"] as const

interface Props {
  role: Role
  allPermissions: Permission[]
}

export function PermissionMatrix({ role, allPermissions }: Props) {
  const { t } = useLocale()
  const { assignPermMut, removePermMut } = useRoleMutations()

  // Extract unique modules from all permissions
  const modules = Array.from(
    new Set(allPermissions.map((p) => p.module)),
  ).sort()

  // Build a set of "module:action" for quick lookup
  const rolePerms = new Set(
    role.permissions.map((p) => `${p.module}:${p.action}`),
  )

  const isPending = assignPermMut.isPending || removePermMut.isPending

  const handleToggle = (module: string, action: string, checked: boolean) => {
    if (checked) {
      assignPermMut.mutate(
        { roleId: role.id, module, action },
        { onError: () => toast.error(t("users.roles.permError")) },
      )
    } else {
      removePermMut.mutate(
        { roleId: role.id, module, action },
        { onError: () => toast.error(t("users.roles.permError")) },
      )
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">{role.name}</CardTitle>
          <div className="flex items-center gap-2">
            {role.isSystem && (
              <Badge variant="secondary" className="text-[10px]">
                {t("users.roles.system")}
              </Badge>
            )}
            <Badge variant="outline" className="text-[10px] tabular-nums">
              {role.permissions.length} {t("users.roles.permCount")}
            </Badge>
          </div>
        </div>
        {role.description && (
          <p className="text-xs text-muted-foreground">{role.description}</p>
        )}
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-start pe-4 pb-2 text-xs font-medium text-muted-foreground">
                  {t("users.roles.module")}
                </th>
                {ACTIONS.map((action) => (
                  <th
                    key={action}
                    className="pb-2 text-center text-xs font-medium text-muted-foreground w-16"
                  >
                    {t(`users.roles.action.${action}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {modules.map((mod) => (
                <tr key={mod} className="border-b border-border/50 last:border-0">
                  <td className="py-2.5 pe-4 text-sm font-medium text-foreground">
                    {t(`users.roles.modules.${mod}`)}
                  </td>
                  {ACTIONS.map((action) => {
                    const key = `${mod}:${action}`
                    const exists = allPermissions.some(
                      (p) => p.module === mod && p.action === action,
                    )
                    const checked = rolePerms.has(key)

                    if (!exists) {
                      return (
                        <td key={action} className="py-2.5 text-center">
                          <span className="text-muted-foreground/30">—</span>
                        </td>
                      )
                    }

                    return (
                      <td key={action} className="py-2.5 text-center">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) =>
                            handleToggle(mod, action, v === true)
                          }
                          disabled={isPending}
                          className="mx-auto"
                        />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

export function PermissionMatrixSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-32" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

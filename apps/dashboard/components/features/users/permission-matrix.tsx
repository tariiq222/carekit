"use client"

import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardHeader, CardTitle } from "@carekit/ui"
import { Badge } from "@carekit/ui"
import { Skeleton } from "@carekit/ui"
import { useRoleMutations } from "@/hooks/use-users"
import { useLocale } from "@/components/locale-provider"
import { toast } from "sonner"
import type { Role, Permission } from "@/lib/types/user"

interface Props {
  role: Role
  allPermissions: Permission[]
}

export function PermissionMatrix({ role, allPermissions }: Props) {
  const { t } = useLocale()
  const { assignPermMut, removePermMut } = useRoleMutations()

  // Group permissions by module — dynamic, driven by what the DB returns
  const moduleMap = new Map<string, string[]>()
  for (const p of allPermissions) {
    if (!moduleMap.has(p.module)) moduleMap.set(p.module, [])
    moduleMap.get(p.module)!.push(p.action)
  }

  // Collect all unique actions across all modules for column headers
  const allActions = Array.from(
    new Set(allPermissions.map((p) => p.action)),
  ).sort((a, b) => {
    // Standard actions first, then extras
    const order = ["view", "create", "edit", "delete", "update", "use"]
    const ai = order.indexOf(a)
    const bi = order.indexOf(b)
    if (ai !== -1 && bi !== -1) return ai - bi
    if (ai !== -1) return -1
    if (bi !== -1) return 1
    return a.localeCompare(b)
  })

  const modules = Array.from(moduleMap.keys()).sort()

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

  // Translate action label — fallback to the raw action string
  const actionLabel = (action: string) => {
    const key = `users.roles.action.${action}`
    const translated = t(key as Parameters<typeof t>[0])
    return translated === key ? action : translated
  }

  // Translate module label — fallback to the raw module string
  const moduleLabel = (mod: string) => {
    const key = `users.roles.modules.${mod}`
    const translated = t(key as Parameters<typeof t>[0])
    return translated === key ? mod : translated
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
                {allActions.map((action) => (
                  <th
                    key={action}
                    className="pb-2 text-center text-xs font-medium text-muted-foreground w-16 whitespace-nowrap px-1"
                  >
                    {actionLabel(action)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {modules.map((mod) => {
                const moduleActions = moduleMap.get(mod) ?? []
                return (
                  <tr key={mod} className="border-b border-border/50 last:border-0">
                    <td className="py-2.5 pe-4 text-sm font-medium text-foreground">
                      {moduleLabel(mod)}
                    </td>
                    {allActions.map((action) => {
                      const exists = moduleActions.includes(action)
                      const key = `${mod}:${action}`
                      const checked = rolePerms.has(key)

                      if (!exists) {
                        return (
                          <td key={action} className="py-2.5 text-center px-1">
                            <span className="text-muted-foreground/30">—</span>
                          </td>
                        )
                      }

                      return (
                        <td key={action} className="py-2.5 text-center px-1">
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
                )
              })}
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

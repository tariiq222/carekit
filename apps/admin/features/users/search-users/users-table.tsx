'use client';

import { Badge } from '@deqah/ui/primitives/badge';
import { Skeleton } from '@deqah/ui/primitives/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@deqah/ui/primitives/table';
import { ResetPasswordDialog } from '../reset-user-password/reset-password-dialog';
import type { UserRow } from '../types';

interface Props {
  items: UserRow[] | undefined;
  isLoading: boolean;
}

export function UsersTable({ items, isLoading }: Props) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Email</TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Organization</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>User ID</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading && !items
          ? Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell colSpan={7}>
                  <Skeleton className="h-6" />
                </TableCell>
              </TableRow>
            ))
          : items?.map((u) => (
              <TableRow key={u.id}>
                <TableCell>
                  <div className="font-medium">{u.email}</div>
                  {u.isSuperAdmin ? (
                    <Badge variant="outline" className="mt-1 border-primary/40 bg-primary/10 text-primary">
                      Super-admin
                    </Badge>
                  ) : null}
                </TableCell>
                <TableCell>{u.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{u.role}</TableCell>
                <TableCell className="text-sm">
                  {u.memberships.length > 0
                    ? u.memberships.map((m) => m.organization.nameAr).join('، ')
                    : <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell>
                  {u.isActive ? (
                    <Badge variant="outline" className="border-success/40 bg-success/10 text-success">
                      Active
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">
                      Inactive
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{u.id}</TableCell>
                <TableCell className="text-right">
                  <ResetPasswordDialog userId={u.id} userEmail={u.email} />
                </TableCell>
              </TableRow>
            ))}
        {!isLoading && items?.length === 0 ? (
          <TableRow>
            <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
              No users match the current filters.
            </TableCell>
          </TableRow>
        ) : null}
      </TableBody>
    </Table>
  );
}

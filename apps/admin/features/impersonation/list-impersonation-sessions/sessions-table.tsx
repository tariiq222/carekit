'use client';

import { useSyncExternalStore } from 'react';
import { LogOut } from 'lucide-react';
import { Button } from '@deqah/ui/primitives/button';
import { Skeleton } from '@deqah/ui/primitives/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@deqah/ui/primitives/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@deqah/ui/primitives/tooltip';
import { useEndImpersonation } from '../end-impersonation/use-end-impersonation';
import type { ImpersonationSession } from '../types';

interface Props {
  items: ImpersonationSession[] | undefined;
  isLoading: boolean;
}

function subscribeToMinute(callback: () => void): () => void {
  const id = setInterval(callback, 60_000);
  return () => clearInterval(id);
}

function useNow(): number {
  return useSyncExternalStore(
    subscribeToMinute,
    () => Date.now(),
    () => 0,
  );
}

function monoTimestamp(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB');
}

function durationLabel(startedAt: string, endedAt: string | null): string {
  const end = endedAt ? new Date(endedAt).getTime() : Date.now();
  const ms = end - new Date(startedAt).getTime();
  const totalSecs = Math.floor(ms / 1000);
  const mins = Math.floor(totalSecs / 60);
  const hours = Math.floor(mins / 60);
  if (hours > 0) return `${hours}h ${mins % 60}m`;
  if (mins > 0) return `${mins}m`;
  return `${totalSecs}s`;
}

interface SessionRowProps {
  session: ImpersonationSession;
  active: boolean;
  endMutation: ReturnType<typeof useEndImpersonation>;
}

function SessionRow({ session: s, active, endMutation }: SessionRowProps) {
  return (
    <TableRow key={s.id}>
      {/* Status dot */}
      <TableCell className="w-6 pr-0">
        {active ? (
          <span
            className="inline-block size-1.5 rounded-full bg-primary animate-pulse"
            aria-label="Active"
          />
        ) : (
          <span className="inline-block size-1.5 rounded-full bg-muted-foreground/30" />
        )}
      </TableCell>

      {/* Actor */}
      <TableCell>
        <span className="font-mono text-[12px]">{s.superAdminUserId}</span>
      </TableCell>

      {/* Target */}
      <TableCell>
        <span className="font-mono text-[12px]">{s.targetUserId}</span>
      </TableCell>

      {/* Org */}
      <TableCell>
        <span className="font-mono text-[12px]">{s.organizationId}</span>
      </TableCell>

      {/* Started */}
      <TableCell>
        <span className="font-mono tabular-nums text-[12px] text-muted-foreground">
          {monoTimestamp(s.startedAt)}
        </span>
      </TableCell>

      {/* Ended */}
      <TableCell>
        <span className="font-mono tabular-nums text-[12px] text-muted-foreground">
          {monoTimestamp(s.endedAt)}
        </span>
      </TableCell>

      {/* Duration */}
      <TableCell>
        <span className="tabular-nums text-[12px] text-muted-foreground">
          {durationLabel(s.startedAt, s.endedAt)}
        </span>
      </TableCell>

      {/* End action */}
      <TableCell className="text-right">
        {active ? (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9 rounded-sm text-destructive hover:bg-destructive/10 hover:text-destructive"
                  disabled={endMutation.isPending}
                  onClick={() => endMutation.mutate(s.id)}
                  aria-label="End impersonation session"
                >
                  <LogOut size={14} strokeWidth={1.75} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">End session</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : null}
      </TableCell>
    </TableRow>
  );
}

const TABLE_COLS = 8;

export function SessionsTable({ items, isLoading }: Props) {
  const endMutation = useEndImpersonation();
  const now = useNow();

  const activeSessions = items?.filter((s) => {
    const expired = new Date(s.expiresAt).getTime() <= now;
    return !s.endedAt && !expired;
  }) ?? [];

  const pastSessions = items?.filter((s) => {
    const expired = new Date(s.expiresAt).getTime() <= now;
    return s.endedAt !== null || expired;
  }) ?? [];

  const colHeaders = (
    <TableRow>
      <TableHead className="w-6" />
      <TableHead>Actor</TableHead>
      <TableHead>Target user</TableHead>
      <TableHead>Organization</TableHead>
      <TableHead>Started</TableHead>
      <TableHead>Ended</TableHead>
      <TableHead>Duration</TableHead>
      <TableHead className="text-right w-16" />
    </TableRow>
  );

  if (isLoading && !items) {
    return (
      <Table>
        <TableHeader>{colHeaders}</TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={`skeleton-${i}`}>
              <TableCell colSpan={TABLE_COLS}>
                <Skeleton className="h-5" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  return (
    <div className="space-y-6">
      {/* Active now section */}
      <div>
        <p className="mb-2 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
          Active now
        </p>
        <div className="border-t border-border">
          <Table>
            <TableHeader>{colHeaders}</TableHeader>
            <TableBody>
              {activeSessions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={TABLE_COLS} className="py-6 text-center text-sm text-muted-foreground">
                    No active sessions.
                  </TableCell>
                </TableRow>
              ) : (
                activeSessions.map((s) => (
                  <SessionRow key={s.id} session={s} active={true} endMutation={endMutation} />
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Past sessions section */}
      <div>
        <p className="mb-2 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
          Past sessions
        </p>
        <div className="border-t border-border">
          <Table>
            <TableHeader>{colHeaders}</TableHeader>
            <TableBody>
              {pastSessions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={TABLE_COLS} className="py-6 text-center text-sm text-muted-foreground">
                    No past sessions.
                  </TableCell>
                </TableRow>
              ) : (
                pastSessions.map((s) => (
                  <SessionRow key={s.id} session={s} active={false} endMutation={endMutation} />
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

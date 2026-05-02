'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@deqah/ui/primitives/table';
import { Badge } from '@deqah/ui/primitives/badge';
import { Skeleton } from '@deqah/ui/primitives/skeleton';
import type { DeliveryLogItem, DeliveryStatus, DeliveryChannel } from './list-delivery-log.api';

interface DeliveryLogTableProps {
  items: DeliveryLogItem[] | undefined;
  isLoading: boolean;
}

const STATUS_CLASS: Record<DeliveryStatus, string> = {
  SENT: 'bg-green-500/10 text-green-700 border-green-500/30',
  FAILED: 'bg-red-500/10 text-red-700 border-red-500/30',
  PENDING: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/30',
  SKIPPED: 'bg-gray-500/10 text-gray-600 border-gray-500/30',
};

const CHANNEL_CLASS: Record<DeliveryChannel, string> = {
  EMAIL: 'bg-blue-500/10 text-blue-700 border-blue-500/30',
  SMS: 'bg-purple-500/10 text-purple-700 border-purple-500/30',
  PUSH: 'bg-orange-500/10 text-orange-700 border-orange-500/30',
  IN_APP: 'bg-gray-500/10 text-gray-600 border-gray-500/30',
};

const COLUMN_COUNT = 11;

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

export function DeliveryLogTable({ items, isLoading }: DeliveryLogTableProps) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Type</TableHead>
            <TableHead>Channel</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Organization</TableHead>
            <TableHead>Recipient</TableHead>
            <TableHead>Address</TableHead>
            <TableHead>Attempts</TableHead>
            <TableHead>Sent At</TableHead>
            <TableHead>Error</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading &&
            Array.from({ length: 5 }).map((_, index) => (
              <TableRow key={`skeleton-${index}`}>
                <TableCell colSpan={COLUMN_COUNT}>
                  <Skeleton className="h-5 w-full" />
                </TableCell>
              </TableRow>
            ))}

          {!isLoading && (!items || items.length === 0) && (
            <TableRow>
              <TableCell
                colSpan={COLUMN_COUNT}
                className="py-10 text-center text-sm text-muted-foreground"
              >
                No delivery log entries match the current filters.
              </TableCell>
            </TableRow>
          )}

          {!isLoading &&
            items?.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-mono text-xs">{item.type}</TableCell>

                <TableCell>
                  <Badge variant="outline" className={CHANNEL_CLASS[item.channel]}>
                    {item.channel}
                  </Badge>
                </TableCell>

                <TableCell>
                  <Badge variant="outline" className={STATUS_CLASS[item.status]}>
                    {item.status}
                  </Badge>
                </TableCell>

                <TableCell>
                  {item.priority === 'CRITICAL' ? (
                    <Badge variant="destructive" className="border">
                      {item.priority}
                    </Badge>
                  ) : (
                    <Badge variant="outline">{item.priority}</Badge>
                  )}
                </TableCell>

                <TableCell className="font-mono text-xs">{item.organizationId}</TableCell>

                <TableCell className="font-mono text-xs">{item.recipientId}</TableCell>

                <TableCell className="text-xs">{item.toAddress ?? '—'}</TableCell>

                <TableCell className="text-center">{item.attempts}</TableCell>

                <TableCell className="whitespace-nowrap text-xs">
                  {formatDate(item.sentAt)}
                </TableCell>

                <TableCell>
                  {item.errorMessage ? (
                    <span
                      className="block max-w-xs truncate text-xs text-red-600"
                      title={item.errorMessage}
                    >
                      {item.errorMessage}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>

                <TableCell className="whitespace-nowrap text-xs">
                  {formatDate(item.createdAt)}
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </div>
  );
}

export type QuickActionKey = 'newBooking' | 'newClient' | 'recordPayment'

export interface VisibleWidgets {
  stats: {
    bookings: boolean
    clients: boolean
    revenue: boolean
    pendingPayments: boolean
  }
  attentionAlerts: {
    pendingPayments: boolean
    cancelRequests: boolean
  }
  quickActions: QuickActionKey[]
  todayTimeline: boolean
  activityFeed: boolean
  revenueChart: boolean
  recentPayments: boolean
  topPerformers: boolean
}

type CanDo = (module: string, action: string) => boolean

export function getVisibleWidgets(
  membershipRole: string | null,
  canDo: CanDo,
): VisibleWidgets {
  const role = membershipRole ?? ''
  const canBookingRead = canDo('bookings', 'read')
  const canBookingCreate = canDo('bookings', 'create')
  const canBookingUpdate = canDo('bookings', 'update')
  const canClientRead = canDo('clients', 'read')
  const canClientCreate = canDo('clients', 'create')
  const canPaymentRead = canDo('payments', 'read')
  const canPaymentCreate = canDo('payments', 'create')
  const canReportRead = canDo('reports', 'read')

  const quickActions: QuickActionKey[] = []
  if (role !== 'EMPLOYEE') {
    if (canBookingCreate) quickActions.push('newBooking')
    if (canClientCreate) quickActions.push('newClient')
    if (canPaymentCreate) quickActions.push('recordPayment')
  }

  return {
    stats: {
      bookings: canBookingRead,
      clients: canClientRead,
      revenue: canPaymentRead,
      pendingPayments: canPaymentRead,
    },
    attentionAlerts: {
      pendingPayments: canPaymentRead,
      cancelRequests: canBookingUpdate,
    },
    quickActions,
    todayTimeline: canBookingRead,
    activityFeed: true,
    revenueChart: canReportRead && canPaymentRead,
    recentPayments: canPaymentRead,
    topPerformers: canReportRead && role !== 'ACCOUNTANT' && role !== '',
  }
}

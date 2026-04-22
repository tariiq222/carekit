"use client"

import { createContext, useContext, type ReactNode } from "react"
import { useCurrentSubscription } from "@/hooks/use-current-subscription"
import type { Plan, Subscription, SubscriptionStatus } from "@/lib/types/billing"

export interface BillingContextValue {
  subscription: Subscription | null
  plan: Plan | null
  limits: Record<string, number | boolean>
  status: SubscriptionStatus | null
  usage: Partial<Record<string, number>>
  isLoading: boolean
  isActive: boolean
  isPastDue: boolean
  isSuspended: boolean
}

const BillingContext = createContext<BillingContextValue | null>(null)

export function BillingProvider({ children }: { children: ReactNode }) {
  const { data, isLoading } = useCurrentSubscription()
  const subscription = data ?? null
  const plan = subscription?.plan ?? null
  const status = subscription?.status ?? null

  const value: BillingContextValue = {
    subscription,
    plan,
    limits: plan?.limits ?? {},
    status,
    usage: subscription?.usage ?? {},
    isLoading,
    isActive: status === "ACTIVE" || status === "TRIALING",
    isPastDue: status === "PAST_DUE",
    isSuspended: status === "SUSPENDED",
  }

  return <BillingContext.Provider value={value}>{children}</BillingContext.Provider>
}

export function useBilling() {
  const context = useContext(BillingContext)

  if (!context) {
    throw new Error("useBilling must be used inside BillingProvider")
  }

  return context
}

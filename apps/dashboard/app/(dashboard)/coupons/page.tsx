"use client"

import { FeatureGate } from "@/components/feature-gate"
import { FeatureKey } from "@carekit/shared/constants"
import { CouponListPage } from "@/components/features/coupons/coupon-list-page"

export default function CouponsRoute() {
  return (
    <FeatureGate feature={FeatureKey.COUPONS}>
      <CouponListPage />
    </FeatureGate>
  )
}

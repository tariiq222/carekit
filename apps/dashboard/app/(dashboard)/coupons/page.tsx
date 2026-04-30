"use client"

import { FeatureGate } from "@/components/feature-gate"
import { FeatureKey } from "@deqah/shared/constants"
import { CouponListPage } from "@/components/features/coupons/coupon-list-page"
import { FeatureDisabledState } from "@/components/features/feature-disabled-state"
import { useLocale } from "@/components/locale-provider"

export default function CouponsRoute() {
  const { t } = useLocale()
  return (
    <FeatureGate
      feature={FeatureKey.COUPONS}
      fallback={
        <FeatureDisabledState
          title={t("coupons.title")}
          description={t("coupons.description")}
        />
      }
    >
      <CouponListPage />
    </FeatureGate>
  )
}

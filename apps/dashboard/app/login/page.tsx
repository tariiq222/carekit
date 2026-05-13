import { headers } from "next/headers"
import { LoginFormClient } from "./login-form-client"
import { BrandingStyle } from "./branding-style"
import { fetchPublicBrandingSSR } from "@/lib/api/branding-ssr"

export default async function LoginPage() {
  const headersList = await headers()
  const host = headersList.get("x-forwarded-host") ?? headersList.get("host") ?? ""

  const branding = await fetchPublicBrandingSSR(host).catch(() => null)

  return (
    <>
      {branding && <BrandingStyle branding={branding} />}
      <LoginFormClient />
    </>
  )
}

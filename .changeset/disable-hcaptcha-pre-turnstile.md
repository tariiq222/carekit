---
"backend": patch
---

Drop the production-only requirement for `CAPTCHA_PROVIDER` so `noop` is a valid value in any environment. Per-account lockout (5 attempts → 15-minute lock) remains the primary brute-force defense until Cloudflare Turnstile lands. Adds a `TurnstileCaptchaVerifier` stub + `TURNSTILE_SECRET` env slot so flipping `CAPTCHA_PROVIDER=turnstile` later is a config change, not a code change.

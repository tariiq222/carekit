---
"admin": patch
---

Include `apps/admin/public/` in the production Docker image. Static assets
(icons, svgs, favicons, og-images) referenced via `next/image` and the App
Router's static handler were returning 404 in production because the runner
stage's `COPY` chain skipped the `public` directory.

#!/usr/bin/env bash
set -euo pipefail

REPO="tariiq222/deqah"

echo "==> Applying branch protection to: $REPO"
echo ""

# ── main ──────────────────────────────────────────────────────────────────────
echo "[1/2] Applying protection to: main"
gh api -X PUT "repos/${REPO}/branches/main/protection" --input - <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "backend",
      "TypeScript checks (all packages)",
      "Lint (all apps)",
      "Dashboard build + typecheck",
      "Dashboard unit tests (vitest)",
      "Admin unit tests (vitest)",
      "api-docs",
      "Tenant Isolation E2E (permissive)",
      "Tenant Isolation E2E (strict)"
    ]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": null,
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_conversation_resolution": false,
  "lock_branch": false,
  "allow_fork_syncing": false
}
JSON
echo "    [OK] main protection applied."
echo ""

# ── staging ───────────────────────────────────────────────────────────────────
echo "[2/2] Applying protection to: staging"
gh api -X PUT "repos/${REPO}/branches/staging/protection" --input - <<'JSON'
{
  "required_status_checks": null,
  "enforce_admins": false,
  "required_pull_request_reviews": null,
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_conversation_resolution": false,
  "lock_branch": false,
  "allow_fork_syncing": false
}
JSON
echo "    [OK] staging protection applied."
echo ""

# ── Summary ───────────────────────────────────────────────────────────────────
echo "============================================================"
echo "  Branch protection summary"
echo "============================================================"
echo ""
echo "  main:"
echo "    force-pushes  : BLOCKED"
echo "    deletions     : BLOCKED"
echo "    linear history: REQUIRED"
echo "    enforce_admins: false (owner can push via GITHUB_TOKEN)"
echo "    required checks (9):"
echo "      - backend"
echo "      - TypeScript checks (all packages)"
echo "      - Lint (all apps)"
echo "      - Dashboard build + typecheck"
echo "      - Dashboard unit tests (vitest)"
echo "      - Admin unit tests (vitest)"
echo "      - api-docs"
echo "      - Tenant Isolation E2E (permissive)"
echo "      - Tenant Isolation E2E (strict)"
echo ""
echo "  staging:"
echo "    force-pushes  : BLOCKED"
echo "    deletions     : BLOCKED"
echo "    linear history: REQUIRED"
echo "    enforce_admins: false"
echo "    required checks: none (CI runs after push)"
echo ""
echo "  develop: untouched (open)"
echo ""
echo "============================================================"
echo "  Rollback commands (to remove protection):"
echo "============================================================"
echo ""
echo "  gh api -X DELETE repos/${REPO}/branches/main/protection"
echo "  gh api -X DELETE repos/${REPO}/branches/staging/protection"
echo ""

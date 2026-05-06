#!/usr/bin/env bash
# scripts/sync-production-branch.sh
#
# Builds a sanitized production tree from the current working directory.
# Outputs to ./production-tree/ (relative to repo root).
#
# Usage (local dry-run):
#   bash scripts/sync-production-branch.sh
#
# Usage (CI):
#   CI=true bash scripts/sync-production-branch.sh
#
# The production tree contains ONLY runtime/deployment files.
# All docs, AI instructions, QA data, test code, and internal metadata
# are stripped — ensuring a compromised VPS cannot read internal architecture.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${REPO_ROOT}/production-tree"
IS_CI="${CI:-}"

log() {
  echo "[sync-production] $*"
}

error() {
  echo "[sync-production] ERROR: $*" >&2
  exit 1
}

# ─── Clean slate ──────────────────────────────────────────────────────────────
if [[ -d "${OUT_DIR}" ]]; then
  log "Removing existing production-tree..."
  rm -rf "${OUT_DIR}"
fi
mkdir -p "${OUT_DIR}"

log "Source: ${REPO_ROOT}"
log "Output: ${OUT_DIR}"

# ─── Step 1: rsync allowlisted top-level paths ───────────────────────────────
#
# We use rsync with --exclude to strip out everything unwanted at the root level,
# then do a second pass to strip nested sensitive files.

log "Running rsync (allowlist pass)..."

rsync -a \
  --exclude='.git/' \
  --exclude='.github/' \
  --exclude='production-tree/' \
  --exclude='.githooks/' \
  --exclude='.claude/' \
  --exclude='.kilo/' \
  --exclude='.opencode/' \
  --exclude='.runtime/' \
  --exclude='.superpowers/' \
  --exclude='.playwright-mcp/' \
  --exclude='.turbo/' \
  --exclude='.worktrees/' \
  --exclude='.mcp.json' \
  --exclude='.DS_Store' \
  --exclude='node_modules/' \
  --exclude='docs/' \
  --exclude='data/' \
  --exclude='graphify-out/' \
  --exclude='test-results/' \
  --exclude='testsprite_tests/' \
  --exclude='AGENTS.md' \
  --exclude='CLAUDE.md' \
  --exclude='CONTRIBUTING.md' \
  --exclude='CODEOWNERS' \
  --exclude='IMPLEMENTATION_PLAN.md' \
  --exclude='.kilo' \
  --exclude='.opencode' \
  "${REPO_ROOT}/" "${OUT_DIR}/"

# ─── Step 2: Strip nested sensitive files recursively ────────────────────────
log "Stripping nested sensitive files..."

# Remove all CLAUDE.md files anywhere in the tree
find "${OUT_DIR}" -name "CLAUDE.md" -delete

# Remove all AGENTS.md files anywhere in the tree
find "${OUT_DIR}" -name "AGENTS.md" -delete

# Remove all .claude/ directories anywhere in the tree
find "${OUT_DIR}" -type d -name ".claude" -exec rm -rf {} + 2>/dev/null || true

# Remove all __mocks__/ directories
find "${OUT_DIR}" -type d -name "__mocks__" -exec rm -rf {} + 2>/dev/null || true

# Remove test directories under apps/ and packages/
find "${OUT_DIR}" -type d \( -name "__tests__" -o -name "e2e" -o -name "tests" -o -name "test" \) \
  -exec rm -rf {} + 2>/dev/null || true

# Remove test files (keep source, strip test code)
find "${OUT_DIR}" \( \
  -name "*.test.ts" \
  -o -name "*.test.tsx" \
  -o -name "*.spec.ts" \
  -o -name "*.spec.tsx" \
  -o -name "*.test.js" \
  -o -name "*.spec.js" \
\) -delete

# Remove .env variants that shouldn't be in production tree
# (only .env.example is allowed)
find "${OUT_DIR}" \( \
  -name ".env.local" \
  -o -name ".env.development" \
  -o -name ".env.test" \
\) -delete

# Remove *.md files inside apps/ and packages/ (internal architecture docs)
# Exception: keep root README.md (already at top level, not under apps/)
find "${OUT_DIR}/apps" -name "*.md" -delete 2>/dev/null || true
find "${OUT_DIR}/packages" -name "*.md" -delete 2>/dev/null || true

# Remove scripts/kiwi/ (QA-sync tooling, not needed in production)
rm -rf "${OUT_DIR}/scripts/kiwi" 2>/dev/null || true

# Remove any .DS_Store files that rsync may have copied
find "${OUT_DIR}" -name ".DS_Store" -delete

log "Nested-file stripping complete."

# ─── Step 3: Regenerate minimal .gitignore in production tree ────────────────
log "Writing minimal .gitignore for production tree..."

cat > "${OUT_DIR}/.gitignore" << 'GITIGNORE'
node_modules/
.next/
dist/
build/
coverage/
*.log
.env
.env.local
.env.production
GITIGNORE

# ─── Step 4: Sanity checks ───────────────────────────────────────────────────
log "Running sanity checks..."

FAIL=0

if [[ ! -d "${OUT_DIR}/apps/backend" ]]; then
  echo "[sync-production] FAIL: production-tree/apps/backend/ does not exist" >&2
  FAIL=1
fi

if [[ ! -f "${OUT_DIR}/package.json" ]]; then
  echo "[sync-production] FAIL: production-tree/package.json does not exist" >&2
  FAIL=1
fi

if [[ -f "${OUT_DIR}/CLAUDE.md" ]]; then
  echo "[sync-production] FAIL: production-tree/CLAUDE.md still exists!" >&2
  FAIL=1
fi

LEAKED_CLAUDE=$(find "${OUT_DIR}" -name "CLAUDE.md" 2>/dev/null)
if [[ -n "${LEAKED_CLAUDE}" ]]; then
  echo "[sync-production] FAIL: CLAUDE.md found in production tree:" >&2
  echo "${LEAKED_CLAUDE}" >&2
  FAIL=1
fi

LEAKED_AGENTS=$(find "${OUT_DIR}" -name "AGENTS.md" 2>/dev/null)
if [[ -n "${LEAKED_AGENTS}" ]]; then
  echo "[sync-production] FAIL: AGENTS.md found in production tree:" >&2
  echo "${LEAKED_AGENTS}" >&2
  FAIL=1
fi

if [[ ${FAIL} -ne 0 ]]; then
  error "Sanity checks failed — aborting. Production tree is NOT safe to deploy."
fi

log "All sanity checks passed."

# ─── Step 5: Local dry-run summary (suppressed in CI) ────────────────────────
if [[ -z "${IS_CI}" ]]; then
  echo ""
  echo "═══════════════════════════════════════════════════════"
  echo "  Production Tree Summary"
  echo "═══════════════════════════════════════════════════════"

  FILE_COUNT=$(find "${OUT_DIR}" -type f | wc -l | tr -d ' ')
  TOTAL_SIZE=$(du -sh "${OUT_DIR}" 2>/dev/null | cut -f1)

  echo "  Files:       ${FILE_COUNT}"
  echo "  Total size:  ${TOTAL_SIZE}"
  echo ""
  echo "  Top 10 largest directories:"
  du -sh "${OUT_DIR}"/*/  2>/dev/null | sort -rh | head -10 | \
    sed "s|${OUT_DIR}/||g" | awk '{printf "    %-8s %s\n", $1, $2}'

  echo ""
  echo "  Sanity check results:"
  echo "    [PASS] apps/backend/ exists"
  echo "    [PASS] package.json exists"
  echo "    [PASS] No CLAUDE.md in tree"
  echo "    [PASS] No AGENTS.md in tree"

  echo ""
  echo "  CLAUDE.md search: $(find "${OUT_DIR}" -name "CLAUDE.md" | wc -l | tr -d ' ') found (expect 0)"
  echo "  AGENTS.md search: $(find "${OUT_DIR}" -name "AGENTS.md" | wc -l | tr -d ' ') found (expect 0)"
  echo "═══════════════════════════════════════════════════════"
  echo ""
fi

log "Done. Production tree ready at: ${OUT_DIR}"

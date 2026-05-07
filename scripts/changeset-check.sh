#!/usr/bin/env bash
# scripts/changeset-check.sh
#
# Local pre-push warning: detects code changes in apps/{backend,dashboard,admin,website}
# that lack a corresponding .changeset/*.md entry mentioning the app.
#
# Exits 0 always (warning, not blocker). The promote-to-main workflow blocks
# the actual deploy if changesets are missing — this hook is just a nudge.
#
# Usage: bash scripts/changeset-check.sh

set -uo pipefail  # NOTE: no -e — we want to print warnings even on diff failures

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# Determine the base ref to diff against.
# - On a feature branch: diff against origin/develop
# - On develop: diff against origin/develop's last fetched commit (i.e., what's about to be pushed)
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "")
if [[ "$CURRENT_BRANCH" == "develop" ]]; then
  BASE_REF="origin/develop"
else
  BASE_REF="origin/develop"
fi

# Make sure we have origin/develop locally
git fetch origin develop --quiet 2>/dev/null || true

if ! git rev-parse --verify "$BASE_REF" >/dev/null 2>&1; then
  echo "[changeset-check] (skipped — $BASE_REF not available)"
  exit 0
fi

CHANGED_FILES=$(git diff --name-only "$BASE_REF"...HEAD 2>/dev/null || echo "")

if [[ -z "$CHANGED_FILES" ]]; then
  exit 0
fi

# Map changed files to apps. An app is "touched" if any of its source paths changed.
declare -a TOUCHED_APPS=()
for app in backend dashboard admin website; do
  if echo "$CHANGED_FILES" | grep -qE "^apps/${app}/(src|prisma|app|components|public|lib|messages|next\.config|Dockerfile|package\.json)"; then
    TOUCHED_APPS+=("$app")
  fi
done

if [[ ${#TOUCHED_APPS[@]} -eq 0 ]]; then
  exit 0
fi

# Check for changeset files mentioning each touched app
CHANGESET_FILES=$(ls .changeset/*.md 2>/dev/null | grep -v README.md || echo "")

declare -a MISSING_APPS=()
for app in "${TOUCHED_APPS[@]}"; do
  FOUND=0
  if [[ -n "$CHANGESET_FILES" ]]; then
    for cs in $CHANGESET_FILES; do
      if grep -qE "^\"${app}\":\s*(patch|minor|major)" "$cs" 2>/dev/null; then
        FOUND=1
        break
      fi
    done
  fi
  if [[ $FOUND -eq 0 ]]; then
    MISSING_APPS+=("$app")
  fi
done

if [[ ${#MISSING_APPS[@]} -gt 0 ]]; then
  echo ""
  echo "════════════════════════════════════════════════════════════════════"
  echo " ⚠️  Missing changeset(s) for code changes in:"
  for app in "${MISSING_APPS[@]}"; do
    echo "      • apps/${app}"
  done
  echo ""
  echo " Run:    pnpm changeset"
  echo ""
  echo " (Push will proceed — but 'gh workflow run promote-to-main.yml'"
  echo "  will FAIL until each touched app has a changeset.)"
  echo "════════════════════════════════════════════════════════════════════"
  echo ""
fi

exit 0

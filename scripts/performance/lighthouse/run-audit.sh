#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/lighthouserc.js"
RESULTS_DIR="$SCRIPT_DIR/results"
DASHBOARD_URL="http://localhost:5001"

# ─── Colour helpers ───────────────────────────────────────────────────────────
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Colour

log_info()  { echo -e "${YELLOW}[LHCI]${NC} $*"; }
log_ok()    { echo -e "${GREEN}[PASS]${NC} $*"; }
log_fail()  { echo -e "${RED}[FAIL]${NC} $*"; }

# ─── Prerequisite: dashboard must be reachable ────────────────────────────────
log_info "Checking dashboard is running on :5001…"
if ! curl -sf --max-time 5 "$DASHBOARD_URL" > /dev/null 2>&1; then
  log_fail "Dashboard not responding at $DASHBOARD_URL"
  echo "  Run:  npm run dev:dashboard   (or  cd dashboard && npm run dev)"
  exit 1
fi
log_ok "Dashboard is up"

# ─── Resolve lhci binary ──────────────────────────────────────────────────────
if command -v lhci > /dev/null 2>&1; then
  LHCI_CMD="lhci"
  log_info "Using globally installed lhci: $(command -v lhci)"
else
  log_info "lhci not found globally — falling back to npx"
  LHCI_CMD="npx --yes @lhci/cli@latest"
fi

# ─── Ensure results directory exists ─────────────────────────────────────────
mkdir -p "$RESULTS_DIR"

# ─── Run audit ────────────────────────────────────────────────────────────────
log_info "Starting Lighthouse CI audit (3 runs × 8 pages)…"
log_info "Results will be saved to: $RESULTS_DIR"

# lhci autorun reads lighthouserc.js from the working directory
cd "$SCRIPT_DIR"

set +e   # capture exit code without aborting
$LHCI_CMD autorun \
  --config="$CONFIG_FILE" \
  --outputDir="$RESULTS_DIR"
LHCI_EXIT=$?
set -e

# ─── Summary ─────────────────────────────────────────────────────────────────
echo ""
echo "────────────────────────────────────────"
if [ $LHCI_EXIT -eq 0 ]; then
  log_ok "All assertions passed."
  echo ""
  echo "  HTML reports: $RESULTS_DIR/*.html"
  echo "  JSON results: $RESULTS_DIR/manifest.json"
  echo "  Public URL:   see upload output above"
else
  log_fail "One or more assertions failed (exit $LHCI_EXIT)."
  echo ""
  echo "  Check the JSON assertion output above for which metrics failed."
  echo "  HTML reports: $RESULTS_DIR/*.html"
  echo ""
  echo "  Common fixes:"
  echo "    Performance  →  lazy-load images, reduce JS bundle, add preconnect hints"
  echo "    Accessibility →  add aria-labels, check colour contrast (4.5:1 min)"
  echo "    Best Practices → switch http → https in prod, fix console errors"
fi
echo "────────────────────────────────────────"
echo ""

exit $LHCI_EXIT

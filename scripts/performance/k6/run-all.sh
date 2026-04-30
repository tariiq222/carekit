#!/usr/bin/env bash
# ─── Deqah k6 Load Test Runner ──────────────────────────────────────────
# Runs all scenarios in sequence and stores JSON results in results/
# Usage: ./run-all.sh [--smoke | --load | --stress | --spike]
#
# ENV vars (override defaults):
#   K6_EMAIL          admin email (default: admin@deqah.sa)
#   K6_PASSWORD       admin password (default: Password123!)
#   K6_PRACTITIONER_ID practitioner ID for slot tests (default: 1)
#   K6_SERVICE_ID     service ID for booking creation (default: 1)
#   K6_PATIENT_ID     patient ID for detail tests (default: 1)

set -euo pipefail

# ─── Paths ─────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCENARIOS_DIR="${SCRIPT_DIR}/scenarios"
RESULTS_DIR="${SCRIPT_DIR}/results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RUN_DIR="${RESULTS_DIR}/${TIMESTAMP}"

mkdir -p "${RUN_DIR}"

# ─── Defaults ──────────────────────────────────────────────────────────────
export K6_EMAIL="${K6_EMAIL:-admin@deqah.sa}"
export K6_PASSWORD="${K6_PASSWORD:-Password123!}"
export K6_PRACTITIONER_ID="${K6_PRACTITIONER_ID:-1}"
export K6_SERVICE_ID="${K6_SERVICE_ID:-1}"
export K6_PATIENT_ID="${K6_PATIENT_ID:-1}"

# ─── Color Output ──────────────────────────────────────────────────────────
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info()    { echo -e "${GREEN}[INFO]${NC}  $*"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $*"; }
log_section() { echo -e "\n${YELLOW}══════════════════════════════════════════${NC}"; echo -e "${YELLOW}  $*${NC}"; echo -e "${YELLOW}══════════════════════════════════════════${NC}"; }

# ─── Verify k6 is installed ────────────────────────────────────────────────
if ! command -v k6 &>/dev/null; then
  log_error "k6 is not installed. Install from: https://k6.io/docs/get-started/installation/"
  log_error "  macOS:  brew install k6"
  log_error "  Linux:  sudo gpg ... (see docs)"
  exit 1
fi

log_info "k6 version: $(k6 version)"
log_info "Results directory: ${RUN_DIR}"
log_info "API target: http://localhost:5000/api/v1"
echo ""

# ─── Track results ─────────────────────────────────────────────────────────
declare -A RESULTS
FAILED=0

run_scenario() {
  local name="$1"
  local file="$2"
  local out="${RUN_DIR}/${name}.json"

  log_section "Running: ${name}"

  if k6 run \
      --out "json=${out}" \
      --quiet \
      "${file}"; then
    RESULTS["${name}"]="PASSED"
    log_info "${name}: PASSED"
  else
    RESULTS["${name}"]="FAILED"
    log_error "${name}: FAILED (exit code $?)"
    FAILED=$((FAILED + 1))
  fi
}

# ─── Run all scenarios ─────────────────────────────────────────────────────
run_scenario "auth"          "${SCENARIOS_DIR}/auth.load.js"
run_scenario "bookings"      "${SCENARIOS_DIR}/bookings.load.js"
run_scenario "practitioners" "${SCENARIOS_DIR}/practitioners.load.js"
run_scenario "patients"      "${SCENARIOS_DIR}/patients.load.js"

# ─── Summary Report ────────────────────────────────────────────────────────
log_section "Summary — ${TIMESTAMP}"

TOTAL=${#RESULTS[@]}
PASSED=$((TOTAL - FAILED))

for scenario in "${!RESULTS[@]}"; do
  status="${RESULTS[$scenario]}"
  if [[ "$status" == "PASSED" ]]; then
    echo -e "  ${GREEN}✓${NC} ${scenario}"
  else
    echo -e "  ${RED}✗${NC} ${scenario}"
  fi
done

echo ""
log_info "Total: ${TOTAL}  |  Passed: ${PASSED}  |  Failed: ${FAILED}"
log_info "Raw JSON results saved to: ${RUN_DIR}/"

# Write a summary JSON manifest
cat > "${RUN_DIR}/summary.json" <<EOF
{
  "timestamp": "${TIMESTAMP}",
  "target": "http://localhost:5000/api/v1",
  "total": ${TOTAL},
  "passed": ${PASSED},
  "failed": ${FAILED},
  "scenarios": {
$(
  first=true
  for scenario in "${!RESULTS[@]}"; do
    [[ "$first" == "false" ]] && echo ","
    echo -n "    \"${scenario}\": \"${RESULTS[$scenario]}\""
    first=false
  done
)
  }
}
EOF

log_info "Summary manifest: ${RUN_DIR}/summary.json"

# Exit with failure count so CI picks it up
exit "${FAILED}"

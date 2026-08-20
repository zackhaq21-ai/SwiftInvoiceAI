#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────────────────────────────────────
# Pre-Deploy Gate for ThatInvoice
#
# Runs typecheck, all tests, production build, and lint on changed files.
# If ANY gate fails, the script exits non-zero and deployment must NOT proceed.
#
# Usage: npm run pre-deploy
#        bash scripts/pre-deploy-gate.sh
# ──────────────────────────────────────────────────────────────────────────────

cd "$(dirname "$0")/.."

BOLD='\033[1m'
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

GATES_PASSED=0
GATES_FAILED=0

run_gate() {
  local name="$1"
  local cmd="$2"
  echo -e "\n${BOLD}▶ Running: ${name}${NC}"
  if eval "$cmd"; then
    echo -e "${GREEN}✓ ${name} — PASSED${NC}"
    GATES_PASSED=$((GATES_PASSED + 1))
  else
    echo -e "${RED}✗ ${name} — FAILED${NC}"
    GATES_FAILED=$((GATES_FAILED + 1))
  fi
}

echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  ThatInvoice — Pre-Deploy Gate${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"

# Gate 1: Typecheck
run_gate "Typecheck" "npm run typecheck 2>&1"

# Gate 2: All tests
run_gate "Tests" "npm test 2>&1"

# Gate 3: Production build
run_gate "Production build" "npm run build 2>&1"

# Gate 4: Lint (changed files only — src/ directory)
run_gate "Lint (src/)" "npx eslint src/ --max-warnings 0 2>&1"

# ── Summary ──────────────────────────────────────────────────────────────────
echo -e "\n${BOLD}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  Gate Summary: ${GATES_PASSED} passed, ${GATES_FAILED} failed${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"

if [ "$GATES_FAILED" -gt 0 ]; then
  echo -e "\n${RED}✗ DEPLOYMENT BLOCKED — ${GATES_FAILED} gate(s) failed.${NC}"
  echo -e "${YELLOW}  Fix the failures above before publishing to production.${NC}"
  echo -e "${YELLOW}  Do NOT publish until all gates pass.${NC}"
  exit 1
fi

echo -e "\n${GREEN}✓ ALL GATES PASSED — safe to publish.${NC}"
echo -e "${YELLOW}  Next: click 'Update' in Bolt's Publish menu to deploy to thatinvoiceai.com${NC}"
echo -e "${YELLOW}  Then run: npm run health-check${NC}"
exit 0

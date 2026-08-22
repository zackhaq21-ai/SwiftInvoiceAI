#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────────────────────────────────────
# Post-Deploy Health Check for VELZICO
#
# After publishing to production, run this script to verify the site is
# live and core public routes are responding.
#
# Usage: npm run health-check
#        bash scripts/post-deploy-health-check.sh [URL]
#
# Defaults to https://velzico.com
# ──────────────────────────────────────────────────────────────────────────────

BASE_URL="${1:-https://velzico.com}"
# Remove trailing slash for consistent URL construction
BASE_URL="${BASE_URL%/}"

BOLD='\033[1m'
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

CHECKS_PASSED=0
CHECKS_FAILED=0

# Routes to verify — homepage and any hash-based routes that serve the SPA
ROUTES=(
  "/"
)

check_route() {
  local url="$1"
  local expected_status="${2:-200}"
  local response_code
  local response_time

  echo -e "  Checking: ${url}"

  # Capture HTTP status code and time
  local tmp_file
  tmp_file=$(mktemp)
  local start_time
  start_time=$(date +%s%N 2>/dev/null || python3 -c 'import time; print(int(time.time()*1000000000))')

  response_code=$(curl -s -o /dev/null -w "%{http_code}" \
    --max-time 15 \
    --connect-timeout 10 \
    -L \
    "$url" 2>/dev/null || echo "000")

  local end_time
  end_time=$(date +%s%N 2>/dev/null || python3 -c 'import time; print(int(time.time()*1000000000))')
  response_time=$(( (end_time - start_time) / 1000000 ))
  rm -f "$tmp_file"

  if [ "$response_code" = "$expected_status" ]; then
    echo -e "    ${GREEN}✓ HTTP ${response_code} (${response_time}ms)${NC}"
    CHECKS_PASSED=$((CHECKS_PASSED + 1))
  else
    echo -e "    ${RED}✗ HTTP ${response_code} (expected ${expected_status}) (${response_time}ms)${NC}"
    CHECKS_FAILED=$((CHECKS_FAILED + 1))
  fi
}

echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  VELZICO — Post-Deploy Health Check${NC}"
echo -e "${BOLD}  Target: ${BASE_URL}${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"

# Check each route
for route in "${ROUTES[@]}"; do
  check_route "${BASE_URL}${route}"
done

# Verify HTTPS is active
echo -e "\n  Checking HTTPS..."
if [[ "$BASE_URL" == https://* ]]; then
  echo -e "    ${GREEN}✓ HTTPS protocol in use${NC}"
  CHECKS_PASSED=$((CHECKS_PASSED + 1))
else
  echo -e "    ${RED}✗ Not using HTTPS — production must use HTTPS${NC}"
  CHECKS_FAILED=$((CHECKS_FAILED + 1))
fi

# Check that the SPA shell loads (contains expected content markers)
echo -e "\n  Checking SPA shell content..."
homepage_body=$(curl -s --max-time 15 "$BASE_URL" 2>/dev/null || echo "")
if echo "$homepage_body" | grep -q "VELZICO\|velzico\|invoice" 2>/dev/null; then
  echo -e "    ${GREEN}✓ Page content contains expected markers${NC}"
  CHECKS_PASSED=$((CHECKS_PASSED + 1))
else
  echo -e "    ${YELLOW}⚠ Could not verify page content markers (may be client-rendered)${NC}"
  # Don't fail — SPA content is client-rendered
fi

# ── Summary ──────────────────────────────────────────────────────────────────
echo -e "\n${BOLD}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  Health Check Summary: ${CHECKS_PASSED} passed, ${CHECKS_FAILED} failed${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"

if [ "$CHECKS_FAILED" -gt 0 ]; then
  echo -e "\n${RED}✗ HEALTH CHECK FAILED — ${CHECKS_FAILED} check(s) failed.${NC}"
  echo -e "${YELLOW}  The deployment may be broken. Consider rolling back.${NC}"
  echo -e "${YELLOW}  Rollback: use Bolt's 'View history' button to restore the${NC}"
  echo -e "${YELLOW}  previous working version, then click 'Update' to republish.${NC}"
  exit 1
fi

echo -e "\n${GREEN}✓ ALL HEALTH CHECKS PASSED — site is live and responding.${NC}"
exit 0

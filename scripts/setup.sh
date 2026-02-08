#!/usr/bin/env bash
#
# API Toll — Production Setup & Validation Script
#
# This script validates your environment is ready to go live
# and walks you through the remaining configuration steps.
#
# Usage:
#   chmod +x scripts/setup.sh
#   ./scripts/setup.sh
#
# For testnet (Base Sepolia):
#   NETWORK=testnet ./scripts/setup.sh

set -euo pipefail

# ─── Colors ──────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

PASS="${GREEN}✅${NC}"
FAIL="${RED}❌${NC}"
WARN="${YELLOW}⚠️${NC}"
INFO="${BLUE}ℹ️${NC}"

ERRORS=0
WARNINGS=0

# ─── Banner ──────────────────────────────────────────────────────

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                                                  ║${NC}"
echo -e "${CYAN}║   ${BOLD}API Toll — Production Setup${NC}${CYAN}                     ║${NC}"
echo -e "${CYAN}║   x402 Micropayments for AI Agents               ║${NC}"
echo -e "${CYAN}║                                                  ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════╝${NC}"
echo ""

NETWORK="${NETWORK:-mainnet}"
echo -e "${INFO} Network: ${BOLD}${NETWORK}${NC}"
echo ""

if [[ "$NETWORK" == "testnet" ]]; then
  echo -e "${WARN} Running in ${YELLOW}TESTNET${NC} mode (Base Sepolia)"
  echo "   Get testnet ETH: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet"
  echo "   Get testnet USDC: Use Coinbase testnet faucet or bridge from Sepolia"
  echo ""
  CHAIN_NAME="Base Sepolia"
  RPC_URL="https://sepolia.base.org"
  USDC_ADDRESS="0x036CbD53842c5426634e7929541eC2318f3dCF7e"
  NETWORK_ID="eip155:84532"
  EXPLORER="https://sepolia.basescan.org"
else
  echo -e "${INFO} Running in ${GREEN}MAINNET${NC} mode (Base)"
  CHAIN_NAME="Base Mainnet"
  RPC_URL="https://mainnet.base.org"
  USDC_ADDRESS="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
  NETWORK_ID="eip155:8453"
  EXPLORER="https://basescan.org"
fi

echo ""
echo -e "${BOLD}═══ Step 1: Check Prerequisites ═══${NC}"
echo ""

# Check Node.js
if command -v node &> /dev/null; then
  NODE_VERSION=$(node --version)
  echo -e "${PASS} Node.js installed: ${NODE_VERSION}"
else
  echo -e "${FAIL} Node.js not installed (requires v18+)"
  ERRORS=$((ERRORS + 1))
fi

# Check npm
if command -v npm &> /dev/null; then
  NPM_VERSION=$(npm --version)
  echo -e "${PASS} npm installed: v${NPM_VERSION}"
else
  echo -e "${FAIL} npm not installed"
  ERRORS=$((ERRORS + 1))
fi

# Check tsx
if command -v npx &> /dev/null; then
  echo -e "${PASS} npx available"
else
  echo -e "${FAIL} npx not available"
  ERRORS=$((ERRORS + 1))
fi

# Check git
if command -v git &> /dev/null; then
  echo -e "${PASS} git installed"
else
  echo -e "${WARN} git not installed (optional but recommended)"
  WARNINGS=$((WARNINGS + 1))
fi

echo ""
echo -e "${BOLD}═══ Step 2: Validate Environment Variables ═══${NC}"
echo ""

# ─── Facilitator Env Vars ────────────────────────────────────────

echo -e "${CYAN}── Facilitator (packages/facilitator) ──${NC}"

# Check facilitator .env
FACILITATOR_ENV="packages/facilitator/.env"
if [[ -f "$FACILITATOR_ENV" ]]; then
  echo -e "${PASS} Facilitator .env exists"
  source "$FACILITATOR_ENV" 2>/dev/null || true
else
  echo -e "${FAIL} Missing: ${FACILITATOR_ENV}"
  echo "   Create it with: cp packages/facilitator/.env.example packages/facilitator/.env"
  ERRORS=$((ERRORS + 1))
fi

# FACILITATOR_PRIVATE_KEY
if [[ -n "${FACILITATOR_PRIVATE_KEY:-}" ]]; then
  KEY_LEN=${#FACILITATOR_PRIVATE_KEY}
  if [[ "$KEY_LEN" -ge 64 ]]; then
    MASKED="${FACILITATOR_PRIVATE_KEY:0:6}...${FACILITATOR_PRIVATE_KEY: -4}"
    echo -e "${PASS} FACILITATOR_PRIVATE_KEY set (${MASKED})"

    # Check if it's the test key
    if [[ "$FACILITATOR_PRIVATE_KEY" == "2b69439cae0a0b"* ]]; then
      echo -e "${WARN} This looks like the TEST private key with \$0 balance!"
      echo "   You need a funded wallet for real payments."
      echo ""
      echo "   To create a new wallet:"
      echo "     1. Install MetaMask or use: npx tsx scripts/create-wallet.ts"
      echo "     2. Save the private key securely"
      echo "     3. Fund it with ETH (for gas) + USDC on ${CHAIN_NAME}"
      echo "     4. Update FACILITATOR_PRIVATE_KEY in ${FACILITATOR_ENV}"
      echo ""
      WARNINGS=$((WARNINGS + 1))
    fi
  else
    echo -e "${FAIL} FACILITATOR_PRIVATE_KEY looks invalid (too short: ${KEY_LEN} chars)"
    ERRORS=$((ERRORS + 1))
  fi
else
  echo -e "${FAIL} FACILITATOR_PRIVATE_KEY not set"
  echo "   This is the hot wallet that pays sellers on behalf of agents."
  echo "   Generate one: npx tsx scripts/create-wallet.ts"
  ERRORS=$((ERRORS + 1))
fi

# FACILITATOR_API_KEYS
if [[ -n "${FACILITATOR_API_KEYS:-}" ]]; then
  if [[ "$FACILITATOR_API_KEYS" == "apitoll-dev-key-2024" ]]; then
    echo -e "${WARN} FACILITATOR_API_KEYS is still the dev key"
    echo "   Generate a secure key: openssl rand -hex 32"
    WARNINGS=$((WARNINGS + 1))
  else
    echo -e "${PASS} FACILITATOR_API_KEYS set (production key)"
  fi
else
  echo -e "${WARN} FACILITATOR_API_KEYS not set (running in open mode)"
  echo "   Anyone can use your facilitator without auth!"
  echo "   Generate a key: openssl rand -hex 32"
  WARNINGS=$((WARNINGS + 1))
fi

echo ""

# ─── Seller API Env Vars ────────────────────────────────────────

echo -e "${CYAN}── Seller API (apps/seller-api) ──${NC}"

SELLER_ENV="apps/seller-api/.env"
if [[ -f "$SELLER_ENV" ]]; then
  echo -e "${PASS} Seller .env exists"
  source "$SELLER_ENV" 2>/dev/null || true
else
  echo -e "${FAIL} Missing: ${SELLER_ENV}"
  echo "   Create it with: cp apps/seller-api/.env.example apps/seller-api/.env"
  ERRORS=$((ERRORS + 1))
fi

# SELLER_WALLET
if [[ -n "${SELLER_WALLET:-}" ]]; then
  if [[ "$SELLER_WALLET" == "0xYOUR"* || "$SELLER_WALLET" == "0xYour"* ]]; then
    echo -e "${FAIL} SELLER_WALLET is still the placeholder"
    echo "   Set it to your real wallet address where you want to receive USDC."
    ERRORS=$((ERRORS + 1))
  else
    echo -e "${PASS} SELLER_WALLET set: ${SELLER_WALLET}"
  fi
else
  echo -e "${FAIL} SELLER_WALLET not set"
  echo "   This is where you receive USDC payments from agents."
  ERRORS=$((ERRORS + 1))
fi

# FACILITATOR_URL
if [[ -n "${FACILITATOR_URL:-}" ]]; then
  if [[ "$FACILITATOR_URL" == "http://localhost"* ]]; then
    echo -e "${WARN} FACILITATOR_URL is localhost: ${FACILITATOR_URL}"
    echo "   For production, set it to your Railway URL:"
    echo "   FACILITATOR_URL=https://facilitator-production-fbd7.up.railway.app"
    WARNINGS=$((WARNINGS + 1))
  else
    echo -e "${PASS} FACILITATOR_URL set: ${FACILITATOR_URL}"
  fi
else
  echo -e "${WARN} FACILITATOR_URL not set (defaults to localhost)"
  WARNINGS=$((WARNINGS + 1))
fi

echo ""

# ─── Agent Client Env Vars ──────────────────────────────────────

echo -e "${CYAN}── Agent Client (apps/agent-client) ──${NC}"

AGENT_ENV="apps/agent-client/.env"
if [[ -f "$AGENT_ENV" ]]; then
  echo -e "${PASS} Agent .env exists"
  source "$AGENT_ENV" 2>/dev/null || true
else
  echo -e "${FAIL} Missing: ${AGENT_ENV}"
  echo "   Create it with: cp apps/agent-client/.env.example apps/agent-client/.env"
  ERRORS=$((ERRORS + 1))
fi

if [[ -n "${AGENT_WALLET:-}" ]]; then
  echo -e "${PASS} AGENT_WALLET set: ${AGENT_WALLET}"
else
  echo -e "${FAIL} AGENT_WALLET not set"
  ERRORS=$((ERRORS + 1))
fi

if [[ -n "${FACILITATOR_API_KEY:-}" ]]; then
  if [[ "$FACILITATOR_API_KEY" == "apitoll-dev-key-2024" ]]; then
    echo -e "${WARN} FACILITATOR_API_KEY is still the dev key"
    WARNINGS=$((WARNINGS + 1))
  else
    echo -e "${PASS} FACILITATOR_API_KEY set"
  fi
else
  echo -e "${FAIL} FACILITATOR_API_KEY not set"
  ERRORS=$((ERRORS + 1))
fi

echo ""
echo -e "${BOLD}═══ Step 3: Check Packages ═══${NC}"
echo ""

# Check if packages are built
for pkg in shared seller-sdk buyer-sdk; do
  PKG_DIR="packages/${pkg}"
  if [[ -d "${PKG_DIR}/dist" ]]; then
    echo -e "${PASS} @apitoll/${pkg} built (dist/ exists)"
  else
    echo -e "${WARN} @apitoll/${pkg} not built — run: cd ${PKG_DIR} && npm run build"
    WARNINGS=$((WARNINGS + 1))
  fi
done

echo ""
echo -e "${BOLD}═══ Step 4: Check Dependencies ═══${NC}"
echo ""

for app in "packages/facilitator" "apps/seller-api" "apps/agent-client"; do
  if [[ -d "${app}/node_modules" ]]; then
    echo -e "${PASS} ${app} dependencies installed"
  else
    echo -e "${WARN} ${app} missing node_modules — run: cd ${app} && npm install"
    WARNINGS=$((WARNINGS + 1))
  fi
done

echo ""
echo -e "${BOLD}═══ Step 5: Network Connectivity ═══${NC}"
echo ""

# Check RPC
echo -n "   Checking ${CHAIN_NAME} RPC..."
if command -v curl &> /dev/null; then
  RPC_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${RPC_URL}" \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
    --connect-timeout 5 2>/dev/null || echo "000")

  if [[ "$RPC_RESPONSE" == "200" ]]; then
    echo -e "\r${PASS} ${CHAIN_NAME} RPC reachable                     "
  else
    echo -e "\r${FAIL} ${CHAIN_NAME} RPC unreachable (HTTP ${RPC_RESPONSE})   "
    ERRORS=$((ERRORS + 1))
  fi
else
  echo -e "\r${WARN} curl not available — can't check RPC"
  WARNINGS=$((WARNINGS + 1))
fi

# Check facilitator if URL is set
if [[ -n "${FACILITATOR_URL:-}" && "$FACILITATOR_URL" != "http://localhost"* ]]; then
  echo -n "   Checking facilitator health..."
  HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "${FACILITATOR_URL}/health" --connect-timeout 5 2>/dev/null || echo "000")

  if [[ "$HEALTH_RESPONSE" == "200" ]]; then
    echo -e "\r${PASS} Facilitator is running                          "
  else
    echo -e "\r${FAIL} Facilitator unreachable at ${FACILITATOR_URL} (HTTP ${HEALTH_RESPONSE})"
    ERRORS=$((ERRORS + 1))
  fi
fi

# Check seller API if URL is set
if [[ -n "${JOKE_API_URL:-}" && "$JOKE_API_URL" != "http://localhost"* ]]; then
  echo -n "   Checking seller API health..."
  SELLER_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "${JOKE_API_URL}/health" --connect-timeout 5 2>/dev/null || echo "000")

  if [[ "$SELLER_RESPONSE" == "200" ]]; then
    echo -e "\r${PASS} Seller API is running                           "
  else
    echo -e "\r${FAIL} Seller API unreachable at ${JOKE_API_URL} (HTTP ${SELLER_RESPONSE})"
    ERRORS=$((ERRORS + 1))
  fi
fi

echo ""

# ─── Summary ────────────────────────────────────────────────────

echo -e "${BOLD}═══════════════════════════════════════════════════${NC}"
echo ""

if [[ $ERRORS -eq 0 && $WARNINGS -eq 0 ]]; then
  echo -e "${GREEN}${BOLD}  ALL CHECKS PASSED! You're ready to go live.${NC}"
  echo ""
  echo "  Next steps:"
  echo "    1. Start facilitator:  cd packages/facilitator && npx tsx src/server.ts"
  echo "    2. Start seller API:   cd apps/seller-api && npx tsx server.ts"
  echo "    3. Run the agent:      cd apps/agent-client && npx tsx agent.ts"
  echo ""
elif [[ $ERRORS -eq 0 ]]; then
  echo -e "${YELLOW}${BOLD}  READY WITH ${WARNINGS} WARNING(S)${NC}"
  echo ""
  echo "  You can proceed, but review the warnings above for production."
  echo ""
elif [[ $ERRORS -gt 0 ]]; then
  echo -e "${RED}${BOLD}  ${ERRORS} ERROR(S) and ${WARNINGS} WARNING(S) found${NC}"
  echo ""
  echo "  Fix the errors above before going live."
  echo ""
fi

echo -e "  ${CYAN}Dashboard:${NC}    https://apitoll.com"
echo -e "  ${CYAN}Facilitator:${NC}  https://facilitator-production-fbd7.up.railway.app"
echo -e "  ${CYAN}Seller API:${NC}   https://seller-api-production.up.railway.app"
echo -e "  ${CYAN}Explorer:${NC}     ${EXPLORER}"
echo -e "  ${CYAN}USDC:${NC}         ${USDC_ADDRESS}"
echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════${NC}"
echo ""

#!/usr/bin/env bash
set -euo pipefail

VERSION="${TRYAPPSTACK_VERSION:-1.0.0}"
LIB="${TRYAPPSTACK_LIB:-$(cd "$(dirname "$0")/.." && pwd)}"
CORE="$(cd "$(dirname "$0")" && pwd)"

source "$CORE/colors.sh"
source "$CORE/detect.sh"
source "$CORE/bashHelpers.sh"
source "$CORE/ai.sh"
source "$CORE/report.sh"

# ── Defaults ──
DIR="${1:-.}"; shift || true
OUTPUT_FILE="" REPORT_NAME="" RUN_ALL=true VERBOSE=false
AI_ENABLED=false AI_KEY="" AI_PROVIDER="claude" PRE_PUSH=false STRICT=false STRICT_T=70 FIX_MODE=false JSON_OUT=false
EXCLUDE=() INCLUDE=()
DEFAULT_EXCLUDE=("node_modules" ".git" "dist" ".next" "build" "__pycache__" ".angular" ".nuxt" "coverage" ".cache" ".turbo" ".vercel" ".output" ".svelte-kit" "storybook-static")
declare -A MOD_ON SCORES MOD_ISSUES
MODS=(loc unused_packages dead_code structure deps complexity security bundle performance best_practices alternatives env git_health test_coverage api_docs a11y)
for m in "${MODS[@]}"; do MOD_ON[$m]=false; done
TOTAL_SCORE=0 TOTAL_MODS=0 REPORT_BODY="" CUR_STEP=0

register_score() { local s=$2; [[ $s -gt 100 ]] && s=100; [[ $s -lt 0 ]] && s=0; SCORES["$1"]=$s; TOTAL_SCORE=$((TOTAL_SCORE+s)); ((TOTAL_MODS++)); }
register_issue() { MOD_ISSUES["$1"]+="- $2"$'\n'; }
export -f register_score register_issue

# ── Parse remaining args ──
while [[ $# -gt 0 ]]; do
  case $1 in
    -o) OUTPUT_FILE="$2"; shift 2;; -n) REPORT_NAME="$2"; shift 2;; --verbose) VERBOSE=true; shift;;
    --strict) STRICT=true; STRICT_T="${2:-70}"; shift; [[ "${1:-}" =~ ^[0-9]+$ ]] && { STRICT_T="$1"; shift; };;
    --ai) AI_ENABLED=true; shift;; --ai-key) AI_KEY="$2"; AI_ENABLED=true; shift 2;;
    --ai-provider) AI_PROVIDER="$2"; shift 2;; --pre-push) PRE_PUSH=true; STRICT=true; VERBOSE=false; shift;;
    --exclude) IFS=',' read -ra EXCLUDE <<< "$2"; shift 2;; --include) IFS=',' read -ra INCLUDE <<< "$2"; shift 2;;
    --fix-mode) FIX_MODE=true; shift;;
    --json) JSON_OUT=true; shift;;
    --loc|--unused-packages|--dead-code|--structure|--bundle|--deps|--complexity|--security|--performance|--best-practices|--alternatives|--env|--git-health|--tests|--test-coverage|--a11y|--docs|--api-docs)
      RUN_ALL=false; MOD_ON[${1#--}]=true; MOD_ON[${1//-/_}]=true; shift;;
    *) shift;;
  esac
done

# Fix mod flag keys (dashes to underscores)
for m in "${MODS[@]}"; do
  dashed="${m//_/-}"
  [[ "${MOD_ON[$dashed]:-}" == "true" ]] && MOD_ON[$m]=true
done
# Short-name aliases
[[ "${MOD_ON[tests]:-}" == "true" ]] && MOD_ON[test_coverage]=true
[[ "${MOD_ON[docs]:-}" == "true" ]] && MOD_ON[api_docs]=true

# ── Load config ──
[[ -f "$DIR/.auditrc" ]] && source "$DIR/.auditrc" 2>/dev/null || true
[[ -f "$HOME/.tryappstack/config" ]] && source "$HOME/.tryappstack/config" 2>/dev/null || true
[[ -n "${OPENAI_API_KEY:-}" && -z "$AI_KEY" ]] && AI_KEY="$OPENAI_API_KEY" AI_PROVIDER="openai"
[[ -n "${ANTHROPIC_API_KEY:-}" && -z "$AI_KEY" ]] && AI_KEY="$ANTHROPIC_API_KEY" AI_PROVIDER="claude"
[[ -n "${XAI_API_KEY:-}" && -z "$AI_KEY" ]] && AI_KEY="$XAI_API_KEY" AI_PROVIDER="grok"

ALL_EXCLUDE=("${DEFAULT_EXCLUDE[@]}" "${EXCLUDE[@]}")
export ALL_EXCLUDE INCLUDE VERBOSE DIR AI_ENABLED AI_KEY AI_PROVIDER LIB

# ── Fix mode ──
if $FIX_MODE; then source "$CORE/autofix.sh"; run_autofix "$DIR"; exit 0; fi

# ── Detect framework ──
detect_framework "$DIR"

# ── Output setup ──
TS=$(date '+%Y-%m-%d_%H-%M')
DATE_DISPLAY=$(date '+%Y-%m-%d %H:%M')
PROJECT=$(basename "$(cd "$DIR" && pwd)")
export DATE_DISPLAY
[[ -z "$OUTPUT_FILE" ]] && { mkdir -p "$DIR/audits" 2>/dev/null || true; OUTPUT_FILE="$DIR/audits/${REPORT_NAME:-audit-$TS}.md"; }
[[ "$OUTPUT_FILE" != *.md ]] && OUTPUT_FILE="${OUTPUT_FILE}.md"

# ── Count steps ──
TOT=2; $AI_ENABLED && ((TOT++))
for m in "${MODS[@]}"; do ($RUN_ALL || [[ "${MOD_ON[$m]:-}" == "true" ]]) && ((TOT++)); done

# ── Info (non-prepush) ──
if ! $PRE_PUSH; then
  echo -e "  ${DIM}Project${NC}     $PROJECT"
  echo -e "  ${DIM}Framework${NC}   $FRAMEWORK_DISPLAY"
  echo -e "  ${DIM}Language${NC}    $LANG_DISPLAY"
  echo -e "  ${DIM}Manager${NC}    $PKG_MANAGER"
  $AI_ENABLED && echo -e "  ${DIM}AI Agent${NC}   $AI_PROVIDER ✨"
  echo ""
fi

# ── Run modules ──
run_mod() {
  local m="$1" f="$LIB/modules/${m}.sh"
  ((CUR_STEP++))
  [[ ! -f "$f" ]] && return 0
  local name="${m//_/ }"
  if ! $PRE_PUSH && [[ -t 1 ]]; then
    local pct=$((CUR_STEP*100/TOT)) w=20 filled=$((CUR_STEP*20/TOT)) bar=""
    for ((i=0;i<filled;i++)); do bar+="━"; done
    for ((i=filled;i<w;i++)); do bar+="─"; done
    printf "\r  ${ACCENT}%s${NC} ${DIM}[%d/%d]${NC} %s%*s" "$bar" "$CUR_STEP" "$TOT" "$name" $((40-${#name})) ""
  fi
  source "$f"
  REPORT_BODY+=$("audit_${m}" "$DIR" 2>&1)$'\n\n'
  $PRE_PUSH && echo -e "  ${DIM}${name}: ${SCORES[$m]:-0}/100${NC}" || true
}

((CUR_STEP++))
$PRE_PUSH || printf "\r  ${ACCENT}━${NC}${DIM}─────────────────── [1/%d]${NC} Detecting framework...          " "$TOT"

for m in "${MODS[@]}"; do
  ($RUN_ALL || [[ "${MOD_ON[$m]:-}" == "true" ]]) && run_mod "$m"
done

# ── AI ──
if $AI_ENABLED && [[ -n "$AI_KEY" ]]; then
  ((CUR_STEP++))
  $PRE_PUSH || printf "\r  ${ACCENT}━━━━━━━━━━━━━━━━━━━━${NC} ${DIM}[%d/%d]${NC} AI analysis...                  " "$CUR_STEP" "$TOT"
  REPORT_BODY+=$(run_ai_analysis)$'\n\n'
fi

# ── Generate report ──
((CUR_STEP++))
$PRE_PUSH || printf "\r  ${ACCENT}━━━━━━━━━━━━━━━━━━━━${NC} ${DIM}[%d/%d]${NC} Generating report...            \n" "$CUR_STEP" "$TOT"
generate_md_report "$OUTPUT_FILE"

# ── Console output ──
if ! $PRE_PUSH; then
  echo ""
  print_scorecard_console
  echo ""
  echo -e "  ${GREEN}${BOLD}✓${NC} Report saved: ${UNDERLINE}${OUTPUT_FILE}${NC}"
  print_quick_wins
fi

# ── JSON output ──
if ${JSON_OUT:-false}; then
  json_scores="{"
  first=true
  for m in "${!SCORES[@]}"; do
    $first && first=false || json_scores+=","
    json_scores+="\"$m\":${SCORES[$m]}"
  done
  json_scores+="}"
  json_avg=0; [[ $TOTAL_MODS -gt 0 ]] && json_avg=$((TOTAL_SCORE / TOTAL_MODS))
  echo "{\"project\":\"$PROJECT\",\"framework\":\"$FRAMEWORK_DISPLAY\",\"score\":$json_avg,\"modules\":$json_scores,\"report\":\"$OUTPUT_FILE\"}"
fi

# ── Strict exit ──
if $STRICT && [[ $TOTAL_MODS -gt 0 ]]; then
  avg=$((TOTAL_SCORE / TOTAL_MODS))
  if [[ $avg -lt $STRICT_T ]]; then
    echo -e "  ${RED}${BOLD}✗ FAILED: $avg < $STRICT_T${NC}"
    $PRE_PUSH && echo -e "  ${DIM}Run 'npx tryappstack-audit' for details. Skip: git push --no-verify${NC}"
    exit 1
  fi
  $PRE_PUSH && echo -e "  ${GREEN}${BOLD}✓ PASSED: $avg ≥ $STRICT_T${NC}"
fi

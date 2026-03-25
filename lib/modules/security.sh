#!/bin/bash
audit_security() {
  local dir="$1"; local issues=0 checks=0
  print_module_header "🔒" "Security Audit"
  echo "| Status | Check |"; echo "|--------|-------|"
  ck_pass() { echo "| ✅ | $1 |"; ((checks++)); }
  ck_warn() { echo "| 🟡 | $1 |"; ((checks++)); ((issues++)); register_issue "Security" "- $1"; }
  ck_fail() { echo "| 🔴 | $1 |"; ((checks++)); ((issues++)); register_issue "Security" "- $1"; }

  # .env safety
  local envs=$(find "$dir" -maxdepth 3 -name '.env' -not -path '*/node_modules/*' 2>/dev/null)
  if [[ -n "$envs" ]]; then
    [[ -f "$dir/.gitignore" ]] && grep -q '\.env' "$dir/.gitignore" && ck_pass ".env is gitignored" || ck_fail ".env NOT in .gitignore"
  fi
  [[ ! -f "$dir/.env.example" && ! -f "$dir/.env.template" ]] && ck_warn "No .env.example for team" || ck_pass ".env.example exists"

  # Secrets
  local sec=$(find "$dir" -not -path '*/node_modules/*' -not -path '*/.git/*' -not -name '*.env*' \
    -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' \) \
    -exec grep -liE '(api_key|secret|password|token|private_key)\s*[=:]\s*["'"'"'][^"'"'"']{8,}' {} \; 2>/dev/null | head -5)
  [[ -n "$sec" ]] && ck_fail "Possible hardcoded secrets found" || ck_pass "No hardcoded secrets"

  # XSS
  local xss=$(find "$dir" -not -path '*/node_modules/*' -type f -name '*.tsx' -exec grep -l "dangerouslySetInnerHTML" {} \; 2>/dev/null | wc -l)
  [[ $xss -gt 0 ]] && ck_warn "dangerouslySetInnerHTML in $xss files" || ck_pass "No dangerouslySetInnerHTML"

  local eval_f=$(find "$dir" -not -path '*/node_modules/*' -type f \( -name '*.ts' -o -name '*.js' \) -exec grep -l '\beval\s*(' {} \; 2>/dev/null | wc -l)
  [[ $eval_f -gt 0 ]] && ck_fail "eval() in $eval_f files" || ck_pass "No eval() usage"

  # Backend
  local pkg="$dir/package.json"
  if [[ "$FRAMEWORK" == "express" || "$FRAMEWORK" == "nestjs" || "$FRAMEWORK" == "fastify" || "$FRAMEWORK" == "node" ]]; then
    grep -q '"helmet"' "$pkg" 2>/dev/null && ck_pass "helmet installed" || ck_warn "No helmet — add security headers"
    grep -rq 'rate-limit\|throttler' "$pkg" 2>/dev/null && ck_pass "Rate limiting" || ck_warn "No rate limiting"
  fi

  echo ""; echo "**Summary:** $checks checks, **$issues issues**"; echo ""
  [[ $checks -gt 0 ]] && register_score "Security" "$(( (checks - issues) * 100 / checks ))"
}

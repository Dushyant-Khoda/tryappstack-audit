#!/bin/bash
audit_performance() {
  local dir="$1"; local issues=0 checks=0; local src=$(get_src_dir "$dir"); local pkg="$dir/package.json"
  print_module_header "⚡" "Performance Patterns"
  echo "| Status | Check |"; echo "|--------|-------|"
  ck_pass() { echo "| ✅ | $1 |"; ((checks++)); }
  ck_warn() { echo "| 🟡 | $1 |"; ((checks++)); ((issues++)); }

  case "$FRAMEWORK" in
    react*|nextjs*)
      local memo=$(find "$src" -name '*.tsx' -exec grep -l "React.memo\|memo(" {} \; 2>/dev/null | wc -l)
      [[ $memo -gt 0 ]] && ck_pass "React.memo: $memo components" || ck_warn "No React.memo usage"
      local lazy=$(find "$src" -type f \( -name '*.tsx' -o -name '*.ts' \) -exec grep -l "React.lazy\|lazy(" {} \; 2>/dev/null | wc -l)
      [[ $lazy -gt 0 ]] && ck_pass "Lazy loading: $lazy" || ck_warn "No code splitting"
      local susp=$(find "$src" -name '*.tsx' -exec grep -l "Suspense" {} \; 2>/dev/null | wc -l)
      [[ $susp -gt 0 ]] && ck_pass "Suspense: $susp" || ck_warn "No Suspense boundaries"
      ;;
    angular)
      local onpush=$(find "$src" -name '*.component.ts' -exec grep -l "OnPush" {} \; 2>/dev/null | wc -l)
      [[ $onpush -gt 0 ]] && ck_pass "OnPush: $onpush components" || ck_warn "No OnPush change detection"
      ;;
    vue*|nuxt)
      local async=$(find "$src" -type f \( -name '*.vue' -o -name '*.ts' \) -exec grep -l "defineAsyncComponent\|import(" {} \; 2>/dev/null | wc -l)
      [[ $async -gt 0 ]] && ck_pass "Async components: $async" || ck_warn "No async components"
      ;;
  esac

  if [[ "$FRAMEWORK" == "express" || "$FRAMEWORK" == "nestjs" || "$FRAMEWORK" == "fastify" || "$FRAMEWORK" == "node" ]]; then
    grep -rq "redis\|lru-cache\|node-cache" "$pkg" 2>/dev/null && ck_pass "Caching solution" || ck_warn "No caching"
    grep -q '"compression"' "$pkg" 2>/dev/null && ck_pass "Compression" || ck_warn "No compression"
  fi

  local large_imgs=$(find "$dir" -not -path '*/node_modules/*' -type f \( -name '*.png' -o -name '*.jpg' \) -size +500k 2>/dev/null | wc -l)
  [[ $large_imgs -gt 0 ]] && ck_warn "$large_imgs images over 500KB" || ck_pass "No oversized images"

  echo ""; echo "**Summary:** $checks checks, **$issues issues**"; echo ""
  [[ $checks -gt 0 ]] && register_score "Performance" "$(( (checks - issues) * 100 / checks ))"
}

#!/bin/bash
audit_best_practices() {
  local dir="$1"; local issues=0 checks=0; local src=$(get_src_dir "$dir"); local pkg="$dir/package.json"
  print_module_header "📐" "Best Practices ($FRAMEWORK_DISPLAY)"
  echo "| Status | Check |"; echo "|--------|-------|"
  ck_pass() { echo "| ✅ | $1 |"; ((checks++)); }
  ck_warn() { echo "| 🟡 | $1 |"; ((checks++)); ((issues++)); }

  case "$FRAMEWORK" in
    react*|nextjs*)
      local err=$(find "$src" -name '*.tsx' -exec grep -l "ErrorBoundary\|componentDidCatch" {} \; 2>/dev/null | wc -l)
      [[ $err -gt 0 ]] && ck_pass "Error boundaries: $err" || ck_warn "No ErrorBoundary"
      local hooks=$(find "$src" -path '*/hooks/*' -name 'use*.ts' 2>/dev/null | wc -l)
      [[ $hooks -ge 3 ]] && ck_pass "Custom hooks: $hooks" || ck_warn "Few custom hooks ($hooks)"
      grep -rq "createContext\|zustand\|@reduxjs" "$src" 2>/dev/null && ck_pass "State management" || ck_warn "No state management"
      ;;
    angular)
      local standalone=$(find "$src" -name '*.component.ts' -exec grep -l "standalone.*true" {} \; 2>/dev/null | wc -l)
      [[ $standalone -gt 0 ]] && ck_pass "Standalone components: $standalone" || ck_warn "No standalone components"
      ;;
    vue*|nuxt)
      local comp_api=$(find "$src" -name '*.vue' -exec grep -l '<script setup' {} \; 2>/dev/null | wc -l)
      [[ $comp_api -gt 0 ]] && ck_pass "Composition API: $comp_api files" || ck_warn "Use Composition API"
      grep -q '"pinia"' "$pkg" 2>/dev/null && ck_pass "Pinia installed" || ck_warn "No Pinia"
      ;;
    nestjs|express|node|fastify)
      grep -rq "zod\|joi\|yup\|class-validator" "$pkg" 2>/dev/null && ck_pass "Input validation" || ck_warn "No validation library"
      grep -rq "winston\|pino\|morgan" "$pkg" 2>/dev/null && ck_pass "Logging library" || ck_warn "No logging"
      ;;
  esac

  local tests=$(find "$dir" -type f \( -name '*.test.*' -o -name '*.spec.*' \) -not -path '*/node_modules/*' 2>/dev/null | wc -l)
  [[ $tests -ge 5 ]] && ck_pass "Tests: $tests files" || ck_warn "Only $tests test files"

  echo ""; echo "**Summary:** $checks checks, **$issues issues**"; echo ""
  [[ $checks -gt 0 ]] && register_score "Best Practices" "$(( (checks - issues) * 100 / checks ))"
}

#!/usr/bin/env bash
audit_test_coverage() {
  local dir="$1"; local issues=0 checks=0
  print_module_header "🧪" "Test Coverage"
  echo "| Status | Check |"; echo "|--------|-------|"
  ck_pass() { echo "| ✅ | $1 |"; ((checks++)); }
  ck_warn() { echo "| 🟡 | $1 |"; ((checks++)); ((issues++)); register_issue "Tests" "$1"; }

  local src=$(get_src_dir "$dir")
  local exts=$(get_source_exts); local ea=()
  for e in $exts; do ea+=(-o -name "*.${e}"); done; ea=("${ea[@]:1}")

  # Count source files vs test files
  local src_count=$(find "$src" -not -path '*/node_modules/*' -type f \( "${ea[@]}" \) \
    -not -name '*.test.*' -not -name '*.spec.*' -not -name 'index.*' -not -name '*.d.ts' 2>/dev/null | wc -l)
  local test_count=$(find "$dir" -not -path '*/node_modules/*' -type f \( -name '*.test.*' -o -name '*.spec.*' \) 2>/dev/null | wc -l)

  local ratio=0
  [[ $src_count -gt 0 ]] && ratio=$((test_count * 100 / src_count))

  echo ""; echo "**Source files:** $src_count · **Test files:** $test_count · **Ratio:** ${ratio}%"; echo ""

  [[ $test_count -ge 1 ]] && ck_pass "Tests exist ($test_count files)" || ck_warn "No test files found"
  [[ $ratio -ge 50 ]] && ck_pass "Good test ratio (${ratio}%)" || ck_warn "Low test ratio (${ratio}%) — aim for 50%+"

  # Check test runner
  local pkg="$dir/package.json"
  local has_runner=false
  for runner in vitest jest mocha cypress playwright @testing-library; do
    grep -q "\"$runner\"" "$pkg" 2>/dev/null && { ck_pass "Test runner: $runner"; has_runner=true; break; }
  done
  $has_runner || ck_warn "No test runner installed"

  # Check test script
  grep -q '"test"' "$pkg" 2>/dev/null && ck_pass "npm test script configured" || ck_warn "No test script in package.json"

  # Coverage config
  if [[ -f "$dir/vitest.config.ts" || -f "$dir/vitest.config.js" ]]; then
    grep -q "coverage" "$dir/vitest.config"* 2>/dev/null && ck_pass "Coverage configured in vitest" || ck_warn "No coverage config in vitest"
  elif [[ -f "$dir/jest.config.ts" || -f "$dir/jest.config.js" || -f "$dir/jest.config.json" ]]; then
    grep -q "coverage" "$dir/jest.config"* 2>/dev/null && ck_pass "Coverage configured in jest" || ck_warn "No coverage config in jest"
  fi

  # Check for coverage report
  [[ -d "$dir/coverage" ]] && ck_pass "Coverage report exists (./coverage/)" || ck_warn "No coverage report — run tests with coverage flag"

  # Untested critical files (pages, services, utils with no matching test)
  local untested=0
  while IFS= read -r -d '' f; do
    local name=$(basename "$f" | sed 's/\..*//')
    [[ "$name" == "index" || "$name" == "main" || "$name" == "App" ]] && continue
    if ! find "$dir" -not -path '*/node_modules/*' \( -name "${name}.test.*" -o -name "${name}.spec.*" \) 2>/dev/null | grep -q .; then
      local cat=$(get_file_category "${f#$dir/}")
      [[ "$cat" == "Page" || "$cat" == "Service" || "$cat" == "Controller" || "$cat" == "Utility" ]] && ((untested++))
    fi
  done < <(find "$src" -not -path '*/node_modules/*' -type f \( "${ea[@]}" \) \
    -not -name '*.test.*' -not -name '*.spec.*' -not -name 'index.*' -not -name '*.d.ts' -print0 2>/dev/null)

  [[ $untested -gt 0 ]] && ck_warn "$untested critical files without tests (pages/services/utils)" || ck_pass "Critical files have tests"

  echo ""; echo "**Summary:** $checks checks, **$issues issues**"; echo ""
  [[ $checks -gt 0 ]] && register_score "Tests" "$(( (checks - issues) * 100 / checks ))"
}

#!/usr/bin/env bash
audit_api_docs() {
  local dir="$1"; local issues=0 checks=0; local pkg="$dir/package.json"
  print_module_header "📝" "Documentation & API Docs"
  echo "| Status | Check |"; echo "|--------|-------|"
  ck_pass() { echo "| ✅ | $1 |"; (( checks++ )) || true; }
  ck_warn() { echo "| 🟡 | $1 |"; (( checks++ )) || true; (( issues++ )) || true; }

  # README quality
  if [[ -f "$dir/README.md" ]]; then
    local readme_lines=$(wc -l < "$dir/README.md")
    [[ $readme_lines -ge 30 ]] && ck_pass "README.md ($readme_lines lines)" || ck_warn "README.md is thin ($readme_lines lines)"

    grep -qi "install" "$dir/README.md" && ck_pass "README has install instructions" || ck_warn "README missing install section"
    grep -qi "usage\|getting started\|quick start" "$dir/README.md" && ck_pass "README has usage section" || ck_warn "README missing usage section"
    grep -qi "api\|endpoint\|route" "$dir/README.md" && ck_pass "README references API" || true
  else
    ck_warn "No README.md"
  fi

  # CHANGELOG
  [[ -f "$dir/CHANGELOG.md" || -f "$dir/HISTORY.md" ]] && ck_pass "CHANGELOG exists" || ck_warn "No CHANGELOG.md"

  # API documentation tools
  if [[ "$FRAMEWORK" == "nestjs" || "$FRAMEWORK" == "express" || "$FRAMEWORK" == "fastify" || "$FRAMEWORK" == "node" ]]; then
    grep -q "@nestjs/swagger\|swagger-jsdoc\|swagger-ui\|@fastify/swagger" "$pkg" 2>/dev/null && \
      ck_pass "Swagger/OpenAPI documentation" || ck_warn "No API documentation tool (add Swagger)"
  fi

  # JSDoc/TSDoc comments in source
  local src=$(get_src_dir "$dir")
  local total_files=0 documented_files=0
  while IFS= read -r -d '' f; do
    (( total_files++ )) || true
    grep -q '/\*\*' "$f" 2>/dev/null && { (( documented_files++ )) || true; }
  done < <(find "$src" -not -path '*/node_modules/*' -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' \) \
    -not -name '*.test.*' -not -name '*.spec.*' -not -name '*.d.ts' -not -name 'index.*' -print0 2>/dev/null)

  if [[ $total_files -gt 0 ]]; then
    local doc_pct=$((documented_files * 100 / total_files))
    [[ $doc_pct -ge 30 ]] && ck_pass "JSDoc/TSDoc: ${doc_pct}% of files" || ck_warn "Low JSDoc/TSDoc coverage: ${doc_pct}%"
  fi

  # TypeDoc / Storybook
  grep -q "typedoc\|storybook\|@storybook" "$pkg" 2>/dev/null && ck_pass "Documentation tool (TypeDoc/Storybook)" || true

  # Contributing guide
  [[ -f "$dir/CONTRIBUTING.md" ]] && ck_pass "CONTRIBUTING.md exists" || ck_warn "No CONTRIBUTING.md"

  echo ""; echo "**Summary:** $checks checks, **$issues issues**"; echo ""
  [[ $checks -gt 0 ]] && register_score "Docs" "$(( (checks - issues) * 100 / checks ))"
}

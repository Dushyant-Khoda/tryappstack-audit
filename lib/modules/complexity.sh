#!/bin/bash
audit_complexity() {
  local dir="$1"; local issues=0
  print_module_header "🧠" "Code Complexity"
  local src=$(get_src_dir "$dir")
  echo "| File | Issue | Action |"; echo "|------|-------|--------|"

  # useEffect / state explosion
  while IFS= read -r -d '' f; do
    local fp="${f#$dir/}"
    local effects=$(grep -c "useEffect\|watchEffect\|watch(" "$f" 2>/dev/null || echo 0)
    [[ $effects -gt 3 ]] && { echo "| \`$fp\` | $effects effects | Extract to custom hooks |"; (( issues++ )) || true; }
    local states=$(grep -cE "useState|ref\(|reactive\(|signal\(" "$f" 2>/dev/null || echo 0)
    [[ $states -gt 6 ]] && { echo "| \`$fp\` | $states state vars | Use reducer/store |"; (( issues++ )) || true; }
  done < <(find "$src" -type f \( -name '*.tsx' -o -name '*.ts' -o -name '*.vue' \) -not -name '*.test.*' -print0 2>/dev/null)

  # console.log
  local consoles=$(find "$src" -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' \) -not -name '*.test.*' \
    -exec grep -l 'console\.\(log\|warn\|debug\)' {} \; 2>/dev/null | wc -l)
  [[ $consoles -gt 0 ]] && { echo "| *$consoles files* | console.log leftovers | Remove before shipping |"; (( issues++ )) || true; }

  # any usage
  if $IS_TYPESCRIPT; then
    local any_total=$(find "$src" -type f \( -name '*.ts' -o -name '*.tsx' \) -not -name '*.test.*' -not -name '*.d.ts' \
      -exec grep -cE ':[[:space:]]*any[^a-zA-Z_]|<any>|as any' {} + 2>/dev/null | awk -F: '{sum+=$NF} END{print sum+0}')
    [[ $any_total -gt 0 ]] && { echo "| *codebase* | $any_total \`any\` usages | Add proper types |"; (( issues++ )) || true; }
  fi

  # .then chains
  local chains=$(find "$src" -type f \( -name '*.ts' -o -name '*.js' \) -not -name '*.test.*' \
    -exec grep -c '\.then(' {} + 2>/dev/null | awk -F: '$NF>3{sum++} END{print sum+0}')
  [[ $chains -gt 0 ]] && { echo "| *$chains files* | .then() chains | Use async/await |"; (( issues++ )) || true; }

  [[ $issues -eq 0 ]] && echo "| ✅ | No complexity issues | — |"
  echo ""; echo "**Summary:** **$issues** complexity issues"; echo ""
  local s=$((100 - issues * 8)); [[ $s -lt 0 ]] && s=0; register_score "Complexity" "$s"
}

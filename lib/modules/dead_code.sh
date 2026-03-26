#!/bin/bash
audit_dead_code() {
  local dir="$1"; local dead=0 total=0
  print_module_header "💀" "Dead Code & Unused Exports"
  local src=$(get_src_dir "$dir"); [[ ! -d "$src" ]] && src="$dir"
  local idx=$(mktemp); local exts=$(get_source_exts); local ea=()
  for e in $exts; do ea+=(-o -name "*.${e}"); done; ea=("${ea[@]:1}")
  find "$dir" -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/dist/*' \
    -type f \( "${ea[@]}" \) -exec grep -h "from ['\"]" {} \; -exec grep -h "import(" {} \; > "$idx" 2>/dev/null

  echo "| File | Type | Status |"
  echo "|------|------|--------|"
  while IFS= read -r -d '' file; do
    local fp="${file#$dir/}"; local cat=$(get_file_category "$fp")
    case "$cat" in Test|Config|Barrel|Types|Module) continue ;; esac
    (( total++ )) || true
    if ! is_file_imported "$fp" "$idx"; then
      echo "| \`$fp\` | $cat | 🔴 Unused |"; (( dead++ )) || true
      register_issue "Dead Code" "- \`$fp\` ($cat)"
    else
      $VERBOSE && echo "| \`$fp\` | $cat | ✅ Used |"
    fi
  done < <(find "$src" -not -path '*/node_modules/*' -type f \( "${ea[@]}" \) \
           -not -name 'index.*' -not -name '*.test.*' -not -name '*.spec.*' \
           -not -name 'main.*' -not -name 'App.*' -not -name '*.d.ts' -print0 2>/dev/null)
  rm -f "$idx"
  echo ""; echo "**Summary:** $total files, **$dead potentially dead**"; echo ""
  [[ $total -gt 0 ]] && register_score "Dead Code" "$(( (total - dead) * 100 / total ))"
}

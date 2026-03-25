#!/bin/bash
audit_structure() {
  local dir="$1"; local issues=0 checks=0
  print_module_header "🏗️" "File Structure & Naming"
  echo "| Status | Check |"; echo "|--------|-------|"
  ck_pass() { echo "| ✅ | $1 |"; ((checks++)); }
  ck_warn() { echo "| 🟡 | $1 |"; ((checks++)); ((issues++)); }
  ck_fail() { echo "| 🔴 | $1 |"; ((checks++)); ((issues++)); }

  [[ -d "$dir/src" ]] && ck_pass "src/ directory exists" || ck_fail "Missing src/"
  local src=$(get_src_dir "$dir"); local exts=$(get_source_exts); local ea=()
  for e in $exts; do ea+=(-o -name "*.${e}"); done; ea=("${ea[@]:1}")

  # Barrel exports
  local barrel_miss=0
  while IFS= read -r f; do
    local c=$(find "$f" -maxdepth 1 -type f \( "${ea[@]}" \) -not -name 'index.*' 2>/dev/null | wc -l)
    [[ $c -ge 3 && ! -f "$f/index.ts" && ! -f "$f/index.tsx" && ! -f "$f/index.js" ]] && \
      ck_warn "${f#$dir/} — $c files, no barrel export" && ((barrel_miss++))
  done < <(find "$src" -type d -not -path '*/node_modules/*' -not -name '.*' 2>/dev/null)
  [[ $barrel_miss -eq 0 ]] && ck_pass "All directories have barrel exports"

  # Duplicates
  local dupes=$(find "$src" -type f \( "${ea[@]}" \) -not -name 'index.*' -not -path '*/node_modules/*' \
                -exec basename {} \; 2>/dev/null | sort | uniq -d)
  [[ -n "$dupes" ]] && while IFS= read -r d; do [[ -n "$d" ]] && ck_fail "Duplicate: $d"; done <<< "$dupes" || ck_pass "No duplicate filenames"

  # Deep nesting
  local deep=0
  while IFS= read -r -d '' f; do
    local depth=$(echo "${f#$src/}" | tr '/' '\n' | wc -l)
    [[ $depth -gt 5 ]] && ck_warn "Deep nesting: ${f#$dir/}" && ((deep++))
  done < <(find "$src" -type f \( "${ea[@]}" \) -print0 2>/dev/null)
  [[ $deep -eq 0 ]] && ck_pass "No deeply nested files"

  echo ""; echo "**Summary:** $checks checks, **$issues issues**"; echo ""
  [[ $checks -gt 0 ]] && register_score "Structure" "$(( (checks - issues) * 100 / checks ))"
}

#!/bin/bash
audit_unused_packages() {
  local dir="$1"; local unused=0 total=0
  print_module_header "📦" "Unused Packages"
  [[ ! -f "$dir/package.json" ]] && { echo "No package.json found."; return; }

  local import_cache=$(mktemp)
  local exts=$(get_source_exts); local ea=()
  for e in $exts; do ea+=(-o -name "*.${e}"); done; ea=("${ea[@]:1}")
  find "$dir" -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/dist/*' \
    -type f \( "${ea[@]}" \) -exec grep -h "from ['\"]" {} \; -exec grep -h "require(['\"]" {} \; > "$import_cache" 2>/dev/null

  local implicit="^(typescript|vite|tailwindcss|postcss|autoprefixer|eslint|prettier|vitest|jsdom|@types/|@vitejs/|@eslint/|tsx|ts-node|nodemon|sass|dotenv|husky|lint-staged)"
  local deps=$(sed -n '/"dependencies"/,/}/p' "$dir/package.json" | grep -oP '"[^"]+(?=":)' | tr -d '"')

  echo "| Package | Status | Details |"
  echo "|---------|--------|---------|"

  local unused_list=()
  for pkg in $deps; do
    ((total++))
    echo "$pkg" | grep -qP "$implicit" && continue
    if grep -q "$pkg" "$import_cache" 2>/dev/null; then
      $VERBOSE && echo "| \`$pkg\` | ✅ Used | Found in imports |"
    else
      echo "| \`$pkg\` | 🔴 Unused | No imports found |"
      unused_list+=("$pkg"); ((unused++))
    fi
  done
  rm -f "$import_cache"

  echo ""
  echo "**Summary:** $total deps scanned, **$unused potentially unused**"
  [[ ${#unused_list[@]} -gt 0 ]] && echo "" && echo "\`\`\`bash" && echo "$PKG_MANAGER $([ "$PKG_MANAGER" = "npm" ] && echo "uninstall" || echo "remove") ${unused_list[*]}" && echo "\`\`\`"
  echo ""

  local s=$((total > 0 ? ((total - unused) * 100 / total) : 100))
  register_score "Unused Pkgs" "$s"
}

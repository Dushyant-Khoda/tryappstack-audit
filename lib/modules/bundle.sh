#!/bin/bash
audit_bundle() {
  local dir="$1"; local issues=0; local pkg="$dir/package.json"
  print_module_header "📦" "Bundle & Dependency Weight"

  if [[ -d "$dir/node_modules" ]]; then
    local nm=$(du -sh "$dir/node_modules" 2>/dev/null | cut -f1)
    echo "**node_modules:** $nm"
    echo ""
  fi

  echo "| Current Package | Recommendation | Savings |"
  echo "|----------------|----------------|---------|"

  suggest() { grep -q "\"$1\"" "$pkg" 2>/dev/null && echo "| \`$1\` | $2 | $3 |" && ((issues++)); }
  suggest "moment" "→ dayjs or date-fns" "~65KB"
  suggest "axios" "→ native fetch()" "~15KB"
  suggest "lodash" "→ lodash-es + cherry-pick" "~50KB"
  suggest "classnames" "→ clsx" "~2KB"
  suggest "uuid" "→ crypto.randomUUID()" "~5KB"
  suggest "request" "→ DEPRECATED, use fetch" "~50KB"
  suggest "jquery" "→ Remove (not needed)" "~85KB"
  suggest "antd" "→ shadcn/ui + Tailwind" "~800KB"
  suggest "node-fetch" "→ native fetch (Node 18+)" "~8KB"
  suggest "body-parser" "→ express.json() built-in" "~5KB"
  suggest "nodemon" "→ node --watch (Node 18+)" "~30KB"
  suggest "dotenv" "→ node --env-file (Node 20+)" "~3KB"
  suggest "chalk" "→ picocolors" "~15KB"
  suggest "webpack" "→ Vite or Turbopack" "faster"
  suggest "formik" "→ react-hook-form" "~15KB"
  suggest "sequelize" "→ Drizzle ORM" "~50KB"
  suggest "typeorm" "→ Drizzle ORM" "~60KB"

  [[ $issues -eq 0 ]] && echo "| ✅ | No swaps needed | — |"
  echo ""; echo "**$issues** improvement suggestions"; echo ""
  local s=$((100 - issues * 7)); [[ $s -lt 0 ]] && s=0; register_score "Bundle" "$s"
}

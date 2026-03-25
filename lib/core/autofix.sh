#!/usr/bin/env bash
run_autofix() {
  local d="$1" fixes=0; echo -e "\n  ${BOLD}🔧 Auto-Fix${NC}\n"
  local src; for x in "$d/src" "$d/app" "$d"; do [[ -d "$x" ]] && { src="$x"; break; }; done
  # Barrel exports
  while IFS= read -r f; do
    local c=$(find "$f" -maxdepth 1 -type f \( -name '*.tsx' -o -name '*.ts' \) -not -name 'index.*' -not -name '*.test.*' 2>/dev/null | wc -l)
    if [[ $c -ge 3 && ! -f "$f/index.ts" ]]; then
      local content=""
      for n in $(find "$f" -maxdepth 1 -type f \( -name '*.tsx' -o -name '*.ts' \) -not -name 'index.*' -not -name '*.test.*' -exec basename {} \; 2>/dev/null | sed 's/\..*//' | sort); do
        content+="export * from './${n}';"$'\n'
      done
      echo "$content" > "$f/index.ts"; echo -e "  ${GREEN}✓${NC} ${f#$d/}/index.ts"; ((fixes++))
    fi
  done < <(find "$src" -type d -not -path '*/node_modules/*' -not -name '.*' 2>/dev/null)
  [[ ! -f "$d/.editorconfig" ]] && { printf "root = true\n\n[*]\nindent_style = space\nindent_size = 2\nend_of_line = lf\ncharset = utf-8\ntrim_trailing_whitespace = true\ninsert_final_newline = true\n" > "$d/.editorconfig"; echo -e "  ${GREEN}✓${NC} .editorconfig"; ((fixes++)); }
  [[ ! -f "$d/.nvmrc" ]] && command -v node &>/dev/null && { node -v | sed 's/v//' > "$d/.nvmrc"; echo -e "  ${GREEN}✓${NC} .nvmrc"; ((fixes++)); }
  [[ -f "$d/.gitignore" ]] && for p in ".env" ".env.local" "*.pem" ".DS_Store"; do
    grep -q "^${p}$" "$d/.gitignore" 2>/dev/null || { echo "$p" >> "$d/.gitignore"; echo -e "  ${GREEN}✓${NC} +$p to .gitignore"; ((fixes++)); }
  done
  echo -e "\n  ${BOLD}$fixes fixes.${NC} Review: ${DIM}git diff${NC}\n"
}
export -f run_autofix

#!/bin/bash
audit_deps() {
  local dir="$1"; local issues=0 checks=0; local pkg="$dir/package.json"
  print_module_header "🔗" "Dependency Health"
  echo "| Status | Check |"; echo "|--------|-------|"
  ck_pass() { echo "| ✅ | $1 |"; (( checks++ )) || true; }
  ck_warn() { echo "| 🟡 | $1 |"; (( checks++ )) || true; (( issues++ )) || true; }

  # Lock file
  [[ -f "$dir/package-lock.json" || -f "$dir/yarn.lock" || -f "$dir/pnpm-lock.yaml" || -f "$dir/bun.lockb" ]] && \
    ck_pass "Lock file exists ($PKG_MANAGER)" || ck_warn "No lock file"

  # Node version
  [[ -f "$dir/.nvmrc" || -f "$dir/.node-version" ]] && ck_pass "Node version pinned" || ck_warn "No .nvmrc"

  # TypeScript
  if $IS_TYPESCRIPT && [[ -f "$dir/tsconfig.json" ]]; then
    grep -q '"strict".*true' "$dir/tsconfig.json" && ck_pass "TS strict mode" || ck_warn "TS strict mode not enabled"
  fi

  # Tooling
  { compgen -G "$dir/.eslintrc*" &>/dev/null || compgen -G "$dir/eslint.config*" &>/dev/null || grep -q '"eslint"' "$pkg" 2>/dev/null; } && ck_pass "ESLint" || ck_warn "No linter"
  { grep -q '"prettier"' "$pkg" 2>/dev/null || compgen -G "$dir/.prettierrc*" &>/dev/null; } && ck_pass "Prettier" || ck_warn "No formatter"
  { [[ -d "$dir/.husky" ]] || grep -q '"husky"' "$pkg" 2>/dev/null; } && ck_pass "Git hooks" || ck_warn "No git hooks"

  # Gitignore
  [[ -f "$dir/.gitignore" ]] && ck_pass ".gitignore exists" || ck_warn "No .gitignore"

  echo ""; echo "**Summary:** $checks checks, **$issues issues**"; echo ""
  [[ $checks -gt 0 ]] && register_score "Dep Health" "$(( (checks - issues) * 100 / checks ))"
}

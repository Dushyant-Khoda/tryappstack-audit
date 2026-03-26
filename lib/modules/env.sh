#!/bin/bash
audit_env() {
  local dir="$1"; local issues=0 checks=0; local pkg="$dir/package.json"
  print_module_header "🛠️" "Environment & Tooling"
  echo "| Status | Check |"; echo "|--------|-------|"
  ck_pass() { echo "| ✅ | $1 |"; (( checks++ )) || true; }
  ck_warn() { echo "| 🟡 | $1 |"; (( checks++ )) || true; (( issues++ )) || true; }

  command -v node &>/dev/null && ck_pass "Node.js $(node -v)" || ck_warn "Node.js not found"
  command -v git &>/dev/null && ck_pass "Git installed" || ck_warn "Git not found"
  [[ -f "$dir/README.md" ]] && ck_pass "README.md" || ck_warn "No README"
  [[ -f "$dir/LICENSE" ]] && ck_pass "LICENSE" || ck_warn "No LICENSE"
  [[ -f "$dir/.editorconfig" ]] && ck_pass ".editorconfig" || ck_warn "No .editorconfig"
  [[ -f "$dir/Dockerfile" || -f "$dir/docker-compose.yml" ]] && ck_pass "Docker config" || ck_warn "No Docker"
  [[ -d "$dir/.github/workflows" || -f "$dir/.gitlab-ci.yml" ]] && ck_pass "CI/CD pipeline" || ck_warn "No CI/CD"
  for s in dev build test lint; do
    grep -q "\"$s\"" "$pkg" 2>/dev/null && ck_pass "Script: $s" || ck_warn "Missing script: $s"
  done

  echo ""; echo "**Summary:** $checks checks, **$issues issues**"; echo ""
  [[ $checks -gt 0 ]] && register_score "Environment" "$(( (checks - issues) * 100 / checks ))"
}

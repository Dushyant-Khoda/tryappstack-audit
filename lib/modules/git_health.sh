#!/bin/bash
audit_git_health() {
  local dir="$1"; local issues=0 checks=0
  print_module_header "🔀" "Git Health"

  if [[ ! -d "$dir/.git" ]]; then
    echo "Not a git repository."; echo ""
    register_score "Git Health" 50; return
  fi

  echo "| Status | Check |"; echo "|--------|-------|"
  ck_pass() { echo "| ✅ | $1 |"; (( checks++ )) || true; }
  ck_warn() { echo "| 🟡 | $1 |"; (( checks++ )) || true; (( issues++ )) || true; }

  # Branch count
  local branches=$(cd "$dir" && git branch 2>/dev/null | wc -l)
  [[ $branches -gt 20 ]] && ck_warn "$branches local branches — cleanup stale ones" || ck_pass "$branches local branches"

  # Uncommitted changes
  local dirty=$(cd "$dir" && git status --porcelain 2>/dev/null | wc -l)
  [[ $dirty -gt 0 ]] && ck_warn "$dirty uncommitted changes" || ck_pass "Clean working tree"

  # Large files tracked
  local large=$(cd "$dir" && git ls-files 2>/dev/null | xargs -I{} find "$dir/{}" -size +5M 2>/dev/null | wc -l)
  [[ $large -gt 0 ]] && ck_warn "$large files over 5MB in git" || ck_pass "No large files in git"

  # .gitignore
  [[ -f "$dir/.gitignore" ]] && ck_pass ".gitignore exists" || ck_warn "No .gitignore"

  # Recent commit frequency
  local recent=$(cd "$dir" && git log --oneline --since="7 days ago" 2>/dev/null | wc -l)
  echo ""; echo "**Recent activity:** $recent commits in last 7 days"

  # Conventional commits check
  local last_5=$(cd "$dir" && git log --oneline -5 2>/dev/null)
  local conventional=$(echo "$last_5" | grep -cE "^[a-f0-9]+ (feat|fix|chore|docs|style|refactor|test|build|ci|perf)(\(.+\))?:" 2>/dev/null)
  [[ $conventional -ge 3 ]] && ck_pass "Conventional commits used" || ck_warn "Not using conventional commits"

  echo ""; echo "**Summary:** $checks checks, **$issues issues**"; echo ""
  [[ $checks -gt 0 ]] && register_score "Git Health" "$(( (checks - issues) * 100 / checks ))"
}

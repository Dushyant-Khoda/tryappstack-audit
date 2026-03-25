#!/usr/bin/env bash
audit_a11y() {
  local dir="$1"; local issues=0 checks=0
  print_module_header "♿" "Accessibility"

  local src=$(get_src_dir "$dir")

  # Only relevant for frontend frameworks
  case "$FRAMEWORK" in
    react*|nextjs*|vue*|nuxt|angular|svelte) ;;
    *) echo "Skipped — backend project."; echo ""; register_score "A11y" 100; return ;;
  esac

  echo "| Status | Check |"; echo "|--------|-------|"
  ck_pass() { echo "| ✅ | $1 |"; ((checks++)); }
  ck_warn() { echo "| 🟡 | $1 |"; ((checks++)); ((issues++)); register_issue "A11y" "$1"; }

  # img without alt
  local img_no_alt=$(find "$src" -not -path '*/node_modules/*' -type f \( -name '*.tsx' -o -name '*.jsx' -o -name '*.vue' \) \
    -exec grep -l '<img' {} \; 2>/dev/null | xargs grep -L 'alt=' 2>/dev/null | wc -l)
  [[ $img_no_alt -gt 0 ]] && ck_warn "$img_no_alt files: <img> without alt attribute" || ck_pass "All <img> have alt attributes"

  # onClick without keyboard handler
  local click_no_key=$(find "$src" -not -path '*/node_modules/*' -type f \( -name '*.tsx' -o -name '*.jsx' \) \
    -exec grep -l 'onClick' {} \; 2>/dev/null | xargs grep -cL 'onKeyDown\|onKeyPress\|onKeyUp\|role=.button\|<button\|<a ' 2>/dev/null | awk -F: '$NF>0' | wc -l)
  [[ $click_no_key -gt 3 ]] && ck_warn "~$click_no_key files: onClick without keyboard handler" || ck_pass "Click handlers have keyboard support"

  # form inputs without labels
  local input_no_label=$(find "$src" -not -path '*/node_modules/*' -type f \( -name '*.tsx' -o -name '*.jsx' -o -name '*.vue' \) \
    -exec grep -l '<input\|<select\|<textarea' {} \; 2>/dev/null | xargs grep -L 'label\|aria-label\|aria-labelledby\|htmlFor' 2>/dev/null | wc -l)
  [[ $input_no_label -gt 0 ]] && ck_warn "$input_no_label files: form inputs without labels" || ck_pass "Form inputs have labels"

  # ARIA attributes usage
  local aria_count=$(find "$src" -not -path '*/node_modules/*' -type f \( -name '*.tsx' -o -name '*.jsx' -o -name '*.vue' \) \
    -exec grep -l 'aria-\|role=' {} \; 2>/dev/null | wc -l)
  [[ $aria_count -gt 0 ]] && ck_pass "ARIA attributes used in $aria_count files" || ck_warn "No ARIA attributes found"

  # Semantic HTML
  local semantic=$(find "$src" -not -path '*/node_modules/*' -type f \( -name '*.tsx' -o -name '*.jsx' -o -name '*.vue' \) \
    -exec grep -l '<main\|<nav\|<header\|<footer\|<section\|<article\|<aside' {} \; 2>/dev/null | wc -l)
  [[ $semantic -gt 0 ]] && ck_pass "Semantic HTML used ($semantic files)" || ck_warn "No semantic HTML (<main>, <nav>, etc.)"

  # a11y testing library
  local pkg="$dir/package.json"
  grep -q "axe-core\|@axe-core\|jest-axe\|@testing-library\|eslint-plugin-jsx-a11y" "$pkg" 2>/dev/null && \
    ck_pass "A11y testing tool installed" || ck_warn "No a11y testing (add eslint-plugin-jsx-a11y or axe-core)"

  # Color contrast (check for hardcoded colors without CSS variables)
  local hardcoded_colors=$(find "$src" -not -path '*/node_modules/*' -type f \( -name '*.tsx' -o -name '*.jsx' \) \
    -exec grep -c 'color:\s*["\x27]#[0-9a-fA-F]' {} + 2>/dev/null | awk -F: '$NF>3{sum++} END{print sum+0}')
  [[ $hardcoded_colors -gt 3 ]] && ck_warn "Hardcoded colors in $hardcoded_colors files — use CSS variables for theming" || ck_pass "Colors use CSS variables/Tailwind"

  # Skip links
  local skip_link=$(find "$src" -not -path '*/node_modules/*' -type f \( -name '*.tsx' -o -name '*.jsx' -o -name '*.vue' \) \
    -exec grep -l 'skip.*main\|skip.*content\|skip.*nav' {} \; 2>/dev/null | wc -l)
  [[ $skip_link -gt 0 ]] && ck_pass "Skip-to-content link found" || ck_warn "No skip-to-content link"

  echo ""; echo "**Summary:** $checks checks, **$issues issues**"; echo ""
  [[ $checks -gt 0 ]] && register_score "A11y" "$(( (checks - issues) * 100 / checks ))"
}

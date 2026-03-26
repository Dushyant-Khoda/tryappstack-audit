#!/bin/bash
audit_loc() {
  local dir="$1"
  local critical=0 warning=0 good=0 clean=0 total=0

  print_module_header "📏" "Lines of Code Health"

  local thresholds=($(get_thresholds))
  local page_warn=${thresholds[0]} page_crit=${thresholds[1]}
  local comp_warn=${thresholds[2]} comp_crit=${thresholds[3]}
  local util_warn=${thresholds[4]} util_crit=${thresholds[5]}

  echo "| File | Lines | Type | Status | Action |"
  echo "|------|-------|------|--------|--------|"

  local exts=$(get_source_exts)
  local ext_args=()
  for e in $exts; do ext_args+=(-o -name "*.${e}"); done
  ext_args=("${ext_args[@]:1}")

  while IFS= read -r -d '' file; do
    local lines=$(wc -l < "$file")
    local fp="${file#$dir/}"
    local cat=$(get_file_category "$fp")
    (( total++ )) || true

    case "$cat" in Test|Config|Barrel|Types) continue ;; esac

    local status="" action="" emoji=""
    case "$cat" in
      Page)
        if [[ $lines -gt $page_crit ]]; then emoji="🔴"; status="Critical"; action="Split into components + hooks"; (( critical++ )) || true
        elif [[ $lines -gt $page_warn ]]; then emoji="🟡"; status="Reduce"; action="Extract hooks & sub-components"; (( warning++ )) || true
        elif [[ $lines -gt 200 ]]; then emoji="🟢"; status="OK"; action="Consider extracting"; (( good++ )) || true
        else emoji="✅"; status="Clean"; action="—"; (( clean++ )) || true; fi ;;
      Component|Composable|Directive)
        if [[ $lines -gt $comp_crit ]]; then emoji="🔴"; status="Critical"; action="Break into smaller pieces"; (( critical++ )) || true
        elif [[ $lines -gt $comp_warn ]]; then emoji="🟡"; status="Reduce"; action="Extract logic"; (( warning++ )) || true
        elif [[ $lines -gt 100 ]]; then emoji="🟢"; status="OK"; action="—"; (( good++ )) || true
        else emoji="✅"; status="Clean"; action="—"; (( clean++ )) || true; fi ;;
      Hook)
        if [[ $lines -gt 150 ]]; then emoji="🟡"; status="Reduce"; action="Split hook"; (( warning++ )) || true
        else emoji="✅"; status="Clean"; action="—"; (( clean++ )) || true; fi ;;
      Utility|Lib|Service)
        if [[ $lines -gt $util_crit ]]; then emoji="🔴"; status="Critical"; action="Split by domain"; (( critical++ )) || true
        elif [[ $lines -gt $util_warn ]]; then emoji="🟡"; status="Reduce"; action="Break into modules"; (( warning++ )) || true
        else emoji="🟢"; status="OK"; action="—"; (( good++ )) || true; fi ;;
      Controller|Route)
        if [[ $lines -gt 300 ]]; then emoji="🔴"; status="Critical"; action="Split routes"; (( critical++ )) || true
        elif [[ $lines -gt 150 ]]; then emoji="🟡"; status="Reduce"; action="Extract to service"; (( warning++ )) || true
        else emoji="🟢"; status="OK"; action="—"; (( good++ )) || true; fi ;;
      UI)
        if [[ $lines -gt 200 ]]; then emoji="🟡"; status="Reduce"; action="Too large for primitive"; (( warning++ )) || true
        else emoji="✅"; status="Clean"; action="—"; (( clean++ )) || true; fi ;;
      *)
        if [[ $lines -gt 300 ]]; then emoji="🔴"; status="Critical"; action="Split"; (( critical++ )) || true
        elif [[ $lines -gt 150 ]]; then emoji="🟡"; status="Reduce"; action="Consider splitting"; (( warning++ )) || true
        else emoji="🟢"; status="OK"; action="—"; (( good++ )) || true; fi ;;
    esac

    [[ "$emoji" == "🔴" || "$emoji" == "🟡" ]] && echo "| \`$fp\` | $lines | $cat | $emoji $status | $action |"
    $VERBOSE && [[ "$emoji" != "🔴" && "$emoji" != "🟡" ]] && echo "| \`$fp\` | $lines | $cat | $emoji $status | $action |"

  done < <(find "$dir" -not -path '*/node_modules/*' -not -path '*/.git/*' \
           -not -path '*/dist/*' -not -path '*/.next/*' -not -path '*/.angular/*' \
           -not -name 'package-lock.json' -not -name 'yarn.lock' \
           -type f \( "${ext_args[@]}" \) -print0 2>/dev/null | sort -z)

  echo ""
  echo "**Summary:** 🔴 $critical critical · 🟡 $warning warnings · 🟢 $good ok · ✅ $clean clean"
  echo ""

  local source=$((total))
  [[ $source -gt 0 ]] && {
    local score=$(( (clean * 100 + good * 75 + warning * 40 + critical * 10) / source ))
    [[ $score -gt 100 ]] && score=100
    register_score "LOC Health" "$score"
  }
}

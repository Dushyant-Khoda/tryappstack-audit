#!/usr/bin/env bash
# AI multi-agent: claude | openai | grok | gemini | deepseek
# Only sends: project name, framework, scores, issue category names
# NEVER sends: source code, file contents, variable names

run_ai_analysis() {
  if [[ -z "$AI_KEY" ]]; then
    cat << 'NOAI'
---

## 🤖 AI Insights

> AI analysis skipped — no API key configured.
> Run `npx tryappstack-audit ai-setup` to configure.
> Supports: Claude · GPT-4o · Grok · Gemini · DeepSeek
NOAI
    return
  fi

  command -v curl &>/dev/null || { echo -e "---\n\n## 🤖 AI\n\n> curl required for AI."; return; }
  command -v jq &>/dev/null || { echo -e "---\n\n## 🤖 AI\n\n> jq required. Install: sudo apt install jq"; return; }

  # Build prompt (scores + issues only — NO source code)
  local scores="" issues=""
  for m in "${!SCORES[@]}"; do scores+="- $m: ${SCORES[$m]}/100"$'\n'; done
  for m in "${!MOD_ISSUES[@]}"; do [[ -n "${MOD_ISSUES[$m]}" ]] && issues+="### $m"$'\n'"${MOD_ISSUES[$m]}"$'\n'; done

  local prompt="You are a principal engineer reviewing a $FRAMEWORK_DISPLAY project ($LANG_DISPLAY) called '$PROJECT'.

## Audit Scores
$scores

## Issues Found
$issues

Provide:
1. **Priority Refactoring Plan** — Top 5 actions ranked by impact. Be specific.
2. **Architecture Suggestions** — Structural improvements based on the pattern of issues.
3. **Quick Wins** — 3 things doable in under 30 minutes.
4. **Tech Debt Estimate** — Hours to fix all critical/warning issues.
5. **Score Roadmap** — Specific steps to reach 85+ overall.

Be concise, use markdown, be actionable. No generic advice."

  local result=""

  case "$AI_PROVIDER" in
    claude|anthropic)
      result=$(curl -sS --max-time 30 https://api.anthropic.com/v1/messages \
        -H "Content-Type: application/json" \
        -H "x-api-key: $AI_KEY" \
        -H "anthropic-version: 2023-06-01" \
        -d "$(jq -n --arg p "$prompt" '{model:"claude-sonnet-4-20250514",max_tokens:2000,messages:[{role:"user",content:$p}]}')" 2>/dev/null \
        | jq -r '.content[0].text // empty' 2>/dev/null) ;;

    openai|gpt)
      result=$(curl -sS --max-time 30 https://api.openai.com/v1/chat/completions \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $AI_KEY" \
        -d "$(jq -n --arg p "$prompt" '{model:"gpt-4o",messages:[{role:"user",content:$p}],max_tokens:2000,temperature:0.3}')" 2>/dev/null \
        | jq -r '.choices[0].message.content // empty' 2>/dev/null) ;;

    grok|xai)
      result=$(curl -sS --max-time 30 https://api.x.ai/v1/chat/completions \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $AI_KEY" \
        -d "$(jq -n --arg p "$prompt" '{model:"grok-3-mini",messages:[{role:"user",content:$p}],max_tokens:2000,temperature:0.3}')" 2>/dev/null \
        | jq -r '.choices[0].message.content // empty' 2>/dev/null) ;;

    gemini|google)
      result=$(curl -sS --max-time 30 "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=$AI_KEY" \
        -H "Content-Type: application/json" \
        -d "$(jq -n --arg p "$prompt" '{contents:[{parts:[{text:$p}]}],generationConfig:{maxOutputTokens:2000,temperature:0.3}}')" 2>/dev/null \
        | jq -r '.candidates[0].content.parts[0].text // empty' 2>/dev/null) ;;

    deepseek)
      result=$(curl -sS --max-time 30 https://api.deepseek.com/chat/completions \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $AI_KEY" \
        -d "$(jq -n --arg p "$prompt" '{model:"deepseek-chat",messages:[{role:"user",content:$p}],max_tokens:2000,temperature:0.3}')" 2>/dev/null \
        | jq -r '.choices[0].message.content // empty' 2>/dev/null) ;;
  esac

  if [[ -z "$result" ]]; then
    result="AI analysis unavailable. Check your API key and provider."
  fi

  cat << AIOUT
---

## 🤖 AI-Powered Insights

*Agent: $AI_PROVIDER · $(date '+%Y-%m-%d %H:%M')*
*Data sent: scores + issue categories only. Source code never leaves your machine.*

$result
AIOUT
}

export -f run_ai_analysis

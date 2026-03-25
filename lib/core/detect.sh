#!/bin/bash
# Framework auto-detection

detect_framework() {
  local dir="$1"
  local pkg="$dir/package.json"

  FRAMEWORK="unknown"
  FRAMEWORK_DISPLAY="Unknown"
  LANG_DISPLAY="JavaScript"
  PKG_MANAGER="npm"
  SRC_DIR="$dir"
  IS_TYPESCRIPT=false
  IS_MONOREPO=false

  # Package Manager
  [[ -f "$dir/pnpm-lock.yaml" ]] && PKG_MANAGER="pnpm"
  [[ -f "$dir/yarn.lock" ]] && PKG_MANAGER="yarn"
  [[ -f "$dir/bun.lockb" ]] && PKG_MANAGER="bun"

  # Monorepo
  if [[ -f "$dir/lerna.json" ]] || [[ -f "$dir/pnpm-workspace.yaml" ]] || \
     [[ -f "$dir/turbo.json" ]] || (grep -q '"workspaces"' "$pkg" 2>/dev/null); then
    IS_MONOREPO=true
  fi

  # TypeScript
  if [[ -f "$dir/tsconfig.json" ]] || (grep -q '"typescript"' "$pkg" 2>/dev/null); then
    IS_TYPESCRIPT=true
    LANG_DISPLAY="TypeScript"
  fi

  # Framework detection
  if [[ -d "$dir/app" ]] && (grep -q '"next"' "$pkg" 2>/dev/null); then
    FRAMEWORK="nextjs-app"; FRAMEWORK_DISPLAY="Next.js (App Router)"; SRC_DIR="$dir/src"
    [[ -d "$dir/src/app" ]] && SRC_DIR="$dir/src"
  elif grep -q '"next"' "$pkg" 2>/dev/null; then
    FRAMEWORK="nextjs"; FRAMEWORK_DISPLAY="Next.js"; SRC_DIR="$dir/src"
  elif grep -q '"nuxt"' "$pkg" 2>/dev/null; then
    FRAMEWORK="nuxt"; FRAMEWORK_DISPLAY="Nuxt.js"; SRC_DIR="$dir"
  elif [[ -f "$dir/angular.json" ]] || (grep -q '"@angular/core"' "$pkg" 2>/dev/null); then
    FRAMEWORK="angular"; FRAMEWORK_DISPLAY="Angular"; SRC_DIR="$dir/src"
  elif grep -q '"svelte"' "$pkg" 2>/dev/null || grep -q '"@sveltejs"' "$pkg" 2>/dev/null; then
    FRAMEWORK="svelte"; FRAMEWORK_DISPLAY="SvelteKit"; SRC_DIR="$dir/src"
  elif grep -q '"vue"' "$pkg" 2>/dev/null; then
    FRAMEWORK="vue"; FRAMEWORK_DISPLAY="Vue.js"; SRC_DIR="$dir/src"
  elif grep -q '"@nestjs/core"' "$pkg" 2>/dev/null; then
    FRAMEWORK="nestjs"; FRAMEWORK_DISPLAY="NestJS"; SRC_DIR="$dir/src"
  elif grep -q '"fastify"' "$pkg" 2>/dev/null; then
    FRAMEWORK="fastify"; FRAMEWORK_DISPLAY="Fastify"; SRC_DIR="$dir/src"
  elif grep -q '"express"' "$pkg" 2>/dev/null; then
    FRAMEWORK="express"; FRAMEWORK_DISPLAY="Express.js"; SRC_DIR="$dir/src"
    [[ ! -d "$dir/src" ]] && SRC_DIR="$dir"
  elif (grep -q '"react"' "$pkg" 2>/dev/null) && (grep -q '"vite"' "$pkg" 2>/dev/null); then
    FRAMEWORK="react-vite"; FRAMEWORK_DISPLAY="React + Vite"; SRC_DIR="$dir/src"
  elif grep -q '"react"' "$pkg" 2>/dev/null; then
    FRAMEWORK="react"; FRAMEWORK_DISPLAY="React"; SRC_DIR="$dir/src"
  elif [[ -f "$pkg" ]]; then
    FRAMEWORK="node"; FRAMEWORK_DISPLAY="Node.js"; SRC_DIR="$dir/src"
    [[ ! -d "$dir/src" ]] && SRC_DIR="$dir"
  fi
}

get_thresholds() {
  case "$FRAMEWORK" in
    react*|nextjs*) echo "300 500 200 400 150 300 150" ;;
    angular)        echo "300 500 250 500 150 300 150" ;;
    vue*|nuxt)      echo "250 400 200 350 150 300 100" ;;
    nestjs|express|fastify|node) echo "200 400 150 300 150 300 100" ;;
    *)              echo "300 500 200 400 150 300 150" ;;
  esac
}

get_source_exts() {
  case "$FRAMEWORK" in
    react*|nextjs*) echo "ts tsx js jsx" ;;
    angular)        echo "ts js html" ;;
    vue*|nuxt)      echo "vue ts js" ;;
    svelte)         echo "svelte ts js" ;;
    *)              echo "ts tsx js jsx vue" ;;
  esac
}

get_src_dir() {
  local dir="$1"
  for d in "$dir/src" "$dir/app" "$dir/lib"; do
    [[ -d "$d" ]] && { echo "$d"; return; }
  done
  echo "$dir"
}

get_file_category() {
  local filepath="$1"
  local filename=$(basename "$filepath")
  local dpath=$(dirname "$filepath")
  local ext="${filename##*.}"

  # Framework-specific
  case "$FRAMEWORK" in
    angular)
      [[ "$filename" == *.component.ts ]] && { echo "Component"; return; }
      [[ "$filename" == *.service.ts ]] && { echo "Service"; return; }
      [[ "$filename" == *.module.ts ]] && { echo "Module"; return; }
      [[ "$filename" == *.pipe.ts ]] && { echo "Pipe"; return; }
      [[ "$filename" == *.guard.ts ]] && { echo "Guard"; return; }
      ;;
    vue*|nuxt)
      [[ "$ext" == "vue" ]] && { echo "Component"; return; }
      [[ "$dpath" == *"/composables"* ]] && { echo "Composable"; return; }
      [[ "$dpath" == *"/store"* ]] && { echo "Store"; return; }
      ;;
    nestjs)
      [[ "$filename" == *.controller.ts ]] && { echo "Controller"; return; }
      [[ "$filename" == *.service.ts ]] && { echo "Service"; return; }
      [[ "$filename" == *.module.ts ]] && { echo "Module"; return; }
      [[ "$filename" == *.dto.ts ]] && { echo "DTO"; return; }
      [[ "$filename" == *.entity.ts ]] && { echo "Entity"; return; }
      ;;
    express*|node|fastify)
      [[ "$dpath" == *"/routes"* ]] && { echo "Route"; return; }
      [[ "$dpath" == *"/controllers"* ]] && { echo "Controller"; return; }
      [[ "$dpath" == *"/services"* ]] && { echo "Service"; return; }
      [[ "$dpath" == *"/models"* ]] && { echo "Model"; return; }
      [[ "$dpath" == *"/middleware"* ]] && { echo "Middleware"; return; }
      ;;
  esac

  # Generic
  [[ "$dpath" == *"/pages"* || "$dpath" == *"/views"* ]] && { echo "Page"; return; }
  [[ "$dpath" == *"/components"* ]] && { echo "Component"; return; }
  [[ "$dpath" == *"/hooks"* || "$filename" == use*.ts ]] && { echo "Hook"; return; }
  [[ "$dpath" == *"/utils"* || "$dpath" == *"/helpers"* ]] && { echo "Utility"; return; }
  [[ "$dpath" == *"/lib"* ]] && { echo "Lib"; return; }
  [[ "$dpath" == *"/ui"* ]] && { echo "UI"; return; }
  [[ "$filename" == "index."* ]] && { echo "Barrel"; return; }
  [[ "$filename" == *.test.* || "$filename" == *.spec.* ]] && { echo "Test"; return; }
  [[ "$filename" == *.config.* ]] && { echo "Config"; return; }

  echo "Source"
}

export FRAMEWORK FRAMEWORK_DISPLAY LANG_DISPLAY PKG_MANAGER SRC_DIR IS_TYPESCRIPT IS_MONOREPO
export -f detect_framework get_thresholds get_file_category get_source_exts get_src_dir

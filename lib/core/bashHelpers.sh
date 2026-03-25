#!/usr/bin/env bash
is_file_imported() {
  local n=$(basename "$1"); n="${n%.*}"
  case "$(basename "$1")" in main.*|index.*|App.*|app.module.*|*.test.*|*.spec.*|*.d.ts|vite-env.d.ts|setup*) return 0;; esac
  grep -q "$n" "$2" 2>/dev/null
}
print_module_header() { echo "## $1 $2"; echo ""; }
export -f is_file_imported print_module_header

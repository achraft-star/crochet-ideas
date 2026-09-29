#!/bin/bash
set -euo pipefail

# This target matches the existing Namecheap Node app: crochet_ideas.
# Git checkout can live separately in ~/repositories/crochet-ideas.
source_dir="$(cd "$(dirname "$0")/.." && pwd -P)"
app_dir="${HOME:?cPanel home directory is required}/crochet_ideas"

mkdir -p "$app_dir"
app_dir="$(cd "$app_dir" && pwd -P)"
expected_home="$(cd "$HOME" && pwd -P)"
if [[ "$app_dir" != "$expected_home/crochet_ideas" ]]; then
  echo 'Refusing deployment: the app directory resolves outside the expected location.' >&2
  exit 1
fi

if [[ "$source_dir" != "$app_dir" ]]; then
  mkdir -p "$app_dir/lib" "$app_dir/public/assets"
  cp "$source_dir/server.mjs" "$source_dir/app.cjs" "$source_dir/package.json" "$source_dir/reset-admin.mjs" "$app_dir/"
  cp -R "$source_dir/lib/." "$app_dir/lib/"
  cp "$source_dir/public/"*.css "$source_dir/public/"*.js "$source_dir/public/"*.html "$app_dir/public/"
  cp -R "$source_dir/public/assets/." "$app_dir/public/assets/"
fi

# Never copy .data, .env, public/uploads, .git or .openai.
# No delete or clean step: existing content, photos and cPanel files are retained.
mkdir -p "$app_dir/tmp"
touch "$app_dir/tmp/restart.txt"
echo "Code deployed to $app_dir. Database and uploaded photos were preserved."

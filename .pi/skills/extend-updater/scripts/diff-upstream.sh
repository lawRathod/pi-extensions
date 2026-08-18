#!/usr/bin/env bash
# Show upstream changes since last sync for an extension.
# Usage: diff-upstream.sh <extension-name>

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
EXTENSIONS_DIR="$REPO_ROOT/extensions"

if [[ $# -lt 1 ]]; then
    echo "Usage: diff-upstream.sh <extension-name>"
    exit 1
fi

ext_name="$1"
ext_dir="$EXTENSIONS_DIR/$ext_name"
upstream_file="$ext_dir/upstream.json"

if [[ ! -d "$ext_dir" ]]; then
    echo "Extension not found: $ext_name"
    exit 1
fi

if [[ ! -f "$upstream_file" ]]; then
    echo "No upstream.json found for $ext_name (not an upstream extension)"
    exit 1
fi

# Parse upstream info
last_commit=$(grep -o '"commit": *"[^"]*"' "$upstream_file" | head -1 | cut -d'"' -f4)
branch=$(grep -o '"branch": *"[^"]*"' "$upstream_file" | head -1 | cut -d'"' -f4)
upstream_path=$(grep -o '"upstreamPath": *"[^"]*"' "$upstream_file" | head -1 | cut -d'"' -f4 || true)

cd "$ext_dir"

# Ensure we have the latest upstream
git fetch upstream --quiet 2>/dev/null || {
    echo "ERROR: Could not fetch from upstream"
    exit 1
}

echo "=== Upstream changes for $ext_name ==="
echo "Last synced commit: $last_commit"
echo "Upstream branch: $branch"
echo ""

# Show commit log
echo "--- New commits ---"
git log --oneline "$last_commit..upstream/$branch" 2>/dev/null || echo "(none)"
echo ""

# Show file diff
echo "--- File changes ---"
if [[ -n "$upstream_path" ]]; then
    # Path mapping: show diff of upstream file between commits
    diff_output=$(git diff "$last_commit..upstream/$branch" -- "$upstream_path" 2>/dev/null || true)
else
    # Same path case
    files=$(grep -o '"files":\[.*\]' "$upstream_file" | grep -o '"[^"]*"' | tr -d '"' | tr '\n' ' ')
    diff_output=$(git diff "$last_commit..upstream/$branch" -- $files 2>/dev/null || true)
fi

if [[ -z "$diff_output" ]]; then
    echo "(no changes to tracked files)"
else
    echo "$diff_output"
fi

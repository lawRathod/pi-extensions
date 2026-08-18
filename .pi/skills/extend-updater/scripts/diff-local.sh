#!/usr/bin/env bash
# Show local modifications for an extension since last upstream sync.
# Usage: diff-local.sh <extension-name>

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
EXTENSIONS_DIR="$REPO_ROOT/extensions"

if [[ $# -lt 1 ]]; then
    echo "Usage: diff-local.sh <extension-name>"
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

# Parse upstream.json
last_commit=$(grep -o '"commit": *"[^"]*"' "$upstream_file" | head -1 | cut -d'"' -f4)
upstream_path=$(grep -o '"upstreamPath": *"[^"]*"' "$upstream_file" | head -1 | cut -d'"' -f4 || true)
local_path=$(grep -o '"localPath": *"[^"]*"' "$upstream_file" | head -1 | cut -d'"' -f4 || true)

cd "$ext_dir"

echo "=== Local modifications for $ext_name ==="
echo "Last synced commit: $last_commit"
echo ""

if [[ -n "$upstream_path" && -n "$local_path" ]]; then
    # Path mapping: compare local file against upstream version at last commit
    echo "Comparing: $local_path (local) vs $upstream_path (upstream@$last_commit)"
    echo ""
    diff_output=$(git diff "$last_commit:$upstream_path" "$ext_dir/$local_path" 2>/dev/null || true)
else
    # Same path case - get files from upstream.json
    files=$(grep -o '"files":\[.*\]' "$upstream_file" | grep -o '"[^"]*"' | tr -d '"' | tr '\n' ' ')
    diff_output=$(git diff "$last_commit" -- $files 2>/dev/null || true)
fi

if [[ -z "$diff_output" ]]; then
    echo "No local modifications found."
else
    echo "$diff_output"
fi

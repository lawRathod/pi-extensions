#!/usr/bin/env bash
# Scan all extensions for upstream updates.
# Usage: check-updates.sh [extension-name]
#   If extension-name is provided, only check that extension.
#   Otherwise, check all extensions with upstream.json.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
EXTENSIONS_DIR="$REPO_ROOT/extensions"

check_extension() {
    local ext_dir="$1"
    local ext_name="$(basename "$ext_dir")"
    local upstream_file="$ext_dir/upstream.json"

    if [[ ! -f "$upstream_file" ]]; then
        return 0
    fi

    # Parse upstream.json (minimal, no jq dependency)
    local repo branch last_commit upstream_path local_path
    repo=$(grep -o '"repo": *"[^"]*"' "$upstream_file" | head -1 | cut -d'"' -f4)
    branch=$(grep -o '"branch": *"[^"]*"' "$upstream_file" | head -1 | cut -d'"' -f4)
    last_commit=$(grep -o '"commit": *"[^"]*"' "$upstream_file" | head -1 | cut -d'"' -f4)
    upstream_path=$(grep -o '"upstreamPath": *"[^"]*"' "$upstream_file" | head -1 | cut -d'"' -f4 || true)
    local_path=$(grep -o '"localPath": *"[^"]*"' "$upstream_file" | head -1 | cut -d'"' -f4 || true)

    if [[ -z "$repo" || -z "$branch" || -z "$last_commit" ]]; then
        echo "$ext_name: ERROR - invalid upstream.json"
        return 1
    fi

    echo "$ext_name:"
    echo "  Upstream: $repo"
    echo "  Last synced: $last_commit"

    # Ensure remote exists
    cd "$ext_dir"
    git remote add upstream "$repo" 2>/dev/null || true
    git fetch upstream --quiet 2>/dev/null || {
        echo "  ERROR - could not fetch from upstream"
        return 1
    }

    # Check for new commits
    local new_commits
    new_commits=$(git log --oneline "$last_commit..upstream/$branch" 2>/dev/null || true)

    if [[ -z "$new_commits" ]]; then
        echo "  Status: UP TO DATE"
    else
        local count=$(echo "$new_commits" | wc -l)
        echo "  Status: $count new commit(s) available"
        echo "  Commits:"
        echo "$new_commits" | sed 's/^/    /'
    fi

    # Check for local modifications (compare working tree against last synced upstream)
    local local_diff
    if [[ -n "$upstream_path" && -n "$local_path" ]]; then
        # Path mapping case: compare local file against upstream version at last commit
        local_diff=$(git diff "$last_commit:$upstream_path" "$ext_dir/$local_path" 2>/dev/null || true)
    else
        # Same path case
        local files=$(grep -o '"files":\[.*\]' "$upstream_file" | grep -o '"[^"]*"' | tr -d '"' | tr '\n' ' ')
        local_diff=$(git diff "$last_commit" -- $files 2>/dev/null || true)
    fi

    if [[ -z "$local_diff" ]]; then
        echo "  Local modifications: NO"
    else
        echo "  Local modifications: YES"
    fi

    echo ""
}

# Main
if [[ $# -gt 0 ]]; then
    # Check specific extension
    ext_dir="$EXTENSIONS_DIR/$1"
    if [[ ! -d "$ext_dir" ]]; then
        echo "Extension not found: $1"
        exit 1
    fi
    check_extension "$ext_dir"
else
    # Check all extensions
    echo "Scanning extensions..."
    echo ""

    found=0
    for ext_dir in "$EXTENSIONS_DIR"/*/; do
        if [[ -f "$ext_dir/upstream.json" ]]; then
            check_extension "$ext_dir"
            found=$((found + 1))
        fi
    done

    if [[ $found -eq 0 ]]; then
        echo "No extensions with upstream sources found."
    fi
fi

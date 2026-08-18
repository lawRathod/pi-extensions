#!/usr/bin/env bash
# Apply upstream updates to an extension, preserving local modifications.
# Usage: apply-update.sh <extension-name> [--force]
#   --force: skip confirmation prompts

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
EXTENSIONS_DIR="$REPO_ROOT/extensions"
FORCE=0

if [[ $# -lt 1 ]]; then
    echo "Usage: apply-update.sh <extension-name> [--force]"
    exit 1
fi

ext_name="$1"
[[ "${2:-}" == "--force" ]] && FORCE=1

ext_dir="$EXTENSIONS_DIR/$ext_name"
upstream_file="$ext_dir/upstream.json"

if [[ ! -d "$ext_dir" ]]; then
    echo "Extension not found: $ext_name"
    exit 1
fi

if [[ ! -f "$upstream_file" ]]; then
    echo "No upstream.json found for $ext_name"
    exit 1
fi

# Parse upstream info
repo=$(grep -o '"repo": *"[^"]*"' "$upstream_file" | head -1 | cut -d'"' -f4)
branch=$(grep -o '"branch": *"[^"]*"' "$upstream_file" | head -1 | cut -d'"' -f4)
last_commit=$(grep -o '"commit": *"[^"]*"' "$upstream_file" | head -1 | cut -d'"' -f4)
upstream_path=$(grep -o '"upstreamPath": *"[^"]*"' "$upstream_file" | head -1 | cut -d'"' -f4 || true)
local_path=$(grep -o '"localPath": *"[^"]*"' "$upstream_file" | head -1 | cut -d'"' -f4 || true)

# Determine which file to work with
if [[ -n "$upstream_path" && -n "$local_path" ]]; then
    source_file="$upstream_path"
    target_file="$ext_dir/$local_path"
else
    files_line=$(grep -o '"files":\[.*\]' "$upstream_file" | head -1)
    source_file=$(echo "$files_line" | grep -o '"[^"]*\.ts"' | head -1 | tr -d '"')
    target_file="$ext_dir/$source_file"
fi

cd "$ext_dir"

# Ensure remote exists and fetch
git remote add upstream "$repo" 2>/dev/null || true
git fetch upstream --quiet 2>/dev/null || {
    echo "ERROR: Could not fetch from upstream"
    exit 1
}

# Get new upstream commit
new_commit=$(git rev-parse "upstream/$branch")

if [[ "$last_commit" == "$new_commit" ]]; then
    echo "Already up to date ($last_commit). Nothing to do."
    exit 0
fi

# Check for local modifications
echo "=== Updating $ext_name ==="
echo "From: $last_commit"
echo "To:   $new_commit"
echo ""

# Get upstream version at old commit for comparison
old_upstream=$(git show "$last_commit:$source_file" 2>/dev/null || echo "")
new_upstream=$(git show "upstream/$branch:$source_file" 2>/dev/null || echo "")
current_local=$(cat "$target_file" 2>/dev/null || echo "")

# Check if we have local modifications
has_local_changes=0
if [[ -n "$old_upstream" ]]; then
    diff_output=$(diff <(echo "$old_upstream") <(echo "$current_local") 2>/dev/null || true)
    if [[ -n "$diff_output" ]]; then
        has_local_changes=1
    fi
fi

if [[ $has_local_changes -eq 0 ]]; then
    echo "No local modifications detected. Fast-forwarding..."
    git show "upstream/$branch:$source_file" > "$target_file"
    echo "Done! File updated."
else
    echo "Local modifications detected. Attempting merge..."
    echo ""

    # Create a temporary directory for the merge
    tmp_dir=$(mktemp -d)
    trap "rm -rf $tmp_dir" EXIT

    # Save the three versions
    echo "$old_upstream" > "$tmp_dir/old_upstream.ts"
    echo "$new_upstream" > "$tmp_dir/new_upstream.ts"
    echo "$current_local" > "$tmp_dir/current_local.ts"

    # Try to merge using diff3-style approach
    # First, get the diff between old and new upstream
    upstream_diff=$(diff "$tmp_dir/old_upstream.ts" "$tmp_dir/new_upstream.ts" || true)

    # Get the diff between old upstream and our local
    local_diff=$(diff "$tmp_dir/old_upstream.ts" "$tmp_dir/current_local.ts" || true)

    if [[ -z "$local_diff" ]]; then
        # No local changes, just use new upstream
        echo "$new_upstream" > "$target_file"
        echo "Applied upstream changes (no local modifications to preserve)."
    elif [[ -z "$upstream_diff" ]]; then
        # No upstream changes, keep local
        echo "No upstream changes. Keeping local version."
    else
        # Both have changes - try to apply upstream on top of local
        echo "Attempting to merge upstream changes with local modifications..."
        echo ""

        # Try git merge-file approach (diff3)
        cp "$tmp_dir/current_local.ts" "$tmp_dir/merge_result.ts"

        # Create a patch from old_upstream to new_upstream
        diff -u "$tmp_dir/old_upstream.ts" "$tmp_dir/new_upstream.ts" > "$tmp_dir/upstream.patch" || true

        # Try to apply the patch to our local version
        if patch -p0 --no-backup-if-mismatch "$tmp_dir/merge_result.ts" "$tmp_dir/upstream.patch" 2>/dev/null; then
            cp "$tmp_dir/merge_result.ts" "$target_file"
            echo "Successfully merged upstream changes with local modifications."
        else
            echo "WARNING: Merge conflict detected!"
            echo ""
            echo "Upstream changed these sections:"
            echo "$upstream_diff" | head -30
            echo ""
            echo "Our local modifications:"
            echo "$local_diff" | head -30
            echo ""
            echo "Options:"
            echo "  1. Accept upstream (lose local changes)"
            echo "  2. Keep local (skip this update)"
            echo "  3. Manual merge (edit the file yourself)"
            echo ""
            read -p "Choice [1/2/3]: " choice
            case "$choice" in
                1)
                    echo "$new_upstream" > "$target_file"
                    echo "Accepted upstream version."
                    ;;
                2)
                    echo "Keeping local version. No changes made."
                    exit 0
                    ;;
                3)
                    echo "Please manually edit: $target_file"
                    echo "Then run: git add $ext_dir/"
                    exit 1
                    ;;
                *)
                    echo "Invalid choice. Aborting."
                    exit 1
                    ;;
            esac
        fi
    fi
fi

# Update upstream.json with new commit
sed -i "s/\"commit\": *\"[^\"]*\"/\"commit\": \"$new_commit\"/" "$upstream_file"

echo ""
echo "Updated upstream.json: $last_commit -> $new_commit"
echo ""
echo "Next steps:"
echo "  git add $ext_dir/"
echo "  git commit -m \"chore(extensions): update $ext_name to $new_commit\""

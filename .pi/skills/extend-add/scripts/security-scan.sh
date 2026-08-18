#!/usr/bin/env bash
# Run security scan on a cloned extension repo.
# Usage: security-scan.sh <path-to-repo>

set -euo pipefail

if [[ $# -lt 1 ]]; then
    echo "Usage: security-scan.sh <path-to-repo>"
    exit 1
fi

REPO_DIR="$1"

if [[ ! -d "$REPO_DIR" ]]; then
    echo "ERROR: Directory not found: $REPO_DIR"
    exit 1
fi

cd "$REPO_DIR"

echo "=== Security Scan: $(basename "$REPO_DIR") ==="
echo ""

# Dangerous patterns
echo "--- Dangerous patterns ---"
DANGEROUS=$(grep -rn "eval\|new Function\|vm\.runIn\|child_process\|spawn\|exec(" src/ index.ts 2>/dev/null || true)
if [[ -n "$DANGEROUS" ]]; then
    echo "⚠️  FOUND:"
    echo "$DANGEROUS"
else
    echo "✅ None found"
fi
echo ""

# Network calls
echo "--- Network calls ---"
NETWORK=$(grep -rn "fetch\|http\|https\|WebSocket\|DNS" src/ index.ts 2>/dev/null || true)
if [[ -n "$NETWORK" ]]; then
    echo "ℹ️  Found (check if justified):"
    echo "$NETWORK" | head -20
    if [[ $(echo "$NETWORK" | wc -l) -gt 20 ]]; then
        echo "  ... and $(($(echo "$NETWORK" | wc -l) - 20)) more"
    fi
else
    echo "✅ None found"
fi
echo ""

# File system access
echo "--- File system access ---"
FS_ACCESS=$(grep -rn "readFile\|writeFile\|mkdir\|rm\|cp\|mv" src/ index.ts 2>/dev/null || true)
if [[ -n "$FS_ACCESS" ]]; then
    echo "ℹ️  Found (check scope):"
    echo "$FS_ACCESS" | head -20
    if [[ $(echo "$FS_ACCESS" | wc -l) -gt 20 ]]; then
        echo "  ... and $(($(echo "$FS_ACCESS" | wc -l) - 20)) more"
    fi
else
    echo "✅ None found"
fi
echo ""

# Obfuscation
echo "--- Obfuscation ---"
OBFUSC=$(grep -rn "Buffer\.from\|atob\|btoa\|base64" src/ index.ts 2>/dev/null || true)
if [[ -n "$OBFUSC" ]]; then
    echo "⚠️  FOUND:"
    echo "$OBFUSC"
else
    echo "✅ None found"
fi
echo ""

# Dynamic imports
echo "--- Dynamic imports ---"
DYN_IMPORT=$(grep -rn "require(\|import(" src/ index.ts 2>/dev/null || true)
if [[ -n "$DYN_IMPORT" ]]; then
    echo "ℹ️  Found (check if justified):"
    echo "$DYN_IMPORT" | head -20
    if [[ $(echo "$DYN_IMPORT" | wc -l) -gt 20 ]]; then
        echo "  ... and $(($(echo "$DYN_IMPORT" | wc -l) - 20)) more"
    fi
else
    echo "✅ None found"
fi
echo ""

# postinstall scripts
echo "--- postinstall scripts ---"
if [[ -f "package.json" ]]; then
    POSTINSTALL=$(grep -A2 "postinstall" package.json 2>/dev/null || true)
    if [[ -n "$POSTINSTALL" ]]; then
        echo "⚠️  FOUND:"
        echo "$POSTINSTALL"
    else
        echo "✅ None found"
    fi
else
    echo "ℹ️  No package.json"
fi
echo ""

echo "=== Scan complete ==="
echo "Review items marked ⚠️  and ℹ️  before proceeding."

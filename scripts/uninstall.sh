#!/usr/bin/env bash

set -euo pipefail

TARGET_DIR="${FSH_TARGET_DIR:-$HOME/.local/bin}"
GHOSTTY_CONFIG="${FSH_GHOSTTY_CONFIG:-$HOME/.config/ghostty/config}"

if [ -L "$TARGET_DIR/fsh" ]; then
  rm "$TARGET_DIR/fsh"
  echo "Removed $TARGET_DIR/fsh"
fi

if [ -f "$GHOSTTY_CONFIG" ]; then
  tmp=$(mktemp)
  awk '!/^command[[:space:]]*=.*fsh/' "$GHOSTTY_CONFIG" > "$tmp"
  mv "$tmp" "$GHOSTTY_CONFIG"
  echo "Removed fsh command overrides from $GHOSTTY_CONFIG"
fi

echo "Uninstall done."
echo "If you added aliases, remove lines manually from ~/.zshrc (look for: alias fsh, alias fshr)."

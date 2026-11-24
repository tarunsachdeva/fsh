#!/usr/bin/env bash

set -euo pipefail

TARGET_DIR="${FSH_TARGET_DIR:-$HOME/.local/bin}"
INSTALL_ALIAS="${FSH_INSTALL_ALIAS:-0}"
INSTALL_GHOSTTY="${FSH_INSTALL_GHOSTTY:-0}"
GHOSTTY_CONFIG="${FSH_GHOSTTY_CONFIG:-$HOME/.config/ghostty/config}"
FSH_SKIP_PERMISSIONS_DEFAULT="${FSH_SKIP_PERMISSIONS_DEFAULT:-0}"

mkdir -p "$TARGET_DIR"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# Keep the executable in the project so Node resolves libfx from this repo.
ln -sfn "$SCRIPT_DIR/../bin/fsh.mjs" "$TARGET_DIR/fsh"

# Optional alias setup for zsh users
if [ "$INSTALL_ALIAS" = "1" ]; then
  if [ -f "$HOME/.zshrc" ]; then
    if ! grep -q "alias fsh=" "$HOME/.zshrc"; then
      {
        echo
        echo "# fsh alias"
        echo "alias fsh='env FSH_SKIP_PERMISSIONS=$FSH_SKIP_PERMISSIONS_DEFAULT $TARGET_DIR/fsh'"
        echo "alias fshr='env FSH_SKIP_PERMISSIONS=$FSH_SKIP_PERMISSIONS_DEFAULT FSH_AUTO_RAW=1 $TARGET_DIR/fsh'"
      } >> "$HOME/.zshrc"
      echo "Added aliases to $HOME/.zshrc"
    else
      echo "Skipping alias insertion; existing alias fsh found in $HOME/.zshrc"
    fi
  else
    echo "No ~/.zshrc found; alias not installed"
  fi
fi

# Optional Ghostty command override
if [ "$INSTALL_GHOSTTY" = "1" ]; then
  if [ -f "$GHOSTTY_CONFIG" ]; then
    BACKUP="$GHOSTTY_CONFIG.bak.fsh.$(date +%Y%m%d-%H%M%S)"
    cp "$GHOSTTY_CONFIG" "$BACKUP"
    tmp=$(mktemp)
    command_line="command = env FSH_SKIP_PERMISSIONS=$FSH_SKIP_PERMISSIONS_DEFAULT $TARGET_DIR/fsh"

    replaced="0"
    while IFS= read -r line; do
      if printf '%s' "$line" | grep -q '^command[[:space:]]*='; then
        echo "$command_line"
        replaced="1"
      else
        echo "$line"
      fi
    done < "$GHOSTTY_CONFIG" > "$tmp"

    if [ "$replaced" = "0" ]; then
      echo "$command_line" >> "$tmp"
    fi

    mv "$tmp" "$GHOSTTY_CONFIG"
    echo "Updated Ghostty config. Backup: $BACKUP"
  else
    mkdir -p "$(dirname "$GHOSTTY_CONFIG")"
    echo "command = env FSH_SKIP_PERMISSIONS=$FSH_SKIP_PERMISSIONS_DEFAULT $TARGET_DIR/fsh" > "$GHOSTTY_CONFIG"
    echo "Created Ghostty config: $GHOSTTY_CONFIG"
  fi
fi

echo "Installed fsh to: $TARGET_DIR"
echo "Run: fsh (or source ~/.zshrc)"

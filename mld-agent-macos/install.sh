#!/usr/bin/env bash
# MLD macOS Agent One-Click Installer & Launcher
set -e

TOKEN="$1"
SERVER="${2:-https://mld-server.onrender.com}"

echo "=================================================="
echo "    MLD Agent - macOS Installation & Setup        "
echo "=================================================="

CONFIG_FILE="$HOME/.mld_agent.properties"
mkdir -p "$HOME/Applications"

# If token provided via argument, save it
if [ -n "$TOKEN" ]; then
    echo "serverUrl=$SERVER" > "$CONFIG_FILE"
    echo "uuid=$TOKEN" >> "$CONFIG_FILE"
    echo "cpatEnabled=false" >> "$CONFIG_FILE"
    echo "Config saved with token: $TOKEN"
fi

# Build or run
if [ ! -d "MLD Agent.app" ]; then
    chmod +x build.sh
    ./build.sh
fi

cp -r "MLD Agent.app" "$HOME/Applications/"
echo "MLD Agent installed to $HOME/Applications/MLD Agent.app"

# Open the agent
open "$HOME/Applications/MLD Agent.app"
echo "MLD Agent is now running in your macOS Top Menu Bar!"


#!/usr/bin/env bash
# MLD Linux Agent Automated Setup Script
set -e

TOKEN="$1"
SERVER="${2:-https://mld-server.onrender.com}"

echo "=================================================="
echo "    MLD Desktop Agent - Linux Installation        "
echo "=================================================="

# Ensure ~/.local/bin and applications directory exist
mkdir -p "$HOME/.local/bin"
mkdir -p "$HOME/.local/share/applications"
mkdir -p "$HOME/.config/systemd/user"

# Copy python executable
cp mld_agent_linux.py "$HOME/.local/bin/"
chmod +x "$HOME/.local/bin/mld_agent_linux.py"

# Configure .properties
CONFIG_FILE="$HOME/.mld_agent.properties"
if [ -n "$TOKEN" ]; then
    echo "serverUrl=$SERVER" > "$CONFIG_FILE"
    echo "uuid=$TOKEN" >> "$CONFIG_FILE"
    echo "cpatEnabled=false" >> "$CONFIG_FILE"
    echo "Saved pairing token: $TOKEN"
fi

# Install desktop protocol handler
cat <<EOF > "$HOME/.local/share/applications/mld-agent.desktop"
[Desktop Entry]
Name=MLD Desktop Agent
Comment=Meeting Leech Detector Background Telemetry Agent
Exec=$HOME/.local/bin/mld_agent_linux.py %u
Terminal=false
Type=Application
MimeType=x-scheme-handler/mld-agent;
Icon=utilities-system-monitor
StartupNotify=false
EOF

# Register protocol scheme with xdg
if command -v xdg-mime &> /dev/null; then
    xdg-mime default mld-agent.desktop x-scheme-handler/mld-agent
    update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true
fi

# Optional: Suggest xdotool and xprintidle for enhanced X11 focus & idle tracking
if ! command -v xdotool &> /dev/null || ! command -v xprintidle &> /dev/null; then
    echo ""
    echo "Note: For optimal active window & idle tracking on X11, install 'xdotool' and 'xprintidle':"
    echo "  Ubuntu/Debian: sudo apt install xdotool xprintidle"
    echo "  Fedora:        sudo dnf install xdotool xprintidle"
    echo "  Arch Linux:    sudo pacman -S xdotool xprintidle"
    echo ""
fi

# Launch agent in background
nohup python3 "$HOME/.local/bin/mld_agent_linux.py" > /dev/null 2>&1 &
echo "MLD Linux Agent installed and running in background!"
echo "To manage as a service, run: systemctl --user enable --now mld-agent.service"


#!/usr/bin/env bash
set -e

echo "=================================================="
echo "    Building MLD Agent for macOS (Universal)      "
echo "=================================================="

# Check for swiftc compiler
if ! command -v swiftc &> /dev/null; then
    echo "Error: Xcode Command Line Tools are required. Run: xcode-select --install"
    exit 1
fi

echo "Compiling MLDAgent.swift with Apple Cocoa, AVFoundation, and Vision..."
swiftc -O MLDAgent.swift \
    -o "MLD-Agent-Mac" \
    -framework Cocoa \
    -framework AVFoundation \
    -framework Vision

# Package into .app bundle structure
mkdir -p "MLD Agent.app/Contents/MacOS"
mkdir -p "MLD Agent.app/Contents/Resources"
mv "MLD-Agent-Mac" "MLD Agent.app/Contents/MacOS/MLD Agent"
cp "Info.plist" "MLD Agent.app/Contents/"
chmod +x "MLD Agent.app/Contents/MacOS/MLD Agent"

echo "Build complete: 'MLD Agent.app' successfully generated!"


#!/bin/bash

# Simple script to install the security hook globally

echo "Installing Vibe Code Security Hook globally..."
./install-hook.sh --global

echo ""
echo "To apply the hook to existing repositories, run this in each repo:"
echo "  git init"
echo ""
echo "All new repositories will automatically have the hook installed." 
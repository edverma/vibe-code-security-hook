#!/bin/bash

# Script to install the security pre-commit hook

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Function to show usage
usage() {
  echo "Usage: $0 [options] [target_repo_path]"
  echo ""
  echo "Options:"
  echo "  -g, --global    Install as a global git hook template"
  echo "  -h, --help      Show this help message"
  echo ""
  echo "If target_repo_path is not provided, installs to the current directory."
  exit 1
}

# Process options
GLOBAL_INSTALL=false
TARGET_REPO=""

while [[ "$#" -gt 0 ]]; do
  case $1 in
    -g|--global) GLOBAL_INSTALL=true; shift ;;
    -h|--help) usage ;;
    *) 
      if [ -z "$TARGET_REPO" ]; then
        TARGET_REPO="$1"
      else
        echo "Error: Too many arguments"
        usage
      fi
      shift ;;
  esac
done

# If no target repo specified, use current directory
if [ -z "$TARGET_REPO" ]; then
  TARGET_REPO="$(pwd)"
fi

# Make sure our security checker is executable
chmod +x "$SCRIPT_DIR/check-security.sh"

# Handle global installation
if [ "$GLOBAL_INSTALL" = true ]; then
  # Set up the global Git template directory
  GIT_TEMPLATE_DIR=$(git config --global init.templateDir)
  
  if [ -z "$GIT_TEMPLATE_DIR" ]; then
    GIT_TEMPLATE_DIR="$HOME/.git-templates"
    git config --global init.templateDir "$GIT_TEMPLATE_DIR"
  fi
  
  # Create hooks directory if it doesn't exist
  mkdir -p "$GIT_TEMPLATE_DIR/hooks"
  
  # Copy our script to the global hooks directory
  cp "$SCRIPT_DIR/check-security.sh" "$GIT_TEMPLATE_DIR/hooks/pre-commit"
  
  echo "Security pre-commit hook installed globally at $GIT_TEMPLATE_DIR/hooks/pre-commit"
  echo "The hook will be automatically installed for new repositories created with 'git init'"
  echo "For existing repositories, run 'git init' in each repo to install the hook"
  exit 0
fi

# Else, install to the target repository
if [ ! -d "$TARGET_REPO/.git" ]; then
  echo "Error: $TARGET_REPO does not appear to be a Git repository"
  exit 1
fi

# Create the Git hooks directory if it doesn't exist
mkdir -p "$TARGET_REPO/.git/hooks"

# Copy our script to the pre-commit hook location
cp "$SCRIPT_DIR/check-security.sh" "$TARGET_REPO/.git/hooks/pre-commit"

echo "Security pre-commit hook installed successfully in $TARGET_REPO!"
echo "The hook will run automatically on every commit to check for security issues." 
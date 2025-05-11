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

# Function to create/update pre-commit hook
create_pre_commit_hook() {
  local hooks_dir="$1"
  local security_hook_path="$2"
  local pre_commit_path="$hooks_dir/pre-commit"
  
  # If pre-commit doesn't exist, create it
  if [ ! -f "$pre_commit_path" ]; then
    cat > "$pre_commit_path" << EOF
#!/bin/bash

# Run the Vibe Code Security Hook
if [ -f "$security_hook_path" ]; then
  "$security_hook_path"
  RESULT=\$?
  if [ \$RESULT -ne 0 ]; then
    exit \$RESULT
  fi
fi

# Continue with any other hooks or exit successfully
exit 0
EOF
    chmod +x "$pre_commit_path"
  else
    # If pre-commit exists, check if our hook is already included
    if ! grep -q "vibe-code-security-hook" "$pre_commit_path"; then
      # Make a backup of the existing hook
      cp "$pre_commit_path" "$pre_commit_path.bak"
      
      # Insert our hook at the top of the file (after the shebang line)
      sed -i.tmp '2i\
# Run the Vibe Code Security Hook\
if [ -f "'"$security_hook_path"'" ]; then\
  "'"$security_hook_path"'"\
  RESULT=$?\
  if [ $RESULT -ne 0 ]; then\
    exit $RESULT\
  fi\
fi\
' "$pre_commit_path"
      rm -f "$pre_commit_path.tmp"
      echo "Updated existing pre-commit hook (backup saved as $pre_commit_path.bak)"
    fi
  fi
}

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
  
  # Copy our script to the hooks directory with a distinct name
  cp "$SCRIPT_DIR/check-security.sh" "$GIT_TEMPLATE_DIR/hooks/vibe-code-security-hook"
  chmod +x "$GIT_TEMPLATE_DIR/hooks/vibe-code-security-hook"
  
  # Create or update the pre-commit hook
  create_pre_commit_hook "$GIT_TEMPLATE_DIR/hooks" "$GIT_TEMPLATE_DIR/hooks/vibe-code-security-hook"
  
  echo "Security pre-commit hook installed globally at $GIT_TEMPLATE_DIR/hooks/"
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

# Copy our script to the hooks directory with a distinct name
cp "$SCRIPT_DIR/check-security.sh" "$TARGET_REPO/.git/hooks/vibe-code-security-hook"
chmod +x "$TARGET_REPO/.git/hooks/vibe-code-security-hook"

# Create or update the pre-commit hook
create_pre_commit_hook "$TARGET_REPO/.git/hooks" "$TARGET_REPO/.git/hooks/vibe-code-security-hook"

echo "Security pre-commit hook installed successfully in $TARGET_REPO!"
echo "The hook will run automatically on every commit to check for security issues." 
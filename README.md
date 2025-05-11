# Vibe Code Security Hook

A Git pre-commit hook that prevents accidentally committing sensitive data like API keys or credentials using Ollama LLM.

## Features

- **Intelligent Detection**: Uses Ollama's LLM to find sensitive data that regex might miss
- **Prevents Security Leaks**: Blocks commits containing credentials or API keys
- **Easy Integration**: Simple installation as a dev dependency
- **Helpful Suggestions**: Provides guidance when issues are found
- **Fallback Mechanism**: Uses regex patterns if Ollama is unavailable

## Prerequisites

- Node.js 16+
- Ollama running locally (install from https://ollama.com)
- Run `ollama pull llama3.1:8b` to download the model

## Installation

```bash
# 1. Install the package
npm install vibe-code-security-hook --save-dev

# 2. IMPORTANT: Run the installer script in your project root
#    (where your .git directory is located)
npx vibe-security-hook-install
```

The hook will now run automatically when you commit changes.

### Alternative Manual Installation

If the installer script doesn't work, you can set up manually with these commands:

```bash
# Navigate to your project root (where .git directory is located)
cd /path/to/your/project

# Install the package and husky
npm install vibe-code-security-hook husky --save-dev

# Set up husky
npm pkg set scripts.prepare="husky"

# Initialize husky and create the hook directory
npx husky

# Add our command to the pre-commit hook
echo "npx vibe-security-hook run" >> .husky/pre-commit

# Make the hook executable
chmod +x .husky/pre-commit
```

### Troubleshooting

If you're having issues with the hook, try these steps:

1. Make sure you're installing from your project root (where .git is located)
2. Check if the pre-commit hook exists and is executable:
   ```bash
   ls -la .husky/pre-commit
   ```
3. Try running the security check manually:
   ```bash
   npx vibe-security-hook run
   ```

## Customization

Create a `.security-exclude` file in your project root directory (same level as your package.json) to exclude certain files or patterns:

```
# Example exclusions
*.md
docs/*
test/*
```

The hook automatically detects this file and uses it to skip specified files during security scans.

## How It Works

When you attempt to commit code, the hook scans staged changes for:
- AWS keys
- Private keys
- Hardcoded credentials
- Other sensitive data

If found, it blocks the commit and provides suggestions to fix the issues.
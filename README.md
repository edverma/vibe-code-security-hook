# Vibe Code Security Hook

A Git pre-commit hook that prevents accidentally committing sensitive data like API keys or credentials using Ollama LLM.

## Features

- **Intelligent Detection**: Uses Ollama's LLM to find sensitive data that regex might miss
- **Prevents Security Leaks**: Blocks commits containing credentials or API keys
- **Easy Integration**: Simple installation as a dev dependency
- **Helpful Suggestions**: Provides guidance when issues are found
- **Fallback Mechanism**: Uses regex patterns if Ollama is unavailable

## Installation

```bash
# Install the package
npm install vibe-code-security-hook --save-dev

# Run the installer script (RECOMMENDED)
npx vibe-security-hook-install
```

The hook will now run automatically when you commit changes.

### Alternative Installation

If you prefer, you can also set up manually with these commands:

```bash
# Install the package
npm install vibe-code-security-hook --save-dev

# Set up husky and the pre-commit hook
npm pkg set scripts.prepare="husky"
npx husky init
npx husky add .husky/pre-commit "npx vibe-security-hook run"
```

### Troubleshooting

If you're having issues with the hook, you can try:

```bash
# Install the hook directly
npx vibe-security-hook install
```

Or check if the pre-commit hook is properly set up:

```bash
# Check if the pre-commit hook exists and is executable
ls -la .husky/pre-commit
```

Still having issues? Try running the security check manually:

```bash
npx vibe-security-hook run
```

## Prerequisites

- Node.js 16+
- Ollama running locally (install from https://ollama.com)
- Run `ollama pull llama3.1:8b` to download the model

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
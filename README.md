# Vibe Code Security Hook

A Git pre-commit hook that prevents accidentally committing sensitive data like API keys or credentials using Ollama LLM.

## Features

- **Intelligent Detection**: Uses Ollama's LLM to find sensitive data that regex might miss
- **Prevents Security Leaks**: Blocks commits containing credentials or API keys
- **Helpful Suggestions**: Provides guidance when issues are found
- **Fallback Mechanism**: Uses regex patterns if Ollama is unavailable

## Prerequisites

- Node.js 16+
- Ollama running locally (install from https://ollama.com)
- Run `ollama pull llama3.1:8b` to download the model

## Installation

### Simple Installation

The simplest way to install the hook is to add it directly to your git hooks:

```bash
# 1. Install the package
npm install vibe-code-security-hook --save-dev

# 2. Create or edit your pre-commit hook
echo '#!/bin/sh
npx vibe-security-hook run' > .git/hooks/pre-commit

# 3. Make the hook executable
chmod +x .git/hooks/pre-commit
```

### Automatic Installation

You can also use our installer:

```bash
npx vibe-security-hook install
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

## Troubleshooting

If the hook isn't working:

1. Make sure the hook file exists and is executable:
   ```bash
   ls -la .git/hooks/pre-commit
   ```

2. Try running the security check manually:
   ```bash
   npx vibe-security-hook run
   ```

3. Check that the pre-commit hook contains the correct command:
   ```bash
   cat .git/hooks/pre-commit
   ```
   It should include: `npx vibe-security-hook run`
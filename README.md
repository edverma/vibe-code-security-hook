# Vibe Code Security Hook

A Git pre-commit hook that scans your code for security issues and sensitive information before allowing commits.

## Features

- Automatically scans staged files before each commit
- Detects sensitive information including:
  - AWS API keys and access tokens
  - Private keys
  - Hardcoded passwords and secrets
  - Database connection strings with credentials
  - Other sensitive information
- Uses Ollama with LLama 3.1 for AI-powered scanning (with regex fallback)
- Configurable exclusions with `.security-exclude` file

## Installation

```bash
./install-hook.sh
```

This will:
1. Make the security checker executable
2. Install the pre-commit hook in your Git repository

## How It Works

The security hook runs automatically when you attempt to commit changes. It will:

1. Check if Ollama is available on your system
2. Scan all staged files for sensitive information
3. Block the commit if security issues are found
4. Allow the commit if no issues are detected

## Configuration

You can exclude files from security checks by adding patterns to the `.security-exclude` file:

```
# Files and patterns to exclude from security checks
# One pattern per line

README.md
docs/*
*.md
```

## Requirements

- Bash
- Git
- Optional: [Ollama](https://github.com/ollama/ollama) with Llama 3.1 model for AI-powered scanning

## License

[MIT License](LICENSE) 
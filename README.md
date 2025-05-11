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
- Uses Ollama with LLama 3.1 for AI-powered scanning
- Configurable exclusions with `.security-exclude` file
- Works alongside existing pre-commit hooks without conflicts

## Installation

First, clone this repository:

```bash
git clone https://github.com/yourusername/vibe-code-security-hook.git
cd vibe-code-security-hook
```

### Install for a specific repository

```bash
./install-hook.sh /path/to/your/repository
```

### Install globally (for all future repositories)

```bash
./install-hook.sh --global
```
This will:
1. Set up a global Git template directory
2. Install the hook as a template
3. Apply to all new repositories created with `git init`
4. For existing repositories, run `git init` in each repo to install the hook

## How It Works

The installation creates two files:
- A separate `vibe-code-security-hook` file containing the security scanning logic
- A standard `pre-commit` hook that calls the security hook but allows other hooks to coexist

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
- [Ollama](https://github.com/ollama/ollama) with Llama 3.1 model for AI-powered scanning

## License

[MIT License](LICENSE) 
# Vibe Code Security Hook

A Git pre-commit hook to prevent vibe coders from accidentally committing sensitive data like API keys or private keys.

## Features
- Detects AWS keys, private keys, and hardcoded credentials.
- Blocks commits if sensitive data is found.
- Provides suggestions to fix issues (e.g., use a .env file).

## Installation
1. Clone this repository: `git clone <repo-url>`.
2. Navigate to the directory: `cd vibe-code-security-hook`.
3. Install dependencies: `npm install`.
4. Initialize Git (if not already done): `git init`.
5. Commit your code— the hook will automatically run!
6. Copy `.env.example` to `.env` and fill in your keys: `cp .env.example .env`.

## Usage
- Stage your changes with `git add .`.
- Commit with `git commit -m "Your message"`.
- If sensitive data is detected, the commit will be blocked with a warning.

## Example
If you try to commit:
```javascript
const api_key = "AKIA1234567890ABCDEF";
```

The hook will block the commit and suggest moving the key to a `.env` file.
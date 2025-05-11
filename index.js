#!/usr/bin/env node

/**
 * Vibe Code Security Hook
 * A Git pre-commit hook to prevent accidentally committing sensitive data
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Main function to run the security check script
export async function runSecurityCheck() {
  // Path to the security check script
  const scriptPath = path.join(__dirname, 'scripts', 'check-security.js');
  
  try {
    // Use dynamic import to execute the script
    await import(scriptPath);
  } catch (error) {
    console.error(`Error running security check: ${error.message}`);
    process.exit(1);
  }
}

// Function to install the pre-commit hook in a project
export function installHook(targetDir = process.cwd()) {
  const huskyDir = path.join(targetDir, '.husky');
  const preCommitPath = path.join(huskyDir, 'pre-commit');
  
  // Create .husky directory if it doesn't exist
  if (!fs.existsSync(huskyDir)) {
    fs.mkdirSync(huskyDir, { recursive: true });
  }
  
  // Create or update pre-commit hook file
  const hookScript = `#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Run vibe-code-security-hook
node -e "import('vibe-code-security-hook').then(module => module.runSecurityCheck())"
`;

  fs.writeFileSync(preCommitPath, hookScript);
  fs.chmodSync(preCommitPath, '755'); // Make executable
  
  console.log('Vibe Code Security Hook installed successfully!');
  return true;
}

// Function to create a sample .security-exclude file
export function createExcludeFile(targetDir = process.cwd()) {
  const excludeFilePath = path.join(targetDir, '.security-exclude');
  
  // Don't overwrite existing file
  if (fs.existsSync(excludeFilePath)) {
    console.log('.security-exclude file already exists.');
    return false;
  }
  
  const sampleContent = `# Vibe Code Security Hook exclusion patterns
# Lines starting with # are comments
# Each line is a glob pattern of files to exclude from security checks

# Documentation files
*.md
*.txt
docs/*

# Examples
examples/*

# Test code
tests/*
test/*
__tests__/*

# Configuration files (be careful with this)
# *.config.js
`;

  fs.writeFileSync(excludeFilePath, sampleContent);
  console.log('Created sample .security-exclude file.');
  return true;
}

// If this script is executed directly, run the security check
if (import.meta.url === `file://${process.argv[1]}`) {
  runSecurityCheck();
}
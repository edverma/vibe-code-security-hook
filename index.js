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

// Function to install hook directly into .git/hooks
export function installGitHook(targetDir = process.cwd()) {
  console.log('🔧 Installing hook to .git/hooks...');
  
  const gitHooksDir = path.join(targetDir, '.git', 'hooks');
  const preCommitPath = path.join(gitHooksDir, 'pre-commit');
  
  // Create the git hooks directory if it doesn't exist
  if (!fs.existsSync(gitHooksDir)) {
    console.log('Creating git hooks directory...');
    fs.mkdirSync(gitHooksDir, { recursive: true });
  }
  
  // Remove .sample extension if needed
  const samplePath = `${preCommitPath}.sample`;
  if (fs.existsSync(samplePath) && !fs.existsSync(preCommitPath)) {
    console.log('Converting sample hook to active hook...');
    fs.copyFileSync(samplePath, preCommitPath);
  }
  
  // Create or append to the pre-commit hook
  const hookCommand = `#!/bin/sh
# vibe-code-security-hook - Prevent committing sensitive data
npx vibe-security-hook run || exit 1
`;

  if (fs.existsSync(preCommitPath)) {
    const existingContent = fs.readFileSync(preCommitPath, 'utf8');
    
    if (existingContent.includes('vibe-security-hook run')) {
      console.log('✅ Hook already installed in .git/hooks');
    } else {
      // Append our command to existing hook, ensuring there's a shebang
      if (!existingContent.startsWith('#!/')) {
        fs.writeFileSync(preCommitPath, `#!/bin/sh\n${existingContent}\n${hookCommand}`);
      } else {
        fs.appendFileSync(preCommitPath, `\n${hookCommand}`);
      }
      console.log('✅ Added hook to existing .git/hooks/pre-commit');
    }
  } else {
    // Create new hook file
    fs.writeFileSync(preCommitPath, hookCommand);
    console.log('✅ Created new .git/hooks/pre-commit');
  }
  
  // Make sure the hook is executable
  fs.chmodSync(preCommitPath, '755');
  
  return true;
}

// Function to install the pre-commit hook in a project
export async function installHook(targetDir = process.cwd()) {
  try {
    console.log(`Installing hook in ${targetDir}...`);

    // Check if we're in a git repository
    if (!fs.existsSync(path.join(targetDir, '.git'))) {
      console.log('No .git directory found. To install the hook correctly:');
      console.log('1. Navigate to your project root (where .git directory is located)');
      console.log('2. Run: npx vibe-security-hook install');
      return false;
    }

    // Install directly to git hooks
    try {
      installGitHook(targetDir);
      return true;
    } catch (error) {
      console.error(`Error installing hook: ${error.message}`);
      
      console.log('\nPlease try running the following commands manually:');
      console.log('echo \'#!/bin/sh\' > .git/hooks/pre-commit');
      console.log('echo \'npx vibe-security-hook run\' >> .git/hooks/pre-commit');
      console.log('chmod +x .git/hooks/pre-commit');
      
      return false;
    }
  } catch (error) {
    console.error(`Error in installHook: ${error.message}`);
    return false;
  }
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

// Check if we're running as a direct script
async function handleDirectExecution() {
  // Check if we have a specific command argument
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === 'run') {
    // Run the security check
    await runSecurityCheck();
  } else if (args[0] === 'install') {
    // Install the hook
    const success = await installHook();
    if (!success) {
      console.error('Failed to install the hook. Please follow the manual installation instructions.');
      process.exit(1);
    }
  } else if (args[0] === 'help') {
    console.log(`
Vibe Code Security Hook

USAGE:
  vibe-security-hook [COMMAND]

COMMANDS:
  run       Run the security check (default)
  install   Install the pre-commit hook
  help      Show this help message

For issues, visit: https://github.com/edverma/vibe-code-security-hook/issues
    `);
  } else {
    console.error(`Unknown command: ${args[0]}`);
    console.log('Try "vibe-security-hook help" for more information.');
    process.exit(1);
  }
}

// If this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  handleDirectExecution().catch(error => {
    console.error('Error:', error.message);
    process.exit(1);
  });
}
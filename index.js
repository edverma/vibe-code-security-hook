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
  console.log('🔧 Installing hook directly to .git/hooks (fallback method)...');

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
      console.log('2. Run: npx vibe-security-hook-install');
      return false;
    }

    // Import execSync
    const { execSync } = await import('child_process');

    // First try direct git hooks installation as the most reliable method
    try {
      console.log('Attempting direct git hooks installation...');
      installGitHook(targetDir);
      console.log('Direct git hooks installation successful!');
    } catch (directError) {
      console.error('Direct git hooks installation failed:', directError.message);
      console.log('Trying other installation methods...');
    }

    // Also try the installer script for additional setup
    console.log('Running dedicated installer script for proper setup...');

    // Run the installer script directly
    try {
      // First try to find the script within the same directory as this module
      const installerPath = path.join(__dirname, 'scripts', 'install.js');

      if (fs.existsSync(installerPath)) {
        console.log('Found local installer script.');
        execSync(`node "${installerPath}"`, {
          stdio: 'inherit',
          cwd: targetDir
        });
        return true;
      } else {
        // If not found locally, try to run it through npx
        console.log('Using npx to run installer script...');
        execSync('npx vibe-security-hook-install', {
          stdio: 'inherit',
          cwd: targetDir
        });
        return true;
      }
    } catch (error) {
      console.error('Could not run the installer script.');

      // Try the husky installation method
      try {
        console.log('Attempting husky installation method...');

        // Add husky to devDependencies if needed
        try {
          execSync('npm list husky', { stdio: 'ignore', cwd: targetDir });
        } catch (error) {
          console.log('Installing husky...');
          execSync('npm install husky --save-dev', { stdio: 'inherit', cwd: targetDir });
        }

        // Add prepare script to package.json
        execSync('npm pkg set scripts.prepare="husky"', { stdio: 'inherit', cwd: targetDir });

        // Initialize husky
        execSync('npx husky', { stdio: 'inherit', cwd: targetDir });

        // Set up the pre-commit hook
        const huskyDir = path.join(targetDir, '.husky');
        if (!fs.existsSync(huskyDir)) {
          fs.mkdirSync(huskyDir, { recursive: true });
        }

        const preCommitPath = path.join(huskyDir, 'pre-commit');
        const hookCommand = 'npx vibe-security-hook run';

        // Check if the pre-commit file exists and update it
        if (fs.existsSync(preCommitPath)) {
          const hookContent = fs.readFileSync(preCommitPath, 'utf8');

          if (!hookContent.includes(hookCommand)) {
            // Append our command to the existing hook
            fs.appendFileSync(preCommitPath, `\n${hookCommand}\n`);
          }
        } else {
          // Create a new pre-commit file with proper format for Husky
          const hookContent = `#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

${hookCommand}
`;
          fs.writeFileSync(preCommitPath, hookContent);
        }

        fs.chmodSync(preCommitPath, '755'); // Make executable

        console.log('Husky installation successful!');
        return true;
      } catch (huskyError) {
        console.error('All installation methods failed.');
        console.log('The direct git hooks method was already attempted as a first resort.');
        return true; // We already installed via direct git hooks method
      }
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
      console.error('Failed to install the hook. Try running with npm exec vibe-security-hook install');
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
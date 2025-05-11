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
export async function installHook(targetDir = process.cwd()) {
  try {
    // First, check if we're in a git repository
    if (!fs.existsSync(path.join(targetDir, '.git'))) {
      console.log('No .git directory found. Skipping hook installation.');
      return false;
    }

    // Add the prepare script to package.json if it doesn't exist
    const packageJsonPath = path.join(targetDir, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

        // Make sure husky is in devDependencies
        if (!packageJson.devDependencies || !packageJson.devDependencies.husky) {
          console.log('Adding husky to devDependencies...');
          packageJson.devDependencies = packageJson.devDependencies || {};
          packageJson.devDependencies.husky = "^9.0.1";
        }

        // Add prepare script for husky
        if (!packageJson.scripts) {
          packageJson.scripts = {};
        }

        if (!packageJson.scripts.prepare || !packageJson.scripts.prepare.includes('husky')) {
          packageJson.scripts.prepare = "husky";
          console.log('Added prepare script to package.json');
        }

        // Write the updated package.json
        fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

        // Run husky install
        try {
          console.log('Running husky install...');
          const { execSync } = await import('child_process');
          execSync('npx husky install', { stdio: 'inherit', cwd: targetDir });
        } catch (error) {
          console.error('Failed to run husky install:', error.message);
        }
      } catch (error) {
        console.error('Error updating package.json:', error.message);
      }
    }

    const huskyDir = path.join(targetDir, '.husky');
    const preCommitPath = path.join(huskyDir, 'pre-commit');

    // Create .husky directory if it doesn't exist
    if (!fs.existsSync(huskyDir)) {
      fs.mkdirSync(huskyDir, { recursive: true });
    }

    // Create _/husky.sh if it doesn't exist
    const huskyShDir = path.join(huskyDir, '_');
    if (!fs.existsSync(huskyShDir)) {
      fs.mkdirSync(huskyShDir, { recursive: true });

      // Copy husky.sh from node_modules if available
      const huskyModule = path.join(targetDir, 'node_modules', 'husky');
      if (fs.existsSync(huskyModule)) {
        const huskyShSource = path.join(huskyModule, 'lib', 'sh', 'husky.sh');
        if (fs.existsSync(huskyShSource)) {
          fs.copyFileSync(huskyShSource, path.join(huskyShDir, 'husky.sh'));
        }
      }
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
  } catch (error) {
    console.error(`Error installing hook: ${error.message}`);
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
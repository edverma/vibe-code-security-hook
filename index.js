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

// If this script is executed directly, run the security check
if (import.meta.url === `file://${process.argv[1]}`) {
  runSecurityCheck();
}
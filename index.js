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
      console.error('Could not run the installer script automatically.');
      console.log('Please install manually by running the following command in your project root:');
      console.log('npx vibe-security-hook-install');

      // Try the alternative installation method
      try {
        console.log('Attempting alternative installation method...');

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

        console.log('Alternative installation successful!');
        return true;
      } catch (altError) {
        console.error('Alternative installation also failed:', altError.message);
        return false;
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
#!/usr/bin/env node

/**
 * Installation script for vibe-code-security-hook
 * This script handles the complete installation of the hook
 */

import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

// Installation directory (current directory by default)
const targetDir = process.cwd();

// Check if we're in a git repository
if (!fs.existsSync(path.join(targetDir, '.git'))) {
  console.error('❌ Error: No .git directory found. This doesn\'t appear to be a git repository.');
  console.log('Please run this script from the root of your git repository.');
  process.exit(1);
}

// Function to install hook directly into .git/hooks
function installGitHook(targetDir) {
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

// Install husky if needed
try {
  console.log('🔍 Checking for husky...');
  try {
    execSync('npm list husky', { stdio: 'ignore' });
    console.log('✅ Husky is already installed.');
  } catch (error) {
    console.log('📦 Installing husky...');
    execSync('npm install husky --save-dev', { stdio: 'inherit' });
    console.log('✅ Husky installed successfully.');
  }

  // Add prepare script to package.json
  console.log('🔧 Configuring package.json...');
  
  try {
    // First check if we have a prepare script already
    const packageJsonPath = path.join(targetDir, 'package.json');
    let packageJson;
    
    if (fs.existsSync(packageJsonPath)) {
      packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      
      // Make sure scripts section exists
      if (!packageJson.scripts) {
        packageJson.scripts = {};
      }
      
      // Add or update prepare script
      if (!packageJson.scripts.prepare || !packageJson.scripts.prepare.includes('husky')) {
        packageJson.scripts.prepare = 'husky';
        
        // Write back to package.json
        fs.writeFileSync(
          packageJsonPath,
          JSON.stringify(packageJson, null, 2)
        );
        console.log('✅ Added prepare script to package.json');
      } else {
        console.log('✅ prepare script already configured');
      }
    } else {
      // If package.json doesn't exist, use npm pkg command
      execSync('npm pkg set scripts.prepare="husky"', { stdio: 'inherit' });
      console.log('✅ Added prepare script to package.json');
    }
  } catch (error) {
    console.error(`Error configuring package.json: ${error.message}`);
    // Try the npm pkg command as fallback
    execSync('npm pkg set scripts.prepare="husky"', { stdio: 'inherit' });
    console.log('✅ Added prepare script to package.json (fallback method)');
  }

  // Try to initialize husky
  let huskySetupSuccessful = false;
  
  try {
    console.log('🚀 Initializing husky...');
    execSync('npx husky', { stdio: 'inherit' });
    
    // Add the pre-commit hook script to the husky directory
    const huskyDir = path.join(targetDir, '.husky');
    const hookPath = path.join(huskyDir, 'pre-commit');
    
    console.log('🛠️ Setting up pre-commit hook...');
    
    // Prepare the hook command - just the npx command, no shebang or source
    // This works with both Husky v9 and v10
    const hookCommand = 'npx vibe-security-hook run';
    
    // Now let Husky add the command to the pre-commit file
    if (!fs.existsSync(huskyDir)) {
      console.log('Creating husky directory...');
      fs.mkdirSync(huskyDir, { recursive: true });
    }
    
    try {
      // If the pre-commit file exists, check if our command is already there
      if (fs.existsSync(hookPath)) {
        const hookContent = fs.readFileSync(hookPath, 'utf8');
        
        if (hookContent.includes(hookCommand)) {
          console.log('✅ Pre-commit hook already includes our command');
          huskySetupSuccessful = true;
        } else {
          // Append our command to the existing hook
          fs.appendFileSync(hookPath, `\n${hookCommand}\n`);
          fs.chmodSync(hookPath, '755');
          console.log('✅ Added command to existing pre-commit hook');
          huskySetupSuccessful = true;
        }
      } else {
        // Create a new pre-commit file with our command
        fs.writeFileSync(hookPath, `#!/usr/bin/env sh\n. "$(dirname -- "$0")/_/husky.sh"\n\n${hookCommand}\n`);
        fs.chmodSync(hookPath, '755');
        console.log('✅ Created new pre-commit hook');
        huskySetupSuccessful = true;
      }
    } catch (error) {
      console.error(`Error setting up pre-commit hook: ${error.message}`);
      console.log('Trying alternative method...');
      
      try {
        // Try to use the husky add command if available
        execSync(`npx husky add .husky/pre-commit "${hookCommand}"`, { stdio: 'inherit' });
        console.log('✅ Pre-commit hook added via husky add');
        huskySetupSuccessful = true;
      } catch (addError) {
        console.error(`Error using husky add: ${addError.message}`);
        huskySetupSuccessful = false;
      }
    }
  } catch (error) {
    console.error(`Husky setup failed: ${error.message}`);
    huskySetupSuccessful = false;
  }
  
  // If husky setup failed, try direct git hooks installation
  if (!huskySetupSuccessful) {
    console.log('⚠️ Husky setup unsuccessful. Falling back to direct git hooks installation...');
    installGitHook(targetDir);
  }

  console.log('\n🎉 vibe-code-security-hook installed successfully!');
  console.log('The hook will run automatically when you commit changes.');
  console.log('\nTo test the hook, try staging and committing a file with a fake API key:');
  console.log('echo "const API_KEY = \\"AKIA1234567890ABCDEF\\";" > test.js');
  console.log('git add test.js');
  console.log('git commit -m "Test commit"');
  console.log('\nFor issues: https://github.com/edverma/vibe-code-security-hook/issues');
} catch (error) {
  console.error(`❌ Error during installation: ${error.message}`);
  
  // Try direct git hooks installation as final fallback
  try {
    console.log('Attempting direct git hooks installation as final fallback...');
    if (installGitHook(targetDir)) {
      console.log('✅ Fallback installation successful!');
      console.log('\nTo test the hook, try staging and committing a file with a fake API key.');
    }
  } catch (fallbackError) {
    console.error(`Fallback installation failed: ${fallbackError.message}`);
    console.log('\nPlease try running the following commands manually:');
    console.log('1. npm install husky --save-dev');
    console.log('2. npm pkg set scripts.prepare="husky"');
    console.log('3. npx husky');
    console.log('4. Edit .husky/pre-commit and add this line:');
    console.log('   npx vibe-security-hook run');
    console.log('5. chmod +x .husky/pre-commit');
    process.exit(1);
  }
}
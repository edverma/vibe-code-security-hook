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
  execSync('npm pkg set scripts.prepare="husky"', { stdio: 'inherit' });
  console.log('✅ Added prepare script to package.json.');

  // Initialize husky
  console.log('🚀 Initializing husky...');
  execSync('npx husky init', { stdio: 'inherit' });
  console.log('✅ Husky initialized.');

  // Add pre-commit hook
  console.log('🛠️ Setting up pre-commit hook...');
  execSync('npx husky add .husky/pre-commit "npx vibe-security-hook run"', { stdio: 'inherit' });
  console.log('✅ Pre-commit hook added.');

  // Make the pre-commit hook executable
  const preCommitPath = path.join(targetDir, '.husky', 'pre-commit');
  fs.chmodSync(preCommitPath, '755');

  console.log('\n🎉 vibe-code-security-hook installed successfully!');
  console.log('The hook will run automatically when you commit changes.');
  console.log('\nTo test the hook, try staging and committing a file with a fake API key:');
  console.log('echo "const API_KEY = \\"AKIA1234567890ABCDEF\\";" > test.js');
  console.log('git add test.js');
  console.log('git commit -m "Test commit"');
  console.log('\nFor issues: https://github.com/edverma/vibe-code-security-hook/issues');
} catch (error) {
  console.error(`❌ Error during installation: ${error.message}`);
  console.log('\nPlease try running the following commands manually:');
  console.log('1. npm install husky --save-dev');
  console.log('2. npm pkg set scripts.prepare="husky"');
  console.log('3. npx husky init');
  console.log('4. npx husky add .husky/pre-commit "npx vibe-security-hook run"');
  process.exit(1);
}
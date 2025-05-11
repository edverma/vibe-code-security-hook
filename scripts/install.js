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

  // First, run husky install to initialize
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
      } else {
        // Append our command to the existing hook
        fs.appendFileSync(hookPath, `\n${hookCommand}\n`);
        fs.chmodSync(hookPath, '755');
        console.log('✅ Added command to existing pre-commit hook');
      }
    } else {
      // Create a new pre-commit file with our command
      fs.writeFileSync(hookPath, `#!/usr/bin/env sh\n. "$(dirname -- "$0")/_/husky.sh"\n\n${hookCommand}\n`);
      fs.chmodSync(hookPath, '755');
      console.log('✅ Created new pre-commit hook');
    }
  } catch (error) {
    console.error(`Error setting up pre-commit hook: ${error.message}`);
    console.log('Trying alternative method...');
    
    try {
      // Try to use the husky add command if available
      execSync(`npx husky add .husky/pre-commit "${hookCommand}"`, { stdio: 'inherit' });
      console.log('✅ Pre-commit hook added via husky add');
    } catch (addError) {
      console.error(`Error using husky add: ${addError.message}`);
      
      // Manual fallback - create the hook file directly
      if (!fs.existsSync(hookPath)) {
        fs.writeFileSync(hookPath, `#!/usr/bin/env sh\n. "$(dirname -- "$0")/_/husky.sh"\n\n${hookCommand}\n`);
      } else {
        fs.appendFileSync(hookPath, `\n${hookCommand}\n`);
      }
      fs.chmodSync(hookPath, '755');
      console.log('✅ Pre-commit hook added via manual fallback');
    }
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
  console.log('\nPlease try running the following commands manually:');
  console.log('1. npm install husky --save-dev');
  console.log('2. npm pkg set scripts.prepare="husky"');
  console.log('3. npx husky');
  console.log('4. Edit .husky/pre-commit and add this line:');
  console.log('   npx vibe-security-hook run');
  console.log('5. chmod +x .husky/pre-commit');
  process.exit(1);
}
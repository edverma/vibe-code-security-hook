#!/usr/bin/env node

/**
 * Installation script for vibe-code-security-hook
 * This script handles the installation of the hook directly to .git/hooks
 */

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

// Install the hook directly to .git/hooks
function installGitHook(targetDir) {
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

try {
  // Install the hook
  installGitHook(targetDir);
  
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
  console.log('1. Create or edit .git/hooks/pre-commit and add this line:');
  console.log('   #!/bin/sh');
  console.log('   npx vibe-security-hook run');
  console.log('2. chmod +x .git/hooks/pre-commit');
  process.exit(1);
}
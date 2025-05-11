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
  execSync('npx husky', { stdio: 'inherit' });
  console.log('✅ Husky initialized.');

  // Create pre-commit hook file manually (since husky add is deprecated)
  console.log('🛠️ Setting up pre-commit hook...');
  const huskyDir = path.join(targetDir, '.husky');
  
  if (!fs.existsSync(huskyDir)) {
    fs.mkdirSync(huskyDir, { recursive: true });
  }
  
  const preCommitPath = path.join(huskyDir, 'pre-commit');
  const hookContent = `#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# Run vibe-code-security-hook
npx vibe-security-hook run
`;

  fs.writeFileSync(preCommitPath, hookContent);
  fs.chmodSync(preCommitPath, '755'); // Make executable
  console.log('✅ Pre-commit hook added.');

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
  console.log('4. Create a file .husky/pre-commit with:');
  console.log('   #!/usr/bin/env sh');
  console.log('   . "$(dirname -- "$0")/_/husky.sh"');
  console.log('   npx vibe-security-hook run');
  console.log('5. chmod +x .husky/pre-commit');
  process.exit(1);
}
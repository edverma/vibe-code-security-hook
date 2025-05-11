import { execSync } from 'child_process';
import chalk from 'chalk';

function getStagedChanges() {
  try {
    // Get list of staged files
    const stagedFiles = execSync('git diff --staged --name-only', { encoding: 'utf-8' })
      .split('\n')
      .filter(Boolean);

    if (stagedFiles.length === 0) {
      return '';
    }

    // Get content of each staged file
    let combinedDiff = '';
    for (const file of stagedFiles) {
      try {
        // Get the staged content
        const fileContent = execSync(`git show :${file}`, { encoding: 'utf-8' });
        combinedDiff += `File: ${file}\n${fileContent}\n\n`;
      } catch (e) {
        // Skip files that can't be read
        console.warn(chalk.yellow(`Warning: Could not read staged content of ${file}`));
      }
    }

    return combinedDiff;
  } catch (error) {
    console.error(chalk.red('Error getting staged changes:'), error.message);
    process.exit(1);
  }
}

const patterns = [
  { regex: /AKIA[0-9A-Z]{16}/, message: 'AWS Access Key detected' },
  { regex: /-----BEGIN [A-Z]+ PRIVATE KEY-----/, message: 'Private key detected' },
  { regex: /(api_key|password|secret)\s*=\s*["'][^"']+["']/, message: 'Hardcoded credential detected' },
];

function scanForSensitiveData(diff) {
  const issues = [];
  const lines = diff.split('\n');

  lines.forEach((line, index) => {
    patterns.forEach(pattern => {
      if (pattern.regex.test(line)) {
        issues.push({
          line: index + 1,
          content: line.trim(),
          message: pattern.message,
        });
      }
    });
  });

  return issues;
}

function main() {
  console.log(chalk.cyan('Scanning staged changes for security issues...'));

  const diff = getStagedChanges();
  if (!diff) {
    console.log(chalk.green('No changes to scan.'));
    process.exit(0);
  }

  const issues = scanForSensitiveData(diff);
  if (issues.length > 0) {
    console.log(chalk.red('Security issues found! Commit blocked.\n'));
    issues.forEach(issue => {
      console.log(chalk.yellow(`Line ${issue.line}: ${issue.message}`));
      console.log(`  ${issue.content}`);
    });
    console.log(chalk.cyan('\nSuggestion: Move sensitive data to a .env file and add it to .gitignore.'));
    process.exit(1);
  }

  console.log(chalk.green('No security issues found. Commit allowed.'));
  process.exit(0);
}

main();
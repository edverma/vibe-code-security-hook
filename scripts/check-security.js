import { execSync } from 'child_process';
import chalk from 'chalk';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

// Load exclusion patterns from file
function loadExclusionPatterns() {
  try {
    // Look for the file at the top level of the repository
    const filePath = path.join(process.cwd(), '.security-exclude');
    const content = fs.readFileSync(filePath, 'utf-8');
    return content
      .split('\n')
      .filter(line => line.trim() && !line.startsWith('#'))
      .map(pattern => pattern.trim());
  } catch (error) {
    console.warn(chalk.yellow(`Warning: Could not load exclusion patterns: ${error.message}`));
    return [];
  }
}

const exclusionPatterns = loadExclusionPatterns();

// Function to check if a file should be excluded
function shouldExcludeFile(filePath) {
  const normalizedPath = filePath.toLowerCase();
  
  // Check against loaded patterns
  for (const pattern of exclusionPatterns) {
    // Convert glob patterns to regex
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*');
    const regex = new RegExp(regexPattern, 'i');
    
    if (regex.test(normalizedPath)) {
      console.log(chalk.blue(`Skipping excluded file: ${filePath} (matched pattern: ${pattern})`));
      return true;
    }
  }
  
  // Legacy exclusion logic (keeping for backward compatibility)
  if (normalizedPath.includes('readme') ||
      filePath.endsWith('.md') ||
      filePath.endsWith('.txt') ||
      filePath.includes('doc')) {
    console.log(chalk.blue(`Skipping documentation file: ${filePath}`));
    return true;
  }
  
  return false;
}

async function checkWithOllama(content, filePath) {
  try {
    // Check if Ollama is running
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Connection timeout')), 1000)
    );

    const fetchPromise = fetch('http://localhost:11434/api/tags', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    await Promise.race([timeoutPromise, fetchPromise]);

    // If we get here, Ollama is running
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama3.1:8b',
        prompt: `Analyze the following code and identify any security issues such as:
1. AWS API keys or access tokens
2. Private keys
3. Hardcoded passwords or secrets
4. Database connection strings with credentials
5. Any other sensitive information that should not be committed to a repository

If you find any such issues, respond with a JSON object that includes:
{
  "hasSensitiveData": true,
  "issues": [
    {
      "line": "the line containing sensitive data",
      "type": "Type of sensitive data (e.g., 'AWS Key', 'Password', etc.)",
      "suggestion": "A suggestion to fix it"
    }
  ]
}

If no sensitive data is found, respond with:
{
  "hasSensitiveData": false
}

Here is the code to analyze from file ${filePath}:

\`\`\`
${content}
\`\`\``,
        stream: false,
      }),
    });

    const data = await response.json();
    let result;

    if (!data || !data.response) {
      throw new Error('Invalid response from Ollama');
    }

    try {
      // Extract JSON from the response text
      const jsonText = data.response.trim();
      result = JSON.parse(jsonText);
    } catch (e) {
      // If parsing fails, try to extract JSON from the text
      const jsonMatch = data.response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        // If still can't parse, check if the response contains indicators of sensitive data
        const text = data.response.toLowerCase();
        if (text.includes('api key') || text.includes('password') ||
            text.includes('secret') || text.includes('credential') ||
            text.includes('sensitive') || text.includes('token')) {
          return {
            hasSensitiveData: true,
            issues: [{
              line: "Unknown line",
              type: "Possible sensitive data",
              suggestion: "Please review the file manually for sensitive information"
            }]
          };
        } else {
          return { hasSensitiveData: false };
        }
      }
    }
    
    return result;
  } catch (error) {
    console.error(chalk.red(`Error calling Ollama: ${error.message}`));
    // Fall back to a simple check for common patterns
    const commonPatterns = [
      { regex: /AKIA[0-9A-Z]{16}/, type: 'AWS Access Key' },
      { regex: /-----BEGIN [A-Z]+ PRIVATE KEY-----/, type: 'Private key' },
      { regex: /(api_key|password|secret)\s*=\s*["'][^"']+["']/, type: 'Hardcoded credential' },
    ];

    // Check if file should be excluded
    if (shouldExcludeFile(filePath)) {
      return { hasSensitiveData: false, issues: [] };
    }

    const lines = content.split('\n');
    const issues = [];

    lines.forEach((line, index) => {
      commonPatterns.forEach(pattern => {
        if (pattern.regex.test(line)) {
          issues.push({
            line: line.trim(),
            type: pattern.type,
            suggestion: 'Move sensitive data to a .env file and add it to .gitignore.'
          });
        }
      });
    });

    return {
      hasSensitiveData: issues.length > 0,
      issues: issues
    };
  }
}

async function getStagedChanges() {
  try {
    // Get list of staged files
    const stagedFiles = execSync('git diff --staged --name-only', { encoding: 'utf-8' })
      .split('\n')
      .filter(Boolean);
    
    if (stagedFiles.length === 0) {
      return [];
    }
    
    // Get content of each staged file
    const stagedContent = [];
    for (const file of stagedFiles) {
      // Check if file should be excluded before processing
      if (shouldExcludeFile(file)) {
        continue;
      }
      
      try {
        // Get the staged content
        const fileContent = execSync(`git show :${file}`, { encoding: 'utf-8' });
        stagedContent.push({
          filePath: file,
          content: fileContent
        });
      } catch (e) {
        // Skip files that can't be read
        console.warn(chalk.yellow(`Warning: Could not read staged content of ${file}`));
      }
    }
    
    return stagedContent;
  } catch (error) {
    console.error(chalk.red('Error getting staged changes:'), error.message);
    process.exit(1);
  }
}

async function main() {
  console.log(chalk.cyan('Scanning staged changes for security issues...'));
  console.log(chalk.blue(`Loaded ${exclusionPatterns.length} exclusion patterns`));

  const stagedFiles = await getStagedChanges();
  if (stagedFiles.length === 0) {
    console.log(chalk.green('No changes to scan.'));
    process.exit(0);
  }

  let hasIssues = false;
  let allIssues = [];

  // Process files sequentially to avoid overwhelming Ollama
  for (const file of stagedFiles) {
    const result = await checkWithOllama(file.content, file.filePath);
    
    if (result.hasSensitiveData) {
      hasIssues = true;
      result.issues.forEach(issue => {
        allIssues.push({
          filePath: file.filePath,
          ...issue
        });
      });
    }
  }

  if (hasIssues) {
    console.log(chalk.red('Security issues found! Commit blocked.\n'));
    allIssues.forEach(issue => {
      console.log(chalk.yellow(`File: ${issue.filePath}`));
      console.log(chalk.yellow(`Issue: ${issue.type}`));
      console.log(`  ${issue.line}`);
      console.log(chalk.cyan(`  Suggestion: ${issue.suggestion || 'Move sensitive data to a .env file and add it to .gitignore.'}`));
      console.log();
    });
    console.log(chalk.cyan('For more information, consult your security team or documentation.'));
    process.exit(1);
  }

  console.log(chalk.green('No security issues found. Commit allowed.'));
  process.exit(0);
}

main();
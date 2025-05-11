#!/bin/bash

# ANSI color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;36m'
NC='\033[0m' # No Color

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Get the Git root directory
GIT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo ".")

# Load exclusion patterns from file
load_exclusion_patterns() {
  EXCLUSION_PATTERNS=()
  
  # First try repository root .security-exclude
  if [ -f "$GIT_ROOT/.security-exclude" ]; then
    EXCLUDE_FILE="$GIT_ROOT/.security-exclude"
  # Then try .security-exclude in the script directory
  elif [ -f "$SCRIPT_DIR/.security-exclude" ]; then
    EXCLUDE_FILE="$SCRIPT_DIR/.security-exclude"
  # Finally fall back to the sample file if it exists
  elif [ -f "$SCRIPT_DIR/.security-exclude.sample" ]; then
    EXCLUDE_FILE="$SCRIPT_DIR/.security-exclude.sample"
    echo -e "${YELLOW}Warning: Using sample exclusion file. Consider creating your own .security-exclude file.${NC}"
  else
    echo -e "${YELLOW}Warning: Could not find .security-exclude file${NC}"
    return
  fi
  
  while IFS= read -r line; do
    # Skip empty lines and comments
    if [[ -n "$line" && ! "$line" =~ ^[[:space:]]*# ]]; then
      EXCLUSION_PATTERNS+=("$line")
    fi
  done < "$EXCLUDE_FILE"
  
  echo -e "${BLUE}Loaded ${#EXCLUSION_PATTERNS[@]} exclusion patterns from $EXCLUDE_FILE${NC}"
}

# Check if a file should be excluded
should_exclude_file() {
  local file_path="$1"
  local normalized_path=$(echo "$file_path" | tr '[:upper:]' '[:lower:]')
  
  # Check against loaded patterns
  for pattern in "${EXCLUSION_PATTERNS[@]}"; do
    # Convert glob pattern to regex
    regex_pattern=$(echo "$pattern" | sed 's/\./\\./g' | sed 's/\*/\.\*/g')
    if [[ "$normalized_path" =~ $regex_pattern ]]; then
      echo -e "${BLUE}Skipping excluded file: $file_path (matched pattern: $pattern)${NC}"
      return 0
    fi
  done
  
  # Legacy exclusion logic
  if [[ "$normalized_path" == *"readme"* || 
        "$file_path" == *".md" || 
        "$file_path" == *".txt" || 
        "$file_path" == *"doc"* ]]; then
    echo -e "${BLUE}Skipping documentation file: $file_path${NC}"
    return 0
  fi
  
  return 1
}

# Check if Ollama is running
check_ollama_available() {
  if curl -s --max-time 1 "http://localhost:11434/api/tags" > /dev/null 2>&1; then
    return 0
  else
    return 1
  fi
}

# Check file with Ollama
check_with_ollama() {
  local content="$1"
  local file_path="$2"
  
  # Call Ollama API
  response=$(curl -s -X POST "http://localhost:11434/api/generate" \
    -H "Content-Type: application/json" \
    -d "{
      \"model\": \"llama3.1:8b\",
      \"prompt\": \"Analyze the following code and identify any security issues such as:
1. AWS API keys or access tokens
2. Private keys
3. Hardcoded passwords or secrets
4. Database connection strings with credentials
5. Any other sensitive information that should not be committed to a repository

If you find any such issues, respond with a JSON object that includes:
{
  \\\"hasSensitiveData\\\": true,
  \\\"issues\\\": [
    {
      \\\"line\\\": \\\"the line containing sensitive data\\\",
      \\\"type\\\": \\\"Type of sensitive data (e.g., 'AWS Key', 'Password', etc.)\\\",
      \\\"suggestion\\\": \\\"A suggestion to fix it\\\"
    }
  ]
}

If no sensitive data is found, respond with:
{
  \\\"hasSensitiveData\\\": false
}

Here is the code to analyze from file ${file_path}:

\`\`\`
${content}
\`\`\`\",
      \"stream\": false
    }")
  
  # Try to parse the JSON response
  if echo "$response" | grep -q "hasSensitiveData"; then
    echo "$response" | jq -r '.response'
    return 0
  else
    # Check if response contains indicators of sensitive data
    if echo "$response" | grep -i -q -e "api key" -e "password" -e "secret" -e "credential" -e "sensitive" -e "token"; then
      echo "{\"hasSensitiveData\": true, \"issues\": [{\"line\": \"Unknown line\", \"type\": \"Possible sensitive data\", \"suggestion\": \"Please review the file manually for sensitive information\"}]}"
    else
      echo "{\"hasSensitiveData\": false}"
    fi
    return 0
  fi
}

# Fallback check with regex patterns
check_with_regex() {
  local content="$1"
  local file_path="$2"
  
  if should_exclude_file "$file_path"; then
    echo "{\"hasSensitiveData\": false, \"issues\": []}"
    return 0
  fi
  
  has_issues=false
  issues="[]"
  
  # Check for AWS Access Keys
  if echo "$content" | grep -q -E "AKIA[0-9A-Z]{16}"; then
    has_issues=true
    line=$(echo "$content" | grep -E "AKIA[0-9A-Z]{16}" | head -1 | sed 's/"/\\"/g')
    issues=$(echo "$issues" | jq '. += [{"line": "'"$line"'", "type": "AWS Access Key", "suggestion": "Move sensitive data to a .env file and add it to .gitignore."}]')
  fi
  
  # Check for Private Keys
  if echo "$content" | grep -q -E "-----BEGIN [A-Z]+ PRIVATE KEY-----"; then
    has_issues=true
    line=$(echo "$content" | grep -E "-----BEGIN [A-Z]+ PRIVATE KEY-----" | head -1 | sed 's/"/\\"/g')
    issues=$(echo "$issues" | jq '. += [{"line": "'"$line"'", "type": "Private key", "suggestion": "Move sensitive data to a .env file and add it to .gitignore."}]')
  fi
  
  # Check for Hardcoded credentials
  if echo "$content" | grep -q -E "(api_key|password|secret)[[:space:]]*=[[:space:]]*[\"'][^\"']+[\"']"; then
    has_issues=true
    line=$(echo "$content" | grep -E "(api_key|password|secret)[[:space:]]*=[[:space:]]*[\"'][^\"']+[\"']" | head -1 | sed 's/"/\\"/g')
    issues=$(echo "$issues" | jq '. += [{"line": "'"$line"'", "type": "Hardcoded credential", "suggestion": "Move sensitive data to a .env file and add it to .gitignore."}]')
  fi
  
  echo "{\"hasSensitiveData\": $has_issues, \"issues\": $issues}"
  return 0
}

# Get staged changes
get_staged_changes() {
  staged_files=$(git diff --staged --name-only)
  
  if [ -z "$staged_files" ]; then
    echo "[]"
    return 0
  fi
  
  file_contents="[]"
  
  for file in $staged_files; do
    if ! should_exclude_file "$file"; then
      content=$(git show ":$file" 2>/dev/null)
      if [ $? -eq 0 ]; then
        # Escape newlines and quotes for JSON
        escaped_content=$(echo "$content" | sed 's/\\/\\\\/g' | sed 's/"/\\"/g' | sed ':a;N;$!ba;s/\n/\\n/g')
        file_contents=$(echo "$file_contents" | jq '. += [{"filePath": "'"$file"'", "content": "'"$escaped_content"'"}]')
      else
        echo -e "${YELLOW}Warning: Could not read staged content of $file${NC}" >&2
      fi
    fi
  done
  
  echo "$file_contents"
}

# Main function
main() {
  echo -e "${BLUE}Scanning staged changes for security issues...${NC}"
  
  # Load exclusion patterns
  load_exclusion_patterns
  
  # Get staged files
  staged_files=$(get_staged_changes)
  
  if [ "$staged_files" = "[]" ]; then
    echo -e "${GREEN}No changes to scan.${NC}"
    exit 0
  fi
  
  has_issues=false
  all_issues=()
  
  # Check if Ollama is available
  if check_ollama_available; then
    ollama_available=true
    echo -e "${BLUE}Using Ollama for security analysis${NC}"
  else
    ollama_available=false
    echo -e "${YELLOW}Ollama not available, falling back to regex patterns${NC}"
  fi
  
  # Process each file
  num_files=$(echo "$staged_files" | jq '. | length')
  for (( i=0; i<$num_files; i++ )); do
    file_path=$(echo "$staged_files" | jq -r ".[$i].filePath")
    content=$(echo "$staged_files" | jq -r ".[$i].content")
    
    echo -e "${BLUE}Scanning file: $file_path${NC}"
    
    if [ "$ollama_available" = true ]; then
      result=$(check_with_ollama "$content" "$file_path")
    else
      result=$(check_with_regex "$content" "$file_path")
    fi
    
    has_sensitive_data=$(echo "$result" | jq -r '.hasSensitiveData')
    
    if [ "$has_sensitive_data" = "true" ]; then
      has_issues=true
      issues=$(echo "$result" | jq -r '.issues')
      num_issues=$(echo "$issues" | jq '. | length')
      
      for (( j=0; j<$num_issues; j++ )); do
        issue=$(echo "$issues" | jq ".[$j]")
        issue_with_file=$(echo "$issue" | jq '. + {"filePath": "'"$file_path"'"}')
        all_issues+=("$issue_with_file")
      done
    fi
  done
  
  if [ "$has_issues" = true ]; then
    echo -e "${RED}Security issues found! Commit blocked.${NC}\n"
    
    for issue in "${all_issues[@]}"; do
      file_path=$(echo "$issue" | jq -r '.filePath')
      issue_type=$(echo "$issue" | jq -r '.type')
      line=$(echo "$issue" | jq -r '.line')
      suggestion=$(echo "$issue" | jq -r '.suggestion // "Move sensitive data to a .env file and add it to .gitignore."')
      
      echo -e "${YELLOW}File: $file_path${NC}"
      echo -e "${YELLOW}Issue: $issue_type${NC}"
      echo "  $line"
      echo -e "${BLUE}  Suggestion: $suggestion${NC}"
      echo ""
    done
    
    echo -e "${BLUE}For more information, consult your security team or documentation.${NC}"
    exit 1
  fi
  
  echo -e "${GREEN}No security issues found. Commit allowed.${NC}"
  exit 0
}

main 
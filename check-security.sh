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
  local found_exclude_file=""

  if [ -f "$GIT_ROOT/.security-exclude" ]; then
    found_exclude_file="$GIT_ROOT/.security-exclude"
  elif [ -f "$SCRIPT_DIR/.security-exclude" ]; then
    found_exclude_file="$SCRIPT_DIR/.security-exclude"
  elif [ -f "$SCRIPT_DIR/.security-exclude.sample" ]; then
    found_exclude_file="$SCRIPT_DIR/.security-exclude.sample"
    echo -e "${YELLOW}Warning: Using sample exclusion file. Consider creating your own .security-exclude file in the repository root or script directory.${NC}"
  fi

  if [ -n "$found_exclude_file" ]; then
    echo -e "${BLUE}Loading exclusion patterns from: $found_exclude_file${NC}"
    # Read file line by line, skipping comments and empty lines
    while IFS= read -r line || [[ -n "$line" ]]; do # Handle last line if no newline
      if [[ -n "$line" && ! "$line" =~ ^[[:space:]]*# ]]; then
        EXCLUSION_PATTERNS+=("$line")
      fi
    done < "$found_exclude_file"
    echo -e "${BLUE}Loaded ${#EXCLUSION_PATTERNS[@]} exclusion patterns.${NC}"
  else
    echo -e "${YELLOW}Warning: No .security-exclude file found. (Checked $GIT_ROOT/.security-exclude, $SCRIPT_DIR/.security-exclude, $SCRIPT_DIR/.security-exclude.sample)${NC}"
  fi
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
  local response
  local curl_exit_status

  # Limit content size to avoid exceeding token limits
  # This truncates the content if it's too large, which is better than failing completely
  local max_content_length=5000
  if [ ${#content} -gt $max_content_length ]; then
    content="${content:0:$max_content_length}"
  fi
  
  # Sanitize file path for the prompt
  local safe_file_path
  safe_file_path=$(echo "$file_path" | sed 's/[\\]/\\\\/g' | sed 's/["]/\\"/g')
  
  # Construct request payload with optimized instructions
  local request_payload='{"model": "llama3.2:3b", "prompt": "TASK: Check if this code contains sensitive information (passwords, API keys, tokens, etc.)\n\nOUTPUT RULES:\n- Response must be valid JSON only\n- No explanations, no text, no markdown\n- ONLY return one of the two JSON formats shown below\n\nEXAMPLE RESPONSE FOR CLEAN CODE:\n{\"hasSensitiveData\": false}\n\nEXAMPLE RESPONSE FOR PROBLEMATIC CODE:\n{\"hasSensitiveData\": true, \"issues\": [{\"line\": \"const apiKey = '"'"'1234abcd'"'"'\", \"type\": \"API Key\", \"suggestion\": \"Store in environment variable\"}]}\n\nCODE TO ANALYZE FROM FILE '"$safe_file_path"':\n'"$content"'", "stream": false}'
  
  # Save request to a temporary file for debugging if needed
  local temp_request
  temp_request=$(mktemp)
  echo "$request_payload" > "$temp_request"

  # Call Ollama API with improved error handling
  response=$(curl -s -S -X POST "http://localhost:11434/api/generate" \
    -H "Content-Type: application/json" \
    -d @"$temp_request" 2>&1)
  curl_exit_status=$?
  
  # Clean up temp request file
  rm -f "$temp_request"

  if [ $curl_exit_status -ne 0 ]; then
    echo '{"hasSensitiveData": true, "issues": [{"type": "OllamaAPIError", "line": "N/A", "suggestion": "Ollama API call failed. Commit blocked."}]}'
    return 0
  fi

  # Check if response contains HTTP error code
  if echo "$response" | grep -q "HTTP.*4[0-9][0-9]"; then
    local error_code
    error_code=$(echo "$response" | grep -o "HTTP.*4[0-9][0-9]" | head -1)
    echo '{"hasSensitiveData": true, "issues": [{"type": "OllamaAPIError", "line": "N/A", "suggestion": "Ollama API error. Check if Ollama is running and the model is available."}]}'
    return 0
  fi
  
  # First, try to extract JSON payload from Ollama's '.response' field
  local ollama_response
  ollama_response=$(echo "$response" | jq -r '.response' 2>/dev/null)
  
  if [ -z "$ollama_response" ]; then
    echo '{"hasSensitiveData": true, "issues": [{"type": "OllamaParsingError", "line": "N/A", "suggestion": "Could not extract response field from Ollama API result."}]}'
    return 0
  fi
  
  # Check if the response field contains JSON directly
  if echo "$ollama_response" | grep -q "^{" && echo "$ollama_response" | jq -e . >/dev/null 2>&1; then
    # Response field contains direct JSON - use it
    echo "$ollama_response"
    return 0
  fi
  
  # Try to extract JSON from code blocks (```json...```) or just any JSON block in the response
  local extracted_json
  
  # Method 1: Try to extract from markdown code blocks using sed instead of grep -P
  # Look for text between triple backticks
  extracted_json=$(echo "$ollama_response" | sed -n '/```/,/```/ { /```/d; p; }' | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' 2>/dev/null)
  
  # If that doesn't work, try another pattern commonly found in responses
  if [ -z "$extracted_json" ] || ! echo "$extracted_json" | jq -e . >/dev/null 2>&1; then
    # Method 2: Look for JSON pattern in the response {.*}
    extracted_json=$(echo "$ollama_response" | grep -o -E '\{[^{]*"hasSensitiveData"[^}]*\}' 2>/dev/null)
  fi
  
  # Check if we've successfully extracted valid JSON
  if [ -n "$extracted_json" ] && echo "$extracted_json" | jq -e . >/dev/null 2>&1; then
    # Successfully extracted JSON
    echo "$extracted_json"
    return 0
  fi
  
  # Method 3: Try a different approach to extract JSON, more compatible with macOS grep
  if [ -z "$extracted_json" ] || ! echo "$extracted_json" | jq -e . >/dev/null 2>&1; then
    # Save response to a file so we can use tools that work better with files
    local temp_response
    temp_response=$(mktemp)
    echo "$ollama_response" > "$temp_response"
    
    # Try to find a JSON object by looking for line with opening brace
    local start_line
    start_line=$(grep -n "^[[:space:]]*{" "$temp_response" | head -1 | cut -d: -f1)
    
    if [ -n "$start_line" ]; then
      # Found a potential JSON start, now extract until the closing brace
      extracted_json=$(tail -n +$start_line "$temp_response" | sed -n '/{/,/}/p' | tr -d '\n')
      
      # Try to clean the extracted JSON
      extracted_json=$(echo "$extracted_json" | sed -e 's/^[^{]*//' -e 's/[^}]*$//')
      
      # Verify it's valid JSON
      if echo "$extracted_json" | jq -e . >/dev/null 2>&1; then
        rm -f "$temp_response"
        echo "$extracted_json"
        return 0
      fi
    fi
    
    rm -f "$temp_response"
  fi
  
  # Method 4: As a last resort, manually parse the response for structured data
  if echo "$ollama_response" | grep -q "hasSensitiveData.*true"; then
    # Found indication of sensitive data, construct a basic JSON response
    local has_sensitive_line
    has_sensitive_line=$(echo "$ollama_response" | grep -o -m 1 '"line":[^,]*' | head -1)
    local has_sensitive_type
    has_sensitive_type=$(echo "$ollama_response" | grep -o -m 1 '"type":[^,]*' | head -1)
    local has_sensitive_suggestion
    has_sensitive_suggestion=$(echo "$ollama_response" | grep -o -m 1 '"suggestion":[^,}]*' | head -1)
    
    # Construct minimal valid JSON using found components or defaults
    echo "{\"hasSensitiveData\": true, \"issues\": [{${has_sensitive_line:-\"line\": \"Found sensitive data\"},${has_sensitive_type:-\"type\": \"Unknown\"},${has_sensitive_suggestion:-\"suggestion\": \"Review manually\"}}]}"
    return 0
  elif echo "$ollama_response" | grep -q "hasSensitiveData.*false"; then
    # No sensitive data found
    echo '{"hasSensitiveData": false}'
    return 0
  fi
  
  # If all else fails, return an error JSON
  echo '{"hasSensitiveData": true, "issues": [{"type": "OllamaParsingError", "line": "N/A", "suggestion": "Could not parse valid JSON from response. Check Ollama model output."}]}'
  return 0
}

# Get staged changes
get_staged_changes() {
  # Create temporary file for the JSON output only
  local json_output
  json_output=$(mktemp)
  echo -n "[]" > "$json_output"  # Initialize with empty array

  # Get list of staged files
  staged_files=$(git diff --staged --name-only 2>/dev/null)
  staged_file_count=$(echo "$staged_files" | wc -l)
  # Uncomment for debugging
  # echo -e "${BLUE}DEBUG: Found $staged_file_count staged files${NC}" >&2

  if [ -z "$staged_files" ]; then
    cat "$json_output"  # Return empty array
    rm -f "$json_output"
    return 0
  fi

  # Process each file individually
  while IFS= read -r file; do
    # Skip if file is empty (can happen with trailing newlines)
    [ -z "$file" ] && continue

    # Uncomment for debugging
    # echo -e "${BLUE}Processing file: $file${NC}" >&2

    # Skip excluded files
    if should_exclude_file "$file"; then
      continue
    fi

    # Get file content
    local content
    content=$(git show ":$file" 2>/dev/null)
    if [ $? -ne 0 ]; then
      echo -e "${YELLOW}Couldn't read content for $file${NC}" >&2
      continue
    fi

    # Create JSON for this file
    local file_json
    file_json=$(jq -n --arg path "$file" --arg cont "$content" '{"filePath": $path, "content": $cont}')

    # Add to array
    local updated_json
    updated_json=$(jq --argjson new_obj "$file_json" '. += [$new_obj]' "$json_output")
    echo "$updated_json" > "$json_output"

    # Uncomment for debugging
    # echo -e "${BLUE}Added $file to analysis queue${NC}" >&2
  done <<< "$staged_files"

  # Return the final JSON
  cat "$json_output"
  rm -f "$json_output"
  return 0
}

# Process a single file for security issues and log them to a temp file
process_single_file_and_log_issues() {
  local file_path="$1"
  local content="$2"
  local temp_issues_file="$3" # Parameter index shifted
  local result
  local file_had_issues=false

  # Always call Ollama, regex fallback is removed
  result=$(check_with_ollama "$content" "$file_path")

  # Uncomment for debugging
  # echo -e "${BLUE}DEBUG: Ollama result for $file_path: $result${NC}" >&2

  local has_sensitive_data
  has_sensitive_data=$(echo "$result" | jq -r '.hasSensitiveData' 2>/dev/null || echo "false")

  if [ "$has_sensitive_data" = "true" ]; then
    file_had_issues=true
    # Extract issues array, then process each issue object if the array exists and is not empty
    local issues_array_json
    issues_array_json=$(echo "$result" | jq -c '.issues[]?' 2>/dev/null) # -c for compact, one issue object per line if array has items
    
    if [ -n "$issues_array_json" ]; then
      echo "$issues_array_json" | while IFS= read -r issue_json_line; do
        if [ -n "$issue_json_line" ] && [ "$issue_json_line" != "null" ]; then
          # Add filePath to the issue object
          local issue_with_file
          issue_with_file=$(echo "$issue_json_line" | jq '. + {"filePath": "'"$file_path"'"}' 2>/dev/null)
          if [ -n "$issue_with_file" ] && [ "$issue_with_file" != "null" ]; then
            echo "$issue_with_file" >> "$temp_issues_file"
          fi
        fi
      done
    fi
  fi
  
  if [ "$file_had_issues" = true ]; then
    return 0 # Bash success (true indicates issues found)
  else
    return 1 # Bash failure (false indicates no issues found for this file)
  fi
}

# Main function
main() {
  if ! command -v jq &> /dev/null; then
    echo -e "${RED}Error: This script requires jq to be installed.${NC}" && exit 1
  fi

  load_exclusion_patterns

  # Check Ollama availability. If not available, block commit immediately.
  if ! check_ollama_available; then
    echo -e "${RED}Ollama is not available. This hook requires Ollama to function.${NC}"
    echo -e "${YELLOW}Please ensure Ollama is running and accessible.${NC}"
    exit 1 # Block commit
  fi

  local TEMP_ISSUES_FILE
  TEMP_ISSUES_FILE=$(mktemp)
  if [ $? -ne 0 ] || [ -z "$TEMP_ISSUES_FILE" ]; then
    echo -e "${RED}Error: Could not create temporary file. Exiting.${NC}"
    exit 1
  fi
  # Ensure the temp file is removed on exit, regardless of how the script exits
  trap 'rm -f "$TEMP_ISSUES_FILE"' EXIT

  local overall_has_issues_flag=false

  # Make sure we get clean output
  local temp_json_output
  temp_json_output=$(mktemp)

  # Run get_staged_changes but redirect stderr to prevent debug output from contaminating JSON
  get_staged_changes > "$temp_json_output" 2>/dev/null

  local staged_files_json
  staged_files_json=$(cat "$temp_json_output")
  rm -f "$temp_json_output"

  # Uncomment for debugging
  # echo -e "${BLUE}DEBUG: Raw JSON output: $staged_files_json${NC}" >&2
  
  # Verify we got valid JSON
  if ! echo "$staged_files_json" | jq empty >/dev/null 2>&1; then
    echo -e "${RED}Error: Invalid JSON received from get_staged_changes. Exiting.${NC}"
    exit 1
  fi

  # Verify the JSON is an array
  local json_type
  json_type=$(echo "$staged_files_json" | jq -r 'type' 2>/dev/null || echo "invalid")
  if [ "$json_type" != "array" ]; then
    echo -e "${RED}Warning: Received JSON is not an array. Creating empty array.${NC}"
    staged_files_json="[]"
  fi
  
  local num_files
  num_files=$(echo "$staged_files_json" | jq '. | length' 2>/dev/null || echo "0")
  
  if [ "$num_files" -eq 0 ]; then
    echo -e "${GREEN}No files to scan. Commit allowed.${NC}"
    exit 0
  fi
  
  # Track processed file paths to avoid duplicates
  local processed_paths=()
  
  # Process each file in the JSON array
  for (( i=0; i<$num_files; i++ )); do
    local file_path content
    file_path=$(echo "$staged_files_json" | jq -r ".[$i].filePath" 2>/dev/null)
    
    # Skip file if path is invalid
    if [ -z "$file_path" ] || [ "$file_path" = "null" ]; then
      continue
    fi
    
    # Skip if we've already processed this file
    if [[ " ${processed_paths[*]} " == *" $file_path "* ]]; then
      continue
    fi
    
    content=$(echo "$staged_files_json" | jq -r ".[$i].content" 2>/dev/null)
    
    # Handle null content
    if [ "$content" = "null" ]; then
      content=$(git show ":$file_path" 2>/dev/null)
      
      if [ $? -ne 0 ]; then
        continue
      fi
    fi
    
    # Add to processed paths list
    processed_paths+=("$file_path")
    
    echo -e "${BLUE}Scanning file with Ollama: $file_path${NC}"
    if process_single_file_and_log_issues "$file_path" "$content" "$TEMP_ISSUES_FILE"; then
      overall_has_issues_flag=true
    fi
  done

  if [ "$overall_has_issues_flag" = true ]; then
    echo -e "${RED}Security issues found! Commit blocked.${NC}\\n"
    local all_issues_list_final
    all_issues_list_final=$(jq -s '.' < "$TEMP_ISSUES_FILE")
    
    local num_total_issues_final
    num_total_issues_final=$(echo "$all_issues_list_final" | jq '. | length' 2>/dev/null || echo 0)

    if ! [[ "$num_total_issues_final" =~ ^[0-9]+$ ]] || [ "$num_total_issues_final" -eq 0 ]; then
        echo -e "${YELLOW}Overall issues flag was true, but no issues were collected in the temp file or temp file empty/invalid. Please review logs.${NC}"
        exit 1 # Exit with error as issues were expected
    fi

    echo -e "${BLUE}Total issues found: $num_total_issues_final${NC}"
    for (( k=0; k<$num_total_issues_final; k++ )); do
        local issue_obj_json
        issue_obj_json=$(echo "$all_issues_list_final" | jq ".[$k]")
        
        local report_file_path issue_type line suggestion
        report_file_path=$(echo "$issue_obj_json" | jq -r '.filePath' 2>/dev/null || echo "unknown file")
        issue_type=$(echo "$issue_obj_json" | jq -r '.type' 2>/dev/null || echo "Unknown issue")
        line=$(echo "$issue_obj_json" | jq -r '.line' 2>/dev/null || echo "Could not extract affected line")
        suggestion=$(echo "$issue_obj_json" | jq -r '.suggestion // "Move sensitive data to a .env file and add it to .gitignore."' 2>/dev/null || echo "Review manually.")
        
        echo -e "${YELLOW}File: $report_file_path${NC}"
        echo -e "  ${RED}Issue: $issue_type${NC}"
        echo -e "  ${BLUE}Line: $line${NC}"
        echo -e "  ${GREEN}Suggestion: $suggestion${NC}"
        echo ""
    done
    echo -e "${BLUE}For more information, consult your security team or documentation.${NC}"
    exit 1
  else
    echo -e "${GREEN}No security issues found. Commit allowed.${NC}"
    exit 0
  fi
}

main
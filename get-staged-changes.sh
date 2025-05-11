#!/bin/bash

# Test script to see staged changes
# Get staged changes
get_staged_changes() {
  # Get list of staged files
  local staged_files=($(git diff --staged --name-only 2>/dev/null))
  echo "DEBUG: Found ${#staged_files[@]} staged files"
  
  if [ ${#staged_files[@]} -eq 0 ]; then
    echo "[]" # Output empty JSON array
    return 0
  fi
  
  # Create array for storing results
  local files_array="[]"
  
  # Process each file individually
  for file in "${staged_files[@]}"; do
    echo "Processing file: $file"
    
    # Get file content
    local content
    content=$(git show ":$file" 2>/dev/null)
    if [ $? -ne 0 ]; then
      echo "Couldn't read content for $file"
      continue
    fi
    
    # Create JSON object and append to array
    local file_json
    file_json=$(jq -n --arg path "$file" --arg cont "$content" '{"filePath": $path, "content": $cont}')
    files_array=$(echo "$files_array" | jq --argjson obj "$file_json" '. + [$obj]')
    echo "Added $file to analysis queue"
  done
  
  # Debug the output
  echo "DEBUG: JSON contains $(echo "$files_array" | jq length) files"
  
  # Output the final JSON array
  echo "$files_array"
  return 0
}

# Run the function to get JSON data of staged files
files_json=$(get_staged_changes)

# Display the JSON
echo "JSON output:"
echo "$files_json"

# Extract the first file's content for testing with Ollama
length=$(echo "$files_json" | jq 'length' 2>/dev/null || echo "0")
if [ "$length" -gt 0 ]; then
  file_path=$(echo "$files_json" | jq -r '.[0].filePath')
  content=$(echo "$files_json" | jq -r '.[0].content')

  echo "Testing Ollama with file: $file_path"

  # Create the prompt
  prompt="TASK: Check if this code contains sensitive information (passwords, API keys, tokens, etc.)

OUTPUT RULES:
- Response must be valid JSON only
- No explanations, no text, no markdown
- ONLY return one of the two JSON formats shown below

EXAMPLE RESPONSE FOR CLEAN CODE:
{\"hasSensitiveData\": false}

EXAMPLE RESPONSE FOR PROBLEMATIC CODE:
{\"hasSensitiveData\": true, \"issues\": [{\"line\": \"const apiKey = '1234abcd'\", \"type\": \"API Key\", \"suggestion\": \"Store in environment variable\"}]}

CODE TO ANALYZE FROM FILE $file_path:
$content"

  # Create request payload
  request_payload=$(jq -n --arg model "llama3.2:3b" --arg prompt "$prompt" '{"model": $model, "prompt": $prompt, "stream": false}')

  # Save to temp file
  temp_request=$(mktemp)
  echo "$request_payload" > "$temp_request"

  # Call Ollama
  echo "Sending request to Ollama..."
  response=$(curl -s -X POST "http://localhost:11434/api/generate" \
    -H "Content-Type: application/json" \
    -d @"$temp_request")

  # Extract response
  ollama_response=$(echo "$response" | jq -r '.response')

  echo "Ollama response:"
  echo "$ollama_response"
fi
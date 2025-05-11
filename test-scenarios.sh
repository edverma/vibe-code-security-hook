#!/bin/bash

# Script to test the security hook with different scenarios across all models
# Author: Claude

# ANSI color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;36m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Function to display usage
usage() {
  echo "Usage: $0 [options]"
  echo "Options:"
  echo "  -h, --help                Show this help message"
  echo "  -c, --clean               Clean up all test files before running"
  echo "  -s, --scenario SCENARIO   Test a single scenario (1-6)"
  echo "  -m, --model MODEL         Test with a specific model"
  echo "  -v, --verbose             Show full output from security checks"
  echo "  -n, --no-color            Disable colored output"
  echo ""
  echo "Scenarios:"
  echo "  1 - Hardcoded API key (should fail)"
  echo "  2 - Environment variable (should pass)"
  echo "  3 - No sensitive data (should pass)"
  echo "  4 - Mixed practices (should fail)"
  echo "  5 - Commented sensitive data (should fail)"
  echo "  6 - Safe database connection (should pass)"
  exit 0
}

# Function to check if a file exists in git staging
is_file_staged() {
  local file="$1"
  git diff --name-only --staged | grep -q "^$file$"
  return $?
}

# Function to unstage a file if it's staged
unstage_if_staged() {
  local file="$1"
  if is_file_staged "$file"; then
    git restore --staged "$file" &>/dev/null
    echo -e "  ${BLUE}Unstaged: $file${NC}"
  fi
}

# Function to clean all test files from git staging
clean_staged_files() {
  echo -e "${BLUE}Cleaning staged test files...${NC}"
  
  # Unstage all test scenarios
  for i in {1..6}; do
    unstage_if_staged "test/scenario$i-*.js"
  done
  
  # Unstage sensitive data file
  unstage_if_staged "sensitive-data.js"
  
  echo -e "${GREEN}All test files have been unstaged.${NC}"
}

# Function to get all available models from Ollama
get_ollama_models() {
  curl -s "http://localhost:11434/api/tags" | jq -r '.models[].name' | sort
}

# Function to create a temporary copy of check-security.sh with specified model
create_temp_security_script() {
  local model="$1"
  local temp_script="$SCRIPT_DIR/check-security-temp.sh"
  
  # Create a copy of the security script
  cp "$SCRIPT_DIR/check-security.sh" "$temp_script"
  
  # Replace the model in the request_payload
  sed -i.bak "s/model\": \"[^\"]*\"/model\": \"$model\"/" "$temp_script"
  
  # Make the script executable
  chmod +x "$temp_script"
  
  # Return the path to the temporary script
  echo "$temp_script"
}

# Function to run a test for a specific scenario with a specific model
run_test() {
  local scenario="$1"
  local expected_result="$2"
  local file_path="$3"
  local description="$4"
  local model="$5"
  local temp_script="$6"
  
  # Make sure file isn't staged from previous tests
  unstage_if_staged "$file_path"
  
  # Stage the file
  git add "$file_path" &>/dev/null
  if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to stage file: $file_path${NC}"
    return 1
  fi
  
  # Run the security hook
  if [ "$VERBOSE" = true ]; then
    "$temp_script"
    RESULT=$?
  else
    RESULT=$("$temp_script" >/dev/null 2>&1; echo $?)
  fi
  
  # Check if the result matches expected
  if [ "$expected_result" = "FAIL" ] && [ $RESULT -eq 1 ]; then
    # Correct detection of sensitive data
    echo -e "  ${GREEN}PASS${NC}"
    return 0  # Test passed
  elif [ "$expected_result" = "PASS" ] && [ $RESULT -eq 0 ]; then
    # Correct detection of clean file
    echo -e "  ${GREEN}PASS${NC}"
    return 0  # Test passed
  else
    if [ "$expected_result" = "FAIL" ]; then
      # Failed to detect sensitive data
      echo -e "  ${RED}FAIL (missed sensitive data)${NC}"
    else
      # False positive
      echo -e "  ${RED}FAIL (false positive)${NC}"
    fi
    return 1  # Test failed
  fi
  
  # Unstage the file after testing
  unstage_if_staged "$file_path"
}

# Function to run all scenarios for a specific model
run_model_tests() {
  local model="$1"
  local results=()
  local total_passed=0
  local temp_script
  
  echo -e "\n${PURPLE}====== Testing model: $model ======${NC}"
  
  # Create a temporary security script with this model
  temp_script=$(create_temp_security_script "$model")
  
  # Test each scenario and count successes
  echo -e "${YELLOW}Scenario 1: Hardcoded API key (should FAIL)${NC}"
  run_test "1" "FAIL" "test/scenario1-hardcoded-apikey.js" "Hardcoded API key" "$model" "$temp_script"
  [ $? -eq 0 ] && ((total_passed++)) && results[0]="PASS" || results[0]="FAIL"
  
  echo -e "${YELLOW}Scenario 2: Environment variable (should PASS)${NC}"
  run_test "2" "PASS" "test/scenario2-env-variable.js" "Environment variable" "$model" "$temp_script"
  [ $? -eq 0 ] && ((total_passed++)) && results[1]="PASS" || results[1]="FAIL"
  
  echo -e "${YELLOW}Scenario 3: No sensitive data (should PASS)${NC}"
  run_test "3" "PASS" "test/scenario3-no-sensitive-data.js" "No sensitive data" "$model" "$temp_script"
  [ $? -eq 0 ] && ((total_passed++)) && results[2]="PASS" || results[2]="FAIL"
  
  echo -e "${YELLOW}Scenario 4: Mixed practices (should FAIL)${NC}"
  run_test "4" "FAIL" "test/scenario4-mixed-practices.js" "Mixed practices" "$model" "$temp_script"
  [ $? -eq 0 ] && ((total_passed++)) && results[3]="PASS" || results[3]="FAIL"
  
  echo -e "${YELLOW}Scenario 5: Commented sensitive data (should FAIL)${NC}"
  run_test "5" "FAIL" "test/scenario5-commented-sensitive.js" "Commented sensitive data" "$model" "$temp_script"
  [ $? -eq 0 ] && ((total_passed++)) && results[4]="PASS" || results[4]="FAIL"
  
  echo -e "${YELLOW}Scenario 6: Safe database connection (should PASS)${NC}"
  run_test "6" "PASS" "test/scenario6-safe-connection.js" "Safe database connection" "$model" "$temp_script"
  [ $? -eq 0 ] && ((total_passed++)) && results[5]="PASS" || results[5]="FAIL"
  
  # Clean up temporary script
  rm -f "$temp_script" "$temp_script.bak"
  
  # Calculate pass rate
  local pass_percentage=$((total_passed * 100 / 6))
  
  # Output summary
  echo -e "\n${CYAN}Summary for $model:${NC}"
  echo -e "  Scenario 1 (Hardcoded API): ${results[0]}"
  echo -e "  Scenario 2 (Env Variable): ${results[1]}"
  echo -e "  Scenario 3 (Clean Code): ${results[2]}"
  echo -e "  Scenario 4 (Mixed Practices): ${results[3]}"
  echo -e "  Scenario 5 (Commented Credentials): ${results[4]}"
  echo -e "  Scenario 6 (Safe DB Connection): ${results[5]}"
  echo -e "  ${CYAN}Pass rate: $total_passed/6 ($pass_percentage%)${NC}\n"
  
  # Add to the overall results
  echo "$model,$total_passed,$pass_percentage" >> "$RESULTS_FILE"
}

# Function to run all tests for all models
run_all_model_tests() {
  # First create a backup of the current .security-exclude file if it exists
  if [ -f "$SCRIPT_DIR/.security-exclude" ]; then
    cp "$SCRIPT_DIR/.security-exclude" "$SCRIPT_DIR/.security-exclude.bak"
    echo -e "${BLUE}Backed up .security-exclude to .security-exclude.bak${NC}"
  fi
  
  # Create a temporary .security-exclude file that doesn't exclude our test files
  cat > "$SCRIPT_DIR/.security-exclude" << 'EOF'
# Custom security exclude file for testing
# Exclude specific patterns

# Documentation files
*.md
*.txt
docs/*
documentation/*

# Example files
examples/*
sample/*

# Build files
dist/*
build/*

# Log files
*.log
EOF
  
  echo -e "${BLUE}Created temporary .security-exclude file for testing${NC}"
  
  # Get all available models
  local models=$(get_ollama_models)
  
  if [ -z "$models" ]; then
    echo -e "${RED}Error: No models found in Ollama.${NC}"
    echo -e "${YELLOW}Please pull at least one model in Ollama before running tests.${NC}"
    exit 1
  fi
  
  # Create the results file with a header
  RESULTS_FILE=$(mktemp)
  echo "model,tests_passed,pass_percentage" > "$RESULTS_FILE"
  
  # Run tests for each model
  for model in $models; do
    run_model_tests "$model"
    # Give Ollama a moment to cool down between models
    sleep 1
  done
  
  # Generate a report
  generate_report "$RESULTS_FILE"
  
  # Restore the original .security-exclude file if it existed
  if [ -f "$SCRIPT_DIR/.security-exclude.bak" ]; then
    mv "$SCRIPT_DIR/.security-exclude.bak" "$SCRIPT_DIR/.security-exclude"
    echo -e "${BLUE}Restored original .security-exclude file${NC}"
  fi
  
  # Clean up
  rm -f "$RESULTS_FILE"
}

# Function to generate a summary report
generate_report() {
  local results_file="$1"
  
  echo -e "\n${PURPLE}==================================================${NC}"
  echo -e "${PURPLE}           OVERALL SECURITY TEST RESULTS            ${NC}"
  echo -e "${PURPLE}==================================================${NC}"
  
  # Sort by pass percentage (highest first)
  echo -e "\n${CYAN}Models Ranked by Pass Rate:${NC}"
  echo -e "${BLUE}--------------------------------------------${NC}"
  echo -e "${BLUE}Model                  | Passed | Percentage${NC}"
  echo -e "${BLUE}--------------------------------------------${NC}"
  
  # Skip header and sort by pass percentage (column 3) in descending order
  (tail -n +2 "$results_file" | sort -t, -k3,3nr -k2,2nr) | while IFS=, read -r model passed percentage; do
    # Add padding for model name
    printf "${CYAN}%-24s${NC} | ${CYAN}%6s${NC} | ${CYAN}%10s%%${NC}\n" "$model" "$passed/6" "$percentage"
  done
  
  echo -e "${BLUE}--------------------------------------------${NC}"
  
  # Analysis and recommendations
  echo -e "\n${PURPLE}Analysis and Recommendations:${NC}"
  
  # Get best model (first line after sorting)
  best_model=$(tail -n +2 "$results_file" | sort -t, -k3,3nr -k2,2nr | head -1)
  best_model_name=$(echo "$best_model" | cut -d, -f1)
  best_model_score=$(echo "$best_model" | cut -d, -f2)
  best_model_percentage=$(echo "$best_model" | cut -d, -f3)
  
  # Get worst model (last line after sorting)
  worst_model=$(tail -n +2 "$results_file" | sort -t, -k3,3nr -k2,2nr | tail -1)
  worst_model_name=$(echo "$worst_model" | cut -d, -f1)
  worst_model_score=$(echo "$worst_model" | cut -d, -f2)
  worst_model_percentage=$(echo "$worst_model" | cut -d, -f3)
  
  echo -e "• Best performing model: ${GREEN}$best_model_name${NC} with $best_model_score/6 tests passed ($best_model_percentage%)"
  echo -e "• Worst performing model: ${RED}$worst_model_name${NC} with $worst_model_score/6 tests passed ($worst_model_percentage%)"
  
  # Overall assessment
  if [ "$best_model_percentage" -eq 100 ]; then
    echo -e "• ${GREEN}Recommendation: Use $best_model_name for optimal security detection${NC}"
  elif [ "$best_model_percentage" -ge 80 ]; then
    echo -e "• ${YELLOW}Recommendation: $best_model_name performs well but may miss some cases${NC}"
  else
    echo -e "• ${RED}Warning: No tested model exceeded 80% accuracy. Consider using a more capable model.${NC}"
  fi
  
  echo -e "\n${PURPLE}==================================================${NC}"
}

# Function to run a single model for all scenarios
run_single_model_tests() {
  local model="$1"
  
  # First create a backup of the current .security-exclude file if it exists
  if [ -f "$SCRIPT_DIR/.security-exclude" ]; then
    cp "$SCRIPT_DIR/.security-exclude" "$SCRIPT_DIR/.security-exclude.bak"
    echo -e "${BLUE}Backed up .security-exclude to .security-exclude.bak${NC}"
  fi
  
  # Create a temporary .security-exclude file that doesn't exclude our test files
  cat > "$SCRIPT_DIR/.security-exclude" << 'EOF'
# Custom security exclude file for testing
# Exclude specific patterns

# Documentation files
*.md
*.txt
docs/*
documentation/*

# Example files
examples/*
sample/*

# Build files
dist/*
build/*

# Log files
*.log
EOF
  
  echo -e "${BLUE}Created temporary .security-exclude file for testing${NC}"
  
  # Create the results file with a header
  RESULTS_FILE=$(mktemp)
  echo "model,tests_passed,pass_percentage" > "$RESULTS_FILE"
  
  # Run tests for the specified model
  run_model_tests "$model"
  
  # Generate a report
  generate_report "$RESULTS_FILE"
  
  # Restore the original .security-exclude file if it existed
  if [ -f "$SCRIPT_DIR/.security-exclude.bak" ]; then
    mv "$SCRIPT_DIR/.security-exclude.bak" "$SCRIPT_DIR/.security-exclude"
    echo -e "${BLUE}Restored original .security-exclude file${NC}"
  fi
  
  # Clean up
  rm -f "$RESULTS_FILE"
}

# Function to run a specific scenario for all models
run_scenario_tests() {
  local scenario="$1"
  local scenario_num=$scenario
  local file_path=""
  local description=""
  local expected_result=""
  
  # Set the appropriate values based on the scenario
  case $scenario_num in
    1)
      file_path="test/scenario1-hardcoded-apikey.js"
      description="Hardcoded API key"
      expected_result="FAIL"
      ;;
    2)
      file_path="test/scenario2-env-variable.js"
      description="Environment variable"
      expected_result="PASS"
      ;;
    3)
      file_path="test/scenario3-no-sensitive-data.js"
      description="No sensitive data"
      expected_result="PASS"
      ;;
    4)
      file_path="test/scenario4-mixed-practices.js"
      description="Mixed practices"
      expected_result="FAIL"
      ;;
    5)
      file_path="test/scenario5-commented-sensitive.js"
      description="Commented sensitive data"
      expected_result="FAIL"
      ;;
    6)
      file_path="test/scenario6-safe-connection.js"
      description="Safe database connection"
      expected_result="PASS"
      ;;
    *)
      echo -e "${RED}Error: Invalid scenario number: $scenario_num${NC}"
      exit 1
      ;;
  esac
  
  # First create a backup of the current .security-exclude file if it exists
  if [ -f "$SCRIPT_DIR/.security-exclude" ]; then
    cp "$SCRIPT_DIR/.security-exclude" "$SCRIPT_DIR/.security-exclude.bak"
    echo -e "${BLUE}Backed up .security-exclude to .security-exclude.bak${NC}"
  fi
  
  # Create a temporary .security-exclude file that doesn't exclude our test files
  cat > "$SCRIPT_DIR/.security-exclude" << 'EOF'
# Custom security exclude file for testing
# Exclude specific patterns

# Documentation files
*.md
*.txt
docs/*
documentation/*

# Example files
examples/*
sample/*

# Build files
dist/*
build/*

# Log files
*.log
EOF
  
  echo -e "${BLUE}Created temporary .security-exclude file for testing${NC}"
  echo -e "\n${PURPLE}====== Testing Scenario $scenario_num: $description (should $expected_result) ======${NC}"
  
  # Create the results file with a header
  RESULTS_FILE=$(mktemp)
  echo "model,result" > "$RESULTS_FILE"
  
  # Get all available models
  local models=$(get_ollama_models)
  
  if [ -z "$models" ]; then
    echo -e "${RED}Error: No models found in Ollama.${NC}"
    echo -e "${YELLOW}Please pull at least one model in Ollama before running tests.${NC}"
    exit 1
  fi
  
  # Test each model with this scenario
  for model in $models; do
    echo -e "\n${YELLOW}Testing model: $model${NC}"
    
    # Create a temporary security script with this model
    temp_script=$(create_temp_security_script "$model")
    
    # Run the test and collect the result
    run_test "$scenario_num" "$expected_result" "$file_path" "$description" "$model" "$temp_script"
    test_result=$?
    
    # Add to results
    if [ $test_result -eq 0 ]; then
      echo "$model,PASS" >> "$RESULTS_FILE"
    else
      echo "$model,FAIL" >> "$RESULTS_FILE"
    fi
    
    # Clean up temporary script
    rm -f "$temp_script" "$temp_script.bak"
    
    # Give Ollama a moment to cool down between models
    sleep 1
  done
  
  # Generate a summary
  echo -e "\n${CYAN}Summary for Scenario $scenario_num:${NC}"
  echo -e "${BLUE}---------------------------${NC}"
  echo -e "${BLUE}Model                  | Result${NC}"
  echo -e "${BLUE}---------------------------${NC}"
  
  # Skip header and parse results
  passed=0
  total=0
  (tail -n +2 "$RESULTS_FILE") | while IFS=, read -r model result; do
    if [ "$result" = "PASS" ]; then
      printf "${CYAN}%-24s${NC} | ${GREEN}PASS${NC}\n" "$model"
      ((passed++))
    else
      printf "${CYAN}%-24s${NC} | ${RED}FAIL${NC}\n" "$model"
    fi
    ((total++))
  done
  
  # Calculate pass percentage
  local pass_percentage=0
  if [ $total -gt 0 ]; then
    pass_percentage=$((passed * 100 / total))
  fi
  
  echo -e "${BLUE}---------------------------${NC}"
  echo -e "${CYAN}Pass rate: $passed/$total ($pass_percentage%)${NC}"
  
  # Restore the original .security-exclude file if it existed
  if [ -f "$SCRIPT_DIR/.security-exclude.bak" ]; then
    mv "$SCRIPT_DIR/.security-exclude.bak" "$SCRIPT_DIR/.security-exclude"
    echo -e "${BLUE}Restored original .security-exclude file${NC}"
  fi
  
  # Clean up
  rm -f "$RESULTS_FILE"
}

# Default options
CLEAN=false
SINGLE_SCENARIO=""
SPECIFIC_MODEL=""
VERBOSE=false
COLOR=true

# Parse command line arguments
while [[ "$#" -gt 0 ]]; do
  case $1 in
    -h|--help) usage ;;
    -c|--clean) CLEAN=true; shift ;;
    -s|--scenario) 
      SINGLE_SCENARIO="$2"
      if ! [[ "$SINGLE_SCENARIO" =~ ^[1-6]$ ]]; then
        echo "Error: Invalid scenario number. Must be between 1 and 6."
        exit 1
      fi
      shift 2 
      ;;
    -m|--model)
      SPECIFIC_MODEL="$2"
      shift 2
      ;;
    -v|--verbose) VERBOSE=true; shift ;;
    -n|--no-color) 
      COLOR=false
      # Remove ANSI color codes
      RED=''
      GREEN=''
      YELLOW=''
      BLUE=''
      PURPLE=''
      CYAN=''
      NC=''
      shift 
      ;;
    *) echo "Unknown option: $1"; usage ;;
  esac
done

# Check if Ollama is available
if ! curl -s --max-time 1 "http://localhost:11434/api/tags" > /dev/null 2>&1; then
  echo -e "${RED}Error: Ollama is not available.${NC}"
  echo -e "${YELLOW}Please ensure Ollama is running and accessible before running tests.${NC}"
  exit 1
fi

# Display welcome message
echo -e "${PURPLE}=====================================${NC}"
echo -e "${PURPLE}    Security Hook Model Benchmark    ${NC}"
echo -e "${PURPLE}=====================================${NC}"

# Clean staged files if requested
if [ "$CLEAN" = true ]; then
  clean_staged_files
fi

# Run tests based on arguments
if [ -n "$SINGLE_SCENARIO" ] && [ -n "$SPECIFIC_MODEL" ]; then
  # Test a specific scenario with a specific model
  echo -e "${BLUE}Testing scenario $SINGLE_SCENARIO with model $SPECIFIC_MODEL${NC}"
  
  # Set the appropriate values based on the scenario
  case $SINGLE_SCENARIO in
    1)
      file_path="test/scenario1-hardcoded-apikey.js"
      description="Hardcoded API key"
      expected_result="FAIL"
      ;;
    2)
      file_path="test/scenario2-env-variable.js"
      description="Environment variable"
      expected_result="PASS"
      ;;
    3)
      file_path="test/scenario3-no-sensitive-data.js"
      description="No sensitive data"
      expected_result="PASS"
      ;;
    4)
      file_path="test/scenario4-mixed-practices.js"
      description="Mixed practices"
      expected_result="FAIL"
      ;;
    5)
      file_path="test/scenario5-commented-sensitive.js"
      description="Commented sensitive data"
      expected_result="FAIL"
      ;;
    6)
      file_path="test/scenario6-safe-connection.js"
      description="Safe database connection"
      expected_result="PASS"
      ;;
  esac
  
  temp_script=$(create_temp_security_script "$SPECIFIC_MODEL")
  run_test "$SINGLE_SCENARIO" "$expected_result" "$file_path" "$description" "$SPECIFIC_MODEL" "$temp_script"
  rm -f "$temp_script" "$temp_script.bak"
  
elif [ -n "$SINGLE_SCENARIO" ]; then
  # Test a specific scenario with all models
  run_scenario_tests "$SINGLE_SCENARIO"
  
elif [ -n "$SPECIFIC_MODEL" ]; then
  # Test all scenarios with a specific model
  run_single_model_tests "$SPECIFIC_MODEL"
  
else
  # Run all tests for all models
  run_all_model_tests
fi

echo -e "\n${GREEN}All tests completed!${NC}"
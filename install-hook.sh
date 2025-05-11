#!/bin/bash

# Make sure our security checker is executable
chmod +x check-security.sh

# Create the Git hooks directory if it doesn't exist
mkdir -p .git/hooks

# Copy our script to the pre-commit hook location
cp check-security.sh .git/hooks/pre-commit

echo "Security pre-commit hook installed successfully!"
echo "The hook will run automatically on every commit to check for security issues." 
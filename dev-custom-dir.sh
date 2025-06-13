#!/bin/bash

# Development script for Crystal with custom directory support
# Usage: ./dev-custom-dir.sh [path-to-custom-directory]

# Check if a custom directory was provided
if [ -n "$1" ]; then
    echo "Using custom Crystal directory: $1"
    export CRYSTAL_DIR="$1"
    
    # Run with command-line argument
    concurrently "pnpm run --filter frontend dev" "wait-on http://localhost:4521 && electron . --crystal-dir=$1"
else
    # Run normally without custom directory
    pnpm electron-dev
fi
#!/bin/bash

# Test auto-update locally
# Usage: ./test-auto-update.sh

echo "🧪 Crystal Auto-Update Test Script"
echo "================================="

# Check if http-server is installed
if ! command -v http-server &> /dev/null; then
    echo "❌ http-server is not installed"
    echo "📦 Installing http-server..."
    npm install -g http-server
fi

# Create test directory
TEST_DIR="$HOME/crystal-test-updates"
mkdir -p "$TEST_DIR"

# Get current version from package.json
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo "📌 Current version: $CURRENT_VERSION"

# Prompt for new version
echo "📝 Enter new test version (e.g., 0.2.0):"
read NEW_VERSION

# Update version in package.json temporarily
echo "🔄 Updating version to $NEW_VERSION..."
cp package.json package.json.backup
node -e "const p = require('./package.json'); p.version = '$NEW_VERSION'; require('fs').writeFileSync('./package.json', JSON.stringify(p, null, 2));"

# Build the app
echo "🔨 Building Crystal v$NEW_VERSION..."
pnpm build:mac

# Copy artifacts to test directory
echo "📋 Copying build artifacts..."
cp dist-electron/*.dmg "$TEST_DIR/"
cp dist-electron/*.zip "$TEST_DIR/"
cp dist-electron/latest-mac.yml "$TEST_DIR/"

# Restore original package.json
mv package.json.backup package.json

# Start local server
echo "🌐 Starting local update server..."
echo "📁 Serving files from: $TEST_DIR"
echo ""
echo "✅ Server running at: http://localhost:8080"
echo ""
echo "To test the update:"
echo "1. Make sure you have Crystal $CURRENT_VERSION installed"
echo "2. Run: TEST_UPDATES=true UPDATE_SERVER_URL=http://localhost:8080 open /Applications/Crystal.app"
echo "3. Check for updates in the app"
echo ""
echo "Press Ctrl+C to stop the server"

cd "$TEST_DIR"
http-server -p 8080 --cors
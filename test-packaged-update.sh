#!/bin/bash

# Test script to verify auto-update works in packaged app
# This builds a test version and runs it to check update functionality

echo "🧪 Testing Auto-Update in Packaged App"
echo "======================================"

# Check if we have a packaged app
if [ -d "dist-electron/mac/Crystal.app" ]; then
    echo "✅ Found packaged app at dist-electron/mac/Crystal.app"
    echo ""
    echo "📋 Steps to test auto-update:"
    echo "1. Open the packaged app: open dist-electron/mac/Crystal.app"
    echo "2. Go to Settings and click 'Check for Updates'"
    echo "3. You should see the Update Dialog with a 'Download Update' button"
    echo "4. Check the DevTools console for debug messages:"
    echo "   - [UpdateDialog] App packaged state: true"
    echo "   - [UpdateDialog] Rendering update UI - isPackaged: true"
    echo ""
    echo "If you see 'View Release' instead of 'Download Update', the packaged detection failed."
    echo ""
    echo "To open DevTools in the packaged app:"
    echo "- Press Cmd+Option+I (macOS)"
    echo "- Or right-click and select 'Inspect Element'"
else
    echo "❌ No packaged app found!"
    echo ""
    echo "First, build the app with:"
    echo "  pnpm build:mac"
    echo ""
    echo "Then run this script again."
fi

echo ""
echo "💡 Note: If testing with version 0.1.0, you'll get a 404 error"
echo "   when trying to download because the release artifacts don't exist."
echo "   This is expected for test versions."
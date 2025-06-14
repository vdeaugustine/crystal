# Testing Auto-Updates Locally

This guide explains how to test Crystal's auto-update functionality without publishing a real release.

## Method 1: Local Update Server (Recommended)

This method uses a local server to simulate GitHub releases.

### 1. Install a Local Server

```bash
# Install globally
npm install -g http-server

# Or use Python (if you have it)
# python3 -m http.server 8080
```

### 2. Create Test Update Files

Create a test directory structure:

```bash
mkdir -p ~/crystal-test-updates
cd ~/crystal-test-updates
```

### 3. Build a Test Release

```bash
# In your Crystal project directory
# First, increment the version in package.json to a higher version (e.g., 0.2.0)

# Build without publishing
pnpm build:mac

# Copy the build artifacts to your test directory
cp dist-electron/*.dmg ~/crystal-test-updates/
cp dist-electron/*.zip ~/crystal-test-updates/
cp dist-electron/latest-mac.yml ~/crystal-test-updates/
```

### 4. Modify the Update URL

Create a test configuration file `main/src/test-updater.ts`:

```typescript
import { autoUpdater } from 'electron-updater';

export function setupTestUpdater() {
  // Point to local server
  autoUpdater.setFeedURL({
    provider: 'generic',
    url: 'http://localhost:8080'
  });
  
  // Disable certificate verification for testing
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
}
```

### 5. Update main/src/index.ts

```typescript
// Add this import
import { setupTestUpdater } from './test-updater';

// In setupAutoUpdater function, add:
function setupAutoUpdater() {
  if (!app.isPackaged) {
    console.log('[AutoUpdater] App is not packaged, skipping auto-updater setup');
    return;
  }

  // TEST MODE: Use local server
  if (process.env.TEST_UPDATES === 'true') {
    setupTestUpdater();
    console.log('[AutoUpdater] Using test update server');
  } else {
    // Normal production setup
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;
  }
  
  // ... rest of the function
}
```

### 6. Start the Local Server

```bash
cd ~/crystal-test-updates
http-server -p 8080 --cors
```

### 7. Test the Update

```bash
# Build and run the older version (e.g., 0.1.0)
TEST_UPDATES=true npm run electron-dev

# Or for packaged app:
TEST_UPDATES=true open /Applications/Crystal.app
```

## Method 2: Test GitHub Repository

Use a separate GitHub repository for testing releases.

### 1. Fork or Create Test Repo

Create a new repository like `your-username/crystal-test`

### 2. Update Build Configuration

Temporarily modify `package.json`:

```json
{
  "build": {
    "publish": {
      "provider": "github",
      "owner": "your-username",
      "repo": "crystal-test"
    }
  }
}
```

### 3. Build and Publish to Test Repo

```bash
# Set your GitHub token
export GH_TOKEN=your_github_token

# Build and publish
pnpm release:mac
```

### 4. Test with Modified App

Install the test build and it will check for updates from your test repository.

## Method 3: Draft Releases

Use draft releases on your main repository.

### 1. Modify Version Checker

Update `main/src/services/versionChecker.ts` to check draft releases:

```typescript
// Change this line:
if (release.prerelease || release.draft) {

// To:
if (release.prerelease) {  // Allow drafts for testing
```

### 2. Create Draft Release

```bash
# Build without publishing
pnpm build:mac

# Manually create a draft release on GitHub and upload the files
```

## Method 4: Local File URL (Quick Test)

For quick testing without a server:

### 1. Create Update Files

```bash
# Create a local directory
mkdir -p ~/test-updates

# Copy your latest-mac.yml and update files there
cp dist-electron/latest-mac.yml ~/test-updates/
cp dist-electron/*.dmg ~/test-updates/
cp dist-electron/*.zip ~/test-updates/
```

### 2. Modify latest-mac.yml

Edit `~/test-updates/latest-mac.yml` to use file URLs:

```yaml
version: 0.2.0
files:
  - url: Crystal-0.2.0-arm64.dmg
    sha512: [your-sha512]
    size: [file-size]
  - url: Crystal-0.2.0.dmg
    sha512: [your-sha512]
    size: [file-size]
path: Crystal-0.2.0-arm64.dmg
sha512: [your-sha512]
releaseDate: '2024-06-14T12:00:00.000Z'
```

### 3. Use File Protocol

```typescript
// In test-updater.ts
autoUpdater.setFeedURL({
  provider: 'generic',
  url: 'file:///Users/your-username/test-updates'
});
```

## Testing Checklist

When testing auto-updates, verify:

1. **Update Detection**
   - [ ] App detects the new version
   - [ ] Update dialog appears with correct version info

2. **Download Process**
   - [ ] Download starts when clicking "Download Update"
   - [ ] Progress bar shows download progress
   - [ ] Download completes successfully

3. **Installation**
   - [ ] "Restart and Install" button appears
   - [ ] App quits and installs update
   - [ ] New version launches successfully

4. **Error Handling**
   - [ ] Test with missing files
   - [ ] Test with network interruption
   - [ ] Verify error messages are user-friendly

5. **Data Preservation**
   - [ ] Settings are preserved after update
   - [ ] Sessions and data remain intact

## Cleanup

After testing, remember to:

1. Revert any test changes to `package.json`
2. Remove test configuration from `index.ts`
3. Delete test update files
4. Reset version number if needed

## Tips

- Use different version numbers for each test (0.2.0, 0.3.0, etc.)
- Test both Intel and Apple Silicon builds if supporting both
- Test with slow network to verify progress indicators
- Always test with a signed app for realistic results
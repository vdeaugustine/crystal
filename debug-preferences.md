# Debugging User Preferences Issue

## Issues Found

### 1. No Error Handling in Frontend
The `loadPreference` functions in both Welcome.tsx and DiscordPopup.tsx don't catch errors:

```typescript
const loadPreference = async () => {
  if (window.electron?.invoke) {
    const result = await window.electron.invoke('preferences:get', 'hide_welcome');
    setDontShowAgain(result?.data === 'true');
  }
};
```

If the IPC call fails, the error is silently ignored.

### 2. Database Migration Issue
Default preferences are only inserted when the table is first created. Existing users might not have these defaults.

### 3. Testing Steps

1. Open the Electron app in development mode
2. Open DevTools (should open automatically)
3. In the console, paste and run:

```javascript
// Test if electron API is available
console.log('window.electron:', window.electron);
console.log('window.electronAPI:', window.electronAPI);

// Test preference handlers
async function testPreferences() {
  try {
    console.log('Testing preferences:get for hide_welcome...');
    const result = await window.electron.invoke('preferences:get', 'hide_welcome');
    console.log('Result:', result);
    
    console.log('Testing preferences:get-all...');
    const allPrefs = await window.electron.invoke('preferences:get-all');
    console.log('All preferences:', allPrefs);
  } catch (error) {
    console.error('Error:', error);
  }
}

await testPreferences();
```

4. Check the main process console for any errors related to database or preferences

### 4. Quick Fixes to Try

1. **Add error handling to Welcome.tsx and DiscordPopup.tsx**
2. **Add a database migration to ensure default preferences exist**
3. **Add more logging to debug the issue**

### 5. Verify Database State

Run this SQL query on the database to check the current state:

```sql
SELECT * FROM user_preferences;
```

This will show if the preferences are properly stored in the database.
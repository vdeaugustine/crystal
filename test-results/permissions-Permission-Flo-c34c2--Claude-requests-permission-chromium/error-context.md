# Test info

- Name: Permission Flow >> should show permission dialog when Claude requests permission
- Location: /Users/jordanbentley/git/crystal/worktrees/auto-commit-toggle-1/tests/permissions.spec.ts:118:7

# Error details

```
TimeoutError: page.waitForSelector: Timeout 30000ms exceeded.
Call log:
  - waiting for locator('[data-testid="sidebar"]') to be visible

    at navigateToApp (/Users/jordanbentley/git/crystal/worktrees/auto-commit-toggle-1/tests/permissions.spec.ts:51:16)
    at /Users/jordanbentley/git/crystal/worktrees/auto-commit-toggle-1/tests/permissions.spec.ts:122:5
```

# Test source

```ts
   1 | import { test, expect } from '@playwright/test';
   2 | import { setupTestProject, cleanupTestProject } from './setup';
   3 |
   4 | test.describe('Permission Flow', () => {
   5 |   let testProjectPath: string;
   6 |   
   7 |   test.beforeAll(async () => {
   8 |     testProjectPath = await setupTestProject();
   9 |   });
   10 |   
   11 |   test.afterAll(async () => {
   12 |     await cleanupTestProject(testProjectPath);
   13 |   });
   14 |   // Helper to navigate to the app and set up a project
   15 |   async function navigateToApp(page) {
   16 |     await page.goto('/');
   17 |     // Wait for the app to load
   18 |     await page.waitForLoadState('networkidle');
   19 |     
   20 |     // Handle Welcome dialog if it appears
   21 |     const getStartedButton = page.locator('button:has-text("Get Started")');
   22 |     if (await getStartedButton.isVisible({ timeout: 2000 }).catch(() => false)) {
   23 |       await getStartedButton.click();
   24 |       // Wait for welcome dialog to close
   25 |       await page.waitForSelector('text="Welcome to Crystal"', { state: 'hidden' });
   26 |     }
   27 |     
   28 |     // Check if we need to select a project
   29 |     const selectProjectButton = page.locator('button:has-text("Select Project")');
   30 |     if (await selectProjectButton.isVisible({ timeout: 2000 }).catch(() => false)) {
   31 |       await selectProjectButton.click();
   32 |       
   33 |       // Wait for project dialog
   34 |       await page.waitForSelector('text="Select or Create Project"');
   35 |       
   36 |       // Click create new project
   37 |       await page.click('button:has-text("Create New Project")');
   38 |       
   39 |       // Fill in project details
   40 |       await page.fill('input[placeholder*="project name"]', 'Test Project');
   41 |       await page.fill('input[placeholder*="directory"]', testProjectPath);
   42 |       
   43 |       // Submit
   44 |       await page.click('button[type="submit"]:has-text("Create")');
   45 |       
   46 |       // Wait for dialog to close
   47 |       await page.waitForSelector('text="Select or Create Project"', { state: 'hidden' });
   48 |     }
   49 |     
   50 |     // Wait for the sidebar to be visible
>  51 |     await page.waitForSelector('[data-testid="sidebar"]', { timeout: 30000 });
      |                ^ TimeoutError: page.waitForSelector: Timeout 30000ms exceeded.
   52 |   }
   53 |
   54 |   // Helper to create a session with permission mode
   55 |   async function createSessionWithPermissions(page, prompt: string, permissionMode: 'approve' | 'ignore') {
   56 |     // Click create session button
   57 |     await page.click('[data-testid="create-session-button"]');
   58 |     
   59 |     // Wait for dialog
   60 |     await page.waitForSelector('[data-testid="create-session-dialog"]');
   61 |     
   62 |     // Fill in prompt
   63 |     await page.fill('textarea[id="prompt"]', prompt);
   64 |     
   65 |     // Select permission mode
   66 |     await page.click(`input[name="permissionMode"][value="${permissionMode}"]`);
   67 |     
   68 |     // Submit form
   69 |     await page.click('button[type="submit"]');
   70 |     
   71 |     // Wait for dialog to close
   72 |     await page.waitForSelector('[data-testid="create-session-dialog"]', { state: 'hidden' });
   73 |   }
   74 |
   75 |   test('should show permission mode option in create session dialog', async ({ page }) => {
   76 |     await navigateToApp(page);
   77 |     
   78 |     // Open create session dialog
   79 |     await page.click('[data-testid="create-session-button"]');
   80 |     
   81 |     // Check that permission mode options are visible
   82 |     await expect(page.locator('input[name="permissionMode"][value="ignore"]')).toBeVisible();
   83 |     await expect(page.locator('input[name="permissionMode"][value="approve"]')).toBeVisible();
   84 |     
   85 |     // Check default selection
   86 |     await expect(page.locator('input[name="permissionMode"][value="ignore"]')).toBeChecked();
   87 |   });
   88 |
   89 |   test('should show permission mode in settings', async ({ page }) => {
   90 |     await navigateToApp(page);
   91 |     
   92 |     // Open settings
   93 |     await page.click('[data-testid="settings-button"]');
   94 |     
   95 |     // Check that default permission mode options are visible
   96 |     await expect(page.locator('input[name="defaultPermissionMode"][value="ignore"]')).toBeVisible();
   97 |     await expect(page.locator('input[name="defaultPermissionMode"][value="approve"]')).toBeVisible();
   98 |   });
   99 |
  100 |   test('should create session with skip permissions mode', async ({ page }) => {
  101 |     await navigateToApp(page);
  102 |     
  103 |     await createSessionWithPermissions(page, 'Test skip permissions', 'ignore');
  104 |     
  105 |     // Verify session was created
  106 |     await expect(page.locator('text=Test skip permissions')).toBeVisible({ timeout: 10000 });
  107 |   });
  108 |
  109 |   test('should create session with approve permissions mode', async ({ page }) => {
  110 |     await navigateToApp(page);
  111 |     
  112 |     await createSessionWithPermissions(page, 'Test approve permissions', 'approve');
  113 |     
  114 |     // Verify session was created
  115 |     await expect(page.locator('text=Test approve permissions')).toBeVisible({ timeout: 10000 });
  116 |   });
  117 |
  118 |   test('should show permission dialog when Claude requests permission', async ({ page }) => {
  119 |     // This test would require mocking the Claude process to trigger a permission request
  120 |     // For now, we'll test that the permission dialog component renders correctly
  121 |     
  122 |     await navigateToApp(page);
  123 |     
  124 |     // Inject a mock permission request
  125 |     await page.evaluate(() => {
  126 |       window.postMessage({
  127 |         type: 'permission:request',
  128 |         data: {
  129 |           id: 'test-request-1',
  130 |           sessionId: 'test-session-1',
  131 |           toolName: 'Bash',
  132 |           input: { command: 'npm install', description: 'Install dependencies' },
  133 |           timestamp: Date.now()
  134 |         }
  135 |       }, '*');
  136 |     });
  137 |     
  138 |     // Wait for permission dialog
  139 |     await expect(page.locator('text=Permission Required')).toBeVisible({ timeout: 5000 });
  140 |     await expect(page.locator('text=Claude wants to Execute shell commands')).toBeVisible();
  141 |     await expect(page.locator('text=npm install')).toBeVisible();
  142 |     
  143 |     // Check that Allow and Deny buttons are present
  144 |     await expect(page.locator('button:has-text("Allow")')).toBeVisible();
  145 |     await expect(page.locator('button:has-text("Deny")')).toBeVisible();
  146 |   });
  147 |
  148 |   test('should handle allow permission response', async ({ page }) => {
  149 |     await navigateToApp(page);
  150 |     
  151 |     // Inject a mock permission request
```
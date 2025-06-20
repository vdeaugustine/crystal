# Test info

- Name: Permission Flow >> should show permission mode option in create session dialog
- Location: /Users/jordanbentley/git/crystal/worktrees/auto-commit-toggle-1/tests/permissions.spec.ts:75:7

# Error details

```
Error: Command failed: git init
fatal: cannot copy '/opt/homebrew/opt/git/share/git-core/templates/info/exclude' to '/private/var/folders/tz/fhf63bv13hx88g77wvxbx22r0000gn/T/crystal-test-1750438415241/.git/info/exclude': File exists

    at setupTestProject (/Users/jordanbentley/git/crystal/worktrees/auto-commit-toggle-1/tests/setup.ts:13:3)
    at /Users/jordanbentley/git/crystal/worktrees/auto-commit-toggle-1/tests/permissions.spec.ts:8:45
```

# Test source

```ts
   1 | import { chromium } from '@playwright/test';
   2 | import * as fs from 'fs';
   3 | import * as path from 'path';
   4 | import * as os from 'os';
   5 |
   6 | export async function setupTestProject() {
   7 |   // Create a temporary test project directory
   8 |   const testProjectPath = path.join(os.tmpdir(), `crystal-test-${Date.now()}`);
   9 |   fs.mkdirSync(testProjectPath, { recursive: true });
  10 |   
  11 |   // Initialize git in the test directory
  12 |   const { execSync } = require('child_process');
> 13 |   execSync('git init', { cwd: testProjectPath });
     |   ^ Error: Command failed: git init
  14 |   execSync('git config user.email "test@example.com"', { cwd: testProjectPath });
  15 |   execSync('git config user.name "Test User"', { cwd: testProjectPath });
  16 |   execSync('touch README.md', { cwd: testProjectPath });
  17 |   execSync('git add .', { cwd: testProjectPath });
  18 |   execSync('git commit -m "Initial commit"', { cwd: testProjectPath });
  19 |   
  20 |   return testProjectPath;
  21 | }
  22 |
  23 | export async function cleanupTestProject(projectPath: string) {
  24 |   try {
  25 |     fs.rmSync(projectPath, { recursive: true, force: true });
  26 |   } catch (error) {
  27 |     console.error('Failed to cleanup test project:', error);
  28 |   }
  29 | }
```
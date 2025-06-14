import { autoUpdater } from 'electron-updater';

export function setupTestUpdater() {
  // Point to local server for testing
  autoUpdater.setFeedURL({
    provider: 'generic',
    url: process.env.UPDATE_SERVER_URL || 'http://localhost:8080'
  });
  
  // Configure for testing
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false;
  autoUpdater.allowDowngrade = false;
  
  // Log all events for debugging
  autoUpdater.logger = console;
  (autoUpdater.logger as any).transports.file.level = 'debug';
}
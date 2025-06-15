import { IpcMain, shell } from 'electron';
import type { AppServices } from './types';

export function registerAppHandlers(ipcMain: IpcMain, services: AppServices): void {
  const { app } = services;

  // Basic app info handlers
  ipcMain.handle('get-app-version', () => {
    return app.getVersion();
  });

  ipcMain.handle('get-platform', () => {
    return process.platform;
  });

  ipcMain.handle('is-packaged', () => {
    return app.isPackaged;
  });

  // System utilities
  ipcMain.handle('openExternal', async (_event, url: string) => {
    try {
      await shell.openExternal(url);
      return { success: true };
    } catch (error) {
      console.error('Failed to open external URL:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to open URL' };
    }
  });
} 
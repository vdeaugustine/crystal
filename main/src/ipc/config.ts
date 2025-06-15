import { IpcMain } from 'electron';
import type { AppServices } from './types';

export function registerConfigHandlers(ipcMain: IpcMain, { configManager }: AppServices): void {
  ipcMain.handle('config:get', async () => {
    try {
      const config = configManager.getConfig();
      return { success: true, data: config };
    } catch (error) {
      console.error('Failed to get config:', error);
      return { success: false, error: 'Failed to get config' };
    }
  });

  ipcMain.handle('config:update', async (_event, updates: any) => {
    try {
      await configManager.updateConfig(updates);
      return { success: true };
    } catch (error) {
      console.error('Failed to update config:', error);
      return { success: false, error: 'Failed to update config' };
    }
  });
} 
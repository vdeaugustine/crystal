import type { default as ElectronStore } from 'electron-store';

// Dynamic import for ES module compatibility
const Store = require('electron-store').default || require('electron-store');

interface UIState {
  treeView: {
    expandedProjects: number[];
    expandedFolders: string[];
  };
}

class UIStateManager {
  private store: any;

  constructor() {
    this.store = new Store({
      name: 'ui-state',
      defaults: {
        treeView: {
          expandedProjects: [],
          expandedFolders: []
        }
      }
    });
  }

  getExpandedProjects(): number[] {
    return this.store.get('treeView.expandedProjects', []);
  }

  getExpandedFolders(): string[] {
    return this.store.get('treeView.expandedFolders', []);
  }

  saveExpandedProjects(projectIds: number[]): void {
    this.store.set('treeView.expandedProjects', projectIds);
  }

  saveExpandedFolders(folderIds: string[]): void {
    this.store.set('treeView.expandedFolders', folderIds);
  }

  saveExpandedState(projectIds: number[], folderIds: string[]): void {
    this.store.set('treeView', {
      expandedProjects: projectIds,
      expandedFolders: folderIds
    });
  }

  getExpandedState(): { expandedProjects: number[]; expandedFolders: string[] } {
    return this.store.get('treeView', {
      expandedProjects: [],
      expandedFolders: []
    });
  }

  clear(): void {
    this.store.clear();
  }
}

export const uiStateManager = new UIStateManager();
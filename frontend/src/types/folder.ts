export interface Folder {
  id: string;
  name: string;
  projectId: number;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFolderRequest {
  name: string;
  projectId: number;
}

export interface UpdateFolderRequest {
  name?: string;
  displayOrder?: number;
}
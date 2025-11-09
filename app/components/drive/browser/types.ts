"use client";

export type DriveFolder = {
  id: string;
  name: string;
  parentId: string | null;
  type: "PROJECT" | "ASSETS" | "DELIVERABLES";
  createdAt?: string;
  _count?: { assets: number; deliveries: number };
  aggregateCount?: { assets: number; deliveries: number };
};

export type DriveAsset = {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  folderId: string | null;
  uploadedAt?: string;
  uploadedBy?: { id: string; email: string; name?: string | null } | null;
};

export type DriveDelivery = {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  folderId: string | null;
  uploadedAt?: string;
  uploadedBy: { id: string; email: string; name?: string | null } | null;
};

export type DriveItemKind = "FOLDER" | "ASSET" | "DELIVERY";

export type DriveDraggableItem =
  | { kind: "FOLDER"; id: string; parentId: string | null }
  | { kind: "ASSET"; id: string; folderId: string | null }
  | { kind: "DELIVERY"; id: string; folderId: string | null };

export type DriveLayoutMode = "grid" | "list";

export type FolderTreeNode = DriveFolder & {
  children: FolderTreeNode[];
};

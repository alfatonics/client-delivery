import type { FolderType } from "@prisma/client";

export type DriveFolderCounts = {
  assets: number;
  deliveries: number;
};

export type DriveFolderFlat = {
  id: string;
  name: string;
  type: FolderType;
  projectId: string;
  parentId: string | null;
  createdAt: string;
  updatedAt?: string;
  _count: DriveFolderCounts;
};

export type DriveFolderNode = DriveFolderFlat & {
  children: DriveFolderNode[];
};

export const buildFolderTree = (
  folders: DriveFolderFlat[]
): DriveFolderNode[] => {
  const nodeMap = new Map<string, DriveFolderNode>();
  const roots: DriveFolderNode[] = [];

  folders.forEach((folder) => {
    nodeMap.set(folder.id, { ...folder, children: [] });
  });

  nodeMap.forEach((node) => {
    if (node.parentId && nodeMap.has(node.parentId)) {
      const parent = nodeMap.get(node.parentId)!;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });

  const sortNodes = (nodes: DriveFolderNode[]) => {
    nodes.sort((a, b) => {
      if (a.type !== b.type) {
        // Enforce ASSETS -> DELIVERABLES -> PROJECT default ordering
        const order: Record<FolderType, number> = {
          ASSETS: 0,
          DELIVERABLES: 1,
          PROJECT: 2,
        };
        return order[a.type] - order[b.type];
      }
      return a.name.localeCompare(b.name);
    });

    nodes.forEach((child) => sortNodes(child.children));
  };

  sortNodes(roots);

  return roots;
};

export const flattenFolderTree = (
  nodes: DriveFolderNode[]
): DriveFolderFlat[] => {
  const result: DriveFolderFlat[] = [];

  const visit = (node: DriveFolderNode) => {
    const { children, ...flat } = node;
    result.push(flat);
    node.children.forEach(visit);
  };

  nodes.forEach(visit);

  return result;
};

export const formatFileSize = (bytes: number): string => {
  if (!bytes && bytes !== 0) return "-";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

export const isImage = (contentType: string, filename: string): boolean => {
  const imageExtensions = [
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".webp",
    ".svg",
    ".bmp",
    ".ico",
  ];
  const normalizedContentType = contentType?.toLowerCase() ?? "";
  const normalizedFilename = filename?.toLowerCase() ?? "";

  return (
    normalizedContentType.startsWith("image/") ||
    imageExtensions.some((ext) => normalizedFilename.endsWith(ext))
  );
};

export const isVideo = (contentType: string, filename: string): boolean => {
  const videoExtensions = [
    ".mp4",
    ".avi",
    ".mov",
    ".wmv",
    ".flv",
    ".webm",
    ".mkv",
  ];
  const normalizedContentType = contentType?.toLowerCase() ?? "";
  const normalizedFilename = filename?.toLowerCase() ?? "";

  return (
    normalizedContentType.startsWith("video/") ||
    videoExtensions.some((ext) => normalizedFilename.endsWith(ext))
  );
};


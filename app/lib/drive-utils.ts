import type { FolderType } from "@prisma/client";

export type DriveFolderCounts = {
  assets: number;
  deliveries: number;
};

export type DriveFolderFlat = {
  id: string;
  name: string;
  type: FolderType;
  parentId: string | null;
  projectId?: string;
  createdAt?: string;
  updatedAt?: string;
  _count?: DriveFolderCounts;
  aggregateCount?: DriveFolderCounts;
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
    const count = folder._count ??
      folder.aggregateCount ?? {
        assets: 0,
        deliveries: 0,
      };
    nodeMap.set(folder.id, { ...folder, _count: count, children: [] });
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

export type DroppedFileEntry = {
  file: File;
  relativePath: string;
};

const readAllDirectoryEntries = (directoryReader: any): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    const entries: any[] = [];
    const readBatch = () => {
      directoryReader.readEntries(
        (batch: any[]) => {
          if (!batch.length) {
            resolve(entries);
            return;
          }
          entries.push(...batch);
          readBatch();
        },
        (error: unknown) => {
          reject(error);
        }
      );
    };
    readBatch();
  });
};

const traverseFileSystemEntry = async (
  entry: any
): Promise<DroppedFileEntry[]> => {
  if (!entry) return [];

  if (entry.isFile) {
    return new Promise((resolve, reject) => {
      entry.file(
        (file: File) => {
          const relativePath =
            (entry.fullPath as string | undefined)?.replace(/^\//, "") ||
            (file as any).webkitRelativePath ||
            file.name;
          resolve([{ file, relativePath }]);
        },
        (error: unknown) => reject(error)
      );
    });
  }

  if (entry.isDirectory) {
    const reader = entry.createReader();
    const entries = await readAllDirectoryEntries(reader).catch(() => []);
    const results = await Promise.all(
      entries.map((child: any) => traverseFileSystemEntry(child))
    );
    return results.flat();
  }

  return [];
};

export const extractDroppedFiles = async (
  dataTransfer: DataTransfer
): Promise<DroppedFileEntry[]> => {
  const items = Array.from(dataTransfer.items ?? []);

  const entryPromises = items
    .map((item) => {
      if (item.kind !== "file") return null;
      const getter = (item as any).webkitGetAsEntry;
      if (typeof getter !== "function") return null;
      try {
        return traverseFileSystemEntry(getter.call(item));
      } catch (error) {
        console.error("Failed to traverse drag entry:", error);
        return null;
      }
    })
    .filter(
      (promise): promise is Promise<DroppedFileEntry[]> => promise !== null
    );

  if (entryPromises.length > 0) {
    try {
      const resolved = await Promise.all(entryPromises);
      const flattened = resolved.flat();
      if (flattened.length > 0) {
        return flattened;
      }
    } catch (error) {
      console.warn("Falling back to DataTransfer#files traversal:", error);
    }
  }

  const files = Array.from(dataTransfer.files ?? []);
  return files.map((file) => ({
    file,
    relativePath:
      (file as any).webkitRelativePath &&
      (file as any).webkitRelativePath.length > 0
        ? (file as any).webkitRelativePath
        : file.name,
  }));
};

export const dropContainsDirectory = (entries: DroppedFileEntry[]): boolean => {
  return entries.some((entry) => entry.relativePath.includes("/"));
};

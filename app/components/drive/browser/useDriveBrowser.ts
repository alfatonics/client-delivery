"use client";

import { useCallback, useMemo, useState } from "react";
import {
  DriveAsset,
  DriveDelivery,
  DriveDraggableItem,
  DriveFolder,
  DriveItemKind,
  DriveLayoutMode,
  FolderTreeNode,
} from "./types";
import { buildFolderTree } from "@/app/lib/drive-utils";

export type MoveItemHandler = (
  item: DriveDraggableItem,
  targetFolderId: string | null
) => Promise<void>;

export type CreateFolderHandler = (
  name: string,
  parentId: string | null
) => Promise<DriveFolder>;

export type UseDriveBrowserParams = {
  folders: DriveFolder[];
  assets?: DriveAsset[];
  deliveries?: DriveDelivery[];
  initialFolderId?: string | null;
  canUpload?: boolean;
  canCreateFolder?: boolean;
  allowedFolderTypes?: Array<DriveFolder["type"]>;
  onMove?: MoveItemHandler;
  onCreateFolder?: CreateFolderHandler;
};

export type UseDriveBrowserResult = {
  layout: DriveLayoutMode;
  setLayout: (mode: DriveLayoutMode) => void;
  search: string;
  setSearch: (value: string) => void;
  activeFolderId: string | null;
  setActiveFolderId: (folderId: string | null) => void;
  breadcrumbs: Array<{ id: string | null; name: string }>;
  childFolders: DriveFolder[];
  childAssets: DriveAsset[];
  childDeliveries: DriveDelivery[];
  tree: FolderTreeNode[];
  canUpload: boolean;
  canCreateFolder: boolean;
  moveItem: (item: DriveDraggableItem, targetFolderId: string | null) => void;
  createFolder: (name: string, parentId: string | null) => Promise<void>;
  isMoving: boolean;
  draggingItem: DriveDraggableItem | null;
  beginDrag: (item: DriveDraggableItem) => void;
  endDrag: () => void;
};

const normalizeAllowedTypes = (
  folders: DriveFolder[],
  allowedFolderTypes?: Array<DriveFolder["type"]>
) => {
  if (!allowedFolderTypes?.length) return folders;
  return folders.filter((folder) => allowedFolderTypes.includes(folder.type));
};

export function useDriveBrowser({
  folders,
  assets = [],
  deliveries = [],
  initialFolderId = null,
  canUpload = false,
  canCreateFolder = false,
  allowedFolderTypes,
  onMove,
  onCreateFolder,
}: UseDriveBrowserParams): UseDriveBrowserResult {
  const filteredFolders = useMemo(
    () => normalizeAllowedTypes(folders, allowedFolderTypes),
    [folders, allowedFolderTypes]
  );

  const foldersWithCounts = useMemo(() => {
    if (filteredFolders.length === 0) return filteredFolders;

    const directCounts = new Map<
      string,
      { assets: number; deliveries: number }
    >();

    filteredFolders.forEach((folder) => {
      directCounts.set(folder.id, { assets: 0, deliveries: 0 });
    });

    assets.forEach((asset) => {
      if (!asset.folderId) return;
      if (!directCounts.has(asset.folderId)) return;
      const current = directCounts.get(asset.folderId)!;
      current.assets += 1;
    });

    deliveries.forEach((delivery) => {
      if (!delivery.folderId) return;
      if (!directCounts.has(delivery.folderId)) return;
      const current = directCounts.get(delivery.folderId)!;
      current.deliveries += 1;
    });

    const childrenMap = new Map<string, string[]>();
    filteredFolders.forEach((folder) => {
      const parentKey = folder.parentId ?? "__root__";
      if (!childrenMap.has(parentKey)) {
        childrenMap.set(parentKey, []);
      }
      childrenMap.get(parentKey)!.push(folder.id);
    });

    const aggregateCounts = new Map<
      string,
      { assets: number; deliveries: number }
    >();

    const computeAggregate = (
      folderId: string
    ): {
      assets: number;
      deliveries: number;
    } => {
      if (aggregateCounts.has(folderId)) {
        return aggregateCounts.get(folderId)!;
      }
      const direct = directCounts.get(folderId) ?? {
        assets: 0,
        deliveries: 0,
      };
      const childIds = childrenMap.get(folderId) ?? [];
      const aggregate = childIds.reduce(
        (acc, childId) => {
          const childTotals = computeAggregate(childId);
          acc.assets += childTotals.assets;
          acc.deliveries += childTotals.deliveries;
          return acc;
        },
        { ...direct }
      );
      aggregateCounts.set(folderId, aggregate);
      return aggregate;
    };

    return filteredFolders.map((folder) => ({
      ...folder,
      aggregateCount: computeAggregate(folder.id),
    }));
  }, [filteredFolders, assets, deliveries]);

  const folderMap = useMemo(() => {
    const map = new Map<string, DriveFolder>();
    foldersWithCounts.forEach((folder) => map.set(folder.id, folder));
    return map;
  }, [foldersWithCounts]);

  const [activeFolderId, setActiveFolderId] = useState<string | null>(
    initialFolderId || null
  );
  const [layout, setLayout] = useState<DriveLayoutMode>("grid");
  const [search, setSearch] = useState("");
  const [isMoving, setIsMoving] = useState(false);
  const [draggingItem, setDraggingItem] = useState<DriveDraggableItem | null>(
    null
  );

  const tree = useMemo<FolderTreeNode[]>(() => {
    return buildFolderTree(foldersWithCounts);
  }, [foldersWithCounts]);

  const breadcrumbs = useMemo(() => {
    const chain: Array<{ id: string | null; name: string }> = [];

    let cursor: string | null | undefined = activeFolderId;
    while (cursor) {
      const folder = folderMap.get(cursor);
      if (!folder) break;
      chain.push({ id: folder.id, name: folder.name });
      cursor = folder.parentId;
    }

    chain.push({ id: null, name: "All Content" });
    return chain.reverse();
  }, [activeFolderId, folderMap]);

  const childFolders = useMemo(() => {
    const set = new Set();
    if (search) {
      const lowered = search.toLowerCase();
      foldersWithCounts.forEach((folder) => {
        if (
          (activeFolderId === null || folder.parentId === activeFolderId) &&
          folder.name.toLowerCase().includes(lowered)
        ) {
          set.add(folder);
        }
      });
      return Array.from(set) as DriveFolder[];
    }

    return foldersWithCounts.filter(
      (folder) => folder.parentId === activeFolderId
    );
  }, [foldersWithCounts, activeFolderId, search]);

  const searchFilter = useCallback(
    <T extends { filename?: string; name?: string }>(items: T[]) => {
      if (!search) return items;
      const lowered = search.toLowerCase();
      return items.filter((item) => {
        const target = (item.filename || item.name || "").toLowerCase();
        return target.includes(lowered);
      });
    },
    [search]
  );

  const childAssets = useMemo(() => {
    const scoped = assets.filter((asset) => asset.folderId === activeFolderId);
    return searchFilter(scoped);
  }, [assets, activeFolderId, searchFilter]);

  const childDeliveries = useMemo(() => {
    const scoped = deliveries.filter(
      (delivery) => delivery.folderId === activeFolderId
    );
    return searchFilter(scoped);
  }, [deliveries, activeFolderId, searchFilter]);

  const moveItem = useCallback(
    async (item: DriveDraggableItem, targetFolderId: string | null) => {
      if (!onMove) return;
      setIsMoving(true);
      try {
        await onMove(item, targetFolderId);
      } finally {
        setIsMoving(false);
      }
    },
    [onMove]
  );

  const createFolder = useCallback(
    async (name: string, parentId: string | null) => {
      if (!onCreateFolder) return;
      await onCreateFolder(name, parentId);
    },
    [onCreateFolder]
  );

  const beginDrag = useCallback((item: DriveDraggableItem) => {
    setDraggingItem(item);
  }, []);

  const endDrag = useCallback(() => {
    setDraggingItem(null);
  }, []);

  const setActiveFolder = useCallback(
    (folderId: string | null) => {
      if (folderId === null) {
        setActiveFolderId(null);
        return;
      }

      if (!folderMap.has(folderId)) return;
      setActiveFolderId(folderId);
    },
    [folderMap]
  );

  return {
    layout,
    setLayout,
    search,
    setSearch,
    activeFolderId,
    setActiveFolderId: setActiveFolder,
    breadcrumbs,
    childFolders,
    childAssets,
    childDeliveries,
    tree,
    canUpload,
    canCreateFolder,
    moveItem,
    createFolder,
    isMoving,
    draggingItem,
    beginDrag,
    endDrag,
  };
}

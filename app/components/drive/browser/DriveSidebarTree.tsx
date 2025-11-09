"use client";

import { useMemo, useState, type FC } from "react";
import type { DriveDraggableItem, FolderTreeNode } from "./types";

type DriveSidebarTreeProps = {
  tree: FolderTreeNode[];
  activeFolderId: string | null;
  onSelect: (folderId: string) => void;
  onCreateFolder?: (parentId: string) => void;
  onDrop?: (targetFolderId: string, item: DriveDraggableItem) => void;
  draggingItem?: DriveDraggableItem | null;
};

type TreeItemProps = {
  node: FolderTreeNode;
  depth: number;
  activeFolderId: string | null;
  onSelect: (folderId: string) => void;
  onCreateFolder?: (parentId: string) => void;
  onDrop?: (targetFolderId: string, item: DriveDraggableItem) => void;
  draggingItem?: DriveDraggableItem | null;
};

const TreeItem: FC<TreeItemProps> = ({
  node,
  depth,
  activeFolderId,
  onSelect,
  onCreateFolder,
  onDrop,
  draggingItem,
}) => {
  const [expanded, setExpanded] = useState(depth === 0);
  const isActive = activeFolderId === node.id;
  const totalAssets = node.aggregateCount?.assets ?? node._count?.assets ?? 0;
  const totalDeliveries =
    node.aggregateCount?.deliveries ?? node._count?.deliveries ?? 0;
  const itemCount = node.type === "ASSETS" ? totalAssets : totalDeliveries;

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    if (!onDrop || !draggingItem) return;
    event.preventDefault();
    if (draggingItem.kind === "FOLDER" && draggingItem.id === node.id) return;
    onDrop(node.id, draggingItem);
  };

  return (
    <div className="flex flex-col">
      <div
        className={[
          "group flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition",
          isActive
            ? "bg-[#e8f0fe] text-[#1967d2]"
            : "text-[#3c4043] hover:bg-[#f1f3f4]",
        ].join(" ")}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        draggable
        onDragOver={(event) => {
          if (!draggingItem || draggingItem.id === node.id) return;
          event.preventDefault();
        }}
        onDrop={handleDrop}
      >
        <button
          type="button"
          className="flex flex-1 items-center gap-2 text-left"
          onClick={() => onSelect(node.id)}
        >
          {node.children.length > 0 ? (
            <span
              className={[
                "flex h-5 w-5 items-center justify-center rounded transition",
                "text-[#5f6368] group-hover:text-[#202124]",
              ].join(" ")}
              onClick={(event) => {
                event.stopPropagation();
                setExpanded((value) => !value);
              }}
            >
              {expanded ? "▾" : "▸"}
            </span>
          ) : (
            <span className="w-5" />
          )}
          <span className="truncate">{node.name}</span>
          {itemCount > 0 && (
            <span className="ml-auto text-xs text-[#80868b]">{itemCount}</span>
          )}
        </button>
        {onCreateFolder && (
          <button
            type="button"
            className="opacity-0 transition group-hover:opacity-100 text-[#1a73e8] hover:text-[#1557b0]"
            title="New subfolder"
            onClick={() => onCreateFolder(node.id)}
          >
            +
          </button>
        )}
      </div>
      {expanded &&
        node.children.map((child) => (
          <TreeItem
            key={child.id}
            node={child}
            depth={depth + 1}
            activeFolderId={activeFolderId}
            onSelect={onSelect}
            onCreateFolder={onCreateFolder}
            onDrop={onDrop}
            draggingItem={draggingItem}
          />
        ))}
    </div>
  );
};

export const DriveSidebarTree: FC<DriveSidebarTreeProps> = ({
  tree,
  activeFolderId,
  onSelect,
  onCreateFolder,
  onDrop,
  draggingItem,
}) => {
  const sortedTree = useMemo(() => {
    const sortNodes = (nodes: FolderTreeNode[]): FolderTreeNode[] =>
      nodes
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((node) => ({
          ...node,
          children: sortNodes(node.children),
        }));
    return sortNodes(tree);
  }, [tree]);

  return (
    <div className="space-y-2">
      {sortedTree.map((node) => (
        <TreeItem
          key={node.id}
          node={node}
          depth={0}
          activeFolderId={activeFolderId}
          onSelect={onSelect}
          onCreateFolder={onCreateFolder}
          onDrop={onDrop}
          draggingItem={draggingItem}
        />
      ))}
    </div>
  );
};

export default DriveSidebarTree;

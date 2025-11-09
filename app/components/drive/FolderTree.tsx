"use client";

import { useMemo, useState, type FC } from "react";
import type { FolderType } from "@prisma/client";
import type { DriveFolderFlat, DriveFolderNode } from "@/app/lib/drive-utils";
import { buildFolderTree } from "@/app/lib/drive-utils";

type FolderTreeProps = {
  folders: DriveFolderFlat[];
  selectedFolderId: string | null;
  onSelect: (folderId: string | null) => void;
  showRoot?: boolean;
  rootLabel?: string;
  className?: string;
  initiallyExpandedIds?: string[];
};

const cn = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

const typeIconColor: Record<FolderType, string> = {
  ASSETS: "#4285f4",
  DELIVERABLES: "#10b981",
  PROJECT: "#fbbc04",
};

const FolderTree: FC<FolderTreeProps> = ({
  folders,
  selectedFolderId,
  onSelect,
  showRoot = true,
  rootLabel = "All Folders",
  className,
  initiallyExpandedIds = [],
}) => {
  const tree = useMemo(() => buildFolderTree(folders), [folders]);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(
    () => new Set(initiallyExpandedIds)
  );

  const handleToggle = (folderId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  return (
    <div className={cn("space-y-2", className)}>
      {showRoot && (
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-2 py-1 text-sm transition-colors",
            !selectedFolderId
              ? "bg-[#e8f0fe] text-[#1a73e8]"
              : "hover:bg-[#f1f3f4]"
          )}
        >
          <span className="w-5" />
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path
              d="M10 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2h-8l-2-2z"
              fill="#1a73e8"
            />
          </svg>
          <span className="flex-1 truncate text-left">{rootLabel}</span>
        </button>
      )}

      <ul className="space-y-1">
        {tree.map((node) => (
          <li key={node.id}>
            <button
              type="button"
              onClick={() => onSelect(node.id)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1 text-sm transition-colors",
                selectedFolderId === node.id
                  ? "bg-[#e8f0fe] text-[#1a73e8]"
                  : "hover:bg-[#f1f3f4]"
              )}
            >
              {node.children.length > 0 ? (
                <span
                  className="flex h-5 w-5 items-center justify-center rounded hover:bg-[#dfe3e8]"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleToggle(node.id);
                  }}
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    {expandedNodes.has(node.id) ? (
                      <path d="M18 15l-6-6-6 6" />
                    ) : (
                      <path d="M6 9l6 6 6-6" />
                    )}
                  </svg>
                </span>
              ) : (
                <span className="w-5" />
              )}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M10 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2h-8l-2-2z"
                  fill={typeIconColor[node.type]}
                />
              </svg>
              <span className="flex-1 truncate text-left">{node.name}</span>
              <span className="text-xs text-[#5f6368]">
                {(node._count?.assets ?? 0) + (node._count?.deliveries ?? 0)}
              </span>
            </button>

            {node.children.length > 0 && expandedNodes.has(node.id) && (
              <ul className="space-y-1">
                {node.children.map((child) => (
                  <FolderTreeBranch
                    key={child.id}
                    node={child}
                    depth={1}
                    selectedFolderId={selectedFolderId}
                    onSelect={onSelect}
                    expandedNodes={expandedNodes}
                    onToggle={handleToggle}
                  />
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

const FolderTreeBranch: FC<{
  node: DriveFolderNode;
  depth: number;
  selectedFolderId: string | null;
  onSelect: (folderId: string) => void;
  expandedNodes: Set<string>;
  onToggle: (folderId: string) => void;
}> = ({ node, depth, selectedFolderId, onSelect, expandedNodes, onToggle }) => {
  const isExpanded = expandedNodes.has(node.id);
  const hasChildren = node.children.length > 0;

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(node.id)}
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-2 py-1 text-sm transition-colors",
          selectedFolderId === node.id
            ? "bg-[#e8f0fe] text-[#1a73e8]"
            : "hover:bg-[#f1f3f4]"
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {hasChildren ? (
          <span
            className="flex h-5 w-5 items-center justify-center rounded hover:bg-[#dfe3e8]"
            onClick={(event) => {
              event.stopPropagation();
              onToggle(node.id);
            }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              {isExpanded ? (
                <path d="M18 15l-6-6-6 6" />
              ) : (
                <path d="M6 9l6 6 6-6" />
              )}
            </svg>
          </span>
        ) : (
          <span className="w-5" />
        )}

        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path
            d="M10 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2h-8l-2-2z"
            fill={typeIconColor[node.type]}
          />
        </svg>
        <span className="flex-1 truncate text-left">{node.name}</span>
        <span className="text-xs text-[#5f6368]">
          {(node._count?.assets ?? 0) + (node._count?.deliveries ?? 0)}
        </span>
      </button>
      {hasChildren && isExpanded && (
        <ul>
          {node.children.map((child) => (
            <FolderTreeBranch
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedFolderId={selectedFolderId}
              onSelect={onSelect}
              expandedNodes={expandedNodes}
              onToggle={onToggle}
            />
          ))}
        </ul>
      )}
    </li>
  );
};

export default FolderTree;

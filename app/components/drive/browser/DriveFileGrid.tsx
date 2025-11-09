"use client";

import Link from "next/link";
import type { FC, MouseEvent } from "react";
import DriveFileIcon from "@/app/components/drive/DriveFileIcon";
import { formatFileSize } from "@/app/lib/drive-utils";
import type {
  DriveAsset,
  DriveDelivery,
  DriveDraggableItem,
  DriveFolder,
  DriveLayoutMode,
} from "./types";

type DriveFileGridProps = {
  layout: DriveLayoutMode;
  folders: DriveFolder[];
  assets: DriveAsset[];
  deliveries: DriveDelivery[];
  onOpenFolder: (folderId: string) => void;
  onPreviewAsset?: (asset: DriveAsset) => void;
  onPreviewDelivery?: (delivery: DriveDelivery) => void;
  onDownloadAsset?: (asset: DriveAsset) => void;
  onDownloadDelivery?: (delivery: DriveDelivery) => void;
  onDeleteAsset?: (asset: DriveAsset) => void;
  onDeleteDelivery?: (delivery: DriveDelivery) => void;
  onRenameFolder?: (folder: DriveFolder) => void;
  onDeleteFolder?: (folder: DriveFolder) => void;
  deletingAssetId?: string | null;
  deletingDeliveryId?: string | null;
  renamingFolderId?: string | null;
  deletingFolderId?: string | null;
  onDropItem?: (targetFolderId: string, item: DriveDraggableItem) => void;
  onDragStart?: (item: DriveDraggableItem) => void;
  onDragEnd?: () => void;
  draggingItem?: DriveDraggableItem | null;
  emptyState?: React.ReactNode;
};

const renderFolderCard = (
  folder: DriveFolder,
  onOpenFolder: (folderId: string) => void,
  onDropItem?: (targetFolderId: string, item: DriveDraggableItem) => void,
  draggingItem?: DriveDraggableItem | null,
  onRenameFolder?: (folder: DriveFolder) => void,
  onDeleteFolder?: (folder: DriveFolder) => void,
  renamingFolderId?: string | null,
  deletingFolderId?: string | null
) => {
  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    if (!onDropItem || !draggingItem) return;
    event.preventDefault();
    if (draggingItem.kind === "FOLDER" && draggingItem.id === folder.id) return;
    onDropItem(folder.id, draggingItem);
  };

  const handleRenameClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onRenameFolder?.(folder);
  };

  const handleDeleteClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onDeleteFolder?.(folder);
  };

  const isRenaming = renamingFolderId === folder.id;
  const isDeleting = deletingFolderId === folder.id;

  return (
    <div
      key={folder.id}
      className="group relative rounded-xl border border-[#e4e7eb] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[#c7ccd1] hover:shadow-md"
      draggable
      onDragOver={(event) => {
        if (!draggingItem || draggingItem.id === folder.id) return;
        event.preventDefault();
      }}
      onDrop={handleDrop}
    >
      {(onRenameFolder || onDeleteFolder) && (
        <div className="absolute right-3 top-3 flex flex-col items-end gap-1 opacity-0 transition group-hover:opacity-100">
          {onRenameFolder && (
            <button
              type="button"
              onClick={handleRenameClick}
              className="rounded-full bg-[#e8f0fe] px-3 py-1 text-xs font-medium text-[#1a73e8]"
              disabled={isRenaming}
            >
              {isRenaming ? "Renaming..." : "Rename"}
            </button>
          )}
          {onDeleteFolder && (
            <button
              type="button"
              onClick={handleDeleteClick}
              className="rounded-full bg-[#fce8e6] px-3 py-1 text-xs font-medium text-[#d93025]"
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </button>
          )}
        </div>
      )}
      <button
        type="button"
        onClick={() => onOpenFolder(folder.id)}
        className="flex w-full flex-col items-start gap-2 text-left"
      >
        <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-[#f4f6fb] text-[#1a73e8]">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path
              d="M10 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2h-8l-2-2z"
              fill="currentColor"
            />
          </svg>
        </span>
        <span className="font-medium text-[#202124]">{folder.name}</span>
        <span className="text-xs text-[#80868b]">
          {(folder.aggregateCount?.assets ?? folder._count?.assets ?? 0) +
            (folder.aggregateCount?.deliveries ??
              folder._count?.deliveries ??
              0)}{" "}
          item(s)
        </span>
      </button>
    </div>
  );
};

const assetDragStart = (
  event: React.DragEvent<HTMLDivElement>,
  asset: DriveAsset,
  onDragStart?: (item: DriveDraggableItem) => void
) => {
  event.dataTransfer.effectAllowed = "move";
  onDragStart?.({ kind: "ASSET", id: asset.id, folderId: asset.folderId });
};

const deliveryDragStart = (
  event: React.DragEvent<HTMLDivElement>,
  delivery: DriveDelivery,
  onDragStart?: (item: DriveDraggableItem) => void
) => {
  event.dataTransfer.effectAllowed = "move";
  onDragStart?.({
    kind: "DELIVERY",
    id: delivery.id,
    folderId: delivery.folderId,
  });
};

export const DriveFileGrid: FC<DriveFileGridProps> = ({
  layout,
  folders,
  assets,
  deliveries,
  onOpenFolder,
  onPreviewAsset,
  onPreviewDelivery,
  onDownloadAsset,
  onDownloadDelivery,
  onDeleteAsset,
  onDeleteDelivery,
  onRenameFolder,
  onDeleteFolder,
  deletingAssetId,
  deletingDeliveryId,
  renamingFolderId,
  deletingFolderId: deletingFolderIdProp,
  onDropItem,
  onDragStart,
  onDragEnd,
  draggingItem,
  emptyState,
}) => {
  const hasContent =
    folders.length > 0 || assets.length > 0 || deliveries.length > 0;

  if (!hasContent) {
    return (
      <div className="rounded-xl border border-dashed border-[#dadce0] bg-[#f8f9fa] px-6 py-12 text-center text-[#5f6368]">
        {emptyState ?? "Nothing here yet."}
      </div>
    );
  }

  const gridClass =
    layout === "grid"
      ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
      : "space-y-2";

  return (
    <div className="space-y-6">
      {folders.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#5f6368]">
            Folders
          </h3>
          <div className={gridClass}>
            {folders.map((folder) =>
              renderFolderCard(
                folder,
                onOpenFolder,
                onDropItem,
                draggingItem,
                onRenameFolder,
                onDeleteFolder,
                renamingFolderId,
                deletingFolderIdProp
              )
            )}
          </div>
        </section>
      )}

      {assets.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#5f6368]">
            Assets
          </h3>
          <div className={gridClass}>
            {assets.map((asset) =>
              layout === "grid" ? (
                <div
                  key={asset.id}
                  className="group relative flex flex-col overflow-hidden rounded-2xl border border-[#e5e8ef] bg-white shadow-sm transition hover:-translate-y-1 hover:border-[#c3d4f7] hover:shadow-lg"
                  draggable
                  onDragStart={(event) =>
                    assetDragStart(event, asset, onDragStart)
                  }
                  onDragEnd={onDragEnd}
                >
                  <div className="flex flex-1 flex-col p-4">
                    <div className="mb-4 flex h-28 items-center justify-center rounded-xl bg-linear-to-br from-[#e8f0fe] via-[#f1f3f4] to-white">
                      <DriveFileIcon
                        type="OTHER"
                        contentType={asset.contentType}
                        filename={asset.filename}
                        size={48}
                      />
                    </div>
                    <div className="mt-auto">
                      <p className="max-h-14 overflow-hidden text-sm font-medium leading-snug text-[#202124]">
                        {asset.filename}
                      </p>
                      <p className="mt-1 text-xs text-[#5f6368]">
                        {formatFileSize(asset.sizeBytes)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 border-t border-[#e5e8ef] bg-[#f8f9fa] px-4 py-3 text-xs opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
                    {onPreviewAsset && (
                      <button
                        type="button"
                        className="rounded-full bg-[#1a73e8] px-4 py-1.5 font-medium text-white shadow-sm transition hover:bg-[#1557b0]"
                        onClick={() => onPreviewAsset(asset)}
                      >
                        Preview
                      </button>
                    )}
                    {onDownloadAsset && (
                      <button
                        type="button"
                        className="rounded-full border border-[#d2d6dc] bg-white px-4 py-1.5 font-medium text-[#1a73e8] transition hover:border-[#1a73e8] hover:bg-[#eef3ff]"
                        onClick={() => onDownloadAsset(asset)}
                      >
                        Download
                      </button>
                    )}
                    {onDeleteAsset && (
                      <button
                        type="button"
                        className="rounded-full border border-transparent px-3 py-1.5 font-medium text-[#d93025] transition hover:bg-[#fce8e6] disabled:opacity-50"
                        onClick={() => onDeleteAsset(asset)}
                        disabled={deletingAssetId === asset.id}
                      >
                        {deletingAssetId === asset.id
                          ? "Deleting..."
                          : "Delete"}
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div
                  key={asset.id}
                  className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#e5e8ef] bg-white px-3 py-3 shadow-sm transition hover:border-[#c3d4f7] hover:shadow-md"
                  draggable
                  onDragStart={(event) =>
                    assetDragStart(event, asset, onDragStart)
                  }
                  onDragEnd={onDragEnd}
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f4f6fb]">
                    <DriveFileIcon
                      type="OTHER"
                      contentType={asset.contentType}
                      filename={asset.filename}
                      size={26}
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[#202124]">
                      {asset.filename}
                    </p>
                    <p className="text-xs text-[#80868b]">
                      {formatFileSize(asset.sizeBytes)}
                    </p>
                  </div>
                  <div className="flex w-full flex-wrap items-center gap-2 text-xs sm:w-auto sm:flex-nowrap sm:justify-end">
                    {onPreviewAsset && (
                      <button
                        type="button"
                        className="flex-1 rounded-full bg-[#1a73e8] px-4 py-1.5 font-medium text-white shadow-sm transition hover:bg-[#1557b0] sm:flex-none"
                        onClick={() => onPreviewAsset(asset)}
                      >
                        Preview
                      </button>
                    )}
                    {onDownloadAsset && (
                      <button
                        type="button"
                        className="flex-1 rounded-full border border-[#d2d6dc] bg-white px-4 py-1.5 font-medium text-[#1a73e8] transition hover:border-[#1a73e8] hover:bg-[#eef3ff] sm:flex-none"
                        onClick={() => onDownloadAsset(asset)}
                      >
                        Download
                      </button>
                    )}
                    {onDeleteAsset && (
                      <button
                        type="button"
                        className="flex-1 rounded-full border border-transparent px-4 py-1.5 font-medium text-[#d93025] transition hover:bg-[#fce8e6] disabled:opacity-50 sm:flex-none"
                        onClick={() => onDeleteAsset(asset)}
                        disabled={deletingAssetId === asset.id}
                      >
                        {deletingAssetId === asset.id
                          ? "Deleting..."
                          : "Delete"}
                      </button>
                    )}
                  </div>
                </div>
              )
            )}
          </div>
        </section>
      )}

      {deliveries.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#5f6368]">
            Deliveries
          </h3>
          <div className={gridClass}>
            {deliveries.map((delivery) =>
              layout === "grid" ? (
                <div
                  key={delivery.id}
                  className="group relative flex flex-col overflow-hidden rounded-2xl border border-[#e5e8ef] bg-white shadow-sm transition hover:-translate-y-1 hover:border-[#c3d4f7] hover:shadow-lg"
                  draggable
                  onDragStart={(event) =>
                    deliveryDragStart(event, delivery, onDragStart)
                  }
                  onDragEnd={onDragEnd}
                >
                  <div className="flex flex-1 flex-col p-4">
                    <div className="mb-4 flex h-28 items-center justify-center rounded-xl bg-linear-to-br from-[#e8f0fe] via-[#f1f3f4] to-white">
                      <DriveFileIcon
                        type="OTHER"
                        contentType={delivery.contentType}
                        filename={delivery.filename}
                        size={48}
                      />
                    </div>
                    <div className="mt-auto">
                      <p className="max-h-14 overflow-hidden text-sm font-medium leading-snug text-[#202124]">
                        {delivery.filename}
                      </p>
                      <p className="mt-1 text-xs text-[#5f6368]">
                        {formatFileSize(delivery.sizeBytes)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 border-t border-[#e5e8ef] bg-[#f8f9fa] px-4 py-3 text-xs opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
                    {onPreviewDelivery && (
                      <button
                        type="button"
                        className="rounded-full bg-[#1a73e8] px-4 py-1.5 font-medium text-white shadow-sm transition hover:bg-[#1557b0]"
                        onClick={() => onPreviewDelivery(delivery)}
                      >
                        Preview
                      </button>
                    )}
                    {onDownloadDelivery && (
                      <button
                        type="button"
                        className="rounded-full border border-[#d2d6dc] bg-white px-4 py-1.5 font-medium text-[#1a73e8] transition hover:border-[#1a73e8] hover:bg-[#eef3ff]"
                        onClick={() => onDownloadDelivery(delivery)}
                      >
                        Download
                      </button>
                    )}
                    {onDeleteDelivery && (
                      <button
                        type="button"
                        className="rounded-full border border-transparent px-3 py-1.5 font-medium text-[#d93025] transition hover:bg-[#fce8e6] disabled:opacity-50"
                        onClick={() => onDeleteDelivery(delivery)}
                        disabled={deletingDeliveryId === delivery.id}
                      >
                        {deletingDeliveryId === delivery.id
                          ? "Deleting..."
                          : "Delete"}
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div
                  key={delivery.id}
                  className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#e5e8ef] bg-white px-3 py-3 shadow-sm transition hover:border-[#c3d4f7] hover:shadow-md"
                  draggable
                  onDragStart={(event) =>
                    deliveryDragStart(event, delivery, onDragStart)
                  }
                  onDragEnd={onDragEnd}
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f4f6fb]">
                    <DriveFileIcon
                      type="OTHER"
                      contentType={delivery.contentType}
                      filename={delivery.filename}
                      size={26}
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[#202124]">
                      {delivery.filename}
                    </p>
                    <p className="text-xs text-[#80868b]">
                      {formatFileSize(delivery.sizeBytes)}
                    </p>
                  </div>
                  <div className="flex w-full flex-wrap items-center gap-2 text-xs sm:w-auto sm:flex-nowrap sm:justify-end">
                    {onPreviewDelivery && (
                      <button
                        type="button"
                        className="flex-1 rounded-full bg-[#1a73e8] px-4 py-1.5 font-medium text-white shadow-sm transition hover:bg-[#1557b0] sm:flex-none"
                        onClick={() => onPreviewDelivery(delivery)}
                      >
                        Preview
                      </button>
                    )}
                    {onDownloadDelivery && (
                      <button
                        type="button"
                        className="flex-1 rounded-full border border-[#d2d6dc] bg-white px-4 py-1.5 font-medium text-[#1a73e8] transition hover:border-[#1a73e8] hover:bg-[#eef3ff] sm:flex-none"
                        onClick={() => onDownloadDelivery(delivery)}
                      >
                        Download
                      </button>
                    )}
                    {onDeleteDelivery && (
                      <button
                        type="button"
                        className="flex-1 rounded-full border border-transparent px-4 py-1.5 font-medium text-[#d93025] transition hover:bg-[#fce8e6] disabled:opacity-50 sm:flex-none"
                        onClick={() => onDeleteDelivery(delivery)}
                        disabled={deletingDeliveryId === delivery.id}
                      >
                        {deletingDeliveryId === delivery.id
                          ? "Deleting..."
                          : "Delete"}
                      </button>
                    )}
                  </div>
                </div>
              )
            )}
          </div>
        </section>
      )}
    </div>
  );
};

export default DriveFileGrid;

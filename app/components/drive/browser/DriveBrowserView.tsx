"use client";

import type { FC, ReactNode } from "react";
import DriveBreadcrumb from "./DriveBreadcrumb";
import DriveToolbar from "./DriveToolbar";
import DriveSidebarTree from "./DriveSidebarTree";
import DriveFileGrid from "./DriveFileGrid";
import type {
  DriveAsset,
  DriveDelivery,
  DriveDraggableItem,
  DriveFolder,
} from "./types";
import type { UseDriveBrowserResult } from "./useDriveBrowser";

type DriveBrowserViewProps = {
  browser: UseDriveBrowserResult;
  assets: DriveAsset[];
  deliveries: DriveDelivery[];
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
  onUploadClick?: () => void;
  onCreateFolderClick?: (parentId: string | null) => void;
  extraToolbarContent?: ReactNode;
  emptyState?: ReactNode;
};

export const DriveBrowserView: FC<DriveBrowserViewProps> = ({
  browser,
  assets,
  deliveries,
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
  deletingFolderId,
  onUploadClick,
  onCreateFolderClick,
  extraToolbarContent,
  emptyState,
}) => {
  const handleDrop = async (
    targetFolderId: string,
    item: DriveDraggableItem
  ) => {
    await browser.moveItem(item, targetFolderId);
  };

  return (
    <div className="flex gap-6">
      <aside className="hidden w-64 shrink-0 lg:block">
        <DriveSidebarTree
          tree={browser.tree}
          activeFolderId={browser.activeFolderId}
          onSelect={(folderId) => browser.setActiveFolderId(folderId)}
          onCreateFolder={
            browser.canCreateFolder
              ? (parentId) =>
                  onCreateFolderClick
                    ? onCreateFolderClick(parentId)
                    : browser.createFolder("New Folder", parentId)
              : undefined
          }
          onDrop={handleDrop}
          draggingItem={browser.draggingItem}
          onDragStart={browser.beginDrag}
          onDragEnd={browser.endDrag}
        />
      </aside>
      <main className="flex-1 space-y-6">
        <DriveBreadcrumb
          items={browser.breadcrumbs}
          onNavigate={(folderId) => browser.setActiveFolderId(folderId)}
        />
        <DriveToolbar
          search={browser.search}
          onSearchChange={browser.setSearch}
          layout={browser.layout}
          onChangeLayout={browser.setLayout}
          canUpload={browser.canUpload}
          canCreateFolder={browser.canCreateFolder}
          onUploadClick={onUploadClick}
          onNewFolder={
            browser.canCreateFolder
              ? () =>
                  onCreateFolderClick
                    ? onCreateFolderClick(browser.activeFolderId)
                    : browser.createFolder("New Folder", browser.activeFolderId)
              : undefined
          }
          rightSlot={extraToolbarContent}
        />
        <DriveFileGrid
          layout={browser.layout}
          folders={browser.childFolders}
          assets={browser.childAssets}
          deliveries={browser.childDeliveries}
          onOpenFolder={browser.setActiveFolderId}
          onPreviewAsset={onPreviewAsset}
          onPreviewDelivery={onPreviewDelivery}
          onDownloadAsset={onDownloadAsset}
          onDownloadDelivery={onDownloadDelivery}
          onDeleteAsset={onDeleteAsset}
          onDeleteDelivery={onDeleteDelivery}
          onRenameFolder={onRenameFolder}
          onDeleteFolder={onDeleteFolder}
          deletingAssetId={deletingAssetId}
          deletingDeliveryId={deletingDeliveryId}
          renamingFolderId={renamingFolderId}
          deletingFolderId={deletingFolderId}
          onDropItem={handleDrop}
          onDragStart={browser.beginDrag}
          onDragEnd={browser.endDrag}
          draggingItem={browser.draggingItem}
          emptyState={emptyState}
        />
      </main>
    </div>
  );
};

export default DriveBrowserView;

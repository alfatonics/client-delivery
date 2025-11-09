"use client";

import { useEffect, useState, use, useRef, useMemo, useCallback } from "react";
import type { DragEvent } from "react";
import Link from "next/link";
import DriveFileIcon from "@/app/components/drive/DriveFileIcon";
import DriveBrowserView from "@/app/components/drive/browser/DriveBrowserView";
import { useDriveBrowser } from "@/app/components/drive/browser/useDriveBrowser";
import type {
  DriveAsset,
  DriveDelivery,
  DriveDraggableItem,
  DriveFolder,
} from "@/app/components/drive/browser/types";
import { formatFileSize, isImage, isVideo } from "@/app/lib/drive-utils";

type Asset = {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  type: string;
  createdAt: string;
  folderId?: string | null;
  folder?: { id: string; name: string } | null;
  uploadedBy?: { id: string; email: string; name: string | null } | null;
};

type Delivery = {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
  folderId?: string | null;
  folder?: { id: string; name: string } | null;
  uploadedBy: { id: string; email: string; name: string | null };
};

type Folder = {
  id: string;
  name: string;
  type: "PROJECT" | "ASSETS" | "DELIVERABLES";
  createdAt: string;
  parentId: string | null;
  _count: { assets: number; deliveries: number };
};

type Project = {
  id: string;
  title: string | null;
  description: string | null;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  client: { id: string; email: string; name: string | null };
  assets: Asset[];
  deliveries: Delivery[];
  folders: Folder[];
  completionSubmittedAt: string | null;
  completionNotifiedAt: string | null;
};

type PreviewItem =
  | {
      kind: "asset";
      data: Asset;
    }
  | {
      kind: "delivery";
      data: Delivery;
    }
  | null;

export default function StaffProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingDeliveries, setUploadingDeliveries] = useState(false);
  const [deliveryUploadProgress, setDeliveryUploadProgress] = useState(0);
  const [deliveryUploadTotal, setDeliveryUploadTotal] = useState(0);
  const [currentDeliveryUploadName, setCurrentDeliveryUploadName] = useState<
    string | null
  >(null);
  const [currentDeliveryUploadIndex, setCurrentDeliveryUploadIndex] =
    useState(0);
  const [uploadingAssets, setUploadingAssets] = useState(false);
  const [assetUploadProgress, setAssetUploadProgress] = useState(0);
  const [assetUploadTotal, setAssetUploadTotal] = useState(0);
  const [currentAssetUploadName, setCurrentAssetUploadName] = useState<
    string | null
  >(null);
  const [currentAssetUploadIndex, setCurrentAssetUploadIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const deliveryInputRef = useRef<HTMLInputElement | null>(null);
  const assetInputRef = useRef<HTMLInputElement | null>(null);
  const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null);
  const [deletingDeliveryId, setDeletingDeliveryId] = useState<string | null>(
    null
  );
  const [deletingFolderId, setDeletingFolderId] = useState<string | null>(null);
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    role: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<PreviewItem>(null);

  const formatDateTime = (value: string | null | undefined) => {
    if (!value) return null;
    try {
      return new Date(value).toLocaleString();
    } catch (e) {
      return value;
    }
  };

  const fetchProject = useCallback(async () => {
    try {
      setLoading(true);
      const baseUrl =
        typeof window !== "undefined" ? window.location.origin : "";
      const res = await fetch(`${baseUrl}/api/projects/${id}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(
          errorText || `Failed to fetch project: ${res.statusText}`
        );
      }
      const data = await res.json();
      setProject(data);
    } catch (e: any) {
      setError(e.message || "Failed to fetch project");
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchCurrentUser = useCallback(async () => {
    try {
      const baseUrl =
        typeof window !== "undefined" ? window.location.origin : "";
      const res = await fetch(`${baseUrl}/api/auth/me`, {
        credentials: "include",
        cache: "no-store",
      });
      if (res.ok) {
        const user = await res.json();
        setCurrentUser(user);
      }
    } catch (e) {
      console.error("Failed to fetch current user:", e);
    }
  }, []);

  useEffect(() => {
    void fetchProject();
    void fetchCurrentUser();
  }, [fetchProject, fetchCurrentUser]);

  const folders = project?.folders ?? [];
  const assetsList = project?.assets ?? [];
  const deliveriesList = project?.deliveries ?? [];

  const driveFolders = useMemo<DriveFolder[]>(
    () =>
      folders.map((folder) => ({
        id: folder.id,
        name: folder.name,
        parentId: folder.parentId ?? null,
        type: folder.type,
        createdAt: folder.createdAt,
        _count: folder._count,
      })),
    [folders]
  );

  const driveAssets = useMemo<DriveAsset[]>(
    () =>
      assetsList.map((asset) => ({
        id: asset.id,
        filename: asset.filename,
        contentType: asset.contentType,
        sizeBytes: asset.sizeBytes,
        folderId: asset.folderId ?? null,
        uploadedAt: asset.createdAt,
        uploadedBy: asset.uploadedBy ?? null,
      })),
    [assetsList]
  );

  const driveDeliveries = useMemo<DriveDelivery[]>(
    () =>
      deliveriesList.map((delivery) => ({
        id: delivery.id,
        filename: delivery.filename,
        contentType: delivery.contentType,
        sizeBytes: delivery.sizeBytes,
        folderId: delivery.folderId ?? null,
        uploadedAt: delivery.createdAt,
        uploadedBy: delivery.uploadedBy ?? null,
      })),
    [deliveriesList]
  );

  const handleMoveItem = useCallback(
    async (item: DriveDraggableItem, targetFolderId: string | null) => {
      try {
        setError(null);
        if (item.kind === "FOLDER") {
          const res = await fetch(`/api/projects/${id}/folders/${item.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ parentId: targetFolderId }),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || "Failed to move folder");
          }
        } else if (item.kind === "ASSET") {
          if (targetFolderId) {
            const targetFolder = folders.find((f) => f.id === targetFolderId);
            if (!targetFolder || targetFolder.type !== "ASSETS") {
              throw new Error("Assets can only be moved into Assets folders.");
            }
          }
          const res = await fetch(`/api/assets/${item.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ folderId: targetFolderId }),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || "Failed to move asset");
          }
        } else if (item.kind === "DELIVERY") {
          if (targetFolderId) {
            const targetFolder = folders.find((f) => f.id === targetFolderId);
            if (
              !targetFolder ||
              (targetFolder.type !== "PROJECT" &&
                targetFolder.type !== "DELIVERABLES")
            ) {
              throw new Error(
                "Deliveries can only be moved into Project or Deliverables folders."
              );
            }
          }
          const res = await fetch(`/api/deliveries/${item.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ folderId: targetFolderId }),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || "Failed to move delivery");
          }
        }
        await fetchProject();
      } catch (e: any) {
        console.error("Move error:", e);
        setError(e.message || "Failed to move item");
      }
    },
    [id, folders, fetchProject]
  );

  const handleCreateFolder = useCallback(
    async (name: string, parentId: string | null) => {
      const trimmed = name.trim();
      if (!trimmed) return Promise.reject(new Error("Folder name is required"));
      try {
        setError(null);
        const res = await fetch(`/api/projects/${id}/folders`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: trimmed, parentId }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to create folder");
        }
        const created = await res.json();
        await fetchProject();
        return created as DriveFolder;
      } catch (e: any) {
        console.error("Create folder error:", e);
        setError(e.message || "Failed to create folder");
        throw e;
      }
    },
    [id, fetchProject]
  );

  const handleDeleteFolder = useCallback(
    async (folder: DriveFolder) => {
      if (
        !confirm(
          `Are you sure you want to delete “${folder.name}”? Contents will move to the parent folder.`
        )
      ) {
        return;
      }
      setDeletingFolderId(folder.id);
      setError(null);
      try {
        const res = await fetch(`/api/projects/${id}/folders/${folder.id}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to delete folder");
        }
        await fetchProject();
      } catch (e: any) {
        console.error("Delete folder error:", e);
        setError(e.message || "Failed to delete folder");
      } finally {
        setDeletingFolderId(null);
      }
    },
    [fetchProject, id]
  );

  const handleRenameFolder = useCallback(
    async (folder: DriveFolder) => {
      const proposed = window.prompt("Rename folder", folder.name)?.trim();
      if (!proposed || proposed === folder.name) {
        return;
      }
      setRenamingFolderId(folder.id);
      setError(null);
      try {
        const res = await fetch(`/api/projects/${id}/folders/${folder.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: proposed }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to rename folder");
        }
        await fetchProject();
      } catch (e: any) {
        console.error("Rename folder error:", e);
        setError(e.message || "Failed to rename folder");
      } finally {
        setRenamingFolderId(null);
      }
    },
    [fetchProject, id]
  );

  const driveBrowser = useDriveBrowser({
    folders: driveFolders,
    assets: driveAssets,
    deliveries: driveDeliveries,
    canUpload: true,
    canCreateFolder: true,
    onMove: handleMoveItem,
    onCreateFolder: handleCreateFolder,
  });

  const { activeFolderId, setActiveFolderId } = driveBrowser;

  useEffect(() => {
    if (!project || activeFolderId) return;
    const defaultFolder =
      project.folders.find((f) => f.type === "ASSETS") ??
      project.folders.find((f) => f.type === "DELIVERABLES") ??
      project.folders[0];
    if (defaultFolder) {
      setActiveFolderId(defaultFolder.id);
    }
  }, [project, activeFolderId, setActiveFolderId]);

  const resolveAssetFolderId = useCallback(() => {
    if (activeFolderId) {
      const folder = folders.find((f) => f.id === activeFolderId);
      if (!folder || folder.type !== "ASSETS") {
        throw new Error("Choose an Assets folder before uploading files.");
      }
      return folder.id;
    }
    const assetsFolder = folders.find((f) => f.type === "ASSETS");
    if (!assetsFolder) {
      throw new Error("No Assets folder found. Please contact the admin team.");
    }
    return assetsFolder.id;
  }, [activeFolderId, folders]);

  const resolveDeliveryFolderId = useCallback(() => {
    if (activeFolderId) {
      const folder = folders.find((f) => f.id === activeFolderId);
      if (
        !folder ||
        (folder.type !== "DELIVERABLES" && folder.type !== "PROJECT")
      ) {
        throw new Error(
          "Choose a Project or Deliverables folder before uploading deliveries."
        );
      }
      return folder.id;
    }
    const deliverablesFolder = folders.find((f) => f.type === "DELIVERABLES");
    if (deliverablesFolder) return deliverablesFolder.id;
    const projectFolder = folders.find((f) => f.type === "PROJECT");
    if (projectFolder) return projectFolder.id;
    throw new Error(
      "No Deliverables or Project folder found. Please create a folder first."
    );
  }, [activeFolderId, folders]);

  const uploadAssets = useCallback(
    async (incoming: FileList | File[]) => {
      const files =
        incoming instanceof FileList ? Array.from(incoming) : [...incoming];
      if (files.length === 0) return;

      try {
        const targetFolderId = resolveAssetFolderId();
        setUploadingAssets(true);
        setError(null);
        setAssetUploadTotal(files.length);
        setAssetUploadProgress(0);

        for (let index = 0; index < files.length; index++) {
          const currentFile = files[index];
          setCurrentAssetUploadName(currentFile.name);
          setCurrentAssetUploadIndex(index + 1);

          const initRes = await fetch(`/api/projects/${id}/assets`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              filename: currentFile.name,
              contentType: currentFile.type || "application/octet-stream",
              sizeBytes: currentFile.size,
              folderId: targetFolderId,
            }),
          });

          if (!initRes.ok) {
            const errorData = await initRes
              .json()
              .catch(() => ({ error: "Failed to initialize upload" }));
            throw new Error(
              errorData.error ||
                `Upload initialization failed for ${currentFile.name}: ${initRes.status}`
            );
          }

          const init = await initRes.json();
          const { uploadId, key, partSize, presignedPartUrls, completeUrl } =
            init;

          if (
            !Array.isArray(presignedPartUrls) ||
            presignedPartUrls.length === 0
          ) {
            throw new Error(
              `Invalid response from server for ${currentFile.name}: missing presigned URLs`
            );
          }

          const totalParts = presignedPartUrls.length;
          const etags: { ETag: string; PartNumber: number }[] = [];

          for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
            const start = (partNumber - 1) * partSize;
            const end = Math.min(start + partSize, currentFile.size);
            const blob = currentFile.slice(start, end);

            const res = await fetch(
              `/api/r2/upload-part?url=${encodeURIComponent(
                presignedPartUrls[partNumber - 1]
              )}`,
              {
                method: "PUT",
                body: blob,
                headers: {
                  "Content-Type":
                    currentFile.type || "application/octet-stream",
                },
              }
            );

            if (!res.ok) {
              const errorData = await res.json().catch(() => ({}));
              throw new Error(
                `Part ${partNumber} upload failed for ${currentFile.name}: ${
                  errorData.error || res.statusText
                }`
              );
            }

            const data = await res.json();
            if (!data.etag) {
              throw new Error(
                `Part ${partNumber} upload failed for ${currentFile.name}: no ETag received`
              );
            }
            etags.push({ ETag: data.etag, PartNumber: partNumber });

            const overallProgress =
              ((index + (partNumber - 1) / totalParts) / files.length) * 100;
            setAssetUploadProgress(Math.min(99, Math.round(overallProgress)));
          }

          const completeRes = await fetch(completeUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              key,
              uploadId,
              parts: etags,
              filename: currentFile.name,
              contentType: currentFile.type || "application/octet-stream",
              sizeBytes: currentFile.size,
              folderId: targetFolderId,
            }),
          });

          if (!completeRes.ok) {
            const errorData = await completeRes.json().catch(() => ({}));
            throw new Error(
              errorData.error ||
                `Upload completion failed for ${currentFile.name}: ${completeRes.status}`
            );
          }

          const completionProgress = ((index + 1) / files.length) * 100;
          setAssetUploadProgress(Math.round(completionProgress));
        }

        await fetchProject();
        setAssetUploadProgress(100);
        setTimeout(() => setAssetUploadProgress(0), 400);
      } catch (e: any) {
        console.error("Asset upload error:", e);
        setError(e.message || "Failed to upload assets");
        setAssetUploadProgress(0);
      } finally {
        setUploadingAssets(false);
        setCurrentAssetUploadName(null);
        setCurrentAssetUploadIndex(0);
        setAssetUploadTotal(0);
      }
    },
    [fetchProject, id, resolveAssetFolderId]
  );

  const uploadDeliveries = useCallback(
    async (incoming: FileList | File[]) => {
      const files =
        incoming instanceof FileList ? Array.from(incoming) : [...incoming];
      if (files.length === 0) return;

      try {
        const targetFolderId = resolveDeliveryFolderId();
        setUploadingDeliveries(true);
        setError(null);
        setDeliveryUploadTotal(files.length);
        setDeliveryUploadProgress(0);

        for (let index = 0; index < files.length; index++) {
          const currentFile = files[index];
          setCurrentDeliveryUploadName(currentFile.name);
          setCurrentDeliveryUploadIndex(index + 1);

          const initRes = await fetch(`/api/projects/${id}/deliveries`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              filename: currentFile.name,
              contentType: currentFile.type || "application/octet-stream",
              sizeBytes: currentFile.size,
              folderId: targetFolderId,
            }),
          });

          if (!initRes.ok) {
            const errorData = await initRes
              .json()
              .catch(() => ({ error: "Failed to initialize upload" }));
            throw new Error(
              errorData.error ||
                `Upload initialization failed for ${currentFile.name}: ${initRes.status}`
            );
          }

          const init = await initRes.json();
          const { uploadId, key, partSize, presignedPartUrls, completeUrl } =
            init;

          if (
            !Array.isArray(presignedPartUrls) ||
            presignedPartUrls.length === 0
          ) {
            throw new Error(
              `Invalid response from server for ${currentFile.name}: missing presigned URLs`
            );
          }

          const totalParts = presignedPartUrls.length;
          const etags: { ETag: string; PartNumber: number }[] = [];

          for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
            const start = (partNumber - 1) * partSize;
            const end = Math.min(start + partSize, currentFile.size);
            const blob = currentFile.slice(start, end);

            const res = await fetch(
              `/api/r2/upload-part?url=${encodeURIComponent(
                presignedPartUrls[partNumber - 1]
              )}`,
              {
                method: "PUT",
                body: blob,
                headers: {
                  "Content-Type":
                    currentFile.type || "application/octet-stream",
                },
              }
            );

            if (!res.ok) {
              const errorData = await res.json().catch(() => ({}));
              throw new Error(
                `Part ${partNumber} upload failed for ${currentFile.name}: ${
                  errorData.error || res.statusText
                }`
              );
            }

            const data = await res.json();
            if (!data.etag) {
              throw new Error(
                `Part ${partNumber} upload failed for ${currentFile.name}: no ETag received`
              );
            }
            etags.push({ ETag: data.etag, PartNumber: partNumber });

            const overallProgress =
              ((index + (partNumber - 1) / totalParts) / files.length) * 100;
            setDeliveryUploadProgress(
              Math.min(99, Math.round(overallProgress))
            );
          }

          const completeRes = await fetch(completeUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              key,
              uploadId,
              parts: etags,
              filename: currentFile.name,
              contentType: currentFile.type || "application/octet-stream",
              sizeBytes: currentFile.size,
              folderId: targetFolderId,
            }),
          });

          if (!completeRes.ok) {
            const errorData = await completeRes.json().catch(() => ({}));
            throw new Error(
              errorData.error ||
                `Upload completion failed for ${currentFile.name}: ${completeRes.status}`
            );
          }

          const completionProgress = ((index + 1) / files.length) * 100;
          setDeliveryUploadProgress(Math.round(completionProgress));
        }

        await fetchProject();
        setDeliveryUploadProgress(100);
        setTimeout(() => setDeliveryUploadProgress(0), 400);
      } catch (e: any) {
        console.error("Delivery upload error:", e);
        setError(e.message || "Failed to upload deliveries");
        setDeliveryUploadProgress(0);
      } finally {
        setUploadingDeliveries(false);
        setCurrentDeliveryUploadName(null);
        setCurrentDeliveryUploadIndex(0);
        setDeliveryUploadTotal(0);
      }
    },
    [fetchProject, id, resolveDeliveryFolderId]
  );

  const handleAssetFiles = useCallback(
    (incoming: FileList | File[]) => {
      if (assetInputRef.current) {
        assetInputRef.current.value = "";
      }
      void uploadAssets(incoming);
    },
    [uploadAssets]
  );

  const handleDeliveryFiles = useCallback(
    (incoming: FileList | File[]) => {
      if (deliveryInputRef.current) {
        deliveryInputRef.current.value = "";
      }
      void uploadDeliveries(incoming);
    },
    [uploadDeliveries]
  );

  const handleUploadClick = useCallback(() => {
    try {
      if (!activeFolderId) {
        assetInputRef.current?.click();
        return;
      }
      const targetFolder = folders.find((f) => f.id === activeFolderId);
      if (!targetFolder) {
        throw new Error(
          "Selected folder is no longer available. Reload and try again."
        );
      }
      if (targetFolder.type === "ASSETS") {
        assetInputRef.current?.click();
      } else {
        deliveryInputRef.current?.click();
      }
    } catch (e: any) {
      setError(e.message || "Select a valid folder before uploading files.");
    }
  }, [activeFolderId, folders]);

  const handleUploadDragOver = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (!Array.from(event.dataTransfer.types).includes("Files")) {
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    },
    []
  );

  const handleUploadDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (!Array.from(event.dataTransfer.types).includes("Files")) {
        return;
      }
      event.preventDefault();
      const files = event.dataTransfer.files;
      if (!files || files.length === 0) return;
      const targetFolder = activeFolderId
        ? folders.find((f) => f.id === activeFolderId)
        : null;
      if (targetFolder && targetFolder.type === "ASSETS") {
        handleAssetFiles(files);
      } else {
        handleDeliveryFiles(files);
      }
    },
    [activeFolderId, folders, handleAssetFiles, handleDeliveryFiles]
  );

  const handleCreateFolderClick = useCallback(
    async (parentId: string | null) => {
      const defaultName = "New Folder";
      const name = window.prompt("Folder name", defaultName);
      if (!name) return;
      try {
        await handleCreateFolder(name, parentId);
      } catch (e) {
        // errors handled inside handleCreateFolder
      }
    },
    [handleCreateFolder]
  );

  const handlePreviewAsset = useCallback(
    (asset: DriveAsset) => {
      const full = assetsList.find((item) => item.id === asset.id);
      if (full) {
        setPreviewItem({ kind: "asset", data: full });
      }
    },
    [assetsList]
  );

  const handlePreviewDelivery = useCallback(
    (delivery: DriveDelivery) => {
      const full = deliveriesList.find((item) => item.id === delivery.id);
      if (full) {
        setPreviewItem({ kind: "delivery", data: full });
      }
    },
    [deliveriesList]
  );

  const handleDownloadAsset = useCallback((asset: DriveAsset) => {
    window.open(
      `/api/assets/${asset.id}/download`,
      "_blank",
      "noopener,noreferrer"
    );
  }, []);

  const handleDownloadDelivery = useCallback((delivery: DriveDelivery) => {
    window.open(
      `/api/deliveries/${delivery.id}/download`,
      "_blank",
      "noopener,noreferrer"
    );
  }, []);

  const handleDeleteAsset = useCallback(
    async (asset: DriveAsset) => {
      if (!confirm("Are you sure you want to delete this asset?")) return;
      setDeletingAssetId(asset.id);
      try {
        const res = await fetch(`/api/assets/${asset.id}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to delete asset");
        }
        await fetchProject();
      } catch (e: any) {
        setError(e.message || "Failed to delete asset");
      } finally {
        setDeletingAssetId(null);
      }
    },
    [fetchProject]
  );

  const handleDeleteDelivery = useCallback(
    async (delivery: DriveDelivery) => {
      if (!confirm("Are you sure you want to delete this delivery?")) return;
      setDeletingDeliveryId(delivery.id);
      try {
        const res = await fetch(`/api/deliveries/${delivery.id}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to delete delivery");
        }
        await fetchProject();
      } catch (e: any) {
        setError(e.message || "Failed to delete delivery");
      } finally {
        setDeletingDeliveryId(null);
      }
    },
    [fetchProject]
  );

  const updateStatus = useCallback(
    async (status: "PENDING" | "IN_PROGRESS" | "COMPLETED") => {
      setSubmitError(null);
      setSubmitSuccess(null);
      try {
        const res = await fetch(`/api/projects/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to update status");
        }
        await fetchProject();
      } catch (e: any) {
        setError(e.message || "Failed to update project status");
      }
    },
    [fetchProject, id]
  );

  const submitProject = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);
    try {
      const res = await fetch(`/api/projects/${id}/submit`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          data.error || "Failed to submit project for admin review."
        );
      }
      await fetchProject();
      setSubmitSuccess("Deliveries submitted to the admin for review.");
      setTimeout(() => setSubmitSuccess(null), 5000);
    } catch (e: any) {
      setSubmitError(e.message || "Failed to submit project for review.");
    } finally {
      setSubmitting(false);
    }
  }, [fetchProject, id, submitting]);

  const deliveriesCount = project?.deliveries.length ?? 0;
  const hasDeliveries = deliveriesCount > 0;
  const submittedAtLabel = formatDateTime(project?.completionSubmittedAt);
  const notifiedAtLabel = formatDateTime(project?.completionNotifiedAt);

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return "badge badge-completed";
      case "IN_PROGRESS":
        return "badge badge-in-progress";
      default:
        return "badge badge-pending";
    }
  };

  const closePreview = () => setPreviewItem(null);

  const renderPreview = () => {
    if (!previewItem) return null;

    const isAssetPreview = previewItem.kind === "asset";
    const file = previewItem.data;
    const streamUrl = isAssetPreview
      ? `/api/assets/${file.id}/stream`
      : `/api/deliveries/${file.id}/stream`;
    const downloadUrl = isAssetPreview
      ? `/api/assets/${file.id}/download`
      : `/api/deliveries/${file.id}/download`;

    const filename = file.filename;
    const contentType = "contentType" in file ? file.contentType : "";
    const mimeType = contentType?.toLowerCase() || "";
    const canShowImage = isImage(mimeType, filename);
    const canShowVideo = isVideo(mimeType, filename);
    const canShowAudio = mimeType.startsWith("audio/");

    let body: JSX.Element = (
      <div className="text-center text-[#5f6368]">
        <div className="mb-4 flex justify-center">
          <DriveFileIcon
            type="OTHER"
            contentType={mimeType}
            filename={filename}
            size={40}
          />
        </div>
        <p>Preview is not available for this file type.</p>
      </div>
    );

    if (canShowImage) {
      body = (
        <img
          src={streamUrl}
          alt={filename}
          className="max-h-[70vh] max-w-full object-contain"
        />
      );
    } else if (canShowVideo) {
      body = (
        <video
          controls
          src={streamUrl}
          className="max-h-[70vh] w-full rounded-lg bg-black"
        />
      );
    } else if (canShowAudio) {
      body = (
        <audio controls className="w-full">
          <source src={streamUrl} type={mimeType || "audio/mpeg"} />
          Your browser does not support the audio element.
        </audio>
      );
    }

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6"
        onClick={closePreview}
        role="dialog"
        aria-modal="true"
      >
        <div
          className="w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between border-b border-[#dadce0] bg-[#f8f9fa] px-6 py-4">
            <div>
              <h3 className="text-lg font-medium text-[#202124]">{filename}</h3>
              <div className="text-sm text-[#5f6368]">
                {formatFileSize(file.sizeBytes)}
              </div>
            </div>
            <button
              onClick={closePreview}
              className="btn-icon text-[#5f6368] hover:text-[#202124]"
              aria-label="Close preview"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path
                  d="M18 6L6 18M6 6l12 12"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
          <div className="flex max-h-[70vh] items-center justify-center overflow-auto bg-[#f8f9fa] p-6">
            {body}
          </div>
          <div className="flex items-center justify-end gap-3 border-t border-[#dadce0] bg-white px-6 py-4">
            <a href={downloadUrl} className="btn-secondary" target="_blank">
              Download
            </a>
            <button onClick={closePreview} className="btn-primary">
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="drive-container p-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-[#5f6368]">Loading...</div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="drive-container p-8">
        <div className="text-[#5f6368]">Project not found</div>
      </div>
    );
  }

  return (
    <div className="drive-container">
      <div className="bg-white border-b border-[#dadce0] px-6 py-4">
        <div className="flex items-center justify-between max-w-[1800px] mx-auto">
          <div className="flex items-center gap-4 flex-wrap">
            <Link href="/staff" className="btn-icon" title="Back">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-2xl font-normal text-[#202124]">
                {project.title || `Project ${project.id.slice(0, 8)}`}
              </h1>
              <div className="text-sm text-[#5f6368] mt-1">
                Client: {project.client.email}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap justify-end">
            <span className={getStatusBadgeClass(project.status)}>
              {project.status.replace("_", " ")}
            </span>
            {project.status !== "COMPLETED" && (
              <button
                onClick={submitProject}
                disabled={submitting || !hasDeliveries}
                className="btn-primary text-sm disabled:opacity-60"
              >
                {submitting ? "Submitting..." : "Submit Deliveries"}
              </button>
            )}
            {project.status !== "IN_PROGRESS" && (
              <button
                onClick={() => updateStatus("IN_PROGRESS")}
                className="btn-secondary text-sm"
              >
                Mark In Progress
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="p-6 max-w-[1800px] mx-auto space-y-6">
        {error && (
          <div className="card bg-red-50 border-red-200 text-red-600">
            {error}
          </div>
        )}
        {!hasDeliveries && project.status !== "COMPLETED" && (
          <div className="card bg-yellow-50 border-yellow-200 text-[#92400e]">
            Upload at least one delivery before submitting the project to the
            admin.
          </div>
        )}
        {submitError && (
          <div className="card bg-red-50 border-red-200 text-red-600">
            {submitError}
          </div>
        )}
        {submitSuccess && (
          <div className="card bg-green-50 border-green-200 text-green-700">
            {submitSuccess}
          </div>
        )}
        {submittedAtLabel && (
          <div className="card bg-blue-50 border-blue-200 text-[#1e3a8a] space-y-1">
            <p className="font-medium">
              Submitted for admin review on {submittedAtLabel}
            </p>
            {notifiedAtLabel ? (
              <p className="text-sm">
                Client email sent on {notifiedAtLabel}. If adjustments are
                required, contact the admin team.
              </p>
            ) : (
              <p className="text-sm">
                Waiting for the admin to review and notify the client.
              </p>
            )}
          </div>
        )}
        {project.description && (
          <div className="card">
            <h2 className="font-medium text-[#202124] mb-2">Description</h2>
            <p className="text-[#5f6368]">{project.description}</p>
          </div>
        )}

        <section
          className="space-y-4"
          onDragOver={handleUploadDragOver}
          onDrop={handleUploadDrop}
        >
          <DriveBrowserView
            browser={driveBrowser}
            assets={driveAssets}
            deliveries={driveDeliveries}
            onPreviewAsset={handlePreviewAsset}
            onPreviewDelivery={handlePreviewDelivery}
            onDownloadAsset={handleDownloadAsset}
            onDownloadDelivery={handleDownloadDelivery}
            onDeleteAsset={handleDeleteAsset}
            onDeleteDelivery={handleDeleteDelivery}
            onRenameFolder={handleRenameFolder}
            onDeleteFolder={handleDeleteFolder}
            deletingAssetId={deletingAssetId}
            deletingDeliveryId={deletingDeliveryId}
            deletingFolderId={deletingFolderId}
            renamingFolderId={renamingFolderId}
            onUploadClick={handleUploadClick}
            onCreateFolderClick={handleCreateFolderClick}
            extraToolbarContent={
              <>
                <input
                  ref={assetInputRef}
                  type="file"
                  multiple
                  accept="*/*"
                  className="sr-only"
                  onChange={(event) => {
                    if (event.target.files) {
                      handleAssetFiles(event.target.files);
                    }
                  }}
                />
                <input
                  ref={deliveryInputRef}
                  type="file"
                  multiple
                  accept="*/*"
                  className="sr-only"
                  onChange={(event) => {
                    if (event.target.files) {
                      handleDeliveryFiles(event.target.files);
                    }
                  }}
                />
              </>
            }
            emptyState={
              <div className="text-sm text-[#5f6368]">
                No folders or files yet. Use the toolbar to create folders or
                upload project assets.
              </div>
            }
          />

          {(uploadingAssets || uploadingDeliveries) && (
            <div className="space-y-3">
              {uploadingAssets && (
                <div className="rounded-lg border border-[#dadce0] bg-white px-4 py-3 shadow-sm">
                  <div className="flex items-center justify-between text-sm text-[#202124]">
                    <span>
                      Uploading {currentAssetUploadName || "files"} (
                      {currentAssetUploadIndex}/{Math.max(assetUploadTotal, 1)})
                    </span>
                    <span>{assetUploadProgress}%</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-[#e8eaed]">
                    <div
                      className="h-2 rounded-full bg-[#1a73e8] transition-all"
                      style={{ width: `${assetUploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
              {uploadingDeliveries && (
                <div className="rounded-lg border border-[#dadce0] bg-white px-4 py-3 shadow-sm">
                  <div className="flex items-center justify-between text-sm text-[#202124]">
                    <span>
                      Uploading {currentDeliveryUploadName || "files"} (
                      {currentDeliveryUploadIndex}/
                      {Math.max(deliveryUploadTotal, 1)})
                    </span>
                    <span>{deliveryUploadProgress}%</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-[#e8eaed]">
                    <div
                      className="h-2 rounded-full bg-[#34a853] transition-all"
                      style={{ width: `${deliveryUploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
      {renderPreview()}
    </div>
  );
}

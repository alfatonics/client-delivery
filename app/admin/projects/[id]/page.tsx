"use client";

import { useEffect, useState, use, useRef, useMemo, useCallback } from "react";
import type { DragEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { generateFriendlyPassword } from "@/app/lib/password";
import { useDriveBrowser } from "@/app/components/drive/browser/useDriveBrowser";
import DriveBrowserView from "@/app/components/drive/browser/DriveBrowserView";
import type {
  DriveDraggableItem,
  DriveFolder,
} from "@/app/components/drive/browser/types";
import DriveFileIcon from "@/app/components/drive/DriveFileIcon";
import {
  dropContainsDirectory,
  extractDroppedFiles,
  formatFileSize,
  isImage,
  isVideo,
} from "@/app/lib/drive-utils";

type Asset = {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  type: string;
  folderId?: string | null;
  folder?: { id: string; name: string } | null;
  uploadedBy?: { id: string; email: string; name: string | null };
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

type Staff = {
  id: string;
  email: string;
  name: string | null;
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
  staff: { id: string; email: string; name: string | null } | null;
  createdBy: {
    id: string;
    email: string;
    name: string | null;
    role: string;
  } | null;
  assets: Asset[];
  deliveries: Delivery[];
  folders: Folder[];
  completionSubmittedAt: string | null;
  completionSubmittedBy: {
    id: string;
    email: string;
    name: string | null;
    role: string;
  } | null;
  completionNotifiedAt: string | null;
  completionNotifiedBy: {
    id: string;
    email: string;
    name: string | null;
    role: string;
  } | null;
  completionNotificationEmail?: string | null;
  completionNotificationCc?: string | null;
};

type UploadTaskKind = "asset" | "delivery";

type UploadTask = {
  id: string;
  kind: UploadTaskKind;
  totalFiles: number;
  currentFileIndex: number;
  currentFileName: string | null;
  progress: number;
  status: "uploading" | "completed" | "error";
  error?: string;
};

type PreviewItem =
  | { kind: "asset"; data: Asset }
  | { kind: "delivery"; data: Delivery }
  | null;

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { id } = use(params);
  const [project, setProject] = useState<Project | null>(null);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const assetInputRef = useRef<HTMLInputElement | null>(null);
  const deliveryInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadTasks, setUploadTasks] = useState<UploadTask[]>([]);
  const [notifyEmail, setNotifyEmail] = useState("");
  const [notifyCc, setNotifyCc] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [notifyError, setNotifyError] = useState<string | null>(null);
  const [notifySuccess, setNotifySuccess] = useState<string | null>(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [copied, setCopied] = useState(false);
  const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null);
  const [deletingDeliveryId, setDeletingDeliveryId] = useState<string | null>(
    null
  );
  const [deletingFolderId, setDeletingFolderId] = useState<string | null>(null);
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<PreviewItem>(null);
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    role: string;
  } | null>(null);
  const [sendingStaffEmail, setSendingStaffEmail] = useState(false);
  const [staffEmailError, setStaffEmailError] = useState<string | null>(null);
  const [staffEmailSuccess, setStaffEmailSuccess] = useState<string | null>(
    null
  );

  const folders: Folder[] = project?.folders ?? [];
  const assetsList = project?.assets ?? [];
  const deliveriesList = project?.deliveries ?? [];

  const fetchData = useCallback(async () => {
    try {
      const baseUrl =
        typeof window !== "undefined" ? window.location.origin : "";
      const projectUrl = `${baseUrl}/api/projects/${id}`;
      const staffUrl = `${baseUrl}/api/admin/staff`;
      const [projectRes, staffRes] = await Promise.all([
        fetch(projectUrl, {
          credentials: "include",
          cache: "no-store",
        }),
        fetch(staffUrl, {
          credentials: "include",
          cache: "no-store",
        }),
      ]);

      if (!projectRes.ok) {
        const errorText = await projectRes.text();
        console.error("Project fetch failed:", projectRes.status, errorText);
        throw new Error(`Failed to fetch project: ${projectRes.status}`);
      }

      if (!staffRes.ok) {
        const errorText = await staffRes.text();
        console.error("Staff fetch failed:", staffRes.status, errorText);
        throw new Error(`Failed to fetch staff: ${staffRes.status}`);
      }

      const projectData = await projectRes.json();
      const staffData = await staffRes.json();

      setProject(projectData);
      setStaff(staffData);
      setSelectedStaffId(projectData.staff?.id || "");
      setNotifyEmail(
        projectData.completionNotificationEmail ||
          projectData.client.email ||
          ""
      );
      setNotifyCc(projectData.completionNotificationCc || "");
      const initialLoginEmail = projectData.client?.email || "";
      setLoginEmail(initialLoginEmail);
      const generatedPassword = generateFriendlyPassword(
        initialLoginEmail,
        projectData.client?.name || null
      );
      setLoginPassword(generatedPassword);
    } catch (e: any) {
      console.error("Fetch error:", e);
      setError(e.message || "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }, [id]);

  const driveFolders = useMemo(
    () =>
      folders.map((folder) => ({
        ...folder,
        parentId: folder.parentId ?? null,
        _count: folder._count ?? { assets: 0, deliveries: 0 },
      })),
    [folders]
  );

  const driveAssets = useMemo(
    () =>
      assetsList.map((asset) => ({
        id: asset.id,
        filename: asset.filename,
        contentType: asset.contentType,
        sizeBytes: asset.sizeBytes,
        folderId: asset.folderId ?? null,
        uploadedBy: asset.uploadedBy ?? null,
      })),
    [assetsList]
  );

  const driveDeliveries = useMemo(
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
            body: JSON.stringify({ parentId: targetFolderId ?? null }),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || "Failed to move folder");
          }
        } else if (item.kind === "ASSET") {
          if (targetFolderId) {
            const targetFolder = folders.find((f) => f.id === targetFolderId);
            if (targetFolder && targetFolder.type !== "ASSETS") {
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
              targetFolder &&
              targetFolder.type !== "DELIVERABLES" &&
              targetFolder.type !== "PROJECT"
            ) {
              throw new Error(
                "Deliveries can only be moved into Deliverables or Project folders."
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
        await fetchData();
      } catch (e: any) {
        console.error("Move error:", e);
        setError(e.message || "Failed to move item");
      }
    },
    [id, folders, fetchData]
  );

  const handleCreateFolderForBrowser = useCallback(
    async (name: string, parentId: string | null) => {
      try {
        setError(null);
        const res = await fetch(`/api/projects/${id}/folders`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            parentId,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to create folder");
        }
        const created = await res.json();
        await fetchData();
        return created;
      } catch (e: any) {
        console.error("Create folder error:", e);
        setError(e.message || "Failed to create folder");
        throw e;
      }
    },
    [id, fetchData]
  );

  const handleDeleteFolder = useCallback(
    async (folder: DriveFolder) => {
      if (
        !confirm(
          `Are you sure you want to delete “${folder.name}”? Nested folders and files will move to the parent folder.`
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
        await fetchData();
      } catch (e: any) {
        console.error("Delete folder error:", e);
        setError(e.message || "Failed to delete folder");
      } finally {
        setDeletingFolderId(null);
      }
    },
    [fetchData, id]
  );

  const handleRenameFolder = useCallback(
    async (folder: DriveFolder) => {
      const suggested = folder.name;
      const nextName = window.prompt("Rename folder", suggested)?.trim();
      if (!nextName || nextName === folder.name) {
        return;
      }
      setRenamingFolderId(folder.id);
      setError(null);
      try {
        const res = await fetch(`/api/projects/${id}/folders/${folder.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: nextName }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to rename folder");
        }
        await fetchData();
      } catch (e: any) {
        console.error("Rename folder error:", e);
        setError(e.message || "Failed to rename folder");
      } finally {
        setRenamingFolderId(null);
      }
    },
    [fetchData, id]
  );

  const handleCreateFolderClick = useCallback(
    (parentId: string | null) => {
      const defaultName = "New Folder";
      const name = window.prompt("Folder name", defaultName)?.trim();
      if (!name) return;
      void handleCreateFolderForBrowser(name, parentId).catch(() => {
        // errors handled in handler
      });
    },
    [handleCreateFolderForBrowser]
  );

  const driveBrowser = useDriveBrowser({
    folders: driveFolders,
    assets: driveAssets,
    deliveries: driveDeliveries,
    canUpload: true,
    canCreateFolder: true,
    onMove: handleMoveItem,
    onCreateFolder: handleCreateFolderForBrowser,
  });

  const resolveAssetFolderId = useCallback(() => {
    const activeId = driveBrowser.activeFolderId;
    if (activeId) {
      const targetFolder = folders.find((f) => f.id === activeId);
      if (!targetFolder || targetFolder.type !== "ASSETS") {
        throw new Error("Select an Assets folder before uploading files.");
      }
      return targetFolder.id;
    }

    const assetsFolder = folders.find((f) => f.type === "ASSETS");
    if (!assetsFolder) {
      throw new Error("No Assets folder found. Please contact support.");
    }
    return assetsFolder.id;
  }, [driveBrowser.activeFolderId, folders]);

  const resolveDeliveryFolderId = useCallback(() => {
    const activeId = driveBrowser.activeFolderId;
    if (activeId) {
      const targetFolder = folders.find((f) => f.id === activeId);
      if (targetFolder) {
        if (
          targetFolder.type === "DELIVERABLES" ||
          targetFolder.type === "PROJECT"
        ) {
          return targetFolder.id;
        }
        if (targetFolder.type === "ASSETS") {
          // Allow uploading deliveries into assets only if explicitly chosen later
          throw new Error(
            "Select a Deliverables or Project folder before uploading deliveries."
          );
        }
      }
    }
    const deliverablesFolder = folders.find((f) => f.type === "DELIVERABLES");
    if (deliverablesFolder) {
      return deliverablesFolder.id;
    }
    const projectFolder = folders.find((f) => f.type === "PROJECT");
    if (projectFolder) {
      return projectFolder.id;
    }
    throw new Error(
      "No Deliverables or Project folder found. Please create a folder first."
    );
  }, [driveBrowser.activeFolderId, folders]);

  const uploadAssets = useCallback(
    async (
      incoming: FileList | File[],
      options?: { targetFolderId?: string | null; refreshAfter?: boolean }
    ) => {
      const files =
        incoming instanceof FileList ? Array.from(incoming) : [...incoming];
      if (files.length === 0) return;

      let taskId: string | null = null;

      try {
        const targetFolderId =
          options?.targetFolderId ?? resolveAssetFolderId();
        const shouldRefresh = options?.refreshAfter ?? true;
        setError(null);
        taskId = `asset-${Date.now()}-${Math.random().toString(16).slice(2)}`;

        setUploadTasks((previous) => [
          ...previous,
          {
            id: taskId!,
            kind: "asset",
            totalFiles: files.length,
            currentFileIndex: files.length > 0 ? 1 : 0,
            currentFileName: files[0]?.name ?? null,
            progress: 0,
            status: "uploading",
          },
        ]);

        const updateTask = (updates: Partial<UploadTask>) => {
          const id = taskId!;
          setUploadTasks((previous) =>
            previous.map((task) =>
              task.id === id ? { ...task, ...updates } : task
            )
          );
        };

        const scheduleRemoval = (delay: number) => {
          const id = taskId!;
          setTimeout(() => {
            setUploadTasks((previous) =>
              previous.filter((task) => task.id !== id)
            );
          }, delay);
        };

        for (let index = 0; index < files.length; index++) {
          const currentFile = files[index];
          updateTask({
            currentFileIndex: index + 1,
            currentFileName: currentFile.name,
          });

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
            const etag = data.etag;
            if (!etag) {
              throw new Error(
                `Part ${partNumber} upload failed for ${currentFile.name}: no ETag received`
              );
            }
            etags.push({ ETag: etag, PartNumber: partNumber });

            const progress =
              ((index + (partNumber - 1) / totalParts) / files.length) * 100;
            updateTask({
              progress: Math.min(99, Math.round(progress)),
              currentFileIndex: index + 1,
              currentFileName: currentFile.name,
            });
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
          updateTask({
            progress: Math.round(completionProgress),
            currentFileIndex: index + 1,
            currentFileName: currentFile.name,
          });
        }

        if (shouldRefresh) {
          await fetchData();
        }
        updateTask({
          progress: 100,
          status: "completed",
          currentFileName: null,
          currentFileIndex: files.length,
        });
        scheduleRemoval(1500);
      } catch (e: any) {
        setError(e.message || "Failed to upload assets");
        if (taskId) {
          setUploadTasks((previous) =>
            previous.map((task) =>
              task.id === taskId
                ? {
                    ...task,
                    status: "error",
                    error: e.message || "Failed to upload assets",
                  }
                : task
            )
          );
          setTimeout(() => {
            setUploadTasks((previous) =>
              previous.filter((task) => task.id !== taskId)
            );
          }, 4000);
        }
      }
    },
    [fetchData, id, resolveAssetFolderId]
  );

  const uploadDeliveries = useCallback(
    async (
      incoming: FileList | File[],
      options?: { targetFolderId?: string | null; refreshAfter?: boolean }
    ) => {
      const files =
        incoming instanceof FileList ? Array.from(incoming) : [...incoming];
      if (files.length === 0) return;

      let taskId: string | null = null;

      try {
        const targetFolderId =
          options?.targetFolderId ?? resolveDeliveryFolderId();
        const shouldRefresh = options?.refreshAfter ?? true;
        setError(null);
        taskId = `delivery-${Date.now()}-${Math.random()
          .toString(16)
          .slice(2)}`;

        setUploadTasks((previous) => [
          ...previous,
          {
            id: taskId!,
            kind: "delivery",
            totalFiles: files.length,
            currentFileIndex: files.length > 0 ? 1 : 0,
            currentFileName: files[0]?.name ?? null,
            progress: 0,
            status: "uploading",
          },
        ]);

        const updateTask = (updates: Partial<UploadTask>) => {
          const id = taskId!;
          setUploadTasks((previous) =>
            previous.map((task) =>
              task.id === id ? { ...task, ...updates } : task
            )
          );
        };

        const scheduleRemoval = (delay: number) => {
          const id = taskId!;
          setTimeout(() => {
            setUploadTasks((previous) =>
              previous.filter((task) => task.id !== id)
            );
          }, delay);
        };

        for (let index = 0; index < files.length; index++) {
          const currentFile = files[index];
          updateTask({
            currentFileIndex: index + 1,
            currentFileName: currentFile.name,
          });

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

            const progress =
              ((index + (partNumber - 1) / totalParts) / files.length) * 100;
            updateTask({
              progress: Math.min(99, Math.round(progress)),
              currentFileIndex: index + 1,
              currentFileName: currentFile.name,
            });
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
          updateTask({
            progress: Math.round(completionProgress),
            currentFileIndex: index + 1,
            currentFileName: currentFile.name,
          });
        }

        if (shouldRefresh) {
          await fetchData();
        }
        updateTask({
          progress: 100,
          status: "completed",
          currentFileName: null,
          currentFileIndex: files.length,
        });
        scheduleRemoval(1500);
      } catch (e: any) {
        setError(e.message || "Failed to upload deliveries");
        if (taskId) {
          setUploadTasks((previous) =>
            previous.map((task) =>
              task.id === taskId
                ? {
                    ...task,
                    status: "error",
                    error: e.message || "Failed to upload deliveries",
                  }
                : task
            )
          );
          setTimeout(() => {
            setUploadTasks((previous) =>
              previous.filter((task) => task.id !== taskId)
            );
          }, 4000);
        }
      }
    },
    [fetchData, id, resolveDeliveryFolderId]
  );

  const handleAssetFiles = useCallback(
    (incoming: FileList | File[]) => {
      const files =
        incoming instanceof FileList ? Array.from(incoming) : [...incoming];
      if (assetInputRef.current) {
        assetInputRef.current.value = "";
      }
      if (files.length === 0) {
        return;
      }
      void uploadAssets(files);
    },
    [uploadAssets]
  );

  const handleDeliveryFiles = useCallback(
    (incoming: FileList | File[]) => {
      const files =
        incoming instanceof FileList ? Array.from(incoming) : [...incoming];
      if (deliveryInputRef.current) {
        deliveryInputRef.current.value = "";
      }
      if (files.length === 0) {
        return;
      }
      void uploadDeliveries(files);
    },
    [uploadDeliveries]
  );

  const handleUploadClick = useCallback(() => {
    setError(null);

    const activeId = driveBrowser.activeFolderId;
    const activeFolder = activeId
      ? folders.find((folder) => folder.id === activeId)
      : null;

    if (activeFolder?.type === "ASSETS") {
      if (!assetInputRef.current) {
        setError("File input for assets is not ready. Please reload the page.");
        return;
      }
      assetInputRef.current.click();
      return;
    }

    if (
      activeFolder?.type === "DELIVERABLES" ||
      activeFolder?.type === "PROJECT"
    ) {
      if (!deliveryInputRef.current) {
        setError(
          "File input for deliveries is not ready. Please reload the page."
        );
        return;
      }
      deliveryInputRef.current.click();
      return;
    }

    // No explicit folder selected: attempt to resolve a sensible default
    try {
      resolveDeliveryFolderId();
      deliveryInputRef.current?.click();
      return;
    } catch (deliveryError: any) {
      try {
        resolveAssetFolderId();
        assetInputRef.current?.click();
        return;
      } catch (assetError: any) {
        setError(
          deliveryError?.message ||
            assetError?.message ||
            "Select a valid folder before uploading files."
        );
      }
    }
  }, [
    driveBrowser.activeFolderId,
    folders,
    resolveDeliveryFolderId,
    resolveAssetFolderId,
  ]);

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
    async (event: DragEvent<HTMLDivElement>) => {
      if (!Array.from(event.dataTransfer.types).includes("Files")) {
        return;
      }
      event.preventDefault();
      const droppedEntries = await extractDroppedFiles(event.dataTransfer);
      if (droppedEntries.length === 0) return;

      const filesOnly = droppedEntries.map((entry) => entry.file);
      if (!dropContainsDirectory(droppedEntries)) {
        const activeId = driveBrowser.activeFolderId;
        const targetFolder = activeId
          ? folders.find((f) => f.id === activeId)
          : null;
        if (targetFolder && targetFolder.type === "ASSETS") {
          handleAssetFiles(filesOnly);
        } else {
          handleDeliveryFiles(filesOnly);
        }
        return;
      }

      const activeId = driveBrowser.activeFolderId;
      const activeFolder = activeId
        ? folders.find((f) => f.id === activeId)
        : null;

      const cacheKey = (parentId: string | null, name: string) =>
        `${parentId ?? "__root__"}::${name.trim().toLowerCase()}`;
      const folderIdCache = new Map<string, string>();
      folders.forEach((folder) => {
        folderIdCache.set(
          cacheKey(folder.parentId ?? null, folder.name),
          folder.id
        );
      });

      const groupedByFolder = new Map<string, File[]>();
      droppedEntries.forEach((entry) => {
        const normalizedPath = entry.relativePath.replace(/\\/g, "/");
        const segments = normalizedPath.split("/").filter(Boolean);
        const filename = segments.pop();
        if (!filename) return;
        const folderPath = segments.join("/");
        if (!groupedByFolder.has(folderPath)) {
          groupedByFolder.set(folderPath, []);
        }
        groupedByFolder.get(folderPath)!.push(entry.file);
      });

      const createFolder = async (
        name: string,
        parentId: string | null
      ): Promise<Folder> => {
        const res = await fetch(`/api/projects/${id}/folders`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, parentId }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || `Failed to create folder "${name}"`);
        }
        const created = data as Folder;
        folderIdCache.set(cacheKey(parentId, created.name), created.id);
        return created;
      };

      const ensureFolderPath = async (
        segments: string[],
        baseFolderId: string | null
      ): Promise<string | null> => {
        let currentParentId = baseFolderId;
        for (const segment of segments) {
          const trimmed = segment.trim();
          if (!trimmed) continue;
          const key = cacheKey(currentParentId, trimmed);
          if (!folderIdCache.has(key)) {
            const created = await createFolder(trimmed, currentParentId);
            currentParentId = created.id;
            continue;
          }
          currentParentId = folderIdCache.get(key)!;
        }
        return currentParentId;
      };

      try {
        setError(null);
        const processAsAssets = activeFolder?.type === "ASSETS";
        const baseFolderId = processAsAssets
          ? activeFolder?.id ?? resolveAssetFolderId()
          : activeFolder?.id ?? resolveDeliveryFolderId();

        for (const [folderPath, groupedFiles] of groupedByFolder.entries()) {
          const segments = folderPath.length > 0 ? folderPath.split("/") : [];
          const destinationFolderId = await ensureFolderPath(
            segments,
            baseFolderId
          );
          if (!destinationFolderId) {
            throw new Error("Unable to resolve destination folder.");
          }

          if (processAsAssets) {
            await uploadAssets(groupedFiles, {
              targetFolderId: destinationFolderId,
              refreshAfter: false,
            });
          } else {
            await uploadDeliveries(groupedFiles, {
              targetFolderId: destinationFolderId,
              refreshAfter: false,
            });
          }
        }

        await fetchData();
      } catch (error: any) {
        console.error("Folder drop failed:", error);
        setError(error?.message || "Failed to process dropped folder.");
      }
    },
    [
      driveBrowser.activeFolderId,
      folders,
      fetchData,
      handleAssetFiles,
      handleDeliveryFiles,
      id,
      resolveAssetFolderId,
      resolveDeliveryFolderId,
      uploadAssets,
      uploadDeliveries,
      setError,
    ]
  );

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
    fetchData();
    fetchCurrentUser();
  }, [fetchData, fetchCurrentUser]);

  const assignStaff = async () => {
    setAssigning(true);
    setStaffEmailError(null);
    setStaffEmailSuccess(null);
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffId: selectedStaffId || null,
          status: selectedStaffId ? "IN_PROGRESS" : "PENDING",
        }),
      });

      if (!res.ok) throw new Error("Failed to assign staff");

      await fetchData();
    } catch (e) {
      console.error(e);
    } finally {
      setAssigning(false);
    }
  };

  const deleteAsset = async (assetId: string) => {
    if (!confirm("Are you sure you want to delete this asset?")) return;

    setDeletingAssetId(assetId);
    try {
      const res = await fetch(`/api/assets/${assetId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete asset");
      await fetchData();
    } catch (e: any) {
      setError(e.message || "Failed to delete asset");
    } finally {
      setDeletingAssetId(null);
    }
  };

  const deleteDelivery = async (deliveryId: string) => {
    if (!confirm("Are you sure you want to delete this delivery?")) return;

    setDeletingDeliveryId(deliveryId);
    try {
      const res = await fetch(`/api/deliveries/${deliveryId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete delivery");
      await fetchData();
    } catch (e: any) {
      setError(e.message || "Failed to delete delivery");
    } finally {
      setDeletingDeliveryId(null);
    }
  };

  const regenerateLoginPassword = () => {
    const basisEmail = (loginEmail || project?.client?.email || "").trim();
    const generated = generateFriendlyPassword(
      basisEmail,
      project?.client?.name || null
    );
    setLoginPassword(generated);
  };

  const sendCompletionEmail = async () => {
    if (!project) return;
    setSendingEmail(true);
    setNotifyError(null);
    setNotifySuccess(null);
    try {
      const trimmedEmail = notifyEmail.trim();
      const trimmedCc = notifyCc.trim();
      const payload: Record<string, unknown> = {};
      if (trimmedEmail) {
        payload.email = trimmedEmail;
      }
      if (trimmedCc) {
        payload.cc = trimmedCc;
      }
      const trimmedLoginEmail = loginEmail.trim();
      const trimmedLoginPassword = loginPassword.trim();
      if (trimmedLoginEmail) {
        payload.loginEmail = trimmedLoginEmail;
      }
      if (trimmedLoginPassword) {
        payload.loginPassword = trimmedLoginPassword;
      }

      const res = await fetch(`/api/projects/${id}/notify-client`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          data.error || "Failed to send completion email to the client."
        );
      }

      const updatedProject = await res.json();

      setProject(updatedProject);
      setSelectedStaffId(updatedProject.staff?.id || "");
      setNotifyEmail(
        updatedProject.completionNotificationEmail ||
          updatedProject.client.email ||
          ""
      );
      setNotifyCc(updatedProject.completionNotificationCc || "");
      setNotifySuccess("Email sent to the client successfully.");
      setTimeout(() => setNotifySuccess(null), 5000);
    } catch (e: any) {
      setNotifyError(e.message || "Failed to send completion email.");
    } finally {
      setSendingEmail(false);
    }
  };

  const sendStaffAssignmentEmail = async () => {
    setStaffEmailError(null);
    setStaffEmailSuccess(null);

    if (!project?.staff?.email) {
      setStaffEmailError(
        "Assign a staff member before sending the assignment email."
      );
      return;
    }

    setSendingStaffEmail(true);
    try {
      const res = await fetch(`/api/projects/${id}/notify-staff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to send staff assignment email");
      }

      setStaffEmailSuccess("Staff assignment email sent successfully.");
    } catch (e: any) {
      console.error("Failed to send staff email:", e);
      setStaffEmailError(
        e?.message || "Failed to send staff assignment email."
      );
    } finally {
      setSendingStaffEmail(false);
    }
  };

  const previewAsset = useCallback(
    (asset: { id: string }) => {
      const full = assetsList.find((item) => item.id === asset.id);
      if (full) {
        setPreviewItem({ kind: "asset", data: full });
      }
    },
    [assetsList]
  );

  const downloadAsset = useCallback((asset: { id: string }) => {
    window.open(
      `/api/assets/${asset.id}/download`,
      "_blank",
      "noopener,noreferrer"
    );
  }, []);

  const previewDelivery = useCallback(
    (delivery: { id: string }) => {
      const full = deliveriesList.find((item) => item.id === delivery.id);
      if (full) {
        setPreviewItem({ kind: "delivery", data: full });
      }
    },
    [deliveriesList]
  );

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
    const mimeType = (file.contentType || "").toLowerCase();
    const canShowImage = isImage(mimeType, filename);
    const canShowVideo = isVideo(mimeType, filename);
    const canShowAudio = mimeType.startsWith("audio/");

    let body = (
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

  const downloadDelivery = useCallback((delivery: { id: string }) => {
    window.open(
      `/api/deliveries/${delivery.id}/download`,
      "_blank",
      "noopener,noreferrer"
    );
  }, []);

  if (loading) {
    return (
      <div className="drive-container p-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-[#5f6368]">Loading...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="drive-container p-8">
        <div className="card bg-red-50 border-red-200 max-w-2xl mx-auto">
          <p className="text-red-600 font-medium mb-2">Error</p>
          <p className="text-red-600 text-sm mb-4">{error}</p>
          <div className="flex gap-3">
            <button
              onClick={() => {
                setError(null);
                setLoading(true);
                fetchData();
              }}
              className="btn-primary bg-red-600 hover:bg-red-700"
            >
              Retry
            </button>
            <Link href="/admin" className="btn-secondary no-underline">
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="drive-container p-8">
        <div className="text-[#5f6368] mb-4">Project not found</div>
        <Link href="/admin" className="btn-secondary no-underline">
          Back to Dashboard
        </Link>
      </div>
    );
  }

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

  const formatDateTime = (value: string | null | undefined) => {
    if (!value) return null;
    try {
      return new Date(value).toLocaleString();
    } catch (error) {
      return value;
    }
  };

  const submittedAtLabel = formatDateTime(project.completionSubmittedAt);
  const notifiedAtLabel = formatDateTime(project.completionNotifiedAt);
  const canSendEmail = project.status === "COMPLETED";

  return (
    <div className="drive-container">
      {/* Toolbar */}
      <div className="bg-white border-b border-[#dadce0] px-4 lg:px-6 xl:px-10 py-4">
        <div className="flex items-center justify-between w-full max-w-[1920px] mx-auto">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="btn-icon" title="Back">
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
                {project.staff && ` • Staff: ${project.staff.email}`}
                {project.createdBy && (
                  <>
                    <br />
                    Created by: {project.createdBy.email}{" "}
                    {project.createdBy.role && (
                      <span className="text-xs">
                        ({project.createdBy.role})
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
          <div className={getStatusBadgeClass(project.status)}>
            {project.status.replace("_", " ")}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 lg:px-6 xl:px-10 py-6 w-full max-w-[1920px] mx-auto space-y-6">
        <div className="card space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="font-medium text-[#202124]">
              Delivery Review & Notification
            </h2>
            <span className={getStatusBadgeClass(project.status)}>
              {project.status.replace("_", " ")}
            </span>
          </div>
          <div className="space-y-2 text-sm text-[#5f6368]">
            <p>
              Submission status:{" "}
              {submittedAtLabel ? (
                <>
                  Received on {submittedAtLabel}
                  {project.completionSubmittedBy && (
                    <>
                      {" "}
                      by{" "}
                      <span className="font-medium">
                        {project.completionSubmittedBy.email}
                      </span>
                    </>
                  )}
                </>
              ) : (
                "Waiting for staff to submit final deliveries."
              )}
            </p>
            <p>
              Client notification:{" "}
              {notifiedAtLabel ? (
                <>
                  Sent on {notifiedAtLabel}
                  {project.completionNotifiedBy && (
                    <>
                      {" "}
                      by{" "}
                      <span className="font-medium">
                        {project.completionNotifiedBy.email}
                      </span>
                    </>
                  )}
                </>
              ) : (
                "Not sent yet."
              )}
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="block text-sm text-[#5f6368] mb-1">
                Client email
              </label>
              <input
                type="email"
                value={notifyEmail}
                onChange={(e) => setNotifyEmail(e.target.value)}
                className="input"
                placeholder="client@example.com"
                disabled={sendingEmail}
              />
            </div>
            <div>
              <label className="block text-sm text-[#5f6368] mb-1">
                CC (optional, comma separated)
              </label>
              <input
                type="text"
                value={notifyCc}
                onChange={(e) => setNotifyCc(e.target.value)}
                className="input"
                placeholder="team@alfatonics.com, partner@example.com"
                disabled={sendingEmail}
              />
            </div>
            <div>
              <label className="block text-sm text-[#5f6368] mb-1">
                Login email (optional)
              </label>
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="input"
                placeholder={project?.client?.email || "client login email"}
                disabled={sendingEmail}
              />
              <p className="text-xs text-[#5f6368] mt-1">
                Leave blank to use the client's registered email.
              </p>
            </div>
            <div className="md:col-span-2 lg:col-span-3">
              <label className="block text-sm text-[#5f6368] mb-1">
                Temporary password (optional)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={loginPassword}
                  onChange={(e) => {
                    setLoginPassword(e.target.value);
                  }}
                  className="input flex-1"
                  placeholder="Generate or enter a password to reset the client login"
                  disabled={sendingEmail}
                />
                <button
                  type="button"
                  onClick={regenerateLoginPassword}
                  className="btn-secondary whitespace-nowrap"
                  disabled={sendingEmail}
                >
                  Generate
                </button>
              </div>
              <p className="text-xs text-[#5f6368] mt-1">
                Provide a password to reset the client's login and include it in
                the email.
              </p>
            </div>
          </div>
          {notifyError && (
            <div className="text-sm text-red-600">{notifyError}</div>
          )}
          {notifySuccess && (
            <div className="text-sm text-green-600">{notifySuccess}</div>
          )}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <button
              onClick={sendCompletionEmail}
              disabled={!canSendEmail || sendingEmail}
              className="btn-primary disabled:opacity-50"
            >
              {sendingEmail
                ? "Sending..."
                : notifiedAtLabel
                ? "Resend Email"
                : "Send Email to Client"}
            </button>
            {!canSendEmail && (
              <p className="text-xs text-[#b91c1c]">
                Mark the project as completed before sending the client email.
              </p>
            )}
          </div>
        </div>
        <div className="card space-y-3">
          <h2 className="font-medium text-[#202124]">Assign Staff</h2>
          <p className="text-sm text-[#5f6368]">
            Choose a team member to manage this project. Assigning automatically
            moves the project to "In Progress".
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <select
              value={selectedStaffId}
              onChange={(e) => setSelectedStaffId(e.target.value)}
              className="input flex-1"
            >
              <option value="">-- No staff assigned --</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.email} {s.name && `(${s.name})`}
                </option>
              ))}
            </select>
            <button
              onClick={assignStaff}
              disabled={assigning}
              className="btn-primary disabled:opacity-50"
            >
              {assigning ? "Assigning..." : "Assign"}
            </button>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-[#5f6368]">
              {project?.staff?.email ? (
                <>
                  Currently assigned to{" "}
                  <strong>
                    {project.staff.email}
                    {project.staff.name ? ` (${project.staff.name})` : ""}
                  </strong>
                </>
              ) : (
                "No staff member currently assigned."
              )}
            </div>
            <button
              onClick={sendStaffAssignmentEmail}
              disabled={sendingStaffEmail || !project?.staff?.email}
              className="btn-secondary disabled:opacity-50 whitespace-nowrap"
            >
              {sendingStaffEmail ? "Sending..." : "Email Assigned Staff"}
            </button>
          </div>
          {staffEmailError && (
            <div className="text-sm text-red-600">{staffEmailError}</div>
          )}
          {staffEmailSuccess && (
            <div className="text-sm text-green-600">{staffEmailSuccess}</div>
          )}
        </div>
        {project.description && (
          <div className="card">
            <h2 className="font-medium text-[#202124] mb-2">Description</h2>
            <p className="text-[#5f6368]">{project.description}</p>
          </div>
        )}
        {/* Client Project Link - Only show for completed projects */}
        {project.status === "COMPLETED" && (
          <div className="card bg-blue-50 border-blue-200">
            <h2 className="font-medium text-[#202124] mb-3">
              Client Project Access Link
            </h2>
            <p className="text-sm text-[#5f6368] mb-4">
              Share this link with the client to give them direct access to
              their project folder:
            </p>
            <div className="flex gap-3 items-center">
              <div className="flex-1 bg-white border border-[#dadce0] rounded-lg p-3 break-all">
                <code className="text-sm text-[#202124]">
                  {typeof window !== "undefined"
                    ? `${window.location.origin}/client/projects/${project.id}`
                    : `/client/projects/${project.id}`}
                </code>
              </div>
              <button
                onClick={() => {
                  const link = `${window.location.origin}/client/projects/${project.id}`;
                  navigator.clipboard.writeText(link);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="btn-secondary whitespace-nowrap"
              >
                {copied ? (
                  <>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="mr-2"
                    >
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="mr-2"
                    >
                      <rect
                        x="9"
                        y="9"
                        width="13"
                        height="13"
                        rx="2"
                        ry="2"
                      ></rect>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                    Copy Link
                  </>
                )}
              </button>
              <Link
                href={`/client/projects/${project.id}`}
                target="_blank"
                className="btn-primary no-underline whitespace-nowrap"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="mr-2"
                >
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                  <polyline points="15 3 21 3 21 9"></polyline>
                  <line x1="10" y1="14" x2="21" y2="3"></line>
                </svg>
                Open Link
              </Link>
            </div>
          </div>
        )}
        {/* Legacy drive UI retained temporarily */}
        <section
          className="space-y-4"
          onDragOver={handleUploadDragOver}
          onDrop={handleUploadDrop}
        >
          <DriveBrowserView
            browser={driveBrowser}
            assets={driveAssets}
            deliveries={driveDeliveries}
            onPreviewAsset={previewAsset}
            onDownloadAsset={downloadAsset}
            onPreviewDelivery={previewDelivery}
            onDownloadDelivery={downloadDelivery}
            onDeleteAsset={(asset) => deleteAsset(asset.id)}
            onDeleteDelivery={(delivery) => deleteDelivery(delivery.id)}
            deletingAssetId={deletingAssetId}
            deletingDeliveryId={deletingDeliveryId}
            onRenameFolder={handleRenameFolder}
            onDeleteFolder={handleDeleteFolder}
            renamingFolderId={renamingFolderId}
            deletingFolderId={deletingFolderId}
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
                No folders or files yet. Use the buttons above to create folders
                or upload project assets.
              </div>
            }
          />

          {uploadTasks.length > 0 && (
            <div className="space-y-3">
              {uploadTasks.map((task) => {
                const currentIndex = Math.max(
                  0,
                  Math.min(task.currentFileIndex, task.totalFiles)
                );
                const baseLabel =
                  task.kind === "asset" ? "Asset upload" : "Delivery upload";
                const statusLabel =
                  task.status === "completed"
                    ? "Completed"
                    : task.status === "error"
                    ? "Failed"
                    : "Uploading";
                const colorClass =
                  task.status === "error"
                    ? "bg-[#d93025]"
                    : task.kind === "asset"
                    ? "bg-[#1a73e8]"
                    : "bg-[#34a853]";

                return (
                  <div
                    key={task.id}
                    className="rounded-lg border border-[#dadce0] bg-white px-4 py-3 shadow-sm"
                  >
                    <div className="flex flex-col gap-1 text-sm text-[#202124] sm:flex-row sm:items-center sm:justify-between">
                      <span className="leading-snug">
                        {statusLabel} {baseLabel}
                        {task.totalFiles > 0 && (
                          <>
                            {" "}
                            ({currentIndex}/{task.totalFiles})
                          </>
                        )}
                        {task.currentFileName ? (
                          <>
                            {" · "}
                            <span className="font-medium">
                              {task.currentFileName}
                            </span>
                          </>
                        ) : null}
                      </span>
                      <span>{Math.max(0, Math.min(100, task.progress))}%</span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-[#e8eaed]">
                      <div
                        className={`h-2 rounded-full ${colorClass} transition-all`}
                        style={{
                          width: `${Math.max(
                            0,
                            Math.min(100, task.progress)
                          )}%`,
                        }}
                      />
                    </div>
                    {task.error && (
                      <p className="mt-2 text-xs text-[#d93025]">
                        {task.error}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
      {renderPreview()}
    </div>
  );
}

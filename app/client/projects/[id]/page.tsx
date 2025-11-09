"use client";

import { useEffect, useState, use, useRef, useMemo, useCallback } from "react";
import Link from "next/link";
import DriveFileIcon from "@/app/components/drive/DriveFileIcon";
import DriveBrowserView from "@/app/components/drive/browser/DriveBrowserView";
import { useDriveBrowser } from "@/app/components/drive/browser/useDriveBrowser";
import type {
  DriveAsset,
  DriveDelivery,
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
  uploadedBy?: { id: string; email: string; name: string | null } | null;
};

type Delivery = {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
  folderId?: string | null;
  uploadedBy: { id: string; email: string; name: string | null } | null;
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
  client?: { id: string; email: string; name: string | null };
  staff: { id: string; email: string; name: string | null } | null;
  assets: Asset[];
  deliveries: Delivery[];
  folders: Folder[];
};

type PreviewItem =
  | { kind: "asset"; data: Asset }
  | { kind: "delivery"; data: Delivery }
  | null;

export default function ClientProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingAssets, setUploadingAssets] = useState(false);
  const [assetUploadProgress, setAssetUploadProgress] = useState(0);
  const [assetUploadTotal, setAssetUploadTotal] = useState(0);
  const [currentAssetUploadName, setCurrentAssetUploadName] = useState<
    string | null
  >(null);
  const [currentAssetUploadIndex, setCurrentAssetUploadIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const assetInputRef = useRef<HTMLInputElement | null>(null);
  const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    role: string;
  } | null>(null);
  const [previewItem, setPreviewItem] = useState<PreviewItem>(null);

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
        const text = await res.text();
        throw new Error(text || "Failed to fetch project");
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

  const driveBrowser = useDriveBrowser({
    folders: driveFolders,
    assets: driveAssets,
    deliveries: driveDeliveries,
    canUpload: true,
    canCreateFolder: false,
  });

  const { activeFolderId, setActiveFolderId } = driveBrowser;

  useEffect(() => {
    if (!project || activeFolderId) return;
    const defaultFolder =
      project.folders.find((f) => f.type === "ASSETS") ?? project.folders[0];
    if (defaultFolder) {
      setActiveFolderId(defaultFolder.id);
    }
  }, [project, activeFolderId, setActiveFolderId]);

  const resolveAssetFolderId = useCallback(() => {
    if (activeFolderId) {
      const folder = folders.find((f) => f.id === activeFolderId);
      if (!folder || folder.type !== "ASSETS") {
        throw new Error("Select an Assets folder before uploading files.");
      }
      return folder.id;
    }
    const assetsFolder = folders.find((f) => f.type === "ASSETS");
    if (!assetsFolder) {
      throw new Error("No Assets folder found. Please contact support.");
    }
    return assetsFolder.id;
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

  const handleAssetFiles = useCallback(
    (incoming: FileList | File[]) => {
      if (assetInputRef.current) {
        assetInputRef.current.value = "";
      }
      void uploadAssets(incoming);
    },
    [uploadAssets]
  );

  const handleUploadClick = useCallback(() => {
    try {
      setError(null);

      if (!activeFolderId) {
        const hasAssetsFolder = folders.some(
          (folder) => folder.type === "ASSETS"
        );
        if (!hasAssetsFolder) {
          throw new Error("No Assets folder found. Please contact support.");
        }
        assetInputRef.current?.click();
        return;
      }

      const targetFolder = folders.find(
        (folder) => folder.id === activeFolderId
      );
      if (!targetFolder) {
        throw new Error(
          "Selected folder is no longer available. Reload the page and try again."
        );
      }
      if (targetFolder.type !== "ASSETS") {
        throw new Error("Select an Assets folder before uploading files.");
      }

      assetInputRef.current?.click();
    } catch (e: any) {
      setError(e.message || "Select an Assets folder before uploading files.");
    }
  }, [activeFolderId, folders]);

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

  const closePreview = () => setPreviewItem(null);

  const renderPreview = () => {
    if (!previewItem) return null;

    const isAsset = previewItem.kind === "asset";
    const file = previewItem.data;
    const streamUrl = isAsset
      ? `/api/assets/${file.id}/stream`
      : `/api/deliveries/${file.id}/stream`;
    const downloadUrl = isAsset
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

  return (
    <div className="drive-container">
      <div className="bg-white border-b border-[#dadce0] px-4 py-3 sm:px-6 sm:py-4">
        <div className="mx-auto flex w-full max-w-[1800px] flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Link href="/client" className="btn-icon" title="Back">
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
            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-[#202124] sm:text-2xl">
                {project.title ||
                  project.client?.email ||
                  `Project ${project.id.slice(0, 8)}`}
              </h1>
              {project.client?.email && (
                <p className="mt-0.5 truncate text-xs text-[#5f6368] sm:text-sm">
                  {project.client.email}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={getStatusBadgeClass(project.status)}>
              {project.status.replace("_", " ")}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1800px] space-y-6 px-4 py-6 sm:px-6 md:px-8">
        {error && (
          <div className="card bg-red-50 border-red-200 text-red-600">
            {error}
          </div>
        )}
        {project.description && (
          <div className="card">
            <h2 className="font-medium text-[#202124] mb-2">Description</h2>
            <p className="text-[#5f6368]">{project.description}</p>
          </div>
        )}

        <section className="space-y-4">
          <DriveBrowserView
            browser={driveBrowser}
            assets={driveAssets}
            deliveries={driveDeliveries}
            onPreviewAsset={handlePreviewAsset}
            onPreviewDelivery={handlePreviewDelivery}
            onDownloadAsset={handleDownloadAsset}
            onDownloadDelivery={handleDownloadDelivery}
            onDeleteAsset={(asset) => handleDeleteAsset(asset)}
            deletingAssetId={deletingAssetId}
            onUploadClick={handleUploadClick}
            extraToolbarContent={
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
            }
            emptyState={
              <div className="text-sm text-[#5f6368]">
                No files yet. Upload assets to share them with your project
                team.
              </div>
            }
          />

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
        </section>
      </div>
      {renderPreview()}
    </div>
  );
}

"use client";

import { useEffect, useState, use, useRef } from "react";
import type { DragEvent, Dispatch, SetStateAction } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Asset = {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  type: string;
  createdAt: string;
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

type Folder = {
  id: string;
  name: string;
  type: "PROJECT" | "ASSETS" | "DELIVERABLES";
  createdAt: string;
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

export default function StaffProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { id } = use(params);
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingAsset, setUploadingAsset] = useState(false);
  const [assetUploadProgress, setAssetUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [deliveryFiles, setDeliveryFiles] = useState<File[]>([]);
  const [assetFiles, setAssetFiles] = useState<File[]>([]);
  const deliveryInputRef = useRef<HTMLInputElement | null>(null);
  const assetInputRef = useRef<HTMLInputElement | null>(null);
  const [isDeliveryDragging, setIsDeliveryDragging] = useState(false);
  const [isAssetDragging, setIsAssetDragging] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedDeliveryFolderId, setSelectedDeliveryFolderId] = useState<
    string | null
  >(null);
  const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    role: string;
  } | null>(null);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState("");
  const [deletingFolderId, setDeletingFolderId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"all" | string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [currentDeliveryUploadName, setCurrentDeliveryUploadName] = useState<
    string | null
  >(null);
  const [currentDeliveryUploadIndex, setCurrentDeliveryUploadIndex] =
    useState(0);
  const [deliveryUploadQueueSize, setDeliveryUploadQueueSize] = useState(0);
  const [currentAssetUploadName, setCurrentAssetUploadName] = useState<
    string | null
  >(null);
  const [currentAssetUploadIndex, setCurrentAssetUploadIndex] = useState(0);
  const [assetUploadQueueSize, setAssetUploadQueueSize] = useState(0);
  const totalDeliveryUploads =
    deliveryUploadQueueSize > 0
      ? deliveryUploadQueueSize
      : deliveryFiles.length;
  const totalAssetUploads =
    assetUploadQueueSize > 0 ? assetUploadQueueSize : assetFiles.length;

  // Helper function to check if file is an image
  const isImage = (contentType: string, filename: string): boolean => {
    const imageTypes = ["image/"];
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
    return (
      contentType.toLowerCase().startsWith("image/") ||
      imageExtensions.some((ext) => filename.toLowerCase().endsWith(ext))
    );
  };

  // Helper function to check if file is a video
  const isVideo = (contentType: string, filename: string): boolean => {
    const videoTypes = ["video/"];
    const videoExtensions = [
      ".mp4",
      ".avi",
      ".mov",
      ".wmv",
      ".flv",
      ".webm",
      ".mkv",
    ];
    return (
      videoTypes.some((type) => contentType.toLowerCase().includes(type)) ||
      videoExtensions.some((ext) => filename.toLowerCase().endsWith(ext))
    );
  };

  const formatDateTime = (value: string | null | undefined) => {
    if (!value) return null;
    try {
      return new Date(value).toLocaleString();
    } catch (error) {
      return value;
    }
  };

  const fileKey = (file: File) =>
    `${file.name}-${file.size}-${file.lastModified}`;

  const addFilesToQueue = (
    incoming: FileList | File[],
    setQueue: Dispatch<SetStateAction<File[]>>
  ) => {
    const filesArray =
      incoming instanceof FileList ? Array.from(incoming) : [...incoming];
    if (filesArray.length === 0) {
      return;
    }
    setQueue((prev) => {
      const existingKeys = new Set(prev.map(fileKey));
      const nextFiles = filesArray.filter(
        (candidate) => !existingKeys.has(fileKey(candidate))
      );
      return [...prev, ...nextFiles];
    });
  };

  const handleDeliveryFiles = (incoming: FileList | File[]) => {
    addFilesToQueue(incoming, setDeliveryFiles);
    if (deliveryInputRef.current) {
      deliveryInputRef.current.value = "";
    }
  };

  const handleAssetFiles = (incoming: FileList | File[]) => {
    addFilesToQueue(incoming, setAssetFiles);
    if (assetInputRef.current) {
      assetInputRef.current.value = "";
    }
  };

  const removeDeliveryFile = (index: number) => {
    setDeliveryFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const removeAssetFile = (index: number) => {
    setAssetFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDeliveryDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    if (!isDeliveryDragging) {
      setIsDeliveryDragging(true);
    }
  };

  const handleDeliveryDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDeliveryDragging(false);
    if (event.dataTransfer?.files?.length) {
      handleDeliveryFiles(event.dataTransfer.files);
    }
  };

  const handleAssetDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    if (!isAssetDragging) {
      setIsAssetDragging(true);
    }
  };

  const handleAssetDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsAssetDragging(false);
    if (event.dataTransfer?.files?.length) {
      handleAssetFiles(event.dataTransfer.files);
    }
  };

  useEffect(() => {
    fetchProject();
    fetchCurrentUser();
  }, [id]);

  // Auto-select first ASSETS folder for assets and first PROJECT folder for deliveries when project loads
  useEffect(() => {
    if (project && viewMode === "all") {
      if (!selectedFolderId) {
        const assetsFolder = project.folders.find((f) => f.type === "ASSETS");
        if (assetsFolder) {
          setSelectedFolderId(assetsFolder.id);
        }
      }
      if (!selectedDeliveryFolderId) {
        const projectFolder = project.folders.find((f) => f.type === "PROJECT");
        if (projectFolder) {
          setSelectedDeliveryFolderId(projectFolder.id);
        }
      }
    }
  }, [project, viewMode, selectedFolderId, selectedDeliveryFolderId]);

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const user = await res.json();
        setCurrentUser(user);
      }
    } catch (e) {
      console.error("Failed to fetch current user:", e);
    }
  };

  const fetchProject = async () => {
    try {
      const res = await fetch(`/api/projects/${id}`);
      if (!res.ok) throw new Error("Failed to fetch project");
      const data = await res.json();
      setProject(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const resolveDeliveryFolderId = () => {
    if (!project) {
      throw new Error(
        "Project data is still loading. Please try again in a moment."
      );
    }

    let targetFolderId: string | undefined;
    if (viewMode !== "all") {
      const currentFolder = project.folders.find((f) => f.id === viewMode);
      if (
        currentFolder?.type !== "PROJECT" &&
        currentFolder?.type !== "DELIVERABLES"
      ) {
        throw new Error(
          "Deliveries can only be uploaded to Project or Deliverables folders"
        );
      }
      targetFolderId = viewMode;
    } else if (!selectedDeliveryFolderId) {
      const deliverablesFolder = project.folders.find(
        (f) => f.type === "DELIVERABLES"
      );
      const projectFolder = project.folders.find((f) => f.type === "PROJECT");
      if (deliverablesFolder) {
        targetFolderId = deliverablesFolder.id;
      } else if (projectFolder) {
        targetFolderId = projectFolder.id;
      } else {
        throw new Error(
          "No Deliverables or Project folder found. Please create a folder first."
        );
      }
    } else {
      const selectedFolder = project.folders.find(
        (f) => f.id === selectedDeliveryFolderId
      );
      if (
        selectedFolder?.type !== "PROJECT" &&
        selectedFolder?.type !== "DELIVERABLES"
      ) {
        throw new Error(
          "Deliveries can only be uploaded to Project or Deliverables folders"
        );
      }
      targetFolderId = selectedDeliveryFolderId;
    }

    if (!targetFolderId) {
      throw new Error("Unable to determine target folder for deliveries.");
    }
    return targetFolderId;
  };

  const resolveAssetFolderId = () => {
    if (!project) {
      throw new Error(
        "Project data is still loading. Please try again in a moment."
      );
    }

    let targetFolderId: string | undefined;
    if (viewMode !== "all") {
      const currentFolder = project.folders.find((f) => f.id === viewMode);
      if (currentFolder?.type !== "ASSETS") {
        throw new Error("Assets can only be uploaded to Assets folders");
      }
      targetFolderId = viewMode;
    } else if (!selectedFolderId) {
      const assetsFolder = project.folders.find((f) => f.type === "ASSETS");
      if (!assetsFolder) {
        throw new Error("No Assets folder found. Please contact support.");
      }
      targetFolderId = assetsFolder.id;
    } else {
      const selectedFolder = project.folders.find(
        (f) => f.id === selectedFolderId
      );
      if (selectedFolder?.type !== "ASSETS") {
        throw new Error("Assets can only be uploaded to Assets folders");
      }
      targetFolderId = selectedFolderId;
    }

    if (!targetFolderId) {
      throw new Error("Unable to determine target folder for assets.");
    }

    return targetFolderId;
  };

  const onUpload = async () => {
    if (deliveryFiles.length === 0) return;
    setUploading(true);
    setError(null);
    setUploadProgress(0);

    const filesToUpload = [...deliveryFiles];
    setDeliveryUploadQueueSize(filesToUpload.length);

    try {
      const targetFolderId = resolveDeliveryFolderId();

      for (let index = 0; index < filesToUpload.length; index++) {
        const currentFile = filesToUpload[index];
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
        const { uploadId, key, partSize, presignedPartUrls, completeUrl } = init;

        if (!Array.isArray(presignedPartUrls) || presignedPartUrls.length === 0) {
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

          const overallProgress =
            ((index + (partNumber - 1) / totalParts) / filesToUpload.length) *
            100;
          setUploadProgress(Math.min(99, Math.round(overallProgress)));
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

        const completionProgress =
          ((index + 1) / filesToUpload.length) * 100;
        setUploadProgress(Math.round(completionProgress));
      }

      await fetchProject();
      setDeliveryFiles([]);
      setUploadProgress(100);
      setTimeout(() => setUploadProgress(0), 500);
    } catch (e: any) {
      setError(e.message || "Upload failed");
      setUploadProgress(0);
    } finally {
      setUploading(false);
      setCurrentDeliveryUploadName(null);
      setCurrentDeliveryUploadIndex(0);
      setDeliveryUploadQueueSize(0);
    }
  };

  const createFolder = async () => {
    if (!folderName.trim()) return;
    setCreatingFolder(true);
    setError(null);

    try {
      const res = await fetch(`/api/projects/${id}/folders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: folderName.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create folder");
      }

      await fetchProject();
      setFolderName("");
      setShowCreateFolder(false);
    } catch (e: any) {
      setError(e.message || "Failed to create folder");
    } finally {
      setCreatingFolder(false);
    }
  };

  const updateFolder = async (folderId: string) => {
    if (!editingFolderName.trim()) return;
    setCreatingFolder(true);
    setError(null);

    try {
      const res = await fetch(`/api/projects/${id}/folders/${folderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editingFolderName.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update folder");
      }

      await fetchProject();
      setEditingFolderId(null);
      setEditingFolderName("");
    } catch (e: any) {
      setError(e.message || "Failed to update folder");
    } finally {
      setCreatingFolder(false);
    }
  };

  const deleteFolder = async (folderId: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this folder? Assets in this folder will be moved to the root."
      )
    )
      return;

    setDeletingFolderId(folderId);
    setError(null);

    try {
      const res = await fetch(`/api/projects/${id}/folders/${folderId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete folder");
      }

      await fetchProject();
      if (viewMode === folderId) {
        setViewMode("all");
      }
    } catch (e: any) {
      setError(e.message || "Failed to delete folder");
    } finally {
      setDeletingFolderId(null);
    }
  };

  const onUploadAsset = async () => {
    if (assetFiles.length === 0) return;
    setUploadingAsset(true);
    setError(null);
    setAssetUploadProgress(0);

    const filesToUpload = [...assetFiles];
    setAssetUploadQueueSize(filesToUpload.length);

    try {
      const targetFolderId = resolveAssetFolderId();

      for (let index = 0; index < filesToUpload.length; index++) {
        const currentFile = filesToUpload[index];
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
        const {
          uploadId,
          key,
          partSize,
          presignedPartUrls,
          completeUrl,
        } = init;

        if (!Array.isArray(presignedPartUrls) || presignedPartUrls.length === 0) {
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

          const overallProgress =
            ((index + (partNumber - 1) / totalParts) / filesToUpload.length) *
            100;
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

        const completionProgress =
          ((index + 1) / filesToUpload.length) * 100;
        setAssetUploadProgress(Math.round(completionProgress));
      }

      await fetchProject();
      setAssetFiles([]);
      setSelectedFolderId(null);
      setAssetUploadProgress(100);
      setTimeout(() => setAssetUploadProgress(0), 500);
    } catch (e: any) {
      setError(e.message || "Upload failed");
      setAssetUploadProgress(0);
    } finally {
      setUploadingAsset(false);
      setCurrentAssetUploadName(null);
      setCurrentAssetUploadIndex(0);
      setAssetUploadQueueSize(0);
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
      await fetchProject();
    } catch (e: any) {
      setError(e.message || "Failed to delete asset");
    } finally {
      setDeletingAssetId(null);
    }
  };

  const updateStatus = async (
    status: "PENDING" | "IN_PROGRESS" | "COMPLETED"
  ) => {
    setSubmitError(null);
    setSubmitSuccess(null);
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      await fetchProject();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const submitProject = async () => {
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

  const deliveriesCount = project.deliveries.length;
  const hasDeliveries = deliveriesCount > 0;
  const submittedAtLabel = formatDateTime(project.completionSubmittedAt);
  const notifiedAtLabel = formatDateTime(project.completionNotifiedAt);

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

  const getFileIcon = (type: string, contentType?: string) => {
    if (type === "IMAGE" || contentType?.startsWith("image/")) {
      return (
        <svg width="40" height="40" viewBox="0 0 24 24" fill="#4285f4">
          <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
        </svg>
      );
    } else if (type === "AUDIO" || contentType?.startsWith("audio/")) {
      return (
        <svg width="40" height="40" viewBox="0 0 24 24" fill="#ea4335">
          <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
        </svg>
      );
    } else if (contentType?.startsWith("video/")) {
      return (
        <svg width="40" height="40" viewBox="0 0 24 24" fill="#fbbc04">
          <path d="M17 10.5V7a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h12a1 1 0 001-1v-3.5l4 4v-11l-4 4z" />
        </svg>
      );
    }
    return (
      <svg width="40" height="40" viewBox="0 0 24 24" fill="#34a853">
        <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
      </svg>
    );
  };

  return (
    <div className="drive-container">
      {/* Toolbar */}
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

      {/* Content */}
      <div className="p-6 max-w-[1800px] mx-auto space-y-6">
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

        <section>
          {/* Search Bar */}
          {viewMode === "all" && (
            <div className="mb-4">
              <div className="relative">
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#5f6368]">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="11" cy="11" r="8"></circle>
                    <path d="m21 21-4.35-4.35"></path>
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Search folders..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white border border-[#dadce0] rounded-lg text-[#202124] placeholder-[#5f6368] focus:outline-none focus:border-[#1a73e8] focus:shadow-sm transition-all"
                />
              </div>
            </div>
          )}

          {viewMode !== "all" && (
            <div className="mb-4">
              <div className="relative">
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#5f6368]">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="11" cy="11" r="8"></circle>
                    <path d="m21 21-4.35-4.35"></path>
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Search files..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white border border-[#dadce0] rounded-lg text-[#202124] placeholder-[#5f6368] focus:outline-none focus:border-[#1a73e8] focus:shadow-sm transition-all"
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-normal text-[#202124]">
                {viewMode === "all" ? (
                  <>Projects & Assets</>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        setViewMode("all");
                        setSearchQuery("");
                      }}
                      className="text-[#1a73e8] hover:underline mr-2"
                    >
                      ← Back
                    </button>
                    {project.folders.find((f) => f.id === viewMode)?.name ||
                      "Folder"}
                  </>
                )}
              </h2>
            </div>
            <div className="flex gap-2">
              {(viewMode === "all" ||
                project.folders.find((f) => f.id === viewMode)?.type ===
                  "DELIVERABLES") && (
                <button
                  onClick={() => setShowCreateFolder(!showCreateFolder)}
                  className="btn-secondary text-sm"
                >
                  {showCreateFolder ? "Cancel" : "New Folder"}
                </button>
              )}
            </div>
          </div>

          {/* Create Folder Form */}
          {showCreateFolder &&
            (viewMode === "all" ||
              project.folders.find((f) => f.id === viewMode)?.type ===
                "DELIVERABLES") && (
              <div className="card mb-4">
                <h3 className="font-medium text-[#202124] mb-4">
                  Create New Folder
                </h3>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={folderName}
                    onChange={(e) => setFolderName(e.target.value)}
                    placeholder="Folder name"
                    className="input flex-1"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        createFolder();
                      }
                    }}
                  />
                  <button
                    onClick={createFolder}
                    disabled={!folderName.trim() || creatingFolder}
                    className="btn-primary disabled:opacity-50"
                  >
                    {creatingFolder ? "Creating..." : "Create"}
                  </button>
                </div>
              </div>
            )}

          {/* Folders Grid */}
          {viewMode === "all" &&
            (() => {
              // Filter folders by search
              const filteredFolders = project.folders.filter((folder) => {
                const matchesSearch =
                  !searchQuery ||
                  folder.name.toLowerCase().includes(searchQuery.toLowerCase());
                return matchesSearch;
              });

              const assetsFolder = filteredFolders.find(
                (f) => f.type === "ASSETS"
              );
              const deliverablesFolder = filteredFolders.find(
                (f) => f.type === "DELIVERABLES"
              );
              const projectFolders = filteredFolders.filter(
                (f) => f.type === "PROJECT"
              );

              return (
                <div className="mb-8 space-y-6">
                  {/* ASSETS Folder */}
                  {assetsFolder && (
                    <div>
                      <div className="flex items-center gap-2 mb-4">
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          className="text-[#5f6368]"
                        >
                          <path
                            d="M10 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2h-8l-2-2z"
                            fill="currentColor"
                          />
                        </svg>
                        <h3 className="text-lg font-medium text-[#202124]">
                          Shared Assets
                        </h3>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-4">
                        <div
                          key={assetsFolder.id}
                          className="card group cursor-pointer"
                          onClick={() => setViewMode(assetsFolder.id)}
                        >
                          <div className="flex flex-col items-center text-center">
                            <div className="mb-2">
                              <svg
                                width="48"
                                height="48"
                                viewBox="0 0 24 24"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                <path
                                  d="M10 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2h-8l-2-2z"
                                  fill="#4285f4"
                                />
                              </svg>
                            </div>
                            <h3 className="font-medium text-[#202124] text-sm mb-1 truncate w-full">
                              {assetsFolder.name}
                            </h3>
                            <div className="text-xs text-[#5f6368]">
                              {assetsFolder._count.assets} file
                              {assetsFolder._count.assets !== 1 ? "s" : ""}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* DELIVERABLES Folder */}
                  {deliverablesFolder && (
                    <div>
                      <div className="flex items-center gap-2 mb-4">
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          className="text-[#5f6368]"
                        >
                          <path
                            d="M10 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2h-8l-2-2z"
                            fill="currentColor"
                          />
                        </svg>
                        <h3 className="text-lg font-medium text-[#202124]">
                          Deliverables
                        </h3>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-4">
                        <div
                          key={deliverablesFolder.id}
                          className="card group cursor-pointer"
                          onClick={() => setViewMode(deliverablesFolder.id)}
                        >
                          <div className="flex flex-col items-center text-center">
                            <div className="mb-2">
                              <svg
                                width="48"
                                height="48"
                                viewBox="0 0 24 24"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                <path
                                  d="M10 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2h-8l-2-2z"
                                  fill="#10b981"
                                />
                              </svg>
                            </div>
                            <h3 className="font-medium text-[#202124] text-sm mb-1 truncate w-full">
                              {deliverablesFolder.name}
                            </h3>
                            <div className="text-xs text-[#5f6368]">
                              {deliverablesFolder._count.deliveries} file
                              {deliverablesFolder._count.deliveries !== 1
                                ? "s"
                                : ""}
                            </div>
                          </div>
                        </div>
                        {/* Show PROJECT folders as subfolders of Deliverables */}
                        {projectFolders.map((folder) => (
                          <div key={folder.id} className="card group">
                            <div
                              className="flex flex-col items-center text-center cursor-pointer"
                              onClick={() => setViewMode(folder.id)}
                            >
                              <div className="mb-2">
                                <svg
                                  width="48"
                                  height="48"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  xmlns="http://www.w3.org/2000/svg"
                                >
                                  <path
                                    d="M10 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2h-8l-2-2z"
                                    fill="#fbbc04"
                                  />
                                </svg>
                              </div>
                              <h3 className="font-medium text-[#202124] text-sm mb-1 truncate w-full">
                                {folder.name}
                              </h3>
                              <div className="text-xs text-[#5f6368] space-y-0.5">
                                {folder._count.assets > 0 && (
                                  <div>
                                    {folder._count.assets} asset
                                    {folder._count.assets !== 1 ? "s" : ""}
                                  </div>
                                )}
                                {folder._count.deliveries > 0 && (
                                  <div>
                                    {folder._count.deliveries} deliver
                                    {folder._count.deliveries !== 1
                                      ? "ies"
                                      : "y"}
                                  </div>
                                )}
                                {folder._count.assets === 0 &&
                                  folder._count.deliveries === 0 && (
                                    <div>Empty</div>
                                  )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* PROJECT Folders (if no Deliverables folder, show as separate section) */}
                  {!deliverablesFolder && projectFolders.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-4">
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          className="text-[#5f6368]"
                        >
                          <path
                            d="M10 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2h-8l-2-2z"
                            fill="currentColor"
                          />
                        </svg>
                        <h3 className="text-lg font-medium text-[#202124]">
                          Project Folders ({projectFolders.length})
                        </h3>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-4">
                        {projectFolders.map((folder) => (
                          <div key={folder.id} className="card group">
                            {editingFolderId === folder.id ? (
                              <div className="space-y-3">
                                <input
                                  type="text"
                                  value={editingFolderName}
                                  onChange={(e) =>
                                    setEditingFolderName(e.target.value)
                                  }
                                  className="input text-sm"
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      updateFolder(folder.id);
                                    }
                                    if (e.key === "Escape") {
                                      setEditingFolderId(null);
                                      setEditingFolderName("");
                                    }
                                  }}
                                  autoFocus
                                />
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => updateFolder(folder.id)}
                                    disabled={creatingFolder}
                                    className="btn-primary text-xs disabled:opacity-50"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditingFolderId(null);
                                      setEditingFolderName("");
                                    }}
                                    className="btn-secondary text-xs"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div
                                  className="flex flex-col items-center text-center cursor-pointer"
                                  onClick={() => setViewMode(folder.id)}
                                >
                                  <div className="mb-2">
                                    <svg
                                      width="48"
                                      height="48"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      xmlns="http://www.w3.org/2000/svg"
                                    >
                                      <path
                                        d="M10 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2h-8l-2-2z"
                                        fill="#fbbc04"
                                      />
                                    </svg>
                                  </div>
                                  <h3 className="font-medium text-[#202124] text-sm mb-1 truncate w-full">
                                    {folder.name}
                                  </h3>
                                  <div className="text-xs text-[#5f6368]">
                                    {folder._count.assets} file
                                    {folder._count.assets !== 1 ? "s" : ""}
                                  </div>
                                </div>
                                <div className="flex gap-2 justify-center mt-3">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingFolderId(folder.id);
                                      setEditingFolderName(folder.name);
                                    }}
                                    className="px-2 py-1 text-xs btn-secondary"
                                    title="Rename folder"
                                  >
                                    Rename
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteFolder(folder.id);
                                    }}
                                    disabled={deletingFolderId === folder.id}
                                    className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                                    title="Delete folder"
                                  >
                                    {deletingFolderId === folder.id
                                      ? "Deleting..."
                                      : "Delete"}
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

          {/* Assets Section - Only show when viewing a folder */}
          {viewMode !== "all" &&
            (() => {
              const currentFolder = project.folders.find(
                (f) => f.id === viewMode
              );
              if (currentFolder?.type !== "ASSETS") return null;

              const folderAssets = project.assets.filter(
                (a) => a.folderId === viewMode
              );

              // Filter by search
              const filteredAssets = folderAssets.filter(
                (a) =>
                  !searchQuery ||
                  a.filename.toLowerCase().includes(searchQuery.toLowerCase())
              );

              return (
                <div>
                  {/* Upload Form - Inside ASSETS Folder */}
                  <div className="card mb-4 space-y-4">
                    <div className="text-sm text-[#5f6368]">
                      Uploading to: <strong>{currentFolder.name}</strong>
                    </div>
                    <div
                      className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
                        isAssetDragging
                          ? "border-[#1a73e8] bg-[#e8f0fe]"
                          : "border-[#dadce0] bg-white"
                      }`}
                      onDragOver={handleAssetDragOver}
                      onDragLeave={() => setIsAssetDragging(false)}
                      onDrop={handleAssetDrop}
                      onClick={() => assetInputRef.current?.click()}
                    >
                      <input
                        ref={assetInputRef}
                        type="file"
                        accept="*/*"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files) {
                            handleAssetFiles(e.target.files);
                          }
                        }}
                      />
                      <p className="font-medium text-[#202124]">
                        Drag & drop files here
                      </p>
                      <p className="text-sm text-[#5f6368]">
                        or tap to select multiple assets from your device
                      </p>
                      <p className="text-xs text-[#80868b] mt-2">
                        All file types are supported. Multi-select works on
                        desktop and mobile.
                      </p>
                    </div>
                    {assetFiles.length > 0 && (
                      <div className="border border-[#dadce0] rounded-lg divide-y divide-[#dadce0]/60 bg-white">
                        {assetFiles.map((selected, index) => (
                          <div
                            key={`${selected.name}-${selected.size}-${selected.lastModified}-${index}`}
                            className="flex items-center justify-between px-3 py-2 text-sm text-[#202124]"
                          >
                            <div className="min-w-0">
                              <p className="truncate font-medium">
                                {selected.name}
                              </p>
                              <p className="text-xs text-[#5f6368]">
                                {(selected.size / (1024 * 1024)).toFixed(2)} MB
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeAssetFile(index)}
                              disabled={uploadingAsset}
                              className="text-xs text-[#1a73e8] hover:underline disabled:opacity-50"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    {error && <p className="text-red-600 text-sm">{error}</p>}
                    {uploadingAsset && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm text-[#5f6368]">
                          <span>
                            Uploading {currentAssetUploadName || "files"} (
                            {currentAssetUploadIndex}/
                            {Math.max(totalAssetUploads, 1)})
                          </span>
                          <span>{assetUploadProgress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                          <div
                            className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                            style={{ width: `${assetUploadProgress}%` }}
                          ></div>
                        </div>
                      </div>
                    )}
                    <button
                      onClick={onUploadAsset}
                      disabled={assetFiles.length === 0 || uploadingAsset}
                      className="btn-primary disabled:opacity-50"
                    >
                      {uploadingAsset
                        ? "Uploading..."
                        : assetFiles.length > 0
                        ? `Upload ${assetFiles.length} Asset${
                            assetFiles.length === 1 ? "" : "s"
                          }`
                        : "Upload Assets"}
                    </button>
                  </div>

                  <div className="flex items-center gap-2 mb-4">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      className="text-[#5f6368]"
                    >
                      <path
                        d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"
                        fill="currentColor"
                      />
                    </svg>
                    <h3 className="text-lg font-medium text-[#202124]">
                      Assets ({filteredAssets.length})
                    </h3>
                  </div>
                  {filteredAssets.length === 0 ? (
                    <div className="text-center py-8 text-[#5f6368] text-sm">
                      No assets in this folder yet.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-4">
                      {filteredAssets.map((asset) => {
                        const canDelete =
                          currentUser?.role === "ADMIN" ||
                          asset.uploadedBy?.id === currentUser?.id;
                        const canView =
                          asset.type === "IMAGE" ||
                          asset.type === "AUDIO" ||
                          asset.contentType?.startsWith("image/") ||
                          asset.contentType?.startsWith("audio/") ||
                          asset.contentType?.startsWith("video/");

                        return (
                          <div key={asset.id} className="card group">
                            <div className="flex flex-col items-center text-center mb-3">
                              <div className="mb-2">
                                {getFileIcon(asset.type, asset.contentType)}
                              </div>
                              <h3 className="font-medium text-[#202124] text-sm mb-1 truncate w-full">
                                {asset.filename}
                              </h3>
                              <div className="text-xs text-[#5f6368] mb-1">
                                {asset.type} •{" "}
                                {(asset.sizeBytes / (1024 * 1024)).toFixed(1)}{" "}
                                MB
                              </div>
                              {asset.uploadedBy && (
                                <div
                                  className="text-xs text-[#80868b] truncate w-full"
                                  title={asset.uploadedBy.email}
                                >
                                  {asset.uploadedBy.email}
                                </div>
                              )}
                            </div>
                            <div className="flex gap-2 justify-center flex-wrap">
                              {canView && (
                                <Link
                                  href={`/api/assets/${asset.id}/stream`}
                                  target="_blank"
                                  className="px-3 py-1.5 btn-primary text-xs no-underline"
                                >
                                  View
                                </Link>
                              )}
                              <Link
                                href={`/api/assets/${asset.id}/download`}
                                className="px-3 py-1.5 btn-secondary text-xs no-underline"
                              >
                                Download
                              </Link>
                              {canDelete && (
                                <button
                                  onClick={() => deleteAsset(asset.id)}
                                  disabled={deletingAssetId === asset.id}
                                  className="px-3 py-1.5 bg-red-600 text-white rounded text-xs disabled:opacity-50 border-none cursor-pointer hover:bg-red-700"
                                >
                                  {deletingAssetId === asset.id
                                    ? "Deleting..."
                                    : "Delete"}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}

          {/* Show deliveries when viewing a PROJECT or DELIVERABLES folder */}
          {viewMode !== "all" &&
            (() => {
              const currentFolder = project.folders.find(
                (f) => f.id === viewMode
              );
              // Only show deliveries section for PROJECT and DELIVERABLES folders
              if (
                currentFolder?.type !== "PROJECT" &&
                currentFolder?.type !== "DELIVERABLES"
              )
                return null;

              const folderDeliveries = project.deliveries.filter(
                (d) => d.folderId === viewMode
              );

              // Filter by search
              const filteredDeliveries = folderDeliveries.filter(
                (d) =>
                  !searchQuery ||
                  d.filename.toLowerCase().includes(searchQuery.toLowerCase())
              );

              return (
                <>
                  {/* Upload Form - Inside PROJECT or DELIVERABLES Folder */}
                  <div className="card mb-4 space-y-4">
                    <div className="text-sm text-[#5f6368]">
                      Uploading to: <strong>{currentFolder.name}</strong>
                    </div>
                    <div
                      className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
                        isDeliveryDragging
                          ? "border-[#1a73e8] bg-[#e8f0fe]"
                          : "border-[#dadce0] bg-white"
                      }`}
                      onDragOver={handleDeliveryDragOver}
                      onDragLeave={() => setIsDeliveryDragging(false)}
                      onDrop={handleDeliveryDrop}
                      onClick={() => deliveryInputRef.current?.click()}
                    >
                      <input
                        ref={deliveryInputRef}
                        type="file"
                        accept="*/*"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files) {
                            handleDeliveryFiles(e.target.files);
                          }
                        }}
                      />
                      <p className="font-medium text-[#202124]">
                        Drag & drop files here
                      </p>
                      <p className="text-sm text-[#5f6368]">
                        or tap to select multiple deliveries from your device
                      </p>
                      <p className="text-xs text-[#80868b] mt-2">
                        All file types are supported. Multi-select works on
                        desktop and mobile.
                      </p>
                    </div>
                    {deliveryFiles.length > 0 && (
                      <div className="border border-[#dadce0] rounded-lg divide-y divide-[#dadce0]/60 bg-white">
                        {deliveryFiles.map((selected, index) => (
                          <div
                            key={`${selected.name}-${selected.size}-${selected.lastModified}-${index}`}
                            className="flex items-center justify-between px-3 py-2 text-sm text-[#202124]"
                          >
                            <div className="min-w-0">
                              <p className="truncate font-medium">
                                {selected.name}
                              </p>
                              <p className="text-xs text-[#5f6368]">
                                {(selected.size / (1024 * 1024)).toFixed(2)} MB
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeDeliveryFile(index)}
                              disabled={uploading}
                              className="text-xs text-[#1a73e8] hover:underline disabled:opacity-50"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    {error && <p className="text-red-600 text-sm">{error}</p>}
                    {uploading && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm text-[#5f6368]">
                          <span>
                            Uploading {currentDeliveryUploadName || "files"} (
                            {currentDeliveryUploadIndex}/
                            {Math.max(totalDeliveryUploads, 1)})
                          </span>
                          <span>{uploadProgress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                          <div
                            className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                            style={{ width: `${uploadProgress}%` }}
                          ></div>
                        </div>
                      </div>
                    )}
                    <button
                      onClick={onUpload}
                      disabled={deliveryFiles.length === 0 || uploading}
                      className="btn-primary disabled:opacity-50"
                    >
                      {uploading
                        ? "Uploading..."
                        : deliveryFiles.length > 0
                        ? `Upload ${deliveryFiles.length} ${
                            deliveryFiles.length === 1
                              ? "Delivery"
                              : "Deliveries"
                          }`
                        : "Upload Deliveries"}
                    </button>
                  </div>

                  <div className="flex items-center gap-2 mb-4">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      className="text-[#5f6368]"
                    >
                      <path
                        d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"
                        fill="currentColor"
                      />
                    </svg>
                    <h2 className="text-xl font-normal text-[#202124]">
                      Deliveries ({filteredDeliveries.length})
                    </h2>
                  </div>

                  {filteredDeliveries.length === 0 ? (
                    <div className="text-center py-12 text-[#5f6368]">
                      No deliveries in this project folder yet.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                      {filteredDeliveries.map((delivery) => {
                        const isImageFile = isImage(
                          delivery.contentType,
                          delivery.filename
                        );
                        const isVideoFile = isVideo(
                          delivery.contentType,
                          delivery.filename
                        );

                        return (
                          <div key={delivery.id} className="card group">
                            <div className="flex flex-col items-center text-center mb-3">
                              <div className="mb-2">
                                {isImageFile ? (
                                  <svg
                                    width="40"
                                    height="40"
                                    viewBox="0 0 24 24"
                                    fill="#4285f4"
                                  >
                                    <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
                                  </svg>
                                ) : isVideoFile ? (
                                  <svg
                                    width="40"
                                    height="40"
                                    viewBox="0 0 24 24"
                                    fill="#ea4335"
                                  >
                                    <path d="M17 10.5V7a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h12a1 1 0 001-1v-3.5l4 4v-11l-4 4z" />
                                  </svg>
                                ) : (
                                  <svg
                                    width="40"
                                    height="40"
                                    viewBox="0 0 24 24"
                                    fill="#34a853"
                                  >
                                    <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
                                  </svg>
                                )}
                              </div>
                              <h3 className="font-medium text-[#202124] text-sm mb-1 truncate w-full">
                                {delivery.filename}
                              </h3>
                              <div className="text-xs text-[#5f6368] mb-1">
                                {(delivery.sizeBytes / (1024 * 1024)).toFixed(
                                  1
                                )}{" "}
                                MB
                              </div>
                              <div className="text-xs text-[#80868b] mt-1">
                                {new Date(
                                  delivery.createdAt
                                ).toLocaleDateString()}
                              </div>
                            </div>
                            <div className="flex gap-2 justify-center">
                              {isVideoFile && (
                                <Link
                                  href={`/api/deliveries/${delivery.id}/stream`}
                                  className="px-3 py-1.5 btn-primary text-xs no-underline"
                                >
                                  Watch
                                </Link>
                              )}
                              {isImageFile && (
                                <Link
                                  href={`/api/deliveries/${delivery.id}/stream`}
                                  target="_blank"
                                  className="px-3 py-1.5 btn-primary text-xs no-underline"
                                >
                                  View
                                </Link>
                              )}
                              <Link
                                href={`/api/deliveries/${delivery.id}/download`}
                                className="px-3 py-1.5 btn-secondary text-xs no-underline"
                              >
                                Download
                              </Link>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              );
            })()}
        </section>
      </div>
    </div>
  );
}

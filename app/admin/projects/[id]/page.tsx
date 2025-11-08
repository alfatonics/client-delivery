"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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
};

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
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
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
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchData();
    fetchCurrentUser();
  }, [id]);

  // Auto-select first ASSETS folder when project loads
  useEffect(() => {
    if (project && viewMode === "all" && !selectedFolderId) {
      const assetsFolder = project.folders.find((f) => f.type === "ASSETS");
      if (assetsFolder) {
        setSelectedFolderId(assetsFolder.id);
      }
    }
  }, [project, viewMode, selectedFolderId]);

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

  const fetchData = async () => {
    try {
      const [projectRes, staffRes] = await Promise.all([
        fetch(`/api/projects/${id}`),
        fetch("/api/admin/staff"),
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
    } catch (e: any) {
      console.error("Fetch error:", e);
      setError(e.message || "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  const assignStaff = async () => {
    setAssigning(true);
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

      await fetchData();
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

      await fetchData();
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

      await fetchData();
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
    if (!file) return;
    setUploading(true);
    setError(null);

    try {
      // Determine target folder for assets (must be ASSETS folder)
      let targetFolderId: string | undefined;
      if (viewMode !== "all") {
        const currentFolder = project?.folders.find((f) => f.id === viewMode);
        if (currentFolder?.type !== "ASSETS") {
          throw new Error("Assets can only be uploaded to Assets folders");
        }
        targetFolderId = viewMode;
      } else {
        if (!selectedFolderId) {
          // Auto-select first ASSETS folder if none selected
          const assetsFolder = project?.folders.find(
            (f) => f.type === "ASSETS"
          );
          if (!assetsFolder) {
            throw new Error("No Assets folder found. Please contact support.");
          }
          targetFolderId = assetsFolder.id;
        } else {
          const selectedFolder = project?.folders.find(
            (f) => f.id === selectedFolderId
          );
          if (selectedFolder?.type !== "ASSETS") {
            throw new Error("Assets can only be uploaded to Assets folders");
          }
          targetFolderId = selectedFolderId;
        }
      }

      const initRes = await fetch(`/api/projects/${id}/assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          folderId: targetFolderId,
        }),
      });
      const init = await initRes.json();
      const {
        uploadId,
        key,
        partSize,
        presignedPartUrls,
        completeUrl,
        folderId: returnedFolderId,
      } = init;

      const totalParts = presignedPartUrls.length;
      const etags: { ETag: string; PartNumber: number }[] = [];
      for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
        const start = (partNumber - 1) * partSize;
        const end = Math.min(start + partSize, file.size);
        const blob = file.slice(start, end);
        // Use proxy route to avoid CORS issues
        const res = await fetch(
          `/api/r2/upload-part?url=${encodeURIComponent(
            presignedPartUrls[partNumber - 1]
          )}`,
          {
            method: "PUT",
            body: blob,
            headers: {
              "Content-Type": file.type || "application/octet-stream",
            },
          }
        );
        if (!res.ok) throw new Error(`Part ${partNumber} failed`);
        const data = await res.json();
        etags.push({ ETag: data.etag, PartNumber: partNumber });
      }

      const completeRes = await fetch(completeUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key,
          uploadId,
          parts: etags,
          filename: file.name,
          contentType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          folderId: targetFolderId,
        }),
      });
      if (!completeRes.ok) throw new Error("Complete failed");

      await fetchData();
      setFile(null);
      setSelectedFolderId(null);
    } catch (e: any) {
      setError(e.message || "Upload failed");
    } finally {
      setUploading(false);
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
      <div className="p-6 max-w-[1800px] mx-auto space-y-6">
        <div className="card">
          <h2 className="font-medium text-[#202124] mb-4">Assign Staff</h2>
          <div className="flex gap-3">
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

        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-normal text-[#202124]">
                {viewMode === "all" ? (
                  <>
                    Assets ({project.assets.filter((a) => !a.folderId).length})
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setViewMode("all")}
                      className="text-[#1a73e8] hover:underline mr-2"
                    >
                      ← Back
                    </button>
                    {project.folders.find((f) => f.id === viewMode)?.name ||
                      "Folder"}{" "}
                    (
                    {
                      project.assets.filter((a) => a.folderId === viewMode)
                        .length
                    }
                    )
                  </>
                )}
              </h2>
            </div>
            <div className="flex gap-2">
              {viewMode === "all" && (
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
          {showCreateFolder && viewMode === "all" && (
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

          {/* Upload Form */}
          <div className="card mb-4">
            <h3 className="font-medium text-[#202124] mb-4">
              Upload New Asset
            </h3>
            <div className="space-y-4">
              {viewMode === "all" &&
                (() => {
                  const assetsFolders = project.folders.filter(
                    (f) => f.type === "ASSETS"
                  );
                  if (assetsFolders.length === 0) {
                    return (
                      <div className="text-sm text-red-600">
                        No Assets folder found. Please contact support.
                      </div>
                    );
                  }
                  return (
                    <div>
                      <label className="block text-sm text-[#5f6368] mb-2">
                        Upload to Assets Folder{" "}
                        <span className="text-red-600">*</span>
                      </label>
                      <select
                        value={selectedFolderId || assetsFolders[0]?.id || ""}
                        onChange={(e) =>
                          setSelectedFolderId(e.target.value || null)
                        }
                        className="input"
                        required
                      >
                        {assetsFolders.map((folder) => (
                          <option key={folder.id} value={folder.id}>
                            {folder.name}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-[#5f6368] mt-1">
                        Assets must be uploaded to the Assets folder.
                      </p>
                    </div>
                  );
                })()}
              {viewMode !== "all" &&
                (() => {
                  const currentFolder = project.folders.find(
                    (f) => f.id === viewMode
                  );
                  if (currentFolder?.type === "ASSETS") {
                    return (
                      <div className="text-sm text-[#5f6368]">
                        Uploading to: <strong>{currentFolder.name}</strong>
                      </div>
                    );
                  } else {
                    return (
                      <div className="text-sm text-red-600">
                        Assets can only be uploaded to Assets folders. Please go
                        back and select an Assets folder.
                      </div>
                    );
                  }
                })()}
              <div>
                <input
                  type="file"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="input"
                  accept="*/*"
                  multiple={false}
                />
                <p className="text-xs text-[#5f6368] mt-1">
                  All file types are supported. File type will be detected
                  automatically.
                </p>
              </div>
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <button
                onClick={onUploadAsset}
                disabled={!file || uploading}
                className="btn-primary disabled:opacity-50"
              >
                {uploading ? "Uploading..." : "Upload Asset"}
              </button>
            </div>
          </div>

          {/* Folders Grid */}
          {viewMode === "all" && project.folders.length > 0 && (
            <div className="mb-8">
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
                  Folders ({project.folders.length})
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-4">
                {project.folders.map((folder) => (
                  <div key={folder.id} className="card group">
                    {editingFolderId === folder.id ? (
                      <div className="space-y-3">
                        <input
                          type="text"
                          value={editingFolderName}
                          onChange={(e) => setEditingFolderName(e.target.value)}
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

          {/* Assets Grid */}
          {(() => {
            const displayedAssets =
              viewMode === "all"
                ? project.assets.filter((a) => !a.folderId)
                : project.assets.filter((a) => a.folderId === viewMode);

            return displayedAssets.length === 0 ? (
              <div className="text-center py-12 text-[#5f6368]">
                {viewMode === "all"
                  ? "No assets in root folder. Create a folder or upload files."
                  : "No assets in this folder yet."}
              </div>
            ) : (
              <>
                {viewMode === "all" && project.folders.length > 0 && (
                  <div className="flex items-center gap-2 mb-4 mt-6">
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
                      Files ({displayedAssets.length})
                    </h3>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-4">
                  {displayedAssets.map((asset) => {
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
                            {(asset.sizeBytes / (1024 * 1024)).toFixed(1)} MB
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
              </>
            );
          })()}
        </section>

        <section>
          <h2 className="text-xl font-normal text-[#202124] mb-4">
            Deliveries ({project.deliveries.length})
          </h2>
          {project.deliveries.length === 0 ? (
            <div className="text-center py-12 text-[#5f6368]">
              No deliveries yet
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {project.deliveries.map((delivery) => (
                <div key={delivery.id} className="card group">
                  <div className="flex flex-col items-center text-center mb-3">
                    <div className="mb-2">
                      <svg
                        width="40"
                        height="40"
                        viewBox="0 0 24 24"
                        fill="#ea4335"
                      >
                        <path d="M17 10.5V7a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h12a1 1 0 001-1v-3.5l4 4v-11l-4 4z" />
                      </svg>
                    </div>
                    <h3 className="font-medium text-[#202124] text-sm mb-1 truncate w-full">
                      {delivery.filename}
                    </h3>
                    <div className="text-xs text-[#5f6368] mb-1">
                      {(delivery.sizeBytes / (1024 * 1024)).toFixed(1)} MB
                    </div>
                    <div
                      className="text-xs text-[#80868b] truncate w-full"
                      title={delivery.uploadedBy.email}
                    >
                      {delivery.uploadedBy.email}
                    </div>
                    <div className="text-xs text-[#80868b] mt-1">
                      {new Date(delivery.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex gap-2 justify-center">
                    <Link
                      href={`/api/deliveries/${delivery.id}/stream`}
                      className="px-3 py-1.5 btn-primary text-xs no-underline"
                    >
                      Watch
                    </Link>
                    <Link
                      href={`/api/deliveries/${delivery.id}/download`}
                      className="px-3 py-1.5 btn-secondary text-xs no-underline"
                    >
                      Download
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

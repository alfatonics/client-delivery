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
  client?: { id: string; email: string; name: string | null };
  staff: { id: string; email: string; name: string | null } | null;
  assets: Asset[];
  deliveries: Delivery[];
  folders: Folder[];
};

export default function ClientProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { id } = use(params);
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    role: string;
  } | null>(null);
  const [viewMode, setViewMode] = useState<"all" | string>("all"); // "all" or folderId
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<
    "all" | "PROJECT" | "ASSETS" | "DELIVERABLES"
  >("all");

  useEffect(() => {
    fetchProject();
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

  const onUpload = async () => {
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

      await fetchProject();
      setFile(null);
      setSelectedFolderId(null);
    } catch (e: any) {
      setError(e.message || "Upload failed");
    } finally {
      setUploading(false);
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

  const isImageFile = (contentType: string, filename: string): boolean => {
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

  const isVideoFile = (contentType: string, filename: string): boolean => {
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

  return (
    <div className="drive-container">
      {/* Toolbar */}
      <div className="bg-white border-b border-[#dadce0] px-6 py-4">
        <div className="flex items-center justify-between max-w-[1800px] mx-auto">
          <div className="flex items-center gap-4">
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
            <div>
              <h1 className="text-2xl font-normal text-[#202124]">
                {project.title ||
                  project.client?.email ||
                  `Customer ${project.id.slice(0, 8)}`}
              </h1>
            </div>
          </div>
          <div className={getStatusBadgeClass(project.status)}>
            {project.status.replace("_", " ")}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 max-w-[1800px] mx-auto space-y-6">
        {project.description && (
          <div className="card">
            <h2 className="font-medium text-[#202124] mb-2">Description</h2>
            <p className="text-[#5f6368]">{project.description}</p>
          </div>
        )}

        <section>
          {/* Search and Filter Bar */}
          {viewMode === "all" && (
            <div className="mb-4 space-y-3">
              <div className="flex gap-3 flex-wrap">
                <div className="flex-1 min-w-[200px]">
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
                      placeholder="Search folders and files..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-white border border-[#dadce0] rounded-lg text-[#202124] placeholder-[#5f6368] focus:outline-none focus:border-[#1a73e8] focus:shadow-sm transition-all"
                    />
                  </div>
                </div>
                <select
                  value={filterType}
                  onChange={(e) =>
                    setFilterType(
                      e.target.value as "all" | "PROJECT" | "ASSETS"
                    )
                  }
                  className="px-4 py-2 bg-white border border-[#dadce0] rounded-lg text-[#202124] focus:outline-none focus:border-[#1a73e8]"
                >
                  <option value="all">All Folders</option>
                  <option value="PROJECT">Project Folders</option>
                  <option value="ASSETS">Assets Folder</option>
                  <option value="DELIVERABLES">Deliverables Folder</option>
                </select>
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
            <div className="flex gap-2"></div>
          </div>

          {/* Folders Grid (only show when viewing all) */}
          {viewMode === "all" &&
            (() => {
              // Filter folders by search and type
              const filteredFolders = project.folders.filter((folder) => {
                const matchesSearch =
                  !searchQuery ||
                  folder.name.toLowerCase().includes(searchQuery.toLowerCase());
                const matchesFilter =
                  filterType === "all" || folder.type === filterType;
                return matchesSearch && matchesFilter;
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
                      </div>
                    </div>
                  )}

                  {/* PROJECT Folders */}
                  {projectFolders.length > 0 && (
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
                </div>
              );
            })()}

          {/* Search Bar in Folder View */}
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

          {/* Folder View - Show Assets and Deliveries */}
          {viewMode !== "all" &&
            (() => {
              const currentFolder = project.folders.find(
                (f) => f.id === viewMode
              );
              if (!currentFolder) return null;

              const folderAssets = project.assets.filter(
                (a) => a.folderId === viewMode
              );
              const folderDeliveries = project.deliveries.filter(
                (d) => d.folderId === viewMode
              );

              // Filter by search
              const filteredAssets = folderAssets.filter(
                (a) =>
                  !searchQuery ||
                  a.filename.toLowerCase().includes(searchQuery.toLowerCase())
              );
              const filteredDeliveries = folderDeliveries.filter(
                (d) =>
                  !searchQuery ||
                  d.filename.toLowerCase().includes(searchQuery.toLowerCase())
              );

              return (
                <>
                  {/* Upload Form - Inside Folder View */}
                  {currentFolder.type === "ASSETS" && (
                    <div className="card mb-4">
                      <h3 className="font-medium text-[#202124] mb-4">
                        Upload New Asset
                      </h3>
                      <div className="space-y-4">
                        <div className="text-sm text-[#5f6368]">
                          Uploading to: <strong>{currentFolder.name}</strong>
                        </div>
                        <div>
                          <input
                            type="file"
                            onChange={(e) =>
                              setFile(e.target.files?.[0] || null)
                            }
                            className="input"
                            accept="*/*"
                            multiple={false}
                          />
                          <p className="text-xs text-[#5f6368] mt-1">
                            All file types are supported. File type will be
                            detected automatically.
                          </p>
                        </div>
                        {error && (
                          <p className="text-red-600 text-sm">{error}</p>
                        )}
                        <button
                          onClick={onUpload}
                          disabled={!file || uploading}
                          className="btn-primary disabled:opacity-50"
                        >
                          {uploading ? "Uploading..." : "Upload Asset"}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Deliveries Section (for PROJECT and DELIVERABLES folders) */}
                  {(currentFolder.type === "PROJECT" ||
                    currentFolder.type === "DELIVERABLES") && (
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
                            d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"
                            fill="currentColor"
                          />
                        </svg>
                        <h3 className="text-lg font-medium text-[#202124]">
                          Deliveries ({filteredDeliveries.length})
                        </h3>
                      </div>
                      {filteredDeliveries.length === 0 ? (
                        <div className="text-center py-8 text-[#5f6368] text-sm">
                          No deliveries in this project folder yet.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-4">
                          {filteredDeliveries.map((delivery) => {
                            const imageFile = isImageFile(
                              delivery.contentType,
                              delivery.filename
                            );
                            const videoFile = isVideoFile(
                              delivery.contentType,
                              delivery.filename
                            );
                            const icon = getFileIcon(
                              imageFile ? "IMAGE" : "OTHER",
                              delivery.contentType
                            );

                            return (
                              <div key={delivery.id} className="card group">
                                <div className="flex flex-col items-center text-center mb-3">
                                  <div className="mb-2">{icon}</div>
                                  <h3 className="font-medium text-[#202124] text-sm mb-1 truncate w-full">
                                    {delivery.filename}
                                  </h3>
                                  <div className="text-xs text-[#5f6368] mb-1">
                                    {(
                                      delivery.sizeBytes /
                                      (1024 * 1024)
                                    ).toFixed(1)}{" "}
                                    MB
                                  </div>
                                </div>
                                <div className="flex gap-2 justify-center flex-wrap">
                                  {videoFile && (
                                    <Link
                                      href={`/api/deliveries/${delivery.id}/stream`}
                                      className="px-3 py-1.5 btn-primary text-xs no-underline"
                                    >
                                      Watch
                                    </Link>
                                  )}
                                  {imageFile && (
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
                    </div>
                  )}

                  {/* Assets Section */}
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
                </>
              );
            })()}
        </section>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Client = { id: string; email: string };

export default function UploadPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [ownerId, setOwnerId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/clients")
      .then((r) => r.json())
      .then(setClients)
      .catch(() => setClients([]));
  }, []);

  const canSubmit = useMemo(() => !!file && !!ownerId, [file, ownerId]);

  const onUpload = async () => {
    if (!file || !ownerId) return;
    setBusy(true);
    setError(null);
    try {
      const contentType = file.type || "application/octet-stream";
      const initRes = await fetch("/api/r2/multipart/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType,
          sizeBytes: file.size,
        }),
      });
      if (!initRes.ok) {
        const message = await initRes.text();
        throw new Error(
          message ||
            `Upload init failed (${initRes.status} ${initRes.statusText})`
        );
      }
      const init = await initRes.json();
      const {
        uploadId,
        key,
        partSize,
        presignedPartUrls,
        completeUrl,
        abortUrl,
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
        if (!res.ok) {
          const message = await res.text();
          throw new Error(
            message
              ? `Part ${partNumber}: ${message}`
              : `Part ${partNumber} failed (${res.status})`
          );
        }
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
          ownerId,
          filename: file.name,
          contentType,
          sizeBytes: file.size,
        }),
      });
      if (!completeRes.ok) {
        const message = await completeRes.text();
        throw new Error(message || `Complete failed (${completeRes.status})`);
      }

      router.push("/admin");
    } catch (e: any) {
      setError(e.message || "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="drive-container">
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
            <h1 className="text-2xl font-normal text-[#202124]">
              Upload Video
            </h1>
          </div>
        </div>
      </div>
      <div className="p-6 max-w-2xl mx-auto">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onUpload();
          }}
          className="card space-y-6"
        >
          <div>
            <label className="block text-sm font-medium text-[#202124] mb-2">
              Select client <span className="text-red-500">*</span>
            </label>
            <select
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
              className="input"
              required
            >
              <option value="">-- Choose client --</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.email}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#202124] mb-2">
              Video file <span className="text-red-500">*</span>
            </label>
            <input
              type="file"
              accept="video/*"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="input"
              required
            />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={!canSubmit || busy}
              className="btn-primary disabled:opacity-50"
            >
              {busy ? "Uploading..." : "Upload"}
            </button>
            <Link href="/admin" className="btn-secondary no-underline">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

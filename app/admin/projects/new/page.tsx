"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Client = { id: string; email: string; name: string | null };

export default function NewProjectPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    clientId: "",
  });
  const [loading, setLoading] = useState(false);
  const [loadingClients, setLoadingClients] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      const res = await fetch("/api/admin/clients");
      if (!res.ok) throw new Error("Failed to fetch clients");
      const data = await res.json();
      setClients(data);
    } catch (e: any) {
      setError(e.message || "Failed to load clients");
    } finally {
      setLoadingClients(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.clientId) {
      setError("Please select a client");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title || undefined,
          description: formData.description || undefined,
          clientId: formData.clientId,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create project");
      }

      const project = await res.json();
      router.push(`/admin/projects/${project.id}`);
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  };

  return (
    <div className="drive-container">
      <div className="bg-white border-b border-[#dadce0] px-6 py-4">
        <div className="flex items-center justify-between max-w-[1800px] mx-auto">
          <h1 className="text-2xl font-normal text-[#202124]">
            Create New Project
          </h1>
          <Link href="/admin" className="btn-secondary no-underline">
            Back
          </Link>
        </div>
      </div>
      <div className="p-6 max-w-2xl mx-auto">
        <form onSubmit={onSubmit} className="card space-y-6">
          <div>
            <label className="block text-sm font-medium text-[#202124] mb-2">
              Client <span className="text-red-500">*</span>
            </label>
            {loadingClients ? (
              <p className="text-[#5f6368]">Loading clients...</p>
            ) : (
              <select
                value={formData.clientId}
                onChange={(e) =>
                  setFormData({ ...formData, clientId: e.target.value })
                }
                className="input"
                required
              >
                <option value="">-- Select client --</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.email} {client.name && `(${client.name})`}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-[#202124] mb-2">
              Title (optional)
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              className="input"
              placeholder="e.g., Product Launch Video"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#202124] mb-2">
              Description (optional)
            </label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="input"
              rows={4}
              placeholder="Describe the project requirements..."
            />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading || loadingClients || !formData.clientId}
              className="btn-primary disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create Project"}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="btn-secondary"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

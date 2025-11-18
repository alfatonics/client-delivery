"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Project = {
  id: string;
  title: string | null;
  description: string | null;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  client: { id: string; email: string; name: string | null } | null;
  staff: { id: string; email: string; name: string | null } | null;
  assets: Array<{ id: string; filename: string; type: string }>;
  deliveries: Array<{ id: string; filename: string }>;
  createdAt: string;
};

export default function ClientDashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const res = await fetch("/api/projects");
      if (!res.ok) {
        const errorText = await res.text();
        console.error("Failed to fetch projects:", res.status, errorText);
        throw new Error(`Failed to fetch projects: ${res.status} ${errorText}`);
      }
      const data = await res.json();
      setProjects(data);
    } catch (e: any) {
      console.error("Error fetching projects:", e);
      // Set empty array on error so UI doesn't break
      setProjects([]);
    } finally {
      setLoading(false);
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

  const getFolderIcon = (status: string) => {
    const color =
      status === "COMPLETED"
        ? "#10b981"
        : status === "IN_PROGRESS"
        ? "#3b82f6"
        : "#f59e0b";
    return (
      <svg
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M10 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2h-8l-2-2z"
          fill={color}
        />
      </svg>
    );
  };

  return (
    <div className="drive-container">
      {/* Toolbar */}
      <div className="bg-white border-b border-[#dadce0] px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center justify-between max-w-[1800px] mx-auto gap-3">
          <h1 className="text-xl sm:text-2xl font-normal text-[#202124]">
            My Projects
          </h1>
          <Link
            href="/client/projects/new"
            className="btn-primary no-underline text-sm sm:text-base shrink-0"
          >
            <span className="flex items-center gap-1 sm:gap-2">
              <svg
                width="18"
                height="18"
                className="sm:w-5 sm:h-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              <span className="hidden sm:inline">New Project</span>
              <span className="sm:hidden">New</span>
            </span>
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 sm:p-6 max-w-[1800px] mx-auto">
        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-24 h-24 mb-4 text-[#dadce0]">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
              >
                <path d="M10 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2h-8l-2-2z" />
              </svg>
            </div>
            <h2 className="text-xl font-normal text-[#202124] mb-2">
              No projects yet
            </h2>
            <p className="text-[#5f6368] mb-6">
              Create your first project to get started.
            </p>
            <Link
              href="/client/projects/new"
              className="btn-primary no-underline"
            >
              Create Project
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-4">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/client/projects/${project.id}`}
                className="card group cursor-pointer no-underline"
              >
                <div className="flex flex-col items-center text-center">
                  <div className="mb-3">{getFolderIcon(project.status)}</div>
                  <h3 className="font-medium text-[#202124] text-sm mb-1 truncate w-full">
                    {project.title ||
                      project.client?.email ||
                      `Customer ${project.id.slice(0, 8)}`}
                  </h3>
                  <div className={getStatusBadgeClass(project.status)}>
                    {project.status.replace("_", " ")}
                  </div>
                  <div className="mt-3 text-xs text-[#5f6368]">
                    <div>
                      {project.deliveries.length} deliver
                      {project.deliveries.length !== 1 ? "ies" : "y"}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import Link from "next/link";
import ClientLink from "@/app/components/ClientLink";

const formatDate = (value?: Date | string | null) => {
  if (!value) return null;
  const date = typeof value === "string" ? new Date(value) : value;
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  try {
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return date.toISOString().split("T")[0];
  }
};

export default async function AdminPage() {
  const session = await auth();
  if (!session || (session.user as any)?.role !== "ADMIN") return null;

  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      client: { select: { id: true, email: true, name: true } },
      staffAssignments: {
        include: {
          staff: { select: { id: true, email: true, name: true } },
        },
        orderBy: { assignedAt: "asc" },
      },
      createdBy: { select: { id: true, email: true, name: true, role: true } },
      assets: true,
      deliveries: {
        include: {
          uploadedBy: { select: { id: true, email: true, name: true } },
        },
      },
    },
    take: 20,
  });

  const stats = {
    totalProjects: await prisma.project.count(),
    pendingProjects: await prisma.project.count({
      where: { status: "PENDING" },
    }),
    inProgressProjects: await prisma.project.count({
      where: { status: "IN_PROGRESS" },
    }),
    completedProjects: await prisma.project.count({
      where: { status: "COMPLETED" },
    }),
    totalClients: await prisma.user.count({ where: { role: "CLIENT" } }),
    totalStaff: await prisma.user.count({ where: { role: "STAFF" } }),
  };

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
      {/* Toolbar */}
      <div className="bg-white border-b border-[#dadce0] px-6 py-4">
        <div className="flex items-center justify-between w-full max-w-[1920px] mx-auto">
          <h1 className="text-2xl font-normal text-[#202124]">
            Admin Dashboard
          </h1>
          <div className="flex gap-3">
            <Link href="/admin/users" className="btn-secondary no-underline">
              Manage Users
            </Link>
            <Link
              href="/admin/projects/new"
              className="btn-primary no-underline"
            >
              Create Project
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 w-full max-w-[1920px] mx-auto space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card">
            <div className="text-3xl font-normal text-[#202124] mb-1">
              {stats.totalProjects}
            </div>
            <div className="text-sm text-[#5f6368]">Total Projects</div>
          </div>
          <div className="card">
            <div className="text-3xl font-normal text-[#f59e0b] mb-1">
              {stats.pendingProjects}
            </div>
            <div className="text-sm text-[#5f6368]">Pending</div>
          </div>
          <div className="card">
            <div className="text-3xl font-normal text-[#3b82f6] mb-1">
              {stats.inProgressProjects}
            </div>
            <div className="text-sm text-[#5f6368]">In Progress</div>
          </div>
          <div className="card">
            <div className="text-3xl font-normal text-[#10b981] mb-1">
              {stats.completedProjects}
            </div>
            <div className="text-sm text-[#5f6368]">Completed</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="card">
            <div className="text-3xl font-normal text-[#202124] mb-1">
              {stats.totalClients}
            </div>
            <div className="text-sm text-[#5f6368]">Total Clients</div>
          </div>
          <div className="card">
            <div className="text-3xl font-normal text-[#202124] mb-1">
              {stats.totalStaff}
            </div>
            <div className="text-sm text-[#5f6368]">Total Staff</div>
          </div>
        </div>

        {/* Recent Projects */}
        <section>
          <h2 className="text-xl font-normal text-[#202124] mb-4">
            Recent Projects
          </h2>
          <div className="bg-white border border-[#dadce0] rounded-lg">
            {projects.length === 0 ? (
              <div className="p-8 text-center text-[#5f6368]">
                No projects yet
              </div>
            ) : (
              projects.map((project) => (
                <div
                  key={project.id}
                  className="block p-4 hover:bg-[#f8f9fa] transition-colors border-b border-[#dadce0] last:border-b-0"
                >
                  <Link
                    href={`/admin/projects/${project.id}`}
                    className="block no-underline"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <div className="font-medium text-[#202124] mb-1">
                          {project.title || `Project ${project.id.slice(0, 8)}`}
                        </div>
                        <div className="text-sm text-[#5f6368]">
                          Client: {project.client.email}
                          {project.staffAssignments.length > 0 && (
                            <>
                              {" "}
                              • Staff:{" "}
                              {project.staffAssignments
                                .map((assignment) => assignment.staff?.email)
                                .filter(Boolean)
                                .join(", ")}
                            </>
                          )}
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
                      <span className={getStatusBadgeClass(project.status)}>
                        {project.status.replace("_", " ")}
                      </span>
                    </div>
                    {project.description && (
                      <div className="text-sm text-[#5f6368] mb-2">
                        {project.description}
                      </div>
                    )}
                    <div className="flex gap-4 text-sm text-[#5f6368]">
                      <span>{project.assets.length} assets</span>
                      <span>{project.deliveries.length} deliveries</span>
                    </div>
                    {"completionNotifiedAt" in project &&
                      project.status === "COMPLETED" && (
                        <div className="mt-2 text-xs">
                          {(() => {
                            const notifiedAt = (
                              project as {
                                completionNotifiedAt?: Date | string | null;
                              }
                            ).completionNotifiedAt;
                            return notifiedAt ? (
                              <span className="text-[#0f766e] font-medium">
                                Email sent {formatDate(notifiedAt)}
                              </span>
                            ) : (
                              <span className="text-[#b45309]">
                                Awaiting client email
                              </span>
                            );
                          })()}
                        </div>
                      )}
                  </Link>
                  {project.status === "COMPLETED" && (
                    <ClientLink projectId={project.id} />
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

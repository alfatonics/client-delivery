import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { sendProjectAssignmentEmail } from "@/app/lib/email";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";

const updateProjectSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED"]).optional(),
  staffIds: z.array(z.string()).optional(),
});

// GET - Get single project
export async function GET(
  _: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) return new NextResponse("Unauthorized", { status: 401 });

    const { id } = await ctx.params;
    const { role, id: userId } = session.user;

    let project = await prisma.project.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, email: true, name: true } },
        staffAssignments: {
          include: {
            staff: { select: { id: true, email: true, name: true } },
            assignedBy: { select: { id: true, email: true, name: true } },
          },
          orderBy: { assignedAt: "asc" },
        },
        createdBy: {
          select: { id: true, email: true, name: true, role: true },
        },
        assets: {
          include: {
            uploadedBy: { select: { id: true, email: true, name: true } },
            folder: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        deliveries: {
          include: {
            uploadedBy: { select: { id: true, email: true, name: true } },
            folder: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        folders: {
          include: {
            _count: {
              select: { assets: true, deliveries: true },
            },
          },
          orderBy: [
            { type: "asc" }, // ASSETS folder first
            { createdAt: "desc" },
          ],
        },
      },
    });

    if (!project) return new NextResponse("Not Found", { status: 404 });

    // Auto-create ASSETS and DELIVERABLES folders if they don't exist
    const assetsFolder = project.folders.find((f) => f.type === "ASSETS");
    const deliverablesFolder = project.folders.find(
      (f) => f.type === "DELIVERABLES"
    );

    if (!assetsFolder || !deliverablesFolder) {
      const foldersToCreate: Prisma.FolderCreateManyInput[] = [];
      if (!assetsFolder) {
        foldersToCreate.push({
          name: "Shared Assets",
          type: "ASSETS",
          projectId: id,
        });
      }
      if (!deliverablesFolder) {
        foldersToCreate.push({
          name: "Deliverables",
          type: "DELIVERABLES",
          projectId: id,
        });
      }

      if (foldersToCreate.length > 0) {
        await prisma.folder.createMany({
          data: foldersToCreate,
        });
      }
      // Refetch project with new folder
      project = await prisma.project.findUnique({
        where: { id },
        include: {
          client: { select: { id: true, email: true, name: true } },
          staffAssignments: {
            include: {
              staff: { select: { id: true, email: true, name: true } },
              assignedBy: { select: { id: true, email: true, name: true } },
            },
            orderBy: { assignedAt: "asc" },
          },
          createdBy: {
            select: { id: true, email: true, name: true, role: true },
          },
          assets: {
            include: {
              uploadedBy: { select: { id: true, email: true, name: true } },
              folder: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: "desc" },
          },
          deliveries: {
            include: {
              uploadedBy: { select: { id: true, email: true, name: true } },
              folder: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: "desc" },
          },
          folders: {
            include: {
              _count: {
                select: { assets: true, deliveries: true },
              },
            },
            orderBy: [{ type: "asc" }, { createdAt: "desc" }],
          },
        },
      });
      if (!project) {
        return new NextResponse("Not Found", { status: 404 });
      }
    }

    // Check permissions
    if (role === "CLIENT" && project.clientId !== userId) {
      return new NextResponse("Forbidden", { status: 403 });
    }
    const staffIds = new Set(
      project.staffAssignments.map((assignment) => assignment.staffId)
    );
    if (
      role === "STAFF" &&
      !staffIds.has(userId) &&
      project.createdById !== userId
    ) {
      // Staff can view projects they're assigned to OR projects they created
      return new NextResponse("Forbidden", { status: 403 });
    }

    // For clients, filter out assets and ASSETS folders - they should only see deliverables
    if (role === "CLIENT") {
      const filteredProject = {
        ...project,
        assets: [],
        folders: project.folders.filter((folder) => folder.type !== "ASSETS"),
      };
      return NextResponse.json(filteredProject);
    }

    return NextResponse.json(project);
  } catch (error: any) {
    console.error("Error in GET /api/projects/[id]:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch project" },
      { status: 500 }
    );
  }
}

// PATCH - Update project (admin or assigned staff)
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await ctx.params;
  const { role, id: userId } = session.user;

  try {
    const body = await req.json();
    const parsed = updateProjectSchema.parse(body);

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, email: true, name: true } },
        staffAssignments: {
          select: { staffId: true },
        },
        _count: { select: { deliveries: true } },
      },
    });

    if (!project) return new NextResponse("Not Found", { status: 404 });

    // Check permissions
    if (role === "CLIENT") {
      return new NextResponse("Forbidden", { status: 403 });
    }
    const existingStaffIds = new Set(
      project.staffAssignments.map((assignment) => assignment.staffId)
    );
    if (role === "STAFF" && !existingStaffIds.has(userId)) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const updateData: Prisma.ProjectUpdateInput = {};

    if (parsed.title !== undefined) {
      updateData.title = parsed.title;
    }
    if (parsed.description !== undefined) {
      updateData.description = parsed.description;
    }
    let staffAssignmentsUpdate:
      | {
          projectId: string;
          staffId: string;
        }[]
      | undefined;
    if (parsed.staffIds !== undefined) {
      if (role !== "ADMIN") {
        const incomingStaffIds = new Set(parsed.staffIds);
        const removedStaff = [...existingStaffIds].filter(
          (staffId) => !incomingStaffIds.has(staffId)
        );
        const addedStaff = [...incomingStaffIds].filter(
          (staffId) => !existingStaffIds.has(staffId)
        );
        const userRemains = incomingStaffIds.has(userId);
        if (
          !userRemains ||
          removedStaff.length > 0 ||
          addedStaff.some((id) => id !== userId)
        ) {
          return new NextResponse("Forbidden", { status: 403 });
        }
      }
      staffAssignmentsUpdate = [...new Set(parsed.staffIds)].map((staffId) => ({
        projectId: project.id,
        staffId,
      }));
    }

    if (parsed.status !== undefined) {
      if (
        parsed.status === "COMPLETED" &&
        role === "STAFF" &&
        project._count.deliveries === 0
      ) {
        return NextResponse.json(
          {
            error:
              "You must upload at least one delivery before marking the project as completed.",
          },
          { status: 400 }
        );
      }

      updateData.status = parsed.status;

      if (parsed.status === "COMPLETED") {
        (
          updateData as Prisma.ProjectUpdateInput & {
            completionSubmittedAt?: Date | null;
            completionSubmittedBy?: { connect: { id: string } };
            completionNotifiedAt?: Date | null;
            completionNotifiedBy?: { disconnect?: boolean };
            completionNotifiedById?: string | null;
            completionNotificationEmail?: string | null;
            completionNotificationCc?: string | null;
          }
        ).completionSubmittedAt = new Date();
        (updateData as any).completionSubmittedBy = { connect: { id: userId } };
      } else {
        (
          updateData as Prisma.ProjectUpdateInput & {
            completionSubmittedAt?: Date | null;
            completionSubmittedBy?: { disconnect?: boolean };
            completionNotifiedAt?: Date | null;
            completionNotifiedBy?: { disconnect?: boolean };
            completionNotificationEmail?: string | null;
            completionNotificationCc?: string | null;
          }
        ).completionSubmittedAt = null;
        (updateData as any).completionSubmittedBy = { disconnect: true };
        (updateData as any).completionNotifiedAt = null;
        (updateData as any).completionNotifiedBy = { disconnect: true };
        (updateData as any).completionNotificationEmail = null;
        (updateData as any).completionNotificationCc = null;
      }
    }

    if (Object.keys(updateData).length === 0) {
      const unchangedProject = await prisma.project.findUnique({
        where: { id },
        include: {
          client: { select: { id: true, email: true, name: true } },
          staffAssignments: {
            include: {
              staff: { select: { id: true, email: true, name: true } },
              assignedBy: { select: { id: true, email: true, name: true } },
            },
            orderBy: { assignedAt: "asc" },
          },
          createdBy: {
            select: { id: true, email: true, name: true, role: true },
          },
          assets: true,
          deliveries: true,
        },
      });
      return NextResponse.json(unchangedProject);
    }

    let updated = await prisma.project.update({
      where: { id },
      data: updateData,
      include: {
        client: { select: { id: true, email: true, name: true } },
        createdBy: {
          select: { id: true, email: true, name: true, role: true },
        },
        assets: true,
        deliveries: true,
        staffAssignments: {
          include: {
            staff: { select: { id: true, email: true, name: true } },
            assignedBy: { select: { id: true, email: true, name: true } },
          },
          orderBy: { assignedAt: "asc" },
        },
      },
    });

    if (staffAssignmentsUpdate !== undefined) {
      await prisma.projectStaffAssignment.deleteMany({
        where: { projectId: id },
      });

      if (staffAssignmentsUpdate.length > 0) {
        await prisma.projectStaffAssignment.createMany({
          data: staffAssignmentsUpdate.map((assignment) => ({
            ...assignment,
            assignedById: session.user.id,
          })),
        });
      }

      const updatedProject = await prisma.project.findUnique({
        where: { id },
        include: {
          client: { select: { id: true, email: true, name: true } },
          createdBy: {
            select: { id: true, email: true, name: true, role: true },
          },
          assets: true,
          deliveries: true,
          staffAssignments: {
            include: {
              staff: { select: { id: true, email: true, name: true } },
              assignedBy: { select: { id: true, email: true, name: true } },
            },
            orderBy: { assignedAt: "asc" },
          },
        },
      });

      if (!updatedProject) {
        return new NextResponse("Not Found", { status: 404 });
      }

      updated = updatedProject;

      // Automatically send emails to all assigned staff (including newly assigned)
      if (updated.staffAssignments.length > 0) {
        const assignedStaff = updated.staffAssignments
          .map((assignment) => assignment.staff)
          .filter(
            (
              staff
            ): staff is { id: string; email: string; name: string | null } =>
              Boolean(staff?.email && staff.email.trim().length > 0)
          );

        // Send emails to all assigned staff in the background
        // We don't await this to avoid blocking the response
        Promise.all(
          assignedStaff.map((staff) =>
            sendProjectAssignmentEmail({
              to: staff.email.trim(),
              staffName: staff.name,
              projectTitle: updated.title,
              projectId: updated.id,
              clientName: updated.client?.name,
              clientEmail: updated.client?.email,
              createdByName: session.user.name || session.user.email,
            }).catch((error) => {
              console.error(
                `Failed to send assignment email to ${staff.email}:`,
                error
              );
              // Don't throw - we don't want email failures to break the assignment
            })
          )
        ).catch((error) => {
          console.error("Error sending assignment emails:", error);
        });
      }
    }

    return NextResponse.json(updated);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json(
      { error: error.message || "Failed to update project" },
      { status: 500 }
    );
  }
}

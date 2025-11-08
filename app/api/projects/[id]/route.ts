import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";

const updateProjectSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED"]).optional(),
  staffId: z.string().optional().nullable(),
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
        staff: { select: { id: true, email: true, name: true } },
        createdBy: {
          select: { id: true, email: true, name: true, role: true },
        },
        completionSubmittedBy: {
          select: { id: true, email: true, name: true, role: true },
        },
        completionNotifiedBy: {
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
          staff: { select: { id: true, email: true, name: true } },
          createdBy: {
            select: { id: true, email: true, name: true, role: true },
          },
          completionSubmittedBy: {
            select: { id: true, email: true, name: true, role: true },
          },
          completionNotifiedBy: {
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
    if (
      role === "STAFF" &&
      project.staffId !== userId &&
      project.createdById !== userId
    ) {
      // Staff can view projects they're assigned to OR projects they created
      return new NextResponse("Forbidden", { status: 403 });
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
        staff: { select: { id: true } },
        _count: { select: { deliveries: true } },
      },
    });

    if (!project) return new NextResponse("Not Found", { status: 404 });

    // Check permissions
    if (role === "CLIENT") {
      return new NextResponse("Forbidden", { status: 403 });
    }
    if (role === "STAFF" && project.staffId !== userId) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const updateData: Prisma.ProjectUpdateInput = {};

    if (parsed.title !== undefined) {
      updateData.title = parsed.title;
    }
    if (parsed.description !== undefined) {
      updateData.description = parsed.description;
    }
    if (parsed.staffId !== undefined) {
      if (role !== "ADMIN" && parsed.staffId !== project.staff?.id) {
        return new NextResponse("Forbidden", { status: 403 });
      }
      updateData.staff =
        parsed.staffId === null
          ? { disconnect: true }
          : { connect: { id: parsed.staffId } };
      if (parsed.staffId === null && role !== "ADMIN") {
        return new NextResponse("Forbidden", { status: 403 });
      }
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
        updateData.completionSubmittedAt = new Date();
        updateData.completionSubmittedBy = { connect: { id: userId } };
      } else {
        updateData.completionSubmittedAt = null;
        updateData.completionSubmittedBy = { disconnect: true };
        updateData.completionNotifiedAt = null;
        updateData.completionNotifiedBy = { disconnect: true };
        updateData.completionNotificationEmail = null;
        updateData.completionNotificationCc = null;
      }
    }

    if (Object.keys(updateData).length === 0) {
      const unchangedProject = await prisma.project.findUnique({
        where: { id },
        include: {
          client: { select: { id: true, email: true, name: true } },
          staff: { select: { id: true, email: true, name: true } },
          createdBy: {
            select: { id: true, email: true, name: true, role: true },
          },
          completionSubmittedBy: {
            select: { id: true, email: true, name: true, role: true },
          },
          completionNotifiedBy: {
            select: { id: true, email: true, name: true, role: true },
          },
          assets: true,
          deliveries: true,
        },
      });
      return NextResponse.json(unchangedProject);
    }

    const updated = await prisma.project.update({
      where: { id },
      data: updateData,
      include: {
        client: { select: { id: true, email: true, name: true } },
        staff: { select: { id: true, email: true, name: true } },
        createdBy: {
          select: { id: true, email: true, name: true, role: true },
        },
        completionSubmittedBy: {
          select: { id: true, email: true, name: true, role: true },
        },
        completionNotifiedBy: {
          select: { id: true, email: true, name: true, role: true },
        },
        assets: true,
        deliveries: true,
      },
    });

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

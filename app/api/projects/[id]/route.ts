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
    });

    if (!project) return new NextResponse("Not Found", { status: 404 });

    // Check permissions
    if (role === "CLIENT") {
      return new NextResponse("Forbidden", { status: 403 });
    }
    if (role === "STAFF" && project.staffId !== userId) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const updated = await prisma.project.update({
      where: { id },
      data: {
        ...(parsed.title !== undefined && { title: parsed.title }),
        ...(parsed.description !== undefined && {
          description: parsed.description,
        }),
        ...(parsed.status !== undefined && { status: parsed.status }),
        ...(parsed.staffId !== undefined && { staffId: parsed.staffId }),
      },
      include: {
        client: { select: { id: true, email: true, name: true } },
        staff: { select: { id: true, email: true, name: true } },
        createdBy: {
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

import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const createFolderSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(["PROJECT", "ASSETS", "DELIVERABLES"]).default("PROJECT"),
  parentId: z.string().min(1).optional().nullable(),
});

// GET - List folders in a project
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  const role = session.user?.role;
  const userId = session.user?.id!;

  // Check project exists
  const project = await prisma.project.findUnique({
    where: { id },
  });

  if (!project) return new NextResponse("Not Found", { status: 404 });

  // Check permissions
  if (role === "CLIENT" && project.clientId !== userId) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  if (
    role === "STAFF" &&
    project.staffId !== userId &&
    project.createdById !== userId
  ) {
    // Staff can view folders if assigned OR if they created the project
    return new NextResponse("Forbidden", { status: 403 });
  }
  if (role !== "ADMIN" && role !== "STAFF" && role !== "CLIENT") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const folders = await prisma.folder.findMany({
    where: { projectId: id },
    include: {
      _count: {
        select: { assets: true, deliveries: true },
      },
    },
    orderBy: [
      { type: "asc" }, // ASSETS, DELIVERABLES, then PROJECT folders
      { createdAt: "desc" },
    ],
  });

  return NextResponse.json(folders);
}

// POST - Create folder
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  const role = session.user?.role;
  const userId = session.user?.id!;

  // Check project exists
  const project = await prisma.project.findUnique({
    where: { id },
  });

  if (!project) return new NextResponse("Not Found", { status: 404 });

  // Check permissions
  if (role === "CLIENT" && project.clientId !== userId) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  if (
    role === "STAFF" &&
    project.staffId !== userId &&
    project.createdById !== userId
  ) {
    // Staff can create folders if assigned OR if they created the project
    return new NextResponse("Forbidden", { status: 403 });
  }
  if (role !== "ADMIN" && role !== "STAFF" && role !== "CLIENT") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = createFolderSchema.parse(body);

    let targetType = parsed.type;
    let parentId: string | null = parsed.parentId ?? null;

    if (parentId) {
      const parentFolder = await prisma.folder.findFirst({
        where: { id: parentId, projectId: id },
        select: { id: true, type: true },
      });

      if (!parentFolder) {
        return NextResponse.json(
          { error: "Parent folder not found" },
          { status: 404 }
        );
      }

      targetType = parentFolder.type;
    } else if (targetType === "ASSETS" || targetType === "DELIVERABLES") {
      return NextResponse.json(
        {
          error:
            "ASSETS and DELIVERABLES folders are system folders and cannot be created manually",
        },
        { status: 400 }
      );
    }

    const folder = await prisma.folder.create({
      data: {
        name: parsed.name,
        type: targetType,
        projectId: id,
        ...(parentId
          ? {
              parent: {
                connect: { id: parentId },
              },
            }
          : {}),
      },
      include: {
        _count: {
          select: { assets: true, deliveries: true },
        },
      },
    });

    return NextResponse.json(folder, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json(
      { error: error.message || "Failed to create folder" },
      { status: 500 }
    );
  }
}

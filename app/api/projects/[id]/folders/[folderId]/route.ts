import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const updateFolderSchema = z.object({
  name: z.string().min(1).max(255).optional(),
});

// PATCH - Update folder
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; folderId: string }> }
) {
  const session = await auth();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const { id, folderId } = await params;
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
  if (role === "STAFF" && project.staffId !== userId) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  if (role !== "ADMIN" && role !== "STAFF" && role !== "CLIENT") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = updateFolderSchema.parse(body);

    // Check folder exists and belongs to project
    const folder = await prisma.folder.findFirst({
      where: {
        id: folderId,
        projectId: id,
      },
    });

    if (!folder) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    const updated = await prisma.folder.update({
      where: { id: folderId },
      data: {
        ...(parsed.name && { name: parsed.name }),
      },
      include: {
        _count: {
          select: { assets: true },
        },
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json(
      { error: error.message || "Failed to update folder" },
      { status: 500 }
    );
  }
}

// DELETE - Delete folder
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; folderId: string }> }
) {
  const session = await auth();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const { id, folderId } = await params;
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
  if (role === "STAFF" && project.staffId !== userId) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  if (role !== "ADMIN" && role !== "STAFF" && role !== "CLIENT") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  try {
    // Check folder exists and belongs to project
    const folder = await prisma.folder.findFirst({
      where: {
        id: folderId,
        projectId: id,
      },
      include: {
        _count: {
          select: { assets: true },
        },
      },
    });

    if (!folder) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    // Delete folder (assets will have folderId set to null due to onDelete: SetNull)
    await prisma.folder.delete({
      where: { id: folderId },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to delete folder" },
      { status: 500 }
    );
  }
}

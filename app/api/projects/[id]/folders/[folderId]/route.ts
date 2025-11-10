import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

async function getParentFolderId(folderId: string): Promise<string | null> {
  const record = await prisma.folder.findUnique({
    where: { id: folderId },
  });

  const parentId =
    (record as unknown as { parentId: string | null } | null)?.parentId ?? null;

  return parentId;
}

type ParentRelationUpdate =
  | { connect: { id: string } }
  | { disconnect: true };

const updateFolderSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  parentId: z.string().min(1).optional().nullable(),
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

    if (parsed.parentId === folderId) {
      return NextResponse.json(
        { error: "Folder cannot be its own parent" },
        { status: 400 }
      );
    }

    let parentRelation: ParentRelationUpdate | undefined = undefined;

    if (parsed.parentId !== undefined) {
      if (parsed.parentId === null) {
        parentRelation = { disconnect: true };
      } else {
        const parentFolder = await prisma.folder.findFirst({
          where: {
            id: parsed.parentId,
            projectId: id,
          },
          select: { id: true },
        });

        if (!parentFolder) {
          return NextResponse.json(
            { error: "Parent folder not found" },
            { status: 404 }
          );
        }

        // Prevent circular hierarchy by ensuring parent isn't a descendant
        if (parentFolder.id === folderId) {
          return NextResponse.json(
            { error: "Folder cannot be moved into itself" },
            { status: 400 }
          );
        }

        // Ensure we are not creating a cycle
        let currentParentId: string | null = parsed.parentId ?? null;
        while (currentParentId) {
          if (currentParentId === folderId) {
            return NextResponse.json(
              { error: "Cannot move folder into its descendant" },
              { status: 400 }
            );
          }
          currentParentId = await getParentFolderId(currentParentId);
        }

        parentRelation = { connect: { id: parentFolder.id } };
      }
    }

    const data: {
      name?: string;
      parent?: ParentRelationUpdate;
    } = {};

    if (parsed.name) {
      data.name = parsed.name;
    }

    if (parentRelation !== undefined) {
      data.parent = parentRelation;
    }

    const updated = await prisma.folder.update({
      where: { id: folderId },
      data,
      include: {
        _count: {
          select: { assets: true, deliveries: true },
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

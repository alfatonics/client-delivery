import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { R2_BUCKET, getR2Client } from "@/app/lib/r2";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { z } from "zod";

const updateAssetSchema = z.object({
  folderId: z.string().optional().nullable(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await ctx.params;
  const role = session.user?.role;
  const userId = session.user?.id!;

  try {
    const body = await req.json();
    const parsed = updateAssetSchema.parse(body);

    const asset = await prisma.asset.findUnique({
      where: { id },
      include: {
        project: {
          select: {
            id: true,
            clientId: true,
            createdById: true,
            staffAssignments: {
              select: { staffId: true },
            },
          },
        },
      },
    });

    if (!asset) return new NextResponse("Not Found", { status: 404 });

    const project = asset.project;

    const isAdmin = role === "ADMIN";
    const staffIds = new Set(
      project.staffAssignments.map((assignment) => assignment.staffId)
    );
    const isStaff =
      role === "STAFF" &&
      (staffIds.has(userId) || project.createdById === userId);
    const isUploader = asset.uploadedById === userId;

    if (!isAdmin && !isStaff && !isUploader) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    let folderId: string | null = null;

    if (parsed.folderId) {
      const folder = await prisma.folder.findFirst({
        where: {
          id: parsed.folderId,
          projectId: project.id,
          type: "ASSETS",
        },
      });

      if (!folder) {
        return NextResponse.json(
          { error: "Target folder not found or invalid" },
          { status: 404 }
        );
      }

      folderId = folder.id;
    }

    const updated = await prisma.asset.update({
      where: { id },
      data: {
        folderId,
      },
      include: {
        folder: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error("Error updating asset:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update asset" },
      { status: 500 }
    );
  }
}

// DELETE - Delete asset (only uploader or admin)
export async function DELETE(
  _: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await ctx.params;
  const role = session.user?.role;
  const userId = session.user?.id!;

  try {
    const asset = await prisma.asset.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!asset) return new NextResponse("Not Found", { status: 404 });

    // Only uploader or admin can delete
    if (role !== "ADMIN" && asset.uploadedById !== userId) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    // Delete from R2
    const client = getR2Client();
    await client.send(
      new DeleteObjectCommand({
        Bucket: R2_BUCKET,
        Key: asset.key,
      })
    );

    // Delete from database
    await prisma.asset.delete({
      where: { id },
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Error deleting asset:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete asset" },
      { status: 500 }
    );
  }
}

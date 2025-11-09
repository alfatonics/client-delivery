import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { R2_BUCKET, getR2Client } from "@/app/lib/r2";
import { NextResponse } from "next/server";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { z } from "zod";

const updateDeliverySchema = z.object({
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
    const parsed = updateDeliverySchema.parse(body);

    const delivery = await prisma.delivery.findUnique({
      where: { id },
      include: {
        project: {
          select: {
            id: true,
            staffId: true,
            clientId: true,
            createdById: true,
          },
        },
      },
    });

    if (!delivery) return new NextResponse("Not Found", { status: 404 });

    const project = delivery.project;
    const isAdmin = role === "ADMIN";
    const isStaff =
      role === "STAFF" &&
      (project.staffId === userId || project.createdById === userId);
    const isUploader = delivery.uploadedById === userId;

    if (!isAdmin && !isStaff && !isUploader) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    let folderId: string | null = null;

    if (parsed.folderId) {
      const folder = await prisma.folder.findFirst({
        where: {
          id: parsed.folderId,
          projectId: project.id,
          type: {
            in: ["PROJECT", "DELIVERABLES"],
          },
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

    const updated = await prisma.delivery.update({
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
    console.error("Error updating delivery:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update delivery" },
      { status: 500 }
    );
  }
}

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
    const delivery = await prisma.delivery.findUnique({
      where: { id },
      include: {
        project: {
          select: {
            id: true,
            staffId: true,
            createdById: true,
          },
        },
      },
    });

    if (!delivery) return new NextResponse("Not Found", { status: 404 });

    const project = delivery.project;
    const isAdmin = role === "ADMIN";
    const isStaff =
      role === "STAFF" &&
      (project.staffId === userId ||
        (project.createdById !== null && project.createdById === userId));
    const isUploader = delivery.uploadedById === userId;

    if (!isAdmin && !isStaff && !isUploader) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const client = getR2Client();
    await client.send(
      new DeleteObjectCommand({
        Bucket: R2_BUCKET,
        Key: delivery.key,
      })
    );

    await prisma.delivery.delete({
      where: { id },
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Error deleting delivery:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete delivery" },
      { status: 500 }
    );
  }
}

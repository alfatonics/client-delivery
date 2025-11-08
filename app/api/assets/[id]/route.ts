import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { R2_BUCKET, getR2Client } from "@/app/lib/r2";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";

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


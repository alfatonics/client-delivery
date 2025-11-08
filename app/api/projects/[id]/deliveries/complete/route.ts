import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { R2_BUCKET, getR2Client } from "@/app/lib/r2";
import { NextResponse } from "next/server";
import { CompleteMultipartUploadCommand } from "@aws-sdk/client-s3";

type Part = { ETag: string; PartNumber: number };

// POST - Complete delivery upload
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await ctx.params;
  const role = session.user?.role;
  const userId = session.user?.id!;

  // Check project exists and is assigned to staff
  const project = await prisma.project.findUnique({
    where: { id },
  });

  if (!project) return new NextResponse("Not Found", { status: 404 });

  // Only staff assigned to project can upload deliveries
  if (role !== "STAFF" || project.staffId !== userId) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  try {
    const body = await req.json();
    const { key, uploadId, parts, filename, contentType, sizeBytes, folderId } =
      body as {
        key: string;
        uploadId: string;
        parts: Part[];
        filename?: string;
        contentType?: string;
        sizeBytes?: number;
        folderId?: string;
      };

    if (!key || !uploadId || !parts?.length) {
      return new NextResponse("Bad Request", { status: 400 });
    }

    // If folderId is provided, verify it belongs to this project and is a PROJECT or DELIVERABLES folder
    if (folderId) {
      const folder = await prisma.folder.findFirst({
        where: {
          id: folderId,
          projectId: id,
          type: { in: ["PROJECT", "DELIVERABLES"] },
        },
      });
      if (!folder) {
        return NextResponse.json(
          { error: "Folder not found or not a valid folder for deliveries" },
          { status: 404 }
        );
      }
    }

    const client = getR2Client();

    const result = await client.send(
      new CompleteMultipartUploadCommand({
        Bucket: R2_BUCKET,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: parts.sort((a, b) => a.PartNumber - b.PartNumber),
        },
      })
    );

    // Save delivery record and update project status
    await prisma.$transaction([
      prisma.delivery.create({
        data: {
          key,
          filename:
            filename || decodeURIComponent(key.split("-").slice(1).join("-")),
          contentType: contentType || "video/mp4",
          sizeBytes: sizeBytes || 0,
          projectId: id,
          folderId: folderId || null,
          uploadedById: userId,
        },
      }),
      prisma.project.update({
        where: { id },
        data: { status: "COMPLETED" },
      }),
    ]);

    return NextResponse.json({ ok: true, location: result.Location });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to complete upload" },
      { status: 500 }
    );
  }
}

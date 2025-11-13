import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { R2_BUCKET, getR2Client } from "@/app/lib/r2";
import { detectAssetType } from "@/app/lib/asset-utils";
import { NextResponse } from "next/server";
import { CompleteMultipartUploadCommand } from "@aws-sdk/client-s3";
import { z } from "zod";

type Part = { ETag: string; PartNumber: number };

const completeAssetSchema = z.object({
  key: z.string(),
  uploadId: z.string(),
  parts: z.array(
    z.object({
      ETag: z.string(),
      PartNumber: z.number(),
    })
  ),
  filename: z.string(),
  contentType: z.string(),
  sizeBytes: z.number(),
  folderId: z.string().optional(),
});

// POST - Complete asset upload
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await ctx.params;
  const role = session.user?.role;
  const userId = session.user?.id!;

  // Check project exists
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      staffAssignments: { select: { staffId: true } },
    },
  });

  if (!project) return new NextResponse("Not Found", { status: 404 });

  // Check permissions:
  // - CLIENT can upload to their own projects
  // - ADMIN can upload to any project
  // - STAFF can upload to assigned projects
  if (role === "CLIENT" && project.clientId !== userId) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  const staffIds = new Set(
    project.staffAssignments.map((assignment) => assignment.staffId)
  );
  if (role === "STAFF" && !staffIds.has(userId)) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  if (role !== "ADMIN" && role !== "STAFF" && role !== "CLIENT") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = completeAssetSchema.parse(body);

    // Auto-detect asset type
    const assetType = detectAssetType(parsed.contentType, parsed.filename);

    // If folderId is provided, verify it belongs to this project
    if (parsed.folderId) {
      const folder = await prisma.folder.findFirst({
        where: {
          id: parsed.folderId,
          projectId: id,
        },
      });
      if (!folder) {
        return NextResponse.json(
          { error: "Folder not found in this project" },
          { status: 404 }
        );
      }
    }

    const client = getR2Client();

    const result = await client.send(
      new CompleteMultipartUploadCommand({
        Bucket: R2_BUCKET,
        Key: parsed.key,
        UploadId: parsed.uploadId,
        MultipartUpload: {
          Parts: parsed.parts.sort((a, b) => a.PartNumber - b.PartNumber),
        },
      })
    );

    // Save asset record
    await prisma.asset.create({
      data: {
        key: parsed.key,
        filename: parsed.filename,
        contentType: parsed.contentType,
        sizeBytes: parsed.sizeBytes,
        type: assetType,
        projectId: id,
        folderId: parsed.folderId || null,
        uploadedById: userId,
      },
    });

    return NextResponse.json({ ok: true, location: result.Location });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json(
      { error: error.message || "Failed to complete upload" },
      { status: 500 }
    );
  }
}

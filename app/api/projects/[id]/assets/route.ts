import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { R2_BUCKET, getR2Client } from "@/app/lib/r2";
import { detectAssetType } from "@/app/lib/asset-utils";
import { NextResponse } from "next/server";
import {
  CreateMultipartUploadCommand,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { z } from "zod";

const DEFAULT_PART_SIZE = 10 * 1024 * 1024; // 10MB

const initAssetUploadSchema = z.object({
  filename: z.string(),
  contentType: z.string(),
  sizeBytes: z.number(),
  folderId: z.string().optional(), // Optional folder ID
});

// POST - Initialize asset upload (client only, for their own projects)
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
    const parsed = initAssetUploadSchema.parse(body);

    // Auto-detect asset type from MIME type and filename
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
    const folderPrefix = parsed.folderId ? `folders/${parsed.folderId}/` : "";
    const key = `assets/${id}/${folderPrefix}${Date.now()}-${encodeURIComponent(
      parsed.filename
    )}`;

    const create = await client.send(
      new CreateMultipartUploadCommand({
        Bucket: R2_BUCKET,
        Key: key,
        ContentType: parsed.contentType,
      })
    );
    const uploadId = create.UploadId!;

    const partSize = DEFAULT_PART_SIZE;
    const partCount = Math.ceil(parsed.sizeBytes / partSize);
    const urls: string[] = [];
    for (let partNumber = 1; partNumber <= partCount; partNumber++) {
      const url = await getSignedUrl(
        client,
        new UploadPartCommand({
          Bucket: R2_BUCKET,
          Key: key,
          UploadId: uploadId,
          PartNumber: partNumber,
        }),
        { expiresIn: 60 * 60 }
      );
      urls.push(url);
    }

    const base = new URL(req.url);
    const completeUrl = `${base.origin}/api/projects/${id}/assets/complete`;

    return NextResponse.json({
      uploadId,
      key,
      partSize,
      presignedPartUrls: urls,
      completeUrl,
      type: assetType,
      folderId: parsed.folderId,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json(
      { error: error.message || "Failed to initialize upload" },
      { status: 500 }
    );
  }
}

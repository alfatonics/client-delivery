import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { R2_BUCKET, getR2Client } from "@/app/lib/r2";
import { NextResponse } from "next/server";
import { CompleteMultipartUploadCommand } from "@aws-sdk/client-s3";

type Part = { ETag: string; PartNumber: number };

export async function POST(req: Request) {
  const session = await auth();
  if (!session || session.user?.role !== "ADMIN")
    return new NextResponse("Unauthorized", { status: 401 });

  const body = await req.json();
  const { key, uploadId, parts, ownerId, filename, contentType, sizeBytes } =
    body as {
      key: string;
      uploadId: string;
      parts: Part[];
      ownerId: string;
      filename?: string;
      contentType?: string;
      sizeBytes?: number;
    };

  if (!key || !uploadId || !parts?.length || !ownerId)
    return new NextResponse("Bad Request", { status: 400 });

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

  // Persist video record
  await prisma.video.create({
    data: {
      key,
      filename:
        filename || decodeURIComponent(key.split("-").slice(1).join("-")),
      contentType: contentType || "video/mp4",
      sizeBytes: sizeBytes || 0,
      ownerId,
    },
  });

  return NextResponse.json({ ok: true, location: result.Location });
}

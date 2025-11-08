import { auth } from "@/app/lib/auth";
import { R2_BUCKET, getR2Client } from "@/app/lib/r2";
import { NextResponse } from "next/server";
import {
  CreateMultipartUploadCommand,
  UploadPartCommand,
  ListPartsCommand,
  CompleteMultipartUploadCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const DEFAULT_PART_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(req: Request) {
  const session = await auth();
  if (!session || session.user?.role !== "ADMIN")
    return new NextResponse("Unauthorized", { status: 401 });

  const body = await req.json();
  const { filename, contentType, sizeBytes } = body as {
    filename: string;
    contentType: string;
    sizeBytes: number;
  };
  if (!filename || !contentType || !sizeBytes)
    return new NextResponse("Bad Request", { status: 400 });

  const client = getR2Client();
  const key = `videos/${Date.now()}-${encodeURIComponent(filename)}`;

  const create = await client.send(
    new CreateMultipartUploadCommand({
      Bucket: R2_BUCKET,
      Key: key,
      ContentType: contentType,
    })
  );
  const uploadId = create.UploadId!;

  const partSize = DEFAULT_PART_SIZE;
  const partCount = Math.ceil(sizeBytes / partSize);
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
  const completeUrl = `${base.origin}/api/r2/multipart/complete`;
  const abortUrl = `${base.origin}/api/r2/multipart/abort`;

  return NextResponse.json({
    uploadId,
    key,
    partSize,
    presignedPartUrls: urls,
    completeUrl,
    abortUrl,
  });
}

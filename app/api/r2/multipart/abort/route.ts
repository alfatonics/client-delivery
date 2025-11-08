import { auth } from "@/app/lib/auth";
import { R2_BUCKET, getR2Client } from "@/app/lib/r2";
import { NextResponse } from "next/server";
import { AbortMultipartUploadCommand } from "@aws-sdk/client-s3";

export async function POST(req: Request) {
  const session = await auth();
  if (!session || session.user?.role !== "ADMIN")
    return new NextResponse("Unauthorized", { status: 401 });
  const body = await req.json();
  const { key, uploadId } = body as { key: string; uploadId: string };
  if (!key || !uploadId)
    return new NextResponse("Bad Request", { status: 400 });
  const client = getR2Client();
  await client.send(
    new AbortMultipartUploadCommand({
      Bucket: R2_BUCKET,
      Key: key,
      UploadId: uploadId,
    })
  );
  return NextResponse.json({ ok: true });
}

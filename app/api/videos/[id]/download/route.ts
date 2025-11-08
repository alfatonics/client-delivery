import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { R2_BUCKET, getR2Client } from "@/app/lib/r2";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";

export async function GET(
  _: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await ctx.params;
  const video = await prisma.video.findUnique({ where: { id } });
  if (!video || video.ownerId !== session.user?.id)
    return new NextResponse("Forbidden", { status: 403 });

  const client = getR2Client();
  const url = await getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: R2_BUCKET,
      Key: video.key,
      ResponseContentDisposition: `attachment; filename="${encodeURIComponent(
        video.filename
      )}"`,
    }),
    { expiresIn: 60 * 30 }
  );

  return NextResponse.redirect(url, { status: 302 });
}

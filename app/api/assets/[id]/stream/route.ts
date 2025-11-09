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
  const role = session.user?.role;
  const userId = session.user?.id!;

  const asset = await prisma.asset.findUnique({
    where: { id },
    include: {
      project: true,
      uploadedBy: { select: { id: true, email: true } },
    },
  });

  if (!asset) return new NextResponse("Not Found", { status: 404 });

  // Check permissions
  if (role === "CLIENT" && asset.project.clientId !== userId) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  if (role === "STAFF" && asset.project.staffId !== userId) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const client = getR2Client();
  const url = await getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: R2_BUCKET, Key: asset.key }),
    { expiresIn: 60 * 30 }
  );

  return NextResponse.redirect(url, { status: 302 });
}



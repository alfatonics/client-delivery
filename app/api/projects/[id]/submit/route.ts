import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(
  _: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { id } = await ctx.params;
  const { id: userId, role } = session.user;

  if (role !== "STAFF") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const project = ((await prisma.project.findUnique({
    where: { id },
    select: {
      staffId: true,
      status: true,
      completionNotifiedAt: true,
      completionSubmittedAt: true,
      _count: { select: { deliveries: true } },
    } as any,
  })) as unknown) as
    | {
        staffId: string | null;
        status: string;
        completionNotifiedAt: Date | null;
        completionSubmittedAt: Date | null;
        _count: { deliveries: number };
      }
    | null;

  if (!project) {
    return new NextResponse("Not Found", { status: 404 });
  }

  if (project.staffId !== userId) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  if (project._count.deliveries === 0) {
    return NextResponse.json(
      {
        error:
          "Upload at least one delivery before submitting the project to the admin.",
      },
      { status: 400 }
    );
  }

  const updated = ((await prisma.project.update({
    where: { id },
    data: {
      status: "COMPLETED",
      completionSubmittedAt: new Date(),
      completionSubmittedById: userId,
    },
    select: {
      id: true,
      status: true,
      completionSubmittedAt: true,
      completionNotifiedAt: true,
    } as any,
  })) as unknown) as {
    id: string;
    status: string;
    completionSubmittedAt: Date | null;
    completionNotifiedAt: Date | null;
  };

  return NextResponse.json({
    ok: true,
    project: updated,
  });
}

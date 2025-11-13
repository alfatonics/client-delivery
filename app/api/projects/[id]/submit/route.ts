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

  const project = await prisma.project.findUnique({
    where: { id },
    select: {
      status: true,
      completionNotifiedAt: true,
      completionSubmittedAt: true,
      _count: { select: { deliveries: true } },
      staffAssignments: {
        select: { staffId: true },
      },
    },
  });

  if (!project) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const staffIds = new Set(
    project.staffAssignments.map((assignment) => assignment.staffId)
  );
  if (!staffIds.has(userId)) {
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

  const updated = await prisma.project.update({
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
    },
  });

  return NextResponse.json({
    ok: true,
    project: updated,
  });
}

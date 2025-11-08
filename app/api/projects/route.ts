import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

export async function GET() {
  const session = await auth();
  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { role, id: userId } = session.user;

  try {
    let whereClause: Prisma.ProjectWhereInput;

    if (role === "ADMIN") {
      whereClause = {};
    } else if (role === "STAFF") {
      whereClause = {
        OR: [{ staffId: userId }, { createdById: userId }],
      };
    } else if (role === "CLIENT") {
      whereClause = { clientId: userId };
    } else {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const projects = await prisma.project.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        client: { select: { id: true, email: true, name: true } },
        staff: { select: { id: true, email: true, name: true } },
        assets: {
          select: { id: true, filename: true, type: true },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        deliveries: {
          select: { id: true, filename: true },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    });

    return NextResponse.json(projects);
  } catch (error: any) {
    console.error("Error fetching projects:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch projects" },
      { status: 500 }
    );
  }
}

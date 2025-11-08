import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { z } from "zod";

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

const createProjectSchema = z.object({
  title: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((value) => value || undefined),
  description: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((value) => value || undefined),
  clientId: z.string().min(1, "Client is required"),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { user } = session;
  if (!user || user.role !== "ADMIN") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        details: parsed.error.issues,
      },
      { status: 400 }
    );
  }

  const { title, description, clientId } = parsed.data;

  try {
    const project = await prisma.project.create({
      data: {
        title,
        description,
        clientId,
        createdById: user.id,
        status: "PENDING",
      } as any,
      select: {
        id: true,
      },
    });

    await prisma.folder.createMany({
      data: [
        {
          name: "Shared Assets",
          type: "ASSETS",
          projectId: project.id,
        },
        {
          name: "Deliverables",
          type: "DELIVERABLES",
          projectId: project.id,
        },
      ],
      skipDuplicates: true,
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error: any) {
    console.error("Error creating project:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create project" },
      { status: 500 }
    );
  }
}

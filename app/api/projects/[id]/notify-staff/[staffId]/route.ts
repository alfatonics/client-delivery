import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { sendProjectAssignmentEmail } from "@/app/lib/email";
import { NextResponse } from "next/server";
import { z } from "zod";

const payloadSchema = z
  .object({
    notes: z
      .string()
      .trim()
      .max(2000, "Notes must be 2000 characters or fewer")
      .optional(),
  })
  .optional()
  .transform((value) => value || {});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string; staffId: string }> }
) {
  const session = await auth();
  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { id, staffId } = await ctx.params;

  let parsedBody: { notes?: string };
  try {
    const json = await req.json().catch(() => ({}));
    parsedBody = payloadSchema.parse(json);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    throw error;
  }

  const project = await prisma.project.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      staffAssignments: {
        where: { staffId },
        select: {
          staff: { select: { id: true, email: true, name: true } },
        },
        orderBy: { assignedAt: "asc" },
      },
      client: { select: { id: true, email: true, name: true } },
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });

  if (!project) {
    return new NextResponse("Not Found", { status: 404 });
  }

  if (project.staffAssignments.length === 0) {
    return NextResponse.json(
      {
        error: "Staff member is not assigned to this project.",
      },
      { status: 400 }
    );
  }

  const staff = project.staffAssignments[0]?.staff;
  if (!staff || !staff.email || staff.email.trim().length === 0) {
    return NextResponse.json(
      {
        error: "Staff member email not found.",
      },
      { status: 400 }
    );
  }

  try {
    await sendProjectAssignmentEmail({
      to: staff.email.trim(),
      staffName: staff.name,
      projectTitle: project.title,
      projectId: project.id,
      clientName: project.client?.name,
      clientEmail: project.client?.email,
      createdByName: project.createdBy?.name,
      notes: parsedBody.notes,
    });
  } catch (error: any) {
    console.error("Failed to send project assignment email:", error);
    return NextResponse.json(
      {
        error:
          "Failed to send the email. Please verify SMTP credentials and try again.",
      },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}


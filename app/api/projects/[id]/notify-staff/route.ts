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
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { id } = await ctx.params;

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
      staff: { select: { id: true, email: true, name: true } },
      client: { select: { id: true, email: true, name: true } },
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });

  if (!project) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const staffEmail = project.staff?.email?.trim();
  if (!staffEmail) {
    return NextResponse.json(
      {
        error:
          "Assign a team member to the project before sending the assignment email.",
      },
      { status: 400 }
    );
  }

  try {
    await sendProjectAssignmentEmail({
      to: staffEmail,
      staffName: project.staff?.name,
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


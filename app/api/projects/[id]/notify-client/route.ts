import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { sendProjectCompletionEmail } from "@/app/lib/email";
import { NextResponse } from "next/server";
import { z } from "zod";
import { hash } from "bcryptjs";

const notifySchema = z.object({
  email: z
    .string()
    .transform((value) => value.trim())
    .pipe(z.string().email())
    .optional(),
  cc: z.string().optional(),
  loginEmail: z
    .union([z.string().trim().email(), z.literal(""), z.undefined()])
    .optional()
    .transform((value) => (value ? value : undefined)),
  loginPassword: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(64, "Password must be 64 characters or fewer")
    .optional(),
});

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

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, email: true, name: true } },
    },
  });

  if (!project) {
    return new NextResponse("Not Found", { status: 404 });
  }

  if (project.status !== "COMPLETED") {
    return NextResponse.json(
      {
        error:
          "Project must be marked as completed before notifying the client.",
      },
      { status: 400 }
    );
  }

  const body = await req.json();

  let parsed;
  try {
    parsed = notifySchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    throw error;
  }

  const fallbackEmail = project.client?.email?.trim();
  const primaryEmail = parsed.email ?? fallbackEmail;

  if (!primaryEmail) {
    return NextResponse.json(
      {
        error:
          "Client email is missing. Provide an email address before sending notifications.",
      },
      { status: 400 }
    );
  }

  const ccList = parsed.cc
    ?.split(",")
    .map((email) => email.trim())
    .filter((email) => email.length > 0);

  if (ccList && ccList.length > 0) {
    for (const cc of ccList) {
      const result = z.string().email().safeParse(cc);
      if (!result.success) {
        return NextResponse.json(
          { error: `Invalid CC email: ${cc}` },
          { status: 400 }
        );
      }
    }
  }

  const loginEmail = parsed.loginEmail || project.client?.email || undefined;

  if (parsed.loginPassword && !loginEmail) {
    return NextResponse.json(
      {
        error:
          "Provide a login email when sending new credentials to the client.",
      },
      { status: 400 }
    );
  }

  let passwordForEmail: string | undefined;

  const trimmedLoginPassword = parsed.loginPassword?.trim();

  if (trimmedLoginPassword) {
    if (!project.client?.id) {
      return NextResponse.json(
        {
          error:
            "Unable to reset password because the client record is missing.",
        },
        { status: 400 }
      );
    }
    await prisma.user.update({
      where: { id: project.client.id },
      data: { passwordHash: await hash(trimmedLoginPassword, 10) },
    });
    passwordForEmail = trimmedLoginPassword;
  }

  try {
    await sendProjectCompletionEmail({
      to: primaryEmail,
      cc: ccList,
      name: project.client?.name,
      projectTitle: project.title,
      projectId: project.id,
      loginEmail,
      loginPassword: passwordForEmail,
    });
  } catch (error: any) {
    console.error("Failed to send project completion email:", error);
    return NextResponse.json(
      {
        error:
          "Failed to send the email. Please verify SMTP credentials and try again.",
      },
      { status: 502 }
    );
  }

  const updated = await prisma.project.update({
    where: { id },
    data: {
      completionNotifiedAt: new Date(),
      completionNotifiedById: session.user.id,
      completionNotificationEmail: primaryEmail,
      completionNotificationCc: ccList?.join(", ") || null,
    },
    include: {
      client: { select: { id: true, email: true, name: true } },
      staff: { select: { id: true, email: true, name: true } },
      createdBy: { select: { id: true, email: true, name: true, role: true } },
      completionSubmittedBy: {
        select: { id: true, email: true, name: true, role: true },
      },
      completionNotifiedBy: {
        select: { id: true, email: true, name: true, role: true },
      },
      assets: true,
      deliveries: true,
    },
  });

  return NextResponse.json(updated);
}

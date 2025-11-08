import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { sendUserCredentialsEmail } from "@/app/lib/email";
import { generateFriendlyPassword } from "@/app/lib/password";
import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { z } from "zod";

const resendSchema = z.object({
  password: z
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
  if (!session || session.user.role !== "ADMIN") {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { id } = await ctx.params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
    },
  });

  if (!user) {
    return new NextResponse("Not Found", { status: 404 });
  }

  let payload: { password?: string } = {};
  const rawContentLength = req.headers.get("content-length");
  const contentLength =
    rawContentLength !== null ? parseInt(rawContentLength, 10) : 0;
  if (contentLength > 0) {
    try {
      const body = await req.json();
      payload = resendSchema.parse(body);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: error.issues }, { status: 400 });
      }
      console.error("Failed to parse request body:", error);
      return NextResponse.json(
        { error: "Invalid request payload." },
        { status: 400 }
      );
    }
  }

  const password =
    payload.password || generateFriendlyPassword(user.email, user.name ?? null);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hash(password, 10),
    },
  });

  try {
    await sendUserCredentialsEmail({
      to: user.email,
      name: user.name,
      role: user.role,
      email: user.email,
      password,
    });
  } catch (error) {
    console.error("Failed to send credentials email:", error);
    return NextResponse.json(
      {
        error:
          "Credentials were reset but the email failed to send. Please try again.",
      },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}

import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";
import { compare, hash } from "bcryptjs";
import { z } from "zod";

const updateSchema = z.object({
  currentPassword: z
    .string()
    .min(6, "Current password must be at least 6 characters"),
  newPassword: z
    .string()
    .min(6, "New password must be at least 6 characters")
    .max(64, "New password must be 64 characters or fewer"),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session || !session.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  let parsed;
  try {
    const body = await req.json();
    parsed = updateSchema.parse(body);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Invalid request payload." },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true },
  });

  if (!user || !user.passwordHash) {
    return NextResponse.json(
      { error: "Account record not found." },
      { status: 404 }
    );
  }

  const passwordMatches = await compare(
    parsed.currentPassword,
    user.passwordHash
  );

  if (!passwordMatches) {
    return NextResponse.json(
      { error: "Current password is incorrect." },
      { status: 400 }
    );
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      passwordHash: await hash(parsed.newPassword, 10),
    },
  });

  return NextResponse.json({ ok: true });
}

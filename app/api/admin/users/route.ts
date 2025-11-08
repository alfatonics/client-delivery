import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { z } from "zod";

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  password: z.string().min(6),
  role: z.enum(["ADMIN", "STAFF", "CLIENT"]),
});

// GET - List all users (admin only)
export async function GET() {
  const session = await auth();
  if (!session || session.user?.role !== "ADMIN")
    return new NextResponse("Unauthorized", { status: 401 });

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      createdBy: {
        select: { id: true, email: true, name: true },
      },
    },
  });
  return NextResponse.json(users);
}

// POST - Create new user (admin only)
export async function POST(req: Request) {
  const session = await auth();
  if (!session || session.user?.role !== "ADMIN")
    return new NextResponse("Unauthorized", { status: 401 });

  try {
    const body = await req.json();
    const parsed = createUserSchema.parse(body);

    // Check if user already exists
    const existing = await prisma.user.findUnique({
      where: { email: parsed.email },
    });
    if (existing) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 400 }
      );
    }

    const passwordHash = await hash(parsed.password, 10);

    const user = await prisma.user.create({
      data: {
        email: parsed.email,
        name: parsed.name,
        passwordHash,
        role: parsed.role,
        createdById: session.user.id,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json(
      { error: error.message || "Failed to create user" },
      { status: 500 }
    );
  }
}


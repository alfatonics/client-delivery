import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";

// GET - List all staff (admin only)
export async function GET() {
  const session = await auth();
  const sessionUser = session?.user;
  if (!sessionUser || sessionUser.role !== "ADMIN")
    return new NextResponse("Unauthorized", { status: 401 });

  const staff = await prisma.user.findMany({
    where: { role: "STAFF" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
    },
  });
  return NextResponse.json(staff);
}

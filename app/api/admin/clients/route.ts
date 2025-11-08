import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  // Allow ADMIN and STAFF to fetch clients
  const role = session.user?.role;
  if (role !== "ADMIN" && role !== "STAFF") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const clients = await prisma.user.findMany({
    where: { role: "CLIENT" },
    select: { id: true, email: true, name: true },
    orderBy: { email: "asc" },
  });
  return NextResponse.json(clients);
}

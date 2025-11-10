import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const rawDatabaseUrl = process.env.DATABASE_URL;
if (rawDatabaseUrl?.includes("channel_binding=require")) {
  process.env.DATABASE_URL = rawDatabaseUrl.replace(
    "channel_binding=require",
    "channel_binding=disable"
  );
}

const prisma = new PrismaClient();

async function main() {
  const projectId = process.argv[2];
  if (!projectId) {
    console.log("No project id provided. Showing the 10 most recent projects.");
    const projects = await prisma.project.findMany({
      select: {
        id: true,
        title: true,
        folders: {
          select: { id: true },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    projects.forEach((project) => {
      console.log(
        `- ${project.id} ${project.title ?? ""} (folders: ${
          project.folders.length
        })`
      );
    });
    return;
  }

const folders = await prisma.folder.findMany({
  where: { projectId },
  include: {
    parent: {
      select: { id: true },
    },
  },
});
folders.sort((a, b) => {
  const aParent = a.parent?.id ?? null;
  const bParent = b.parent?.id ?? null;
  if (aParent === bParent) {
    return a.createdAt.getTime() - b.createdAt.getTime();
  }
  if (aParent === null) return -1;
  if (bParent === null) return 1;
  return aParent.localeCompare(bParent);
});

  if (folders.length === 0) {
    console.log(`No folders found for project ${projectId}`);
    return;
  }

  console.log(`Folders for project ${projectId}:`);
  folders.forEach((folder) => {
    const parentId = folder.parent?.id ?? null;
    console.log(
      `- ${folder.name} (${folder.id}) type=${folder.type} parent=${parentId}`
    );
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";

export default async function WatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session) return null;
  const { id } = await params;
  const video = await prisma.video.findUnique({ where: { id } });
  if (!video || video.ownerId !== session.user?.id) return notFound();

  const src = `/api/videos/${id}/stream`;

  return (
    <div className="drive-container">
      <div className="bg-white border-b border-[#dadce0] px-6 py-4">
        <div className="flex items-center justify-between max-w-[1800px] mx-auto">
          <div className="flex items-center gap-4">
            <Link href="/client" className="btn-icon" title="Back">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-2xl font-normal text-[#202124] truncate">
              {video.filename}
            </h1>
          </div>
        </div>
      </div>
      <div className="p-6 max-w-6xl mx-auto">
        <div className="card">
          <video
            controls
            className="w-full rounded-lg"
            src={src}
            style={{ maxHeight: "80vh" }}
          />
        </div>
      </div>
    </div>
  );
}

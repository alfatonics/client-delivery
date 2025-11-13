import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { R2_BUCKET, getR2Client } from "@/app/lib/r2";
import { NextResponse } from "next/server";
import {
  CreateMultipartUploadCommand,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const DEFAULT_PART_SIZE = 10 * 1024 * 1024; // 10MB

// POST - Initialize delivery upload (staff only, for assigned projects)
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await ctx.params;
  const role = session.user?.role;
  const userId = session.user?.id!;

  try {
    // Check project exists - don't include createdBy to avoid errors with old projects
    let project;
    try {
      project = await prisma.project.findUnique({
        where: { id },
        select: {
          id: true,
          createdById: true,
          clientId: true,
          staffAssignments: {
            select: { staffId: true },
          },
        },
      });
    } catch (dbError: any) {
      console.error("Database error fetching project:", dbError);
      return NextResponse.json(
        { error: `Database error: ${dbError.message}` },
        { status: 500 }
      );
    }

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Only STAFF (assigned/creator) or ADMIN can upload deliveries
    if (role !== "STAFF" && role !== "ADMIN") {
      return NextResponse.json(
        { error: "Only staff or admins can upload deliveries" },
        { status: 403 }
      );
    }

    // Staff can upload if they are assigned to the project OR if they created the project
    if (role === "STAFF") {
      const staffIds = new Set(
        project.staffAssignments.map((assignment) => assignment.staffId)
      );
      const canUpload =
        staffIds.has(userId) ||
        (project.createdById !== null && project.createdById === userId);

      if (!canUpload) {
        return NextResponse.json(
          {
            error:
              "You can only upload deliveries to projects you are assigned to or created",
          },
          { status: 403 }
        );
      }
    }

    let body;
    try {
      body = await req.json();
    } catch (jsonError: any) {
      console.error("Error parsing request body:", jsonError);
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    const { filename, contentType, sizeBytes, folderId } = body as {
      filename: string;
      contentType?: string;
      sizeBytes: number;
      folderId?: string;
    };

    if (!filename || !sizeBytes) {
      return NextResponse.json(
        { error: "filename and sizeBytes are required" },
        { status: 400 }
      );
    }

    // Use default contentType if not provided
    const finalContentType = contentType || "application/octet-stream";

    // If folderId is provided, verify it belongs to this project and is a PROJECT or DELIVERABLES folder
    if (folderId) {
      let folder;
      try {
        folder = await prisma.folder.findFirst({
          where: {
            id: folderId,
            projectId: id,
            type: { in: ["PROJECT", "DELIVERABLES"] },
          },
        });
      } catch (folderError: any) {
        console.error("Database error fetching folder:", folderError);
        return NextResponse.json(
          { error: `Database error: ${folderError.message}` },
          { status: 500 }
        );
      }
      if (!folder) {
        return NextResponse.json(
          {
            error: "Folder not found or not a valid folder for deliveries",
            details: `Folder ${folderId} not found in project ${id} or is not a PROJECT/DELIVERABLES folder`,
          },
          { status: 404 }
        );
      }
    }

    if (!R2_BUCKET) {
      console.error("R2_BUCKET environment variable is not set");
      return NextResponse.json(
        { error: "R2 bucket not configured" },
        { status: 500 }
      );
    }

    let client;
    try {
      client = getR2Client();
    } catch (r2ClientError: any) {
      console.error("Error initializing R2 client:", r2ClientError);
      return NextResponse.json(
        { error: `Failed to initialize R2 client: ${r2ClientError.message}` },
        { status: 500 }
      );
    }
    const folderPrefix = folderId ? `folders/${folderId}/` : "";
    const key = `deliveries/${id}/${folderPrefix}${Date.now()}-${encodeURIComponent(
      filename
    )}`;

    let uploadId: string;
    try {
      const create = await client.send(
        new CreateMultipartUploadCommand({
          Bucket: R2_BUCKET,
          Key: key,
          ContentType: finalContentType,
        })
      );
      uploadId = create.UploadId!;
    } catch (r2Error: any) {
      console.error("R2 CreateMultipartUploadCommand error:", r2Error);

      // Handle timeout errors specifically
      if (r2Error.name === "TimeoutError" || r2Error.code === "ETIMEDOUT") {
        return NextResponse.json(
          {
            error:
              "R2 connection timeout. Please check your R2 configuration and network connection.",
            details: r2Error.message,
          },
          { status: 504 } // Gateway Timeout
        );
      }

      // Handle other R2 errors
      return NextResponse.json(
        {
          error: `Failed to initialize R2 upload: ${
            r2Error.message || r2Error.name || "Unknown error"
          }`,
          details: r2Error.code || "No error code",
        },
        { status: 500 }
      );
    }

    const partSize = DEFAULT_PART_SIZE;
    const partCount = Math.ceil(sizeBytes / partSize);
    const urls: string[] = [];

    try {
      for (let partNumber = 1; partNumber <= partCount; partNumber++) {
        const url = await getSignedUrl(
          client,
          new UploadPartCommand({
            Bucket: R2_BUCKET,
            Key: key,
            UploadId: uploadId,
            PartNumber: partNumber,
          }),
          { expiresIn: 60 * 60 }
        );
        urls.push(url);
      }
    } catch (urlError: any) {
      console.error("Error generating presigned URLs:", urlError);

      // Handle timeout errors specifically
      if (urlError.name === "TimeoutError" || urlError.code === "ETIMEDOUT") {
        return NextResponse.json(
          {
            error:
              "R2 connection timeout while generating presigned URLs. Please check your R2 configuration and network connection.",
            details: urlError.message,
          },
          { status: 504 } // Gateway Timeout
        );
      }

      return NextResponse.json(
        {
          error: `Failed to generate presigned URLs: ${
            urlError.message || urlError.name || "Unknown error"
          }`,
          details: urlError.code || "No error code",
        },
        { status: 500 }
      );
    }

    const base = new URL(req.url);
    const completeUrl = `${base.origin}/api/projects/${id}/deliveries/complete`;

    return NextResponse.json({
      uploadId,
      key,
      partSize,
      presignedPartUrls: urls,
      completeUrl,
      folderId: folderId || undefined,
    });
  } catch (error: any) {
    console.error("Error in POST /api/projects/[id]/deliveries:", error);
    return NextResponse.json(
      { error: error.message || "Failed to initialize upload" },
      { status: 500 }
    );
  }
}

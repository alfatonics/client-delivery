import { NextRequest, NextResponse } from "next/server";
import https from "https";
import { URL } from "url";

// Create a custom HTTPS agent with increased timeouts and IPv4 preference
const httpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 1000,
  timeout: 600000, // 10 minutes
  family: 4, // Force IPv4
  maxSockets: 50,
});

// Helper function to make PUT request using native https module
function putRequest(
  url: string,
  data: Buffer,
  headers: Record<string, string>,
  timeout: number
): Promise<{
  statusCode: number;
  headers: Record<string, string | string[]>;
  body: string;
}> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    let timeoutId: NodeJS.Timeout | undefined;
    let isResolved = false;

    const options: https.RequestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: `${urlObj.pathname}${urlObj.search}`,
      method: "PUT",
      headers: {
        ...headers,
        "Content-Length": data.length.toString(),
      },
      agent: httpsAgent,
      family: 4,
    };

    const clearTimer = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = undefined;
      }
    };

    const req = https.request(options, (res) => {
      clearTimer();
      let body = "";

      res.on("data", (chunk) => {
        body += chunk.toString();
      });

      res.on("end", () => {
        if (isResolved) return;
        isResolved = true;

        const normalizedHeaders: Record<string, string | string[]> = {};
        for (const [key, value] of Object.entries(res.headers)) {
          if (typeof value === "string" || Array.isArray(value)) {
            normalizedHeaders[key] = value;
          }
        }

        resolve({
          statusCode: res.statusCode ?? 500,
          headers: normalizedHeaders,
          body,
        });
      });

      res.on("error", (error: NodeJS.ErrnoException) => {
        if (isResolved) return;
        isResolved = true;
        clearTimer();
        reject(error);
      });
    });

    const handleTimeout = () => {
      if (isResolved) return;
      isResolved = true;
      clearTimer();
      req.destroy(new Error(`Request timeout after ${timeout}ms`));
      reject(new Error(`Request timeout after ${timeout}ms`));
    };

    timeoutId = setTimeout(handleTimeout, timeout);

    req.on("error", (error: NodeJS.ErrnoException) => {
      if (isResolved) return;
      isResolved = true;
      clearTimer();
      reject(error);
    });

    req.setTimeout(timeout, handleTimeout);

    req.write(data);
    req.end();
  });
}

// Proxy route to handle R2 upload parts and avoid CORS issues
export async function PUT(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const uploadUrl = searchParams.get("url");

    if (!uploadUrl) {
      return new NextResponse("Missing upload URL", { status: 400 });
    }

    const blob = await req.blob();
    const blobSize = blob.size;

    // Calculate timeout based on file size
    // For small files (<1MB): 2 minutes
    // For larger files: 10 minutes minimum + 2 minutes per 10MB
    // This accounts for slow network connections and R2 upload speeds
    const minUploadSpeedBytesPerSec = 100 * 1024; // 100 KB/s minimum
    let timeoutMs: number;
    if (blobSize < 1024 * 1024) {
      // Small files (<1MB): 2 minutes should be enough
      timeoutMs = 120000;
    } else {
      // Larger files: calculate based on size
      const estimatedUploadTimeMs =
        (blobSize / minUploadSpeedBytesPerSec) * 1000;
      timeoutMs = Math.max(600000, estimatedUploadTimeMs * 2); // 2x estimated time, minimum 10 minutes
    }

    // Log upload details for debugging (remove in production if needed)
    if (process.env.NODE_ENV === "development") {
      console.log(
        `Upload part: size=${blobSize} bytes, timeout=${Math.round(
          timeoutMs / 1000
        )}s, url=${new URL(uploadUrl).hostname}`
      );
    }

    try {
      // Convert blob to Buffer for better Node.js compatibility
      const arrayBuffer = await blob.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Use native https request for better reliability
      const contentType =
        req.headers.get("Content-Type") || "application/octet-stream";

      const result = await putRequest(
        uploadUrl,
        buffer,
        {
          "Content-Type": contentType,
        },
        timeoutMs
      );

      if (result.statusCode < 200 || result.statusCode >= 300) {
        console.error(
          `Upload part failed: ${result.statusCode} ${result.body}`
        );
        return NextResponse.json(
          {
            error: `Upload failed: HTTP ${result.statusCode}`,
            status: result.statusCode,
            details: result.body,
          },
          { status: result.statusCode }
        );
      }

      // Get ETag from response headers
      const etagHeader = result.headers["etag"] || result.headers["ETag"];
      const etag = Array.isArray(etagHeader) ? etagHeader[0] : etagHeader || "";
      // Remove quotes from ETag if present (AWS S3/R2 returns ETags with quotes)
      const cleanEtag = etag.replace(/^"|"$/g, "");

      return NextResponse.json({ etag: cleanEtag });
    } catch (uploadError: any) {
      // Handle timeout errors
      if (
        uploadError.message?.includes("timeout") ||
        uploadError.code === "ETIMEDOUT"
      ) {
        console.error(
          `Upload part timeout after ${Math.round(
            timeoutMs / 1000
          )}s for ${blobSize} bytes`
        );
        return NextResponse.json(
          {
            error: `Upload timeout: File part too large or connection too slow. Tried for ${Math.round(
              timeoutMs / 1000
            )}s`,
            timeout: true,
            size: blobSize,
          },
          { status: 504 } // Gateway Timeout
        );
      }

      // Handle network errors
      console.error("Upload part error:", uploadError);
      return NextResponse.json(
        {
          error: uploadError.message || "Upload failed",
          details: uploadError.code || uploadError.name,
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Upload part error (outer catch):", error);
    return NextResponse.json(
      {
        error: error.message || "Upload failed",
        details: error.code || error.name,
      },
      { status: 500 }
    );
  }
}

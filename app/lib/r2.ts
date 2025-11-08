import { S3Client } from "@aws-sdk/client-s3";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import { Agent as HttpsAgent } from "https";

export function getR2Client() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "R2 credentials are not configured. Please set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY environment variables."
    );
  }

  const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;

  // Create HTTPS agent that prefers IPv4 and has increased timeouts
  const httpsAgent = new HttpsAgent({
    keepAlive: true,
    keepAliveMsecs: 1000,
    timeout: 60000, // 60 seconds
    // Force IPv4 by using family 4
    family: 4,
  });

  // Create HTTP handler with increased timeout and custom agent
  const requestHandler = new NodeHttpHandler({
    requestTimeout: 90000, // 90 seconds
    connectionTimeout: 30000, // 30 seconds for initial connection
    httpsAgent,
  });

  return new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    requestHandler,
    maxAttempts: 3, // Retry up to 3 times
  });
}

export const R2_BUCKET = process.env.R2_BUCKET!;
export const R2_PUBLIC_BASE_URL = process.env.R2_PUBLIC_BASE_URL || "";

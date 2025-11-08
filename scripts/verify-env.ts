import "dotenv/config";
import { S3Client, HeadBucketCommand } from "@aws-sdk/client-s3";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import { Agent as HttpsAgent } from "https";

function assertEnv(name: string) {
  if (!process.env[name] || String(process.env[name]).trim() === "") {
    throw new Error(`Missing env: ${name}`);
  }
}

async function verifyR2() {
  assertEnv("R2_ACCOUNT_ID");
  assertEnv("R2_ACCESS_KEY_ID");
  assertEnv("R2_SECRET_ACCESS_KEY");
  assertEnv("R2_BUCKET");

  const endpoint = `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

  // Create HTTPS agent that prefers IPv4 (same as in app/lib/r2.ts)
  const httpsAgent = new HttpsAgent({
    keepAlive: true,
    keepAliveMsecs: 1000,
    timeout: 60000, // 60 seconds
    family: 4, // Force IPv4 to avoid IPv6 connection issues
  });

  // Create HTTP handler with increased timeout (same as in app/lib/r2.ts)
  const requestHandler = new NodeHttpHandler({
    requestTimeout: 90000, // 90 seconds
    connectionTimeout: 30000, // 30 seconds for initial connection
    httpsAgent,
  });

  const s3 = new S3Client({
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
    requestHandler,
    maxAttempts: 3, // Retry up to 3 times
  });

  console.log(`Testing R2 connection to: ${endpoint}`);
  console.log(`Bucket: ${process.env.R2_BUCKET}`);
  console.log(`Using IPv4 only to avoid connection issues...`);

  try {
    await s3.send(new HeadBucketCommand({ Bucket: process.env.R2_BUCKET! }));
    console.log("✓ R2 connection successful!");
  } catch (error: any) {
    if (error.name === "TimeoutError" || error.code === "ETIMEDOUT") {
      throw new Error(
        `R2 connection timeout. This could be due to:\n` +
          `1. Network connectivity issues (check your internet connection)\n` +
          `2. Firewall/proxy blocking the connection\n` +
          `3. R2 endpoint not reachable from your network\n` +
          `4. VPN or network configuration blocking Cloudflare R2\n` +
          `5. Incorrect R2_ACCOUNT_ID (current: ${process.env.R2_ACCOUNT_ID})\n\n` +
          `Error: ${error.message}\n` +
          `\nTip: Try testing the connection with:\n` +
          `  curl -v --connect-timeout 30 ${endpoint}`
      );
    }
    throw error;
  }
}

async function main() {
  assertEnv("DATABASE_URL");
  assertEnv("SMTP_HOST");
  assertEnv("SMTP_PORT");
  assertEnv("EMAIL_FROM");
  await verifyR2();
  console.log(
    "ENV OK: DATABASE_URL present, email settings configured, and R2 bucket reachable."
  );
}

main().catch((err) => {
  console.error("ENV VALIDATION FAILED:\n", err?.message || err);
  process.exit(1);
});

import { S3Client } from "@aws-sdk/client-s3";

/**
 * Shared S3 client pointed at Cloudflare R2. Lazy-initialized so that
 * module import during Next.js build (when runtime env vars may be absent)
 * doesn't throw. First actual use picks up env vars from the runtime process.
 */

let _s3: S3Client | null = null;

export function getS3(): S3Client {
  if (_s3) return _s3;

  if (!process.env.R2_ENDPOINT || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
    throw new Error("R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY are required");
  }

  _s3 = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });

  return _s3;
}

/**
 * Backward-compat Proxy so existing code can keep calling `s3.send(...)`.
 * Any property access triggers lazy init.
 */
export const s3 = new Proxy({} as S3Client, {
  get(_target, prop) {
    const client = getS3();
    const value = (client as any)[prop];
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export const BUCKET = process.env.R2_BUCKET || "kodo-assets";
export const PUBLIC_URL = process.env.R2_PUBLIC_URL || process.env.R2_ENDPOINT;

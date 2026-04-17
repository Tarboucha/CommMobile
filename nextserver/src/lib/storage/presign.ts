import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3, BUCKET } from "./s3";
import { isAllowedImageType } from "./mime";
import { ValidationError } from "@/lib/errors/domain-errors";

const DEFAULT_TTL_SECONDS = 300;

export interface PresignUploadInput {
  /** Full R2 object key (caller builds via paths.ts). */
  key: string;
  /** MIME type — validated against the allowlist in mime.ts. */
  contentType: string;
  /** Max payload size in bytes. Enforced by R2 via Content-Length. */
  maxBytes: number;
  /** URL lifetime in seconds. Default 5 min. */
  ttlSeconds?: number;
}

export interface PresignedUpload {
  upload_url: string;
  key: string;
  expires_in: number;
  content_type: string;
  max_bytes: number;
}

/**
 * Generate a short-lived presigned PUT URL for an R2 object.
 *
 * The returned URL is scoped to the exact key + content-type + max size.
 * R2 refuses any PUT that doesn't match.
 *
 * Clients upload directly to R2 using this URL — no bytes flow through
 * kodo-api.
 */
export async function presignUpload(input: PresignUploadInput): Promise<PresignedUpload> {
  if (!isAllowedImageType(input.contentType)) {
    throw new ValidationError(`Unsupported content type: ${input.contentType}`);
  }
  if (input.maxBytes <= 0) {
    throw new ValidationError("maxBytes must be positive");
  }

  const ttl = input.ttlSeconds ?? DEFAULT_TTL_SECONDS;

  // Note: we intentionally don't set ContentLength on the signed command —
  // PUTs must match the signed length exactly, so including it would require
  // the client to know the post-resize size in advance. Size is enforced on
  // the client (resize cap) and on the server at persist time (we can HEAD
  // the object if needed).
  const upload_url = await getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: input.key,
      ContentType: input.contentType,
    }),
    { expiresIn: ttl }
  );

  return {
    upload_url,
    key: input.key,
    expires_in: ttl,
    content_type: input.contentType,
    max_bytes: input.maxBytes,
  };
}

import "server-only";
import { randomUUID } from "node:crypto";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadBucketCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { db } from "./db";

const bucket = process.env.S3_BUCKET ?? process.env.BUCKET_NAME;

/** Photos go to S3-compatible storage when it's configured, otherwise into Postgres. */
export function s3Configured() {
  return Boolean(bucket && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
}

let client: S3Client | undefined;
function s3() {
  client ??= new S3Client({
    region: process.env.AWS_REGION || "auto",
    endpoint: process.env.AWS_ENDPOINT_URL_S3 || undefined,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
  });
  return client;
}

export async function checkS3(): Promise<string> {
  if (!s3Configured()) return "not configured (photos stored in database)";
  try {
    await s3().send(new HeadBucketCommand({ Bucket: bucket }));
    return "ok";
  } catch (e) {
    return "error: " + (e instanceof Error ? e.name + " " + e.message : String(e));
  }
}

export async function savePhoto(
  reportId: string,
  roomId: string | null,
  bytes: Uint8Array,
  contentType: string,
  phase: "move_in" | "move_out" = "move_in",
) {
  const sql = await db();
  const id = randomUUID();
  if (s3Configured()) {
    const key = `reports/${reportId}/${id}`;
    await s3().send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: bytes, ContentType: contentType }));
    await sql`insert into photos (id, report_id, room_id, storage, storage_key, content_type, phase)
              values (${id}, ${reportId}, ${roomId}, 's3', ${key}, ${contentType}, ${phase})`;
  } else {
    await sql`insert into photos (id, report_id, room_id, storage, storage_key, content_type, data, phase)
              values (${id}, ${reportId}, ${roomId}, 'db', ${id}, ${contentType}, ${Buffer.from(bytes)}, ${phase})`;
  }
  return id;
}

type PhotoRow = { id: string; storage: string; storage_key: string; content_type: string; data: Buffer | null };

export async function photoResponse(row: PhotoRow): Promise<Response> {
  if (row.storage === "s3") {
    const url = await getSignedUrl(s3(), new GetObjectCommand({ Bucket: bucket, Key: row.storage_key }), { expiresIn: 600 });
    return Response.redirect(url, 302);
  }
  return new Response(new Uint8Array(row.data ?? Buffer.alloc(0)), {
    headers: { "content-type": row.content_type, "cache-control": "private, max-age=86400" },
  });
}

export async function removePhotoObject(row: { storage: string; storage_key: string }) {
  if (row.storage === "s3") {
    await s3().send(new DeleteObjectCommand({ Bucket: bucket, Key: row.storage_key })).catch(() => {});
  }
}

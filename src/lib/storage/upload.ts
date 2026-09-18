// ════════════════════════════════════════════════════════════
// نظام رفع الملفات — يدعم Cloudflare R2 / AWS S3 / MinIO
// أو Local Storage للتطوير
// ════════════════════════════════════════════════════════════
export type UploadResult = {
  key:      string;
  url:      string;
  filename: string;
  size:     number;
  mimeType: string;
};

type UploadOptions = {
  file:       File | Buffer;
  filename:   string;
  mimeType:   string;
  folder:     string; // "procurement" | "vendors" | "hr" | "grants"
  orgId:      string;
};

// ── مرسل موحد يختار الموفر من البيئة ───────────────────────
export async function uploadFile(opts: UploadOptions): Promise<UploadResult> {
  if (process.env.STORAGE_ENDPOINT && process.env.STORAGE_ACCESS_KEY) {
    return uploadToS3Compatible(opts);
  }
  // Local Storage للتطوير (يخزن في /public/uploads)
  return uploadToLocal(opts);
}

async function uploadToS3Compatible(opts: UploadOptions): Promise<UploadResult> {
  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
  const { getSignedUrl }               = await import("@aws-sdk/s3-request-presigner");

  const s3 = new S3Client({
    endpoint:        process.env.STORAGE_ENDPOINT,
    region:          process.env.STORAGE_REGION ?? "auto",
    credentials: {
      accessKeyId:     process.env.STORAGE_ACCESS_KEY!,
      secretAccessKey: process.env.STORAGE_SECRET_KEY!,
    },
  });

  const key  = `${opts.orgId}/${opts.folder}/${Date.now()}-${opts.filename.replace(/\s+/g,"-")}`;
  const buf  = opts.file instanceof File ? Buffer.from(await opts.file.arrayBuffer()) : opts.file;

  await s3.send(new PutObjectCommand({
    Bucket:      process.env.STORAGE_BUCKET!,
    Key:         key,
    Body:        buf,
    ContentType: opts.mimeType,
  }));

  const url = `${process.env.STORAGE_PUBLIC_URL ?? process.env.STORAGE_ENDPOINT}/${process.env.STORAGE_BUCKET}/${key}`;
  return { key, url, filename:opts.filename, size:buf.length, mimeType:opts.mimeType };
}

async function uploadToLocal(opts: UploadOptions): Promise<UploadResult> {
  const { writeFile, mkdir } = await import("fs/promises");
  const { join }             = await import("path");

  const key    = `${opts.orgId}/${opts.folder}/${Date.now()}-${opts.filename.replace(/\s+/g,"-")}`;
  const dir    = join(process.cwd(), "public", "uploads", opts.orgId, opts.folder);
  const buf    = opts.file instanceof File ? Buffer.from(await opts.file.arrayBuffer()) : opts.file;
  const fname  = `${Date.now()}-${opts.filename.replace(/\s+/g,"-")}`;

  await mkdir(dir, { recursive:true });
  await writeFile(join(dir, fname), buf);

  const url = `/uploads/${opts.orgId}/${opts.folder}/${fname}`;
  return { key, url, filename:opts.filename, size:buf.length, mimeType:opts.mimeType };
}

export async function deleteFile(key: string): Promise<void> {
  if (process.env.STORAGE_ENDPOINT && process.env.STORAGE_ACCESS_KEY) {
    const { S3Client, DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    const s3 = new S3Client({
      endpoint:    process.env.STORAGE_ENDPOINT,
      region:      process.env.STORAGE_REGION ?? "auto",
      credentials: { accessKeyId:process.env.STORAGE_ACCESS_KEY!, secretAccessKey:process.env.STORAGE_SECRET_KEY! },
    });
    await s3.send(new DeleteObjectCommand({ Bucket:process.env.STORAGE_BUCKET!, Key:key }));
  } else {
    const { unlink } = await import("fs/promises");
    const { join }   = await import("path");
    try { await unlink(join(process.cwd(), "public", key)); } catch {}
  }
}

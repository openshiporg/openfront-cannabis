/** Uploaded public photos (product photos, the storefront cover) on Keystone's my_images S3 storage. */
import { createHash } from "node:crypto";
import { Readable } from "node:stream";

export const MAX_PUBLIC_IMAGE_BYTES = 10 * 1024 * 1024;
const EXTENSIONS = new Set(["jpg", "png", "webp", "gif"]);

type GraphQLUpload = { filename?: string; createReadStream: () => NodeJS.ReadableStream };
type StoredImage = { id: string; extension: string; filesize: number; width: number; height: number };
type ImagesContext = { images: (storage: "my_images") => { getDataFromStream: (stream: Readable, filename: string) => Promise<StoredImage>; getUrl: (id: string, extension: any) => Promise<string> } };

/** Read a GraphQL multipart upload into memory, bounded, with its content hash (the command's idempotency identity). */
export async function readPublicImageUpload(upload: unknown, maxBytes = MAX_PUBLIC_IMAGE_BYTES) {
  const file = (await upload) as GraphQLUpload | null | undefined;
  if (!file || typeof file.createReadStream !== "function") return null;
  const chunks: Buffer[] = []; let size = 0;
  for await (const chunk of file.createReadStream() as AsyncIterable<Buffer>) {
    size += chunk.length;
    if (size > maxBytes) throw new Error(`Photo must be ${Math.round(maxBytes / 1024 / 1024)} MB or smaller`);
    chunks.push(Buffer.from(chunk));
  }
  if (!size) throw new Error("Photo file is empty");
  const buffer = Buffer.concat(chunks);
  return { buffer, filename: String(file.filename || "photo"), sha256: createHash("sha256").update(buffer).digest("hex") };
}

/** Prisma column values for a Keystone image field named `prefix`. */
export function imageColumns(prefix: string, image: StoredImage | null) {
  return {
    [`${prefix}_id`]: image?.id ?? null, [`${prefix}_extension`]: image?.extension ?? null, [`${prefix}_filesize`]: image?.filesize ?? null,
    [`${prefix}_width`]: image?.width ?? null, [`${prefix}_height`]: image?.height ?? null,
  };
}

/** Store the bytes in my_images; Keystone rejects anything that is not a jpg, png, webp or gif image. */
export async function storePublicImage(context: unknown, upload: { buffer: Buffer; filename: string }) {
  let stored: StoredImage;
  try { stored = await (context as ImagesContext).images("my_images").getDataFromStream(Readable.from(upload.buffer), upload.filename); }
  catch { throw new Error("Photo must be a JPEG, PNG, WebP or GIF image"); }
  if (!EXTENSIONS.has(stored.extension)) throw new Error("Photo must be a JPEG, PNG, WebP or GIF image");
  return stored;
}

/** Public URL of a stored image field (`{ url }` from a Keystone query), else the legacy URL text, else null. */
export function publicImageUrl(field: { url?: string | null } | null | undefined, legacy?: string | null) {
  return field?.url || legacy || null;
}

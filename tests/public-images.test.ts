import { test } from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { imageColumns, publicImageUrl, readPublicImageUpload, storePublicImage } from "../features/keystone/domain/publicImages.ts";

const upload = (bytes: Buffer, filename = "photo.png") => Promise.resolve({ filename, createReadStream: () => Readable.from([bytes]) });

test("an upload is read whole with a content hash that changes with the file", async () => {
  const a = await readPublicImageUpload(upload(Buffer.from("first image")));
  const b = await readPublicImageUpload(upload(Buffer.from("second image")));
  assert.equal(a?.buffer.toString(), "first image");
  assert.equal(a?.filename, "photo.png");
  assert.match(a!.sha256, /^[0-9a-f]{64}$/);
  assert.notEqual(a!.sha256, b!.sha256);
});

test("no upload, an empty file and an oversized file are told apart", async () => {
  assert.equal(await readPublicImageUpload(undefined), null);
  assert.equal(await readPublicImageUpload(null), null);
  await assert.rejects(readPublicImageUpload(upload(Buffer.alloc(0))), /empty/);
  await assert.rejects(readPublicImageUpload(upload(Buffer.alloc(11)), 10), /MB or smaller/);
});

test("image columns are written together, and cleared together on removal", () => {
  assert.deepEqual(imageColumns("photo", { id: "abc", extension: "png", filesize: 9, width: 3, height: 2 }),
    { photo_id: "abc", photo_extension: "png", photo_filesize: 9, photo_width: 3, photo_height: 2 });
  assert.deepEqual(imageColumns("heroImage", null),
    { heroImage_id: null, heroImage_extension: null, heroImage_filesize: null, heroImage_width: null, heroImage_height: null });
});

test("storage rejections become an operator message, and only image extensions are accepted", async () => {
  const context = (result: () => Promise<unknown>) => ({ images: () => ({ getDataFromStream: result, getUrl: async () => "" }) });
  await assert.rejects(storePublicImage(context(async () => { throw new Error("sharp: unsupported"); }), { buffer: Buffer.from("x"), filename: "a.txt" }), /JPEG, PNG, WebP or GIF/);
  await assert.rejects(storePublicImage(context(async () => ({ id: "a", extension: "tiff", filesize: 1, width: 1, height: 1 })), { buffer: Buffer.from("x"), filename: "a.tiff" }), /JPEG, PNG, WebP or GIF/);
  const stored = await storePublicImage(context(async () => ({ id: "a", extension: "png", filesize: 1, width: 1, height: 1 })), { buffer: Buffer.from("x"), filename: "a.png" });
  assert.equal(stored.id, "a");
});

test("the public URL prefers the uploaded photo over the legacy URL text", () => {
  assert.equal(publicImageUrl({ url: "https://bucket/a.png" }, "https://legacy/b.png"), "https://bucket/a.png");
  assert.equal(publicImageUrl(null, "https://legacy/b.png"), "https://legacy/b.png");
  assert.equal(publicImageUrl(null, ""), null);
});

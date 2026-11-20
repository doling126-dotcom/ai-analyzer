import { createWriteStream, promises as fs } from "fs";
import path from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import type { ReadableStream as WebReadableStream } from "stream/web";
import { probe } from "@/lib/video/ffmpeg";
import { newId } from "@/lib/video/ops";
import { errorResponse } from "@/lib/video/serve";
import { MEDIA_DIR, ensureDirs, listMedia, saveMedia } from "@/lib/video/storage";

const ALLOWED_EXT = new Set([".mp4", ".mov", ".m4v", ".webm", ".mkv", ".avi"]);

export async function GET() {
  try {
    return Response.json({ media: await listMedia() });
  } catch (err) {
    return errorResponse(err);
  }
}

// Add a video either as a raw upload (body = file bytes, `x-filename` header)
// or by URL (JSON body `{ "url": "https://…" }`), e.g. a clip generated elsewhere.
export async function POST(request: Request) {
  await ensureDirs();
  const id = newId("m");
  let name: string;
  let body: ReadableStream<Uint8Array> | null;

  try {
    if (request.headers.get("content-type")?.includes("application/json")) {
      const { url } = (await request.json()) as { url?: string };
      if (!url || !/^https?:\/\//i.test(url)) {
        return errorResponse(new Error("A http(s) url is required"), 400);
      }
      const res = await fetch(url);
      if (!res.ok || !res.body) {
        return errorResponse(new Error(`Download failed: HTTP ${res.status}`), 400);
      }
      name = decodeURIComponent(new URL(url).pathname.split("/").pop() || "video.mp4");
      body = res.body;
    } else {
      name = decodeURIComponent(request.headers.get("x-filename") || "video.mp4");
      body = request.body;
    }
    if (!body) return errorResponse(new Error("Empty body"), 400);

    let ext = path.extname(name).toLowerCase();
    if (!ALLOWED_EXT.has(ext)) ext = ".mp4";
    const file = `${id}${ext}`;
    const filePath = path.join(MEDIA_DIR, file);
    await pipeline(
      Readable.fromWeb(body as WebReadableStream<Uint8Array>),
      createWriteStream(filePath)
    );

    try {
      const info = await probe(filePath);
      const media = { id, name, file, ...info, createdAt: new Date().toISOString() };
      await saveMedia(media);
      return Response.json({ media });
    } catch (err) {
      await fs.rm(filePath, { force: true });
      return errorResponse(err, 400);
    }
  } catch (err) {
    return errorResponse(err);
  }
}

// Stream a file with HTTP Range support so <video> can seek (server only).

import { createReadStream, promises as fs } from "fs";
import { Readable } from "stream";

export async function serveFile(
  request: Request,
  file: string,
  contentType: string
): Promise<Response> {
  let size: number;
  try {
    size = (await fs.stat(file)).size;
  } catch {
    return new Response("Not found", { status: 404 });
  }
  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-cache",
  };

  const range = request.headers.get("range")?.match(/bytes=(\d*)-(\d*)/);
  if (range && (range[1] || range[2])) {
    let start = range[1] ? Number(range[1]) : size - Number(range[2]);
    let end = range[1] && range[2] ? Number(range[2]) : size - 1;
    start = Math.max(0, start);
    end = Math.min(end, size - 1);
    if (start > end) {
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${size}` },
      });
    }
    const stream = Readable.toWeb(createReadStream(file, { start, end }));
    return new Response(stream as ReadableStream, {
      status: 206,
      headers: {
        ...headers,
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Content-Length": String(end - start + 1),
      },
    });
  }

  const stream = Readable.toWeb(createReadStream(file));
  return new Response(stream as ReadableStream, {
    headers: { ...headers, "Content-Length": String(size) },
  });
}

export function errorResponse(err: unknown, status = 500) {
  const message = err instanceof Error ? err.message : String(err);
  return Response.json({ error: message }, { status });
}

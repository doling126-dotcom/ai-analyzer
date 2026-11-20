import { renderProject, type RenderEvent } from "@/lib/video/ffmpeg";
import { errorResponse } from "@/lib/video/serve";
import { getProject, mediaMap } from "@/lib/video/storage";

// Render the saved project. Progress is streamed as newline-delimited JSON;
// clips that did not change since the last render are reused from cache.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let project;
  try {
    project = await getProject((await params).id);
  } catch (err) {
    return errorResponse(err, 400);
  }
  if (!project) return new Response("Not found", { status: 404 });
  const media = await mediaMap();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: RenderEvent | { type: "error"; message: string }) =>
        controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      try {
        await renderProject(project, media, send);
      } catch (err) {
        send({ type: "error", message: err instanceof Error ? err.message : String(err) });
      }
      controller.close();
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-cache" },
  });
}

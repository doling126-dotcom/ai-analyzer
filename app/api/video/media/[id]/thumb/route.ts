import { thumbnail } from "@/lib/video/ffmpeg";
import { errorResponse, serveFile } from "@/lib/video/serve";
import { getMedia } from "@/lib/video/storage";

// GET /api/video/media/:id/thumb?t=12.5 → JPEG frame at that time.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const media = await getMedia((await params).id);
    if (!media) return new Response("Not found", { status: 404 });
    const t = Number(new URL(request.url).searchParams.get("t")) || 0;
    return serveFile(request, await thumbnail(media, t), "image/jpeg");
  } catch (err) {
    return errorResponse(err);
  }
}

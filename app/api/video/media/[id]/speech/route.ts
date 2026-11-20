import { detectSpeech } from "@/lib/video/ffmpeg";
import { errorResponse } from "@/lib/video/serve";
import { getMedia } from "@/lib/video/storage";

// GET /api/video/media/:id/speech?noise=-35&minSilence=0.5&padding=0.15
// → the non-silent ranges, used for automatic jump cuts.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const media = await getMedia((await params).id);
    if (!media) return new Response("Not found", { status: 404 });
    const q = new URL(request.url).searchParams;
    const num = (key: string, fallback: number) => {
      const v = Number(q.get(key));
      return q.has(key) && Number.isFinite(v) ? v : fallback;
    };
    const ranges = await detectSpeech(media, {
      noiseDb: Math.min(-10, Math.max(-80, num("noise", -35))),
      minSilence: Math.min(5, Math.max(0.1, num("minSilence", 0.5))),
      padding: Math.min(1, Math.max(0, num("padding", 0.15))),
    });
    return Response.json({ ranges });
  } catch (err) {
    return errorResponse(err);
  }
}

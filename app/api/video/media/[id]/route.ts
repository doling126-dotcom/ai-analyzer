import { serveFile, errorResponse } from "@/lib/video/serve";
import { getMedia, mediaFilePath } from "@/lib/video/storage";

const TYPES: Record<string, string> = {
  mp4: "video/mp4",
  m4v: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  mkv: "video/x-matroska",
  avi: "video/x-msvideo",
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const media = await getMedia((await params).id);
    if (!media) return new Response("Not found", { status: 404 });
    const ext = media.file.split(".").pop() ?? "mp4";
    return serveFile(request, mediaFilePath(media), TYPES[ext] ?? "video/mp4");
  } catch (err) {
    return errorResponse(err, 400);
  }
}

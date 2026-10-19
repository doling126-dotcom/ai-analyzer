import path from "path";
import { serveFile } from "@/lib/video/serve";
import { RENDER_DIR } from "@/lib/video/storage";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ file: string }> }
) {
  const { file } = await params;
  if (!/^p_[a-z0-9]+_\d+\.mp4$/.test(file)) {
    return new Response("Not found", { status: 404 });
  }
  return serveFile(request, path.join(RENDER_DIR, file), "video/mp4");
}

import { clipsFromRanges, makeClip, newId } from "@/lib/video/ops";
import { detectSpeech } from "@/lib/video/ffmpeg";
import { errorResponse } from "@/lib/video/serve";
import { getMedia, listProjects, saveProject } from "@/lib/video/storage";
import type { Clip, Project } from "@/lib/video/types";

export async function GET() {
  try {
    return Response.json({ projects: await listProjects() });
  } catch (err) {
    return errorResponse(err);
  }
}

// Create a project from one or more videos. With `autoCut`, silences are
// detected and removed so each spoken part becomes its own editable clip.
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      name?: string;
      mediaIds?: string[];
      autoCut?: boolean;
      width?: number;
      height?: number;
    };
    const mediaIds = body.mediaIds ?? [];
    const clips: Clip[] = [];
    let first: { width: number; height: number } | null = null;
    for (const id of mediaIds) {
      const media = await getMedia(id);
      if (!media) return errorResponse(new Error(`Unknown media ${id}`), 400);
      first ??= media;
      if (body.autoCut) {
        const ranges = await detectSpeech(media, {
          noiseDb: -35,
          minSilence: 0.5,
          padding: 0.15,
        });
        clips.push(...clipsFromRanges(media.id, ranges));
      } else {
        clips.push(makeClip(media.id, 0, media.duration));
      }
    }

    const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);
    const now = new Date().toISOString();
    const project: Project = {
      id: newId("p"),
      name: body.name?.trim() || "새 프로젝트",
      width: even(body.width ?? first?.width ?? 1920),
      height: even(body.height ?? first?.height ?? 1080),
      fps: 30,
      clips,
      createdAt: now,
      updatedAt: now,
    };
    await saveProject(project);
    return Response.json({ project });
  } catch (err) {
    return errorResponse(err);
  }
}

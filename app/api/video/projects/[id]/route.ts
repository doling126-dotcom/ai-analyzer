import { errorResponse } from "@/lib/video/serve";
import { getProject, saveProject } from "@/lib/video/storage";
import type { Project } from "@/lib/video/types";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  try {
    const project = await getProject((await params).id);
    if (!project) return new Response("Not found", { status: 404 });
    return Response.json({ project });
  } catch (err) {
    return errorResponse(err, 400);
  }
}

export async function PUT(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const existing = await getProject(id);
    if (!existing) return new Response("Not found", { status: 404 });
    const { project } = (await request.json()) as { project: Project };
    const saved: Project = {
      ...project,
      id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };
    await saveProject(saved);
    return Response.json({ project: saved });
  } catch (err) {
    return errorResponse(err, 400);
  }
}

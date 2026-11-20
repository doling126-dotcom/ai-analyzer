// File-system storage for media, projects and renders (server only).

import { promises as fs } from "fs";
import path from "path";
import type { Media, Project } from "./types";

export const STORAGE_DIR = path.resolve(
  process.env.VIDEO_STORAGE_DIR || path.join(process.cwd(), ".video-storage")
);
export const MEDIA_DIR = path.join(STORAGE_DIR, "media");
export const PROJECT_DIR = path.join(STORAGE_DIR, "projects");
export const SEGMENT_DIR = path.join(STORAGE_DIR, "segments");
export const RENDER_DIR = path.join(STORAGE_DIR, "renders");
export const THUMB_DIR = path.join(STORAGE_DIR, "thumbs");

const ID_RE = /^[a-z]+_[a-z0-9]+$/;

export function assertId(id: string): string {
  if (!ID_RE.test(id)) throw new Error(`Invalid id: ${id}`);
  return id;
}

export async function ensureDirs() {
  await Promise.all(
    [MEDIA_DIR, PROJECT_DIR, SEGMENT_DIR, RENDER_DIR, THUMB_DIR].map((d) =>
      fs.mkdir(d, { recursive: true })
    )
  );
}

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as T;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

async function writeJson(file: string, data: unknown) {
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2));
  await fs.rename(tmp, file);
}

async function listJson<T>(dir: string): Promise<T[]> {
  await ensureDirs();
  const names = (await fs.readdir(dir)).filter((n) => n.endsWith(".json"));
  const items = await Promise.all(names.map((n) => readJson<T>(path.join(dir, n))));
  return items.filter((x): x is Awaited<T> => x !== null) as T[];
}

export const mediaJsonPath = (id: string) =>
  path.join(MEDIA_DIR, `${assertId(id)}.json`);
export const projectJsonPath = (id: string) =>
  path.join(PROJECT_DIR, `${assertId(id)}.json`);

export async function getMedia(id: string) {
  return readJson<Media>(mediaJsonPath(id));
}

export function mediaFilePath(media: Media) {
  return path.join(MEDIA_DIR, path.basename(media.file));
}

export async function saveMedia(media: Media) {
  await ensureDirs();
  await writeJson(mediaJsonPath(media.id), media);
}

export async function listMedia() {
  const all = await listJson<Media>(MEDIA_DIR);
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function mediaMap(): Promise<Record<string, Media>> {
  return Object.fromEntries((await listMedia()).map((m) => [m.id, m]));
}

export async function getProject(id: string) {
  return readJson<Project>(projectJsonPath(id));
}

export async function saveProject(project: Project) {
  await ensureDirs();
  await writeJson(projectJsonPath(project.id), project);
}

export async function listProjects() {
  const all = await listJson<Project>(PROJECT_DIR);
  return all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

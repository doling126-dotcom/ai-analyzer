// Shared data model for the video editor. Everything that describes an edit
// lives in a Project as plain JSON, so any single clip can be changed later
// (by hand or by Claude) without touching the rest of the video.

export type TextPosition = "top" | "center" | "bottom";

export interface ClipText {
  content: string;
  position: TextPosition;
  size: number; // font size in output pixels
  color: string; // #rrggbb
  background: boolean; // semi-transparent box behind the text
}

export interface Clip {
  id: string;
  mediaId: string;
  start: number; // seconds in the source media
  end: number; // seconds in the source media
  speed: number; // 0.25 – 4
  volume: number; // 0 – 2 (1 = original)
  text: ClipText | null;
  fadeIn: number; // seconds
  fadeOut: number; // seconds
  label: string;
}

export interface Project {
  id: string;
  name: string;
  width: number;
  height: number;
  fps: number;
  clips: Clip[];
  createdAt: string;
  updatedAt: string;
}

export interface Media {
  id: string;
  name: string;
  file: string; // file name inside the media directory
  duration: number;
  width: number;
  height: number;
  hasAudio: boolean;
  createdAt: string;
}

export interface SpeechRange {
  start: number;
  end: number;
}

# AI Analyzer + AI 영상 편집기

## AI 영상 편집기 (`/editor`)

영상을 올리면 무음 구간을 자동으로 잘라 클립으로 나눕니다. 그런 다음 **클립 하나하나를 따로 수정**하고 MP4로 렌더링할 수 있습니다.

- **무음 자동 컷**: ffmpeg `silencedetect`로 말하지 않는 구간을 제거하고, 말한 구간마다 클립을 만듭니다.
- **부분 수정**: 클립별로 트림(가장자리 드래그), 속도, 볼륨, 페이드, 자막(한글), 순서 변경, 자르기(S), 복제, 삭제를 할 수 있습니다. 실행 취소/다시 실행(Ctrl+Z / Ctrl+Shift+Z)도 됩니다.
- **영상 교체**: 특정 클립의 화면만 새 영상(예: AI로 새로 만든 영상)으로 바꾸고, 자막·속도·페이드는 그대로 유지합니다. URL로 영상을 가져올 수도 있습니다.
- **AI 편집**: "3번 클립 자막을 '안녕하세요'로 바꿔줘"처럼 말로 지시하면 Claude가 장면 이미지를 보고, 지시한 클립만 고치는 편집 명령을 만듭니다.
- **빠른 재렌더링**: 클립마다 결과를 캐시해 두므로, 수정한 클립만 다시 인코딩하고 나머지는 재사용합니다.

### 준비

- Node.js 20+
- `ffmpeg` / `ffprobe` (PATH에 있거나 `FFMPEG_PATH`, `FFPROBE_PATH`로 지정, 여러 줄 자막 가운데 정렬은 6.1 이상)
- AI 편집을 쓰려면 `.env.local`에 `ANTHROPIC_API_KEY=...`
- 자막용 한글 폰트는 자동으로 찾습니다(맥: Apple SD Gothic Neo, 윈도우: 맑은 고딕, 리눅스: Noto CJK/나눔고딕). 다른 폰트를 쓰려면 `VIDEO_FONT_PATH`를 지정하세요.

```bash
npm install
npm run dev
# http://localhost:3000/editor
```

업로드한 영상, 프로젝트(JSON), 렌더링 결과는 `.video-storage/`에 저장됩니다(`VIDEO_STORAGE_DIR`로 위치를 바꿀 수 있음).

### 구조

| 경로 | 역할 |
| --- | --- |
| `lib/video/types.ts` | 프로젝트·클립·미디어 데이터 모델 |
| `lib/video/ops.ts` | 편집 명령(`update_clip`, `split_clip`, `replace_media` 등). UI와 AI가 같은 명령을 씁니다 |
| `lib/video/ffmpeg.ts` | 무음 감지, 썸네일, 클립별 캐시 렌더링 + 이어붙이기 |
| `app/api/video/**` | 업로드, 프로젝트 저장, 렌더링(진행 상황 스트리밍), AI 편집 API |
| `app/editor/**` | 편집기 UI (미리보기, 타임라인, 클립 편집, AI 편집, 렌더링) |

---

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

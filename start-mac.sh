#!/bin/bash
# AI 영상 편집기 실행 (macOS)
# 터미널에 `bash ` 을 입력하고 이 파일을 끌어다 놓은 뒤 Enter를 누르세요.
# 처음 실행할 때만 필요한 프로그램(Homebrew, Node.js, ffmpeg)을 설치합니다.

set -e
cd "$(dirname "$0")"

echo "== AI 영상 편집기 =="

# Homebrew (맥용 프로그램 설치 도구)
if ! command -v brew >/dev/null 2>&1; then
  for b in /opt/homebrew/bin/brew /usr/local/bin/brew; do
    [ -x "$b" ] && eval "$("$b" shellenv)"
  done
fi
if ! command -v brew >/dev/null 2>&1; then
  echo "Homebrew를 설치합니다. 맥 로그인 비밀번호를 물어보면 입력하세요(화면에 표시되지 않아요)."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  for b in /opt/homebrew/bin/brew /usr/local/bin/brew; do
    [ -x "$b" ] && eval "$("$b" shellenv)"
  done
fi

command -v node >/dev/null 2>&1 || { echo "Node.js를 설치합니다…"; brew install node; }
command -v ffmpeg >/dev/null 2>&1 || { echo "ffmpeg를 설치합니다…"; brew install ffmpeg; }

# Claude API 키 (AI 편집 기능용, 처음 한 번만)
if [ ! -f .env.local ]; then
  echo ""
  echo "AI 편집(말로 수정하기)을 쓰려면 Anthropic API 키가 필요해요."
  echo "https://console.anthropic.com 에서 발급할 수 있어요. 없으면 그냥 Enter (나중에 .env.local 파일에 넣으면 돼요)."
  read -r -p "API 키: " key
  echo "ANTHROPIC_API_KEY=$key" > .env.local
fi

if [ ! -d node_modules ] || [ package-lock.json -nt node_modules ]; then
  echo "필요한 파일을 설치합니다(처음엔 1~2분 걸려요)…"
  npm install
  touch node_modules
fi

echo ""
echo "편집기를 엽니다: http://localhost:3000/editor"
echo "끝낼 때는 이 터미널 창에서 Control + C 를 누르세요."
(sleep 5 && open "http://localhost:3000/editor") &
npm run dev

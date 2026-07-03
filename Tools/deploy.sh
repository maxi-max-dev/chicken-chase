#!/usr/bin/env bash
# 构建并发布到 GitHub Pages（main 分支 /docs 目录）
set -euo pipefail
cd "$(dirname "$0")/.."
npm test
npx vite build --outDir docs --emptyOutDir
git add -A
git commit -m "${1:-发布新构建}"
git push origin main
echo "✅ 已推送，约 1 分钟后生效：https://maxi-max-dev.github.io/chicken-chase/"

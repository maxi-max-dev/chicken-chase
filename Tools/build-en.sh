#!/usr/bin/env bash
# 构建英文版到 docs/en（线上 https://maxi-max-dev.github.io/chicken-chase/en/）。
# 只写 docs/en 一个目录，中文版 docs/ 不动。发布仍走 git commit + push。
set -euo pipefail
cd "$(dirname "$0")/.."
npm test
npx vite build --config vite.config.en.ts
echo "✅ docs/en 已生成，提交推送后约 1 分钟生效：https://maxi-max-dev.github.io/chicken-chase/en/"

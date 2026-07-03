import { defineConfig } from 'vite'

// base './' —— 部署在 GitHub Pages 子路径下也能正常加载资源
export default defineConfig({
  base: './',
  build: { target: 'es2022' },
  server: { port: 5180 },
})

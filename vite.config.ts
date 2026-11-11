import { defineConfig } from 'vite';

// base 를 상대 경로로 두어 GitHub Pages 의 하위 경로에서도 그대로 동작한다.
export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 2000 },
});

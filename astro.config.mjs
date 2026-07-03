// @ts-check
import { defineConfig } from 'astro/config';

// GitHub Pages 프로젝트 페이지로 배포 → https://juice119.github.io/kpt/
// 레포명(kpt)이 곧 하위 경로이므로 base='/kpt'.
export default defineConfig({
  site: 'https://juice119.github.io',
  base: '/kpt',
  markdown: {
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' },
    },
  },
});

// @ts-check
import { defineConfig } from 'astro/config';

// NOTE: `site`/`base`는 GitHub Pages 배포(STEP 8)에서 확정합니다.
// 프로젝트 페이지로 배포하면: site='https://<user>.github.io', base='/kpt-wiki'
export default defineConfig({
  markdown: {
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' },
    },
  },
});

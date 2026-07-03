// @ts-check
import { defineConfig } from 'astro/config';

// 커스텀 도메인(kpt.juice119.io)으로 배포 → 도메인 루트 서빙.
// 따라서 base는 기본값('/') 유지, site만 도메인으로 지정.
// (커스텀 도메인은 public/CNAME 파일로 고정)
export default defineConfig({
  site: 'https://kpt.juice119.io',
  markdown: {
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' },
    },
  },
});

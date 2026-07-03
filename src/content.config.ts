import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// 매일 하나의 .md 파일 = 하루치 KPT 회고
// src/content/retros/YYYY-MM-DD.md 로 저장하면 자동으로 사이트에 반영됩니다.
const retros = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/retros' }),
  schema: z.object({
    // 필수: 회고 날짜 (파일명과 맞추는 것을 권장)
    date: z.coerce.date(),
    // 선택: 그날 회고의 한 줄 제목 (없으면 날짜로 표시)
    title: z.string().optional(),
    // 선택: 태그 (예: [배포, 협업])
    tags: z.array(z.string()).default([]),
    // 선택: 초안이면 true (빌드에서 제외)
    draft: z.boolean().default(false),
    // KPT와 참고 이미지는 프론트매터가 아니라 본문 섹션에 작성합니다.
    // "# Keep / # Problem / # Try" 및 "# 참고 이미지"(불릿으로 경로 나열)
  }),
});

export const collections = { retros };

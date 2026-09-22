# kpt-wiki

하루 KPT(Keep / Problem / Try)를 가볍게 남기는 개인 회고 블로그.

🔗 https://juice119.github.io/kpt/

## 스택

- [Astro](https://astro.build) (static, content collections)
- 회고는 마크다운 파일 하나 = 하루 (`src/content/retros/YYYY-MM-DD.md`)

## 회고 작성

```bash
pnpm retro          # 오늘 회고 작성
pnpm retro -1       # 어제 회고 작성 (offset)
pnpm retro 2026-09-06  # 특정 날짜 회고 작성
```

`scripts/retro.mjs`가 아래를 자동으로 해줌:

- 어제 회고의 미완료 액션 리뷰 (완료 항목 체크)
- 오늘자 GitHub 커밋/PR (`gh search`), TMetric 시간 기록 수집
- 수집한 활동 기반으로 AI가 질문 생성 → 답변 입력받아 회고 마크다운 생성

TMetric 연동은 `env/env.yml`에 `TMetricApiToken` 설정 (또는 실행 시 프롬프트로 입력).

## 회고 파일 포맷

```markdown
---
date: 2026-09-06
title: 짧은 한 줄 제목
tags: [태그1, 태그2]
---

## 오늘 한일
- ...

## 다음 액션
- [ ] ...

# Keep
- ...

# Problem
- ...

# Try
- ...
```

## 개발

```bash
pnpm dev       # 로컬 개발 서버
pnpm build     # 정적 빌드
pnpm preview   # 빌드 결과 미리보기
pnpm test      # 테스트
pnpm check     # biome lint/format
```

## 배포

`main` 브랜치 푸시 시 GitHub Actions(`.github/workflows/deploy.yml`)가 GitHub Pages로 자동 배포.

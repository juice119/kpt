const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const;

/** 요일 (한 글자). date-only 파싱은 UTC 자정이므로 UTC 게터로 일관되게 처리 */
export function koWeekday(d: Date): string {
  return WEEKDAYS[d.getUTCDay()];
}

/** 2026-07-01 → "2026-07-01" (사이트 전역에서 slug/키로 사용) */
export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** "07.01" */
export function shortDate(d: Date): string {
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${m}.${day}`;
}

/** 사이드바 월 그룹 라벨: "2026 · 7월" */
export function monthLabel(d: Date): string {
  return `${d.getUTCFullYear()} · ${d.getUTCMonth() + 1}월`;
}

/** 사이드바 날짜 행 라벨: "01 수" */
export function dayLabel(d: Date): string {
  return `${String(d.getUTCDate()).padStart(2, '0')} ${koWeekday(d)}`;
}

/** BASE_URL을 붙여 GitHub Pages 하위 경로에서도 링크가 깨지지 않게 함 */
export function withBase(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}/${path.replace(/^\//, '')}`;
}

export function homePath(): string {
  return withBase('/');
}

export function retroPath(id: string): string {
  return withBase(`retros/${id}/`);
}

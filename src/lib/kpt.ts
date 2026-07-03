import { marked } from 'marked';

// 본문에서 "# Keep / # Problem / # Try" 섹션을 분리한다.
// 헤딩 레벨(#~######)·대소문자 무시. 헤딩 라인 자체는 버리고(카드 라벨이 대체),
// 그 아래 내용을 해당 섹션의 마크다운으로 취급한다.
const SECTION_RE = /^\s{0,3}#{1,6}\s*(keep|problem|try)\s*$/i;

type SectionKey = 'keep' | 'problem' | 'try';

export interface KptRaw {
  keep: string | null;
  problem: string | null;
  try: string | null;
  rest: string | null; // KPT 헤딩 바깥(주로 도입부) 내용
}

export function splitKpt(body: string | undefined): KptRaw {
  const buckets: Record<SectionKey | 'rest', string[]> = {
    keep: [],
    problem: [],
    try: [],
    rest: [],
  };
  let current: SectionKey | 'rest' = 'rest';

  for (const line of (body ?? '').split(/\r?\n/)) {
    const m = line.match(SECTION_RE);
    if (m) {
      current = m[1].toLowerCase() as SectionKey;
      continue;
    }
    buckets[current].push(line);
  }

  const clean = (arr: string[]): string | null => {
    const s = arr.join('\n').trim();
    return s.length > 0 ? s : null;
  };

  return {
    keep: clean(buckets.keep),
    problem: clean(buckets.problem),
    try: clean(buckets.try),
    rest: clean(buckets.rest),
  };
}

export interface KptHtml {
  keep: string | null;
  problem: string | null;
  try: string | null;
  rest: string | null;
}

function toHtml(s: string | null): string | null {
  return s ? (marked.parse(s, { async: false }) as string) : null;
}

/** 본문을 KPT 섹션별 HTML로 렌더 */
export function renderKpt(body: string | undefined): KptHtml {
  const raw = splitKpt(body);
  return {
    keep: toHtml(raw.keep),
    problem: toHtml(raw.problem),
    try: toHtml(raw.try),
    rest: toHtml(raw.rest),
  };
}

/** 어떤 KPT 섹션이 작성됐는지 (색점 표시용) */
export function kptPresent(body: string | undefined): SectionKey[] {
  const raw = splitKpt(body);
  return (['keep', 'problem', 'try'] as const).filter((k) => raw[k]);
}

/** 최근 회고 요약용 평문 발췌 (마크다운 기호 제거) */
export function plainExcerpt(body: string | undefined, max = 80): string {
  const raw = splitKpt(body);
  const src = raw.keep ?? raw.problem ?? raw.try ?? raw.rest ?? '';
  const text = src
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // 링크는 텍스트만
    .replace(/[#>*_`~]/g, ' ')
    .replace(/^\s*[-]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

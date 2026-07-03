import { marked } from 'marked';

// 본문을 "# Keep / # Problem / # Try / # 참고 이미지" 섹션으로 분리한다.
// 헤딩 레벨(#~######)·대소문자 무시. 알려진 섹션 헤딩만 경계로 취급하고,
// 그 외 헤딩/내용은 현재 섹션(없으면 rest)에 남긴다.
type SectionKey = 'keep' | 'problem' | 'try';
type Bucket = SectionKey | 'images' | 'rest';

/** 헤딩 라인을 알려진 섹션으로 분류. 아니면 null(경계 아님) */
function classifyHeading(line: string): Exclude<Bucket, 'rest'> | null {
  const m = line.match(/^\s{0,3}#{1,6}\s*(.+?)\s*$/);
  if (!m) return null;
  const t = m[1].trim().toLowerCase();
  if (t === 'keep') return 'keep';
  if (t === 'problem') return 'problem';
  if (t === 'try') return 'try';
  if (/^(참고\s*이미지|images?|photos?)$/.test(t)) return 'images';
  return null;
}

export interface KptRaw {
  keep: string | null;
  problem: string | null;
  try: string | null;
  images: string | null; // 참고 이미지 섹션 원본(마크다운)
  rest: string | null; // 알려진 섹션 바깥(주로 도입부)
}

export function splitKpt(body: string | undefined): KptRaw {
  const buckets: Record<Bucket, string[]> = {
    keep: [],
    problem: [],
    try: [],
    images: [],
    rest: [],
  };
  let current: Bucket = 'rest';

  for (const line of (body ?? '').split(/\r?\n/)) {
    const k = classifyHeading(line);
    if (k) {
      current = k;
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
    images: clean(buckets.images),
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

/** 본문을 KPT 섹션별 HTML로 렌더 (이미지 섹션 제외) */
export function renderKpt(body: string | undefined): KptHtml {
  const raw = splitKpt(body);
  return {
    keep: toHtml(raw.keep),
    problem: toHtml(raw.problem),
    try: toHtml(raw.try),
    rest: toHtml(raw.rest),
  };
}

const IMG_EXT_RE = /\.(png|jpe?g|gif|svg|webp|avif)(\?.*)?$/i;

/** "# 참고 이미지" 섹션에서 이미지 경로 목록을 추출 */
export function extractImages(body: string | undefined): string[] {
  const raw = splitKpt(body).images;
  if (!raw) return [];
  const out: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const s = line.trim();
    if (!s) continue;
    // 마크다운 이미지: ![alt](path)
    const img = s.match(/!\[[^\]]*\]\(([^)]+)\)/);
    if (img) {
      out.push(img[1].trim());
      continue;
    }
    // 불릿/일반 라인에서 경로 추출
    const path = s.replace(/^[-*+]\s+/, '').trim();
    if (/^(https?:\/\/|\/|\.\/|data:)/.test(path) || IMG_EXT_RE.test(path)) {
      out.push(path);
    }
  }
  return out;
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

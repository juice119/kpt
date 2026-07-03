import { marked } from "marked";

// 본문을 "# Keep / # Problem / # Try / # 참고 이미지" 섹션으로 분리한다.
// 헤딩 레벨(#~######)·대소문자 무시. 알려진 섹션 헤딩만 경계로 취급하고,
// 그 외 헤딩/내용은 현재 섹션(없으면 rest)에 남긴다.
type SectionKey = "keep" | "problem" | "try";
type Bucket = SectionKey | "images" | "rest";

export type { SectionKey };

export interface KptRaw {
	keep: string | null;
	problem: string | null;
	try: string | null;
	images: string | null; // 참고 이미지 섹션 원본(마크다운)
	rest: string | null; // 알려진 섹션 바깥(주로 도입부)
}

export interface KptHtml {
	keep: string | null;
	problem: string | null;
	try: string | null;
	rest: string | null;
}

/** KPT 회고 본문 파싱·렌더·발췌 */
export class KptDocument {
	private static readonly IMG_EXT_RE =
		/\.(png|jpe?g|gif|svg|webp|avif)(\?.*)?$/i;

	private readonly _raw: KptRaw;

	private constructor(kptRaw: KptRaw) {
		this._raw = kptRaw;
	}

	static fromMdFile(body: string): KptDocument {
		return new KptDocument(KptDocument.parseMDFormate(body));
	}

	/** 본문을 KPT 섹션별 HTML로 렌더 (이미지 섹션 제외) */
	toHtml(): KptHtml {
		return {
			keep: KptDocument.toHtml(this._raw.keep),
			problem: KptDocument.toHtml(this._raw.problem),
			try: KptDocument.toHtml(this._raw.try),
			rest: KptDocument.toHtml(this._raw.rest),
		};
	}

	/** "# 참고 이미지" 섹션에서 이미지 경로 목록을 추출 */
	images(): string[] {
		const section = this._raw.images;
		if (!section) return [];

		const out: string[] = [];

		for (const line of section.split(/\r?\n/)) {
			const s = line.trim();
			if (!s) continue;
			const img = s.match(/!\[[^\]]*\]\(([^)]+)\)/);
			if (img) {
				out.push(img[1].trim());
				continue;
			}
			const path = s.replace(/^[-*+]\s+/, "").trim();
			if (
				/^(https?:\/\/|\/|\.\/|data:)/.test(path) ||
				KptDocument.IMG_EXT_RE.test(path)
			) {
				out.push(path);
			}
		}
		return out;
	}

	/** 어떤 KPT 섹션이 작성됐는지 (색점 표시용) */
	present(): SectionKey[] {
		return (["keep", "problem", "try"] as const).filter((k) => this._raw[k]);
	}

	/** 최근 회고 요약용 평문 발췌 (마크다운 기호 제거) */
	excerpt(max = 80): string {
		const src =
			this._raw.keep ??
			this._raw.problem ??
			this._raw.try ??
			this._raw.rest ??
			"";
		const text = src
			.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
			.replace(/[#>*_`~]/g, " ")
			.replace(/^\s*[-]\s+/gm, "")
			.replace(/\s+/g, " ")
			.trim();
		return text.length > max ? `${text.slice(0, max)}…` : text;
	}

	private static classifyHeading(line: string): Exclude<Bucket, "rest"> | null {
		const m = line.match(/^\s{0,3}#{1,6}\s*(.+?)\s*$/);
		if (!m) return null;
		const t = m[1].trim().toLowerCase();
		if (t === "keep") return "keep";
		if (t === "problem") return "problem";
		if (t === "try") return "try";
		if (/^(참고\s*이미지|images?|photos?)$/.test(t)) return "images";
		return null;
	}

	private static parseMDFormate(body: string | undefined): KptRaw {
		const buckets: Record<Bucket, string[]> = {
			keep: [],
			problem: [],
			try: [],
			images: [],
			rest: [],
		};
		let current: Bucket = "rest";

		for (const line of (body ?? "").split(/\r?\n/)) {
			const k = KptDocument.classifyHeading(line);
			if (k) {
				current = k;
				continue;
			}
			buckets[current].push(line);
		}

		return {
			keep: KptDocument.trim(buckets.keep),
			problem: KptDocument.trim(buckets.problem),
			try: KptDocument.trim(buckets.try),
			images: KptDocument.trim(buckets.images),
			rest: KptDocument.trim(buckets.rest),
		};
	}

	private static trim(arr: string[]): string | null {
		const s = arr.join("\n").trim();
		return s.length > 0 ? s : null;
	}

	private static toHtml(s: string | null): string | null {
		return s ? (marked.parse(s, { async: false }) as string) : null;
	}

	get raw(): KptRaw {
		return this._raw;
	}
}

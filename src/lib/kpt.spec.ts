import { describe, expect, it } from "vitest";
import { KptDocument } from "./kpt";

describe("KptDocument Unit Test", () => {
	describe("fromMdFile", () => {
		it("md파일에서 KptRaw를 추출한다.", () => {
			// given
			const body = getTestMd();

			// when
			const kptDocument = KptDocument.fromMdFile(body);

			// then
			const kptRaw = kptDocument.raw;
			expect(kptRaw.keep).toMatchInlineSnapshot(
				`"- Nodejs 소스 코드 보면서 깊게 분석하고 이해하기"`,
			);
			expect(kptRaw.problem).toMatchInlineSnapshot(
				`"- 외부 일정이 많이서 공부시간을 7시간 23분로 낮게 유지했다."`,
			);
			expect(kptRaw.try).toMatchInlineSnapshot(
				`"- 외부 일정때 공부할 자료 또는 책 들고 다니기"`,
			);
			expect(kptRaw.rest).toMatchInlineSnapshot(`
				"---
				date: 2026-07-03
				title: nodejs 기초 학습 및 KPT 회고 블로그 배포
				tags: [nodejs, github.io]
				---

				nodejs 기초 학습
				KPT 회고 블로그 배포

				## 다음 액션
				- [ ] 들고 다닐 책 정하고 자료는 북마크로 따로 관리하기"
			`);
			expect(kptRaw.images).toMatchInlineSnapshot(`"* /photos/2026-07-03/"`);
		});

		it("빈 md파일이면 모든 KptRaw 값이 null이다.", () => {
			// given
			const body = "";

			// when
			const kptDocument = KptDocument.fromMdFile(body);

			// then
			expect(kptDocument.raw).toEqual({
				keep: null,
				problem: null,
				try: null,
				images: null,
				rest: null,
			});
		});
	});

	describe("toHtml", () => {
		it("KPT 섹션을 html로 렌더링한다.", () => {
			// given
			const body = getTestMd();

			// when
			const kptDocument = KptDocument.fromMdFile(body);
			const kptHtml = kptDocument.toHtml();

			// then
			expect(kptHtml.keep).toMatchInlineSnapshot(`
				"<ul>
				<li>Nodejs 소스 코드 보면서 깊게 분석하고 이해하기</li>
				</ul>
				"
			`);
			expect(kptHtml.problem).toMatchInlineSnapshot(`
				"<ul>
				<li>외부 일정이 많이서 공부시간을 7시간 23분로 낮게 유지했다.</li>
				</ul>
				"
			`);
			expect(kptHtml.try).toMatchInlineSnapshot(`
				"<ul>
				<li>외부 일정때 공부할 자료 또는 책 들고 다니기</li>
				</ul>
				"
			`);
		});

		it("이미지 섹션은 html 결과에 포함하지 않는다.", () => {
			// given
			const body = getTestMd();

			// when
			const kptDocument = KptDocument.fromMdFile(body);
			const kptHtml = kptDocument.toHtml();

			// then
			expect(kptHtml).not.toHaveProperty("images");
		});
	});

	describe("images", () => {
		it("참고 이미지 섹션에서 이미지 경로를 추출한다.", () => {
			// given
			const body = getTestMd();

			// when
			const kptDocument = KptDocument.fromMdFile(body);

			// then
			expect(kptDocument.images()).toEqual(["/photos/2026-07-03/"]);
		});

		it("마크다운 이미지 문법에서 경로를 추출한다.", () => {
			// given
			const body = `
# 참고 이미지
![alt text](./foo.png)
![](https://example.com/bar.jpg)
`;

			// when
			const kptDocument = KptDocument.fromMdFile(body);

			// then
			expect(kptDocument.images()).toEqual([
				"./foo.png",
				"https://example.com/bar.jpg",
			]);
		});

		it("이미지 경로가 없으면 빈 배열을 반환한다.", () => {
			// given
			const body = "# Keep\nkeep";

			// when
			const kptDocument = KptDocument.fromMdFile(body);

			// then
			expect(kptDocument.images()).toEqual([]);
		});
	});

	describe("present", () => {
		it("작성된 KPT 섹션만 반환한다.", () => {
			// given
			const body = getTestMd();

			// when
			const kptDocument = KptDocument.fromMdFile(body);

			// then
			expect(kptDocument.present()).toEqual(["keep", "problem", "try"]);
		});

		it("작성된 KPT 섹션이 없으면 빈 배열을 반환한다.", () => {
			// given
			const body = "그냥 텍스트입니다.";

			// when
			const kptDocument = KptDocument.fromMdFile(body);

			// then
			expect(kptDocument.present()).toEqual([]);
		});
	});

	describe("excerpt", () => {
		it("keep 섹션을 우선해서 평문 발췌를 만든다.", () => {
			// given
			const body = getTestMd();

			// when
			const kptDocument = KptDocument.fromMdFile(body);

			// then
			expect(kptDocument.excerpt()).toMatchInlineSnapshot(
				`"Nodejs 소스 코드 보면서 깊게 분석하고 이해하기"`,
			);
		});

		it("keep이 없으면 problem, try, rest 순서로 발췌 대상을 고른다.", () => {
			// given
			const body = "# Problem\nproblem\n\n# Try\ntry";

			// when
			const kptDocument = KptDocument.fromMdFile(body);

			// then
			expect(kptDocument.excerpt()).toBe("problem");
		});

		it("max 길이를 넘으면 말줄임표를 붙인다.", () => {
			// given
			const body = `# Keep\n${"a".repeat(100)}`;

			// when
			const kptDocument = KptDocument.fromMdFile(body);

			// then
			expect(kptDocument.excerpt(10)).toBe(`${"a".repeat(10)}…`);
		});
	});
});

function getTestMd() {
	return `---
date: 2026-07-03
title: nodejs 기초 학습 및 KPT 회고 블로그 배포
tags: [nodejs, github.io]
---

nodejs 기초 학습
KPT 회고 블로그 배포

## 다음 액션
- [ ] 들고 다닐 책 정하고 자료는 북마크로 따로 관리하기

# Keep
- Nodejs 소스 코드 보면서 깊게 분석하고 이해하기

# Problem
- 외부 일정이 많이서 공부시간을 7시간 23분로 낮게 유지했다.

# Try
- 외부 일정때 공부할 자료 또는 책 들고 다니기

# 참고 이미지
* /photos/2026-07-03/
`;
}

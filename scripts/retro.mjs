#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const retrosDir = path.join(repoRoot, "src/content/retros");

const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => rl.question(q);

function toDateStr(d) {
	return d.toISOString().slice(0, 10);
}

const date = process.argv[2] ?? toDateStr(new Date());
const outFile = path.join(retrosDir, `${date}.md`);

if (existsSync(outFile)) {
	console.error(`이미 존재함: ${outFile}`);
	process.exit(1);
}

function nextDay(dateStr) {
	const d = new Date(`${dateStr}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() + 1);
	return toDateStr(d);
}

function runGh(args) {
	const res = spawnSync("gh", args, { encoding: "utf8" });
	if (res.status !== 0) {
		console.warn(
			`[gh 경고] ${args.join(" ")} 실패: ${res.stderr?.trim() || res.error?.message}`,
		);
		return [];
	}
	try {
		return JSON.parse(res.stdout || "[]");
	} catch {
		console.warn(`[gh 경고] JSON 파싱 실패: ${args.join(" ")}`);
		return [];
	}
}

function fetchCommits(date) {
	const range = `${date}..${date}`;
	const items = runGh([
		"search",
		"commits",
		"--author=@me",
		`--author-date=${range}`,
		"--json",
		"repository,commit",
		"--limit",
		"30",
	]);
	return items.map(
		(c) =>
			`- [${c.repository?.fullName ?? "?"}] ${c.commit?.message?.split("\n")[0] ?? ""}`,
	);
}

function fetchPrs(date) {
	const range = `${date}..${date}`;
	const items = runGh([
		"search",
		"prs",
		"--author=@me",
		`--created=${range}`,
		"--json",
		"title,url,repository,state",
		"--limit",
		"30",
	]);
	return items.map(
		(p) =>
			`- [${p.repository?.fullName ?? "?"}] (${p.state}) ${p.title} ${p.url}`,
	);
}

async function askEnvOrPrompt(envName, label) {
	let value = process.env[envName];
	if (!value) {
		console.log(
			`${envName} 환경변수 없음. (다음부터는 export ${envName}=... 해두면 이 프롬프트 건너뜀)`,
		);
		value = (await ask(`${label}: `)).trim();
	}
	return value;
}

// Toggl 2.0 (Focus) API: https://engineering.toggl.com/docs/focus/
async function fetchToggl(date) {
	const token = await askEnvOrPrompt(
		"TOGGL_API_TOKEN",
		"Toggl API 키 입력 (focus.toggl.com/settings 에서 발급, toggl_sk_...)",
	);
	if (!token) {
		console.warn("[toggl 경고] 토큰 미입력, Toggl 데이터 건너뜀");
		return [];
	}
	const orgId = await askEnvOrPrompt(
		"TOGGL_ORG_ID",
		"Toggl organization_id 입력 (focus.toggl.com 접속 시 URL에서 확인)",
	);
	const workspaceId = await askEnvOrPrompt(
		"TOGGL_WORKSPACE_ID",
		"Toggl workspace_id 입력 (focus.toggl.com 접속 시 URL에서 확인)",
	);
	if (!orgId || !workspaceId) {
		console.warn(
			"[toggl 경고] organization_id/workspace_id 미입력, Toggl 데이터 건너뜀",
		);
		return [];
	}

	const url = `https://focus.toggl.com/api/organizations/${orgId}/workspaces/${workspaceId}/time-entries?date_from=${date}T00:00:00Z&date_to=${nextDay(date)}T00:00:00Z`;
	try {
		const res = await fetch(url, {
			headers: { Authorization: `Bearer ${token}` },
		});
		if (!res.ok) {
			console.warn(
				`[toggl 경고] API 요청 실패: ${res.status} ${res.statusText}`,
			);
			return [];
		}
		const body = await res.json();
		const entries = body.data ?? body;

		return entries.map((e) => {
			const minutes = Math.max(0, Math.round((e.duration ?? 0) / 60));
			const title =
				e.description || e.task?.name || e.project?.name || "(제목 없음)";
			return `- ${title} (${minutes}분)`;
		});
	} catch (err) {
		console.warn(`[toggl 경고] ${err.message}`);
		return [];
	}
}

function callClaude(prompt) {
	const res = spawnSync("claude", ["-p", prompt], {
		encoding: "utf8",
		maxBuffer: 10 * 1024 * 1024,
	});
	if (res.status !== 0) {
		throw new Error(
			`claude 호출 실패: ${res.stderr?.trim() || res.error?.message}`,
		);
	}
	return res.stdout.trim();
}

function stripCodeFence(text) {
	const m = text.match(/^```(?:markdown|md)?\n([\s\S]*?)\n```$/);
	return m ? m[1] : text;
}

async function main() {
	console.log(`오늘(${date}) 활동 수집 중...`);
	const commits = fetchCommits(date);
	const prs = fetchPrs(date);
	const toggl = await fetchToggl(date);

	const summary = [
		"## GitHub 커밋",
		commits.length ? commits.join("\n") : "(없음)",
		"",
		"## GitHub PR",
		prs.length ? prs.join("\n") : "(없음)",
		"",
		"## Toggl 시간 기록",
		toggl.length ? toggl.join("\n") : "(없음)",
	].join("\n");

	console.log("\n--- 오늘 활동 요약 ---");
	console.log(summary);
	console.log("---\n");

	const questionsPrompt = `아래는 개발자의 오늘(${date}) 활동 요약이다. 이 사람이 하루 회고(KPT)를 쓰는 데 도움이 될 짧은 질문을 최대 3개, 한글로 만들어라. 각 질문은 번호를 붙여 한 줄씩만 출력하고 다른 설명은 붙이지 마라.\n\n${summary}`;

	console.log("예상 질문 생성 중 (claude 호출)...");
	const questionsRaw = callClaude(questionsPrompt);
	const questions = questionsRaw
		.split("\n")
		.map((l) => l.replace(/^\s*\d+[.)]\s*/, "").trim())
		.filter(Boolean)
		.slice(0, 3);

	if (questions.length === 0) {
		throw new Error("claude가 질문을 생성하지 못함");
	}

	const qa = [];
	for (const q of questions) {
		const a = await ask(`\n${q}\n> `);
		qa.push({ q, a: a.trim() });
	}
	rl.close();

	const example1 = readFileSync(path.join(retrosDir, "2026-07-11.md"), "utf8");
	const example2 = readFileSync(path.join(retrosDir, "2026-07-13.md"), "utf8");

	const qaText = qa.map(({ q, a }) => `Q: ${q}\nA: ${a}`).join("\n\n");

	const mdPrompt = `아래 형식과 정확히 동일한 구조로 ${date} 날짜의 하루 회고(KPT) 마크다운을 작성하라.

형식 예시 1:
${example1}

형식 예시 2:
${example2}

규칙:
- frontmatter는 date(${date}), title(하루 내용을 요약한 짧은 제목), tags(관련 키워드 배열) 세 개만 사용.
- frontmatter 다음에 그날 한 일을 자유 서술로 몇 줄 요약.
- "## 다음 액션" 섹션에 체크리스트(- [ ] ...) 2~4개.
- "# Keep", "# Problem", "# Try" 섹션(H1, 정확히 이 텍스트)을 순서대로 포함, 각각 불릿 1개 이상.
- 마크다운 본문만 출력하고 코드펜스나 다른 설명은 붙이지 마라.

오늘 활동 요약:
${summary}

사용자가 답변한 질문/답변:
${qaText}`;

	console.log("\n회고 md 생성 중 (claude 호출)...");
	const mdRaw = callClaude(mdPrompt);
	const md = stripCodeFence(mdRaw);

	writeFileSync(outFile, md.endsWith("\n") ? md : `${md}\n`);
	console.log(`\n생성 완료: ${outFile}`);
}

main().catch((err) => {
	rl.close();
	console.error(err.message);
	process.exit(1);
});

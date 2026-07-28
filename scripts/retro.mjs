#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const retrosDir = path.join(repoRoot, "src/content/retros");

const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => rl.question(q);

function loadEnvYml() {
	const file = path.join(repoRoot, "env/env.yml");
	if (!existsSync(file)) return {};
	const env = {};
	for (const line of readFileSync(file, "utf8").split("\n")) {
		const m = line.match(/^\s*([A-Za-z0-9_]+)\s*[:=]\s*(.+?)\s*$/);
		if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
	}
	return env;
}
const envYml = loadEnvYml();

function toDateStr(d) {
	return d.toISOString().slice(0, 10);
}

const arg = process.argv[2];
const isOffset = arg !== undefined && /^-?\d+$/.test(arg);
const date = isOffset
	? toDateStr(new Date(Date.now() + Number(arg) * 86400000))
	: (arg ?? toDateStr(new Date()));
const outFile = path.join(retrosDir, `${date}.md`);

if (existsSync(outFile)) {
	console.error(`이미 존재함: ${outFile}`);
	process.exit(1);
}

function findLatestRetroDate(beforeDate) {
	const dates = readdirSync(retrosDir)
		.map((f) => f.match(/^(\d{4}-\d{2}-\d{2})\.md$/)?.[1])
		.filter((d) => d && d < beforeDate)
		.sort();
	return dates.at(-1) ?? null;
}

function extractActionPoints(md) {
	const m = md.match(/## 다음 액션\n([\s\S]*?)(?:\n#|$)/);
	if (!m) return [];
	return m[1]
		.split("\n")
		.map((l) => l.trim())
		.filter((l) => l.startsWith("- ["));
}

function determineCompletedActions(prevActions, summary, qaText) {
	if (prevActions.length === 0) return [];
	const prompt = `아래는 이전 회고의 "다음 액션" 목록이다. 오늘 활동 요약과 질문/답변을 참고해 오늘 완료된 항목만 골라, 목록에 있는 원문 그대로 한 줄씩 출력하라. 완료된 항목이 없으면 "없음"만 출력하고 다른 설명은 붙이지 마라.

다음 액션 목록:
${prevActions.join("\n")}

오늘 활동 요약:
${summary}

질문/답변:
${qaText}`;
	const raw = callClaude(prompt);
	const lines = raw
		.split("\n")
		.map((l) => l.trim())
		.filter(Boolean);
	return prevActions.filter((a) => lines.includes(a));
}

function markActionsComplete(prevDate, completedActions) {
	if (!prevDate || completedActions.length === 0) return;
	const prevFile = path.join(retrosDir, `${prevDate}.md`);
	let content = readFileSync(prevFile, "utf8");
	for (const action of completedActions) {
		const checked = action.replace("- [ ]", "- [x]");
		content = content.replace(action, checked);
	}
	writeFileSync(prevFile, content);
	console.log(`이전 회고(${prevDate}) 완료 항목 체크: ${completedActions.length}개`);
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

async function askEnvOrPrompt(envName, label, ymlKey) {
	let value = process.env[envName] || (ymlKey && envYml[ymlKey]);
	if (!value) {
		console.log(
			`${envName} 환경변수 없음. (다음부터는 env.yml에 ${ymlKey ?? envName} 적어두면 이 프롬프트 건너뜀)`,
		);
		value = (await ask(`${label}: `)).trim();
	}
	return value;
}

// TMetric API v3: https://app.tmetric.com/api-docs/
async function fetchTmetric(date) {
	const token = await askEnvOrPrompt(
		"TMETRIC_API_TOKEN",
		"TMetric API 토큰 입력 (app.tmetric.com/#/profile 의 'Get new API token'에서 발급)",
		"TMetricApiToken",
	);
	if (!token) {
		console.warn("[tmetric 경고] 토큰 미입력, TMetric 데이터 건너뜀");
		return [];
	}

	const headers = { Authorization: `Bearer ${token}` };
	try {
		const userRes = await fetch("https://app.tmetric.com/api/v3/user", {
			headers,
		});
		if (!userRes.ok) {
			console.warn(
				`[tmetric 경고] 사용자 정보 조회 실패: ${userRes.status} ${userRes.statusText}`,
			);
			return [];
		}
		const { activeAccountId } = await userRes.json();

		const url = `https://app.tmetric.com/api/v3/accounts/${activeAccountId}/timeentries?startDate=${date}&endDate=${date}`;
		const res = await fetch(url, { headers });
		if (!res.ok) {
			console.warn(
				`[tmetric 경고] API 요청 실패: ${res.status} ${res.statusText}`,
			);
			return [];
		}
		const entries = await res.json();

		return entries
			.filter((e) => e.endTime)
			.map((e) => {
				const minutes = Math.max(
					0,
					Math.round((new Date(e.endTime) - new Date(e.startTime)) / 60000),
				);
				const title =
					e.note || e.task?.name || e.project?.name || "(제목 없음)";
				return `- ${title} (${minutes}분)`;
			});
	} catch (err) {
		console.warn(`[tmetric 경고] ${err.message}`);
		return [];
	}
}

function callClaude(prompt) {
	const res = spawnSync("claude", ["-p", prompt, "--tools", ""], {
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
	const tmetric = await fetchTmetric(date);

	const summary = [
		"## GitHub 커밋",
		commits.length ? commits.join("\n") : "(없음)",
		"",
		"## GitHub PR",
		prs.length ? prs.join("\n") : "(없음)",
		"",
		"## TMetric 시간 기록",
		tmetric.length ? tmetric.join("\n") : "(없음)",
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

	const prevDate = findLatestRetroDate(date);
	const prevActions = prevDate
		? extractActionPoints(
				readFileSync(path.join(retrosDir, `${prevDate}.md`), "utf8"),
			)
		: [];

	const qaText = qa.map(({ q, a }) => `Q: ${q}\nA: ${a}`).join("\n\n");

	console.log("이전 회고 완료 항목 판별 중 (claude 호출)...");
	const completedActions = determineCompletedActions(prevActions, summary, qaText);
	markActionsComplete(prevDate, completedActions);
	const remainingActions = prevActions.filter((a) => !completedActions.includes(a));

	const mdPrompt = `아래 형식과 정확히 동일한 구조로 ${date} 날짜의 하루 회고(KPT) 마크다운을 작성하라.

형식 예시 1:
${example1}

형식 예시 2:
${example2}

규칙:
- frontmatter는 date(${date}), title(하루 내용을 요약한 짧은 제목), tags(관련 키워드 배열) 세 개만 사용.
- frontmatter 다음에 그날 한 일을 자유 서술로 몇 줄 요약. "커밋/PR 없는 하루" 같이 없다는 사실 자체를 언급하는 문장은 쓰지 말고, 실제로 한 일 위주로만 서술.
- "## 다음 액션" 섹션에 체크리스트(- [ ] ...) 2~4개. 아래 "이전 회고(${prevDate ?? "없음"})의 미완료 다음 액션"을 이어서 넣어라. 자리가 남으면 오늘 활동에서 새 액션을 추가해라.
- "# Keep", "# Problem", "# Try" 섹션(H1, 정확히 이 텍스트)을 순서대로 포함, 각각 불릿 1개 이상.
- 마크다운 본문만 출력하고 코드펜스나 다른 설명은 붙이지 마라.

이전 회고(${prevDate ?? "없음"})의 미완료 다음 액션:
${remainingActions.length ? remainingActions.join("\n") : "(없음)"}

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

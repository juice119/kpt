interface Window {
	/** 테마를 명시적으로 설정 (BaseLayout의 인라인 스크립트에서 정의) */
	__setTheme?: (theme: "light" | "dark") => void;
	/** 라이트/다크 토글 */
	__toggleTheme?: () => void;
}

# Commit Message Rules

Always generate commit messages using the following rules:

1. Format: `<type>(<scope>): <subject>` (Conventional Commits)
   - Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `build`, `ci`
2. Language: Korean (한국어)
3. Subject:
   - Under 50 characters
   - Imperative mood or noun phrase (e.g., `로그인 로직 수정`, `검색 필터 추가`)
   - Do NOT end with a period (`.`)
4. Body (Optional):
   - Include only when explaining *Why* the change was made, wrapped at 72 chars.

---
name: project-fridge-step3-auth-storage
description: '냉장고를 부탁해' Step 3(레시피 저장) 백엔드의 스토리지/세션 아키텍처 결정 — node:sqlite 선택 이유와 Supabase 마이그레이션 경로
metadata:
  type: project
---

Step 3(회원가입/로그인/레시피 저장) 백엔드를 구현하며 내린 결정들. 코드에서 바로 보이지 않는 "왜"만 정리 — 세부 구현은 lib/repositories, lib/auth, lib/db, app/api/auth/*, app/api/recipes/save 참고.

**스토리지는 SQLite(임시) → Supabase(예정)로 갈 계획**: 사용자가 원래 Supabase를 원했으나 이 세션에서 Supabase MCP 인증(`SUPABASE_ACCESS_TOKEN`)이 안 되어 있어 우선 SQLite로 구현하고, 나중에 쉽게 갈아탈 수 있게 레포지토리 패턴으로 분리했다. 스토리지 선택 자체는 `NOTES_FOR_REVIEW.md`에 확인된 결정으로 기록돼 있음(체크됨).

**SQLite 드라이버는 `node:sqlite`(Node 내장), `better-sqlite3` 아님**: 이 프로젝트는 Windows 개발 환경이고 사용자가 네이티브 빌드 의존성을 명시적으로 피하고 싶어했다. Node 22.5+/24.x에 내장된 `node:sqlite`(DatabaseSync)를 실제로 이 환경(Node v24.15.0)에서 플래그 없이 경고 없이 동작하는지 직접 테스트하고 확인 후 채택 — npm 패키지 추가 없이 해결됨. `@types/node`가 20.x라 타입이 없어서, `@types/node`를 올리는 대신 `types/node-sqlite.d.ts`에 최소 ambient 선언만 추가했다(무관한 의존성 업그레이드 리스크 회피).

**Why:** 매번 이 프로젝트에서 SQLite/네이티브 모듈 관련 작업을 할 때, "better-sqlite3를 쓸까?"로 되돌아가지 않기 위함 — 이미 시도해보고 의도적으로 피한 선택이다.

**How to apply:** 이후 세션에서 SQLite 관련 코드를 만지거나 Supabase 마이그레이션을 실제로 진행할 때: (1) 마이그레이션은 `lib/repositories/types.ts`의 인터페이스(`UserRepository`/`SessionRepository`/`SavedRecipeRepository`)를 구현하는 `lib/repositories/supabase/*`를 새로 만들고 `lib/repositories/index.ts`의 export 세 줄만 바꾸면 된다 — 라우트 핸들러(`app/api/auth/*`, `app/api/recipes/save`)는 손댈 필요 없음. (2) 세션은 httpOnly 쿠키(`fridge_session`)에 랜덤 토큰만 담고 DB에는 SHA-256 해시만 저장하는 방식(`lib/auth/session.ts`) — Supabase Auth로 완전히 갈아탈 경우 이 세션 레이어 자체를 Supabase Auth 세션으로 대체할지, 아니면 커스텀 이메일/비밀번호 인증을 유지한 채 데이터만 Supabase Postgres로 옮길지 사용자와 먼저 확인이 필요하다(둘은 다른 리팩터링 범위).

관련: [냉장고를 부탁해 — env 파일/계약 관례](project_fridge_env_and_contract.md)

# 검증/확인 필요 사항 모음 (자율 진행 중 기록)

사용자가 자리를 비운 동안 확인 없이 자율적으로 진행하면서 내린 판단들을 모아둔 파일입니다. 돌아오시면 한 번에 검토해주세요. 결정이 끝나면 해당 항목을 지우거나 "확인됨"으로 표시해도 됩니다.

## 미해결 / 확인 필요

- [x] **프로젝트 루트의 `openrouter.env`, `openrouter_api_key.env` 파일**: 사용자 확인 완료. `openrouter_api_key.env`가 유효한 키 파일입니다. 미사용 파일 `openrouter.env`는 삭제했습니다.
- [x] **PRD_step3(레시피 저장)의 인증 수단/저장소 — 사용자 직접 확정함**: 처음 자율적으로 "이메일+비밀번호 + SQLite"로 진행했다가 사용자가 두 에이전트를 중단하고 직접 재검토했습니다. 최종 확정: **인증은 이메일+비밀번호 자체 구현**(동일), **저장소는 Supabase(외부 클라우드 DB)** 희망. 단, Supabase MCP가 이 세션에서 아직 인증되지 않아(`SUPABASE_ACCESS_TOKEN` 없음) 프로젝트를 바로 생성할 수 없었습니다. 사용자가 "일단 SQLite로 진행, 나중에 Supabase로 마이그레이션 가능한 구조로 분리"를 선택해 그렇게 재진행 중입니다. **나중에 Supabase 마이그레이션을 원하시면 MCP 인증(개인 액세스 토큰) 설정이 먼저 필요합니다.**
- [ ] **레시피 생성 응답 속도**: `POST /api/recipes/generate`가 DeepSeek 모델 특성상 응답까지 약 15~35초 걸립니다(테스트 중 실측). 사용자 경험상 느린 편이라, 로딩 UX를 더 보강하거나(진행률 안내 등) 더 빠른 모델로 교체할지 검토가 필요할 수 있습니다. 지금은 기능 동작에는 문제없어 그대로 두었습니다.

## 자율적으로 내린 기술 판단 (참고용 — 문제 없으면 별도 조치 불필요)

- **Step 1 비전 모델**: `openai/gpt-4o-mini` (OpenRouter). DeepSeek 계열은 비전 미지원이라 별도 모델 채택. `OPENROUTER_VISION_MODEL` 환경변수로 교체 가능.
- **Step 2 레시피 생성 모델**: `deepseek/deepseek-chat` (OpenRouter). 원래 이 프로젝트에 예정돼 있던 모델이라 채택했고, 품질/비용 모두 양호. 다만 `response_format: json_object`를 안정적으로 지키지 않아(코드펜스로 감싸서 반환) 방어적 파싱 로직을 추가해 대응함. `OPENROUTER_RECIPE_MODEL` 환경변수로 교체 가능.
- **버그 수정(제가 직접 고침)**: 레시피 "조리 순서"가 화면에 "1. 1. 두부를…" 처럼 번호가 중복 표시되는 문제 발견 → `lib/openrouter.ts`의 `parseRecipes()`에서 LLM이 스텝 앞에 붙인 숫자 접두어("1. ", "2)" 등)를 제거하는 정규화 로직(`stripLeadingStepNumber`)을 추가해 해결. 여러 번 재호출로 재발하지 않음을 확인.
- **입력 재료가 아주 적을 때(예: 재료 1개)** LLM이 제공되지 않은 재료명을 요리명에 섞어 쓰는 경향을 llm-integration-expert가 발견 — 시스템 프롬프트에 "제공 재료 최대 활용" 지시를 추가해 완화했으나 완전히 막지는 못함. PRD_step2 범위 내 허용 가능한 수준으로 판단.

## Step 3 (레시피 저장) 백엔드 구현 완료 — curl 스모크 테스트로 확인, 브라우저 미검증

- **SQLite 드라이버 선택**: Node 내장 `node:sqlite`(Node 22.5+/24.x)를 사용. 이 환경(Node v24.15.0)에서는 `--experimental-sqlite` 플래그 없이도 경고 없이 정상 동작함을 직접 확인. `better-sqlite3` 같은 네이티브 모듈을 전혀 설치하지 않아 Windows 네이티브 빌드 이슈 자체가 발생하지 않음. package.json에 새 런타임 의존성 추가 없음.
- **타입 선언**: 프로젝트의 `@types/node`가 20.14.10(node:sqlite 타입 없음)이라, `@types/node`를 올리는 대신 `types/node-sqlite.d.ts`에 사용하는 부분만 최소 ambient 선언을 추가함. (무관한 의존성 업그레이드로 인한 리스크 회피)
- **저장소 추상화**: `lib/repositories/types.ts`에 `UserRepository`/`SessionRepository`/`SavedRecipeRepository` 인터페이스 정의 → `lib/repositories/sqlite/*`가 구현 → `lib/repositories/index.ts`가 실제 사용할 구현체를 선택해서 export. 나중에 Supabase로 옮길 때는 `lib/repositories/supabase/*` 구현체를 추가하고 `index.ts`의 세 줄만 바꾸면 되도록 설계함(라우트 핸들러는 인터페이스만 알고 SQLite를 직접 참조하지 않음). 인터페이스 메서드는 전부 `Promise` 반환으로 선언해서(현재 SQLite 구현은 동기지만) 나중에 네트워크 기반 Supabase 구현으로 바꿔도 호출부 코드가 바뀌지 않도록 함.
- **세션 방식**: httpOnly 쿠키(`fridge_session`, 이름은 임의 선택)에는 32바이트 랜덤 토큰만 담고, DB의 `sessions` 테이블에는 토큰의 SHA-256 해시만 저장(원문 토큰 미저장) — DB가 유출되더라도 그 자체로 세션을 재사용할 수 없도록 함. 세션 TTL은 PRD에 명시가 없어 7일로 임의 설정(재검토 가능한 값). 쿠키는 `httpOnly + SameSite=Lax`, 프로덕션(`NODE_ENV=production`)에서만 `Secure` 플래그 적용(로컬 http 개발 환경 호환).
- **비밀번호 해싱**: 네이티브 의존성 없는 `crypto.scryptSync` + salt(16바이트) + `timingSafeEqual` 비교.
- **레시피 중복 저장 정책(판단)**: FR-1.2("이미 저장됨 표시")는 프론트(`context/SavedRecipesContext.tsx`의 `isSaved()`, 이름 기준 클라이언트 측 판단)에서 이미 처리되고 있어서, 서버는 동일 이름 레시피 중복 저장을 막지 않음(유니크 제약 없음). 저장할 때마다 새 id로 별개 행 생성. 서버 측 강제 중복 방지가 필요하면 추가 논의 필요.
- **삭제 시 소유권 검증**: `DELETE /api/recipes/save?id=`는 `WHERE id = ? AND user_id = ?` 조건으로 한 번에 검증 — id가 존재하지 않는 경우와 다른 사용자 소유인 경우를 구분하지 않고 동일하게 404 처리(정보 노출 방지, IDOR 대응).
- **스모크 테스트 결과**: 회원가입 → 중복가입 거부(409) → me → 로그아웃 → me(null) → 틀린 비밀번호 로그인 거부(401) → 로그인 → 레시피 저장(한글 포함, 라운드트립 바이트 검증 완료) → 목록 조회 → 잘못된 id 삭제(404) → 정상 삭제(200) → 삭제 후 목록 재조회(빈 배열) → 비로그인 상태로 저장/목록/삭제 시도(401) 전부 기대대로 동작. `npx tsc --noEmit` 통과. 단, **실제 브라우저 UI를 통한 검증은 하지 않았음** — AuthDialog/SaveRecipeButton/SavedRecipes 컴포넌트를 눈으로 보고 클릭해보는 확인이 아직 필요함.
- **DB 파일 위치**: `/data/app.db`(+ WAL 보조파일, 로컬 실행 시 자동 생성됨). `.gitignore`에 `/data/`, `*.sqlite`, `*.sqlite3`, `*.db` 추가함.

## 완료되어 실제 브라우저로 검증된 항목

- Step 1: 이미지 업로드 → 미리보기 → 비전 AI 재료 인식(빈 결과 처리 포함) → 수동 추가/삭제 → 목록 확정 — 전체 플로우 실제 동작 확인
- Step 2: 확정된 재료 목록 → "레시피 추천받기" → 실제 DeepSeek 모델 호출 → 레시피 3개(요리명/재료/조리순서/시간/난이도/인분) 카드 표시 → "다른 레시피 추천받기" 재생성 — 전체 플로우 실제 동작 확인
- 두 단계 모두 콘솔 에러 없음(파비콘 404 제외), 타입체크(`tsc --noEmit`) 통과

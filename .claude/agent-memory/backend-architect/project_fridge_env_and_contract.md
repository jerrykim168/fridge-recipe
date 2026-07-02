---
name: project-fridge-env-and-contract
description: '냉장고를 부탁해' 프로젝트에서 실제로 쓰이는 env 파일이 무엇인지, 그리고 frontend-developer와의 API 계약이 어디에 살아있는지
metadata:
  type: project
---

이 프로젝트 루트에는 OpenRouter API 키가 든 파일이 있었는데, 실제로 Next.js 앱이 읽는 것은 `.env.local` 하나뿐이다.
- `.env.local` — Next.js가 자동 로드. `OPENROUTER_API_KEY`, `OPENROUTER_VISION_MODEL`(기본 `openai/gpt-4o-mini`), `OPENROUTER_RECIPE_MODEL`(기본 `deepseek/deepseek-chat`), `OPENROUTER_APP_URL`, `OPENROUTER_APP_TITLE` 보유. 코드가 실제로 참조하는 곳은 여기뿐.
- `openrouter.env` — 미사용 장식용 파일이었음. 사용자가 직접 확인 후 삭제함(2026-07-02 기준 더 이상 존재하지 않음).
- `openrouter_api_key.env` — 여전히 존재. 사용자가 "유효한 키 파일"이라고 확인은 했지만, 어떤 npm 스크립트도 이 파일을 로드하지 않는다는 사실 자체는 변하지 않았다(참고/백업용으로 남겨둔 것으로 보임). 실제 값 갱신은 여전히 `.env.local`에 해야 앱에 반영된다.

**Why:** 파일이 여러 개 있으면 ".env 파일이 있으니 그중 아무거나 맞겠지"라고 가정하기 쉬운데, npm/Next.js가 실제로 로드하는 건 `.env.local` 뿐이다.

**How to apply:** API 키/모델 설정을 바꾸거나 점검할 때는 `.env.local`만 수정하면 된다. `openrouter_api_key.env`는 참고용으로만 열어볼 것, 거기 값을 바꿔도 앱 동작에는 반영되지 않는다는 점을 헷갈리지 말 것. `.gitignore`에 둘 다 등록되어 있어 커밋 걱정은 없음.

---

**FE/BE 계약은 `lib/constants.ts`에 실시간으로 존재한다.** 이 프로젝트는 frontend-developer 에이전트와 backend-architect 에이전트가 동시에 같은 저장소를 편집하는 방식으로 진행된다. `lib/constants.ts`는 frontend가 소유/관리하며 다음을 선언한다: `RECOGNIZE_ENDPOINT`(예: `/api/ingredients/recognize`), `RecognizeSuccess`/`RecognizeError`/`RecognizeResponse` 타입(판별 필드는 `success`), 그리고 업로드 검증 상수(`MAX_FILE_BYTES`, `ACCEPTED_MIME_TYPES` 등).

**Why:** 두 에이전트가 병렬로 작업하므로 파일 내용이 세션 도중에도 바뀔 수 있다. 실제로 작업 중 `lib/constants.ts`와 `app/` 하위 파일들이 frontend-developer에 의해 실시간으로 갱신되는 것을 목격함(예: 이전에 존재하던 `app/api/recognize` 구현이 삭제되고 `lib/constants.ts`에 새 계약 상수가 추가됨).

**How to apply:** 백엔드 라우트를 만들기 전에 항상 `lib/constants.ts`를 먼저 읽어 최신 계약(엔드포인트 경로, 응답 필드명, 검증 상수)을 확인할 것. 이 파일에 정의된 타입/상수를 그대로 import해서 쓰고, 임의로 새 타입을 만들지 말 것. 계약을 변경해야 한다면 frontend 쪽과 조율이 필요하다는 점을 응답에 명시할 것.

관련: 비전 모델은 `openai/gpt-4o-mini`를 기본값으로 사용 (DeepSeek 계열은 비전 미지원이라 PRD_step1.md 5절에 명시됨).

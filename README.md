# 냉장고를 부탁해 🧊

냉장고 사진을 올리면 AI가 식재료를 인식하고 레시피를 추천해주는 서비스입니다. 마음에 든 레시피를 계정에 저장하여 나중에 다시 확인할 수 있습니다.

**배포 주소**: https://study02-opal.vercel.app
**저장소**: https://github.com/jerrykim168/fridge-recipe (main에 push하면 Vercel이 자동 재배포)

## 🌟 주요 기능

### Step 1: 재료 인식 🖼️
- 냉장고 사진 업로드 (JPG/PNG/WEBP, 최대 8MB)
- 비전 AI(`openai/gpt-4o-mini`)로 식재료 자동 인식
- 재료 목록 수동 추가/삭제 가능

### Step 2: 레시피 생성 👨‍🍳
- 확정된 재료 기반 AI 레시피 추천 (3개)
- DeepSeek 모델(`deepseek/deepseek-chat`)로 고품질 레시피 생성
- 요리명, 재료, 조리순서, 예상 시간, 난이도, 인분 정보 제공
- 생성 대기(15~35초) 중 회전 안내 메시지 표시
- "다른 레시피 추천받기"로 새로운 레시피 즉시 재생성

### Step 3: 인증 & 레시피 저장 💾
- 이메일/비밀번호 회원가입(비밀번호 확인 포함)/로그인/로그아웃
- 마음에 드는 레시피를 계정에 저장, 저장 목록 조회/삭제
- httpOnly 세션 쿠키 기반 인증

## 🎨 디자인

파스텔 로즈 팔레트 기반의 프리미엄 톤앤매너로 디자인되어 있습니다 — 웜 블러시/크림 배경, 딥 로즈 프라이머리, 레이어드 섀도우. 모든 색상 조합은 WCAG AA 명도 대비 기준을 충족합니다.

## 🛠️ 기술 스택

- **Frontend**: React 18, Next.js 14 (App Router), TypeScript
- **Backend**: Next.js Route Handlers
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Email/Password 자체 구현 (소셜 로그인 없음)
- **AI/LLM**: OpenRouter API
  - Vision Model: `openai/gpt-4o-mini` (`OPENROUTER_VISION_MODEL`로 교체 가능)
  - Recipe Generation: `deepseek/deepseek-chat` (`OPENROUTER_RECIPE_MODEL`로 교체 가능)
- **Hosting**: Vercel (GitHub 연동 자동 배포)

## 📋 요구사항

- Node.js 20+
- npm
- Supabase 프로젝트
- OpenRouter API 키

## 🚀 로컬 개발 환경 설정

### 1. 저장소 클론 및 의존성 설치
```bash
git clone https://github.com/jerrykim168/fridge-recipe.git
cd fridge-recipe
npm install
```

### 2. 환경변수 설정

`.env.example`을 복사해 `.env.local`을 만들고 값을 채웁니다.
```bash
cp .env.example .env.local
```

```env
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
OPENROUTER_VISION_MODEL=openai/gpt-4o-mini
OPENROUTER_RECIPE_MODEL=deepseek/deepseek-chat
OPENROUTER_APP_URL=http://localhost:3000
OPENROUTER_APP_TITLE=냉장고를 부탁해

SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

- **OpenRouter API 키**: https://openrouter.ai/keys
- **Supabase URL/키**: 프로젝트 대시보드 → Settings → API (`SERVICE_ROLE_KEY`는 RLS를 우회하므로 서버 전용 — 절대 클라이언트에 노출하지 마세요)

### 3. Supabase 테이블 생성

Supabase 대시보드의 SQL 에디터에서 실행합니다.

```sql
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at BIGINT NOT NULL,
  created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

CREATE TABLE IF NOT EXISTS saved_recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  ingredients JSONB NOT NULL,
  steps JSONB NOT NULL,
  estimated_time TEXT NOT NULL,
  difficulty TEXT,
  servings TEXT,
  saved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_recipes_user_id ON saved_recipes(user_id);
```

### 4. 개발 서버 실행
```bash
npm run dev
```
브라우저에서 `http://localhost:3000` 접속.

## 📁 프로젝트 구조

```
├── app/
│   ├── page.tsx                       # 메인 페이지 (Step 1/2 UI 전체)
│   ├── layout.tsx / providers.tsx
│   ├── globals.css / page.module.css
│   └── api/
│       ├── auth/{signup,login,logout,me}/route.ts
│       ├── ingredients/recognize/route.ts   # Step 1: 비전 AI 호출
│       └── recipes/{generate,save}/route.ts # Step 2/3
├── components/
│   ├── AuthBar.tsx / AuthDialog.tsx          # 로그인 상태 표시 / 인증 모달
│   ├── SaveRecipeButton.tsx / SavedRecipes.tsx
│   └── step3.module.css
├── context/
│   ├── AuthContext.tsx                       # 전역 인증 상태 + 다이얼로그 제어
│   └── SavedRecipesContext.tsx
├── lib/
│   ├── repositories/                         # 데이터 접근 계층 (추상화)
│   │   ├── types.ts                         # 인터페이스 정의
│   │   ├── supabase/                        # 실제 사용 중인 구현체
│   │   ├── sqlite/                          # 이전 구현체 (참고/롤백용, 미사용)
│   │   └── index.ts                         # 실사용 구현체 선택 (3줄)
│   ├── db/supabase.ts                        # Supabase 클라이언트
│   ├── auth/{password,session,validate}.ts
│   ├── security/rateLimit.ts                 # 로그인/API rate limiting
│   ├── recipes/validate.ts
│   ├── openrouter.ts                         # OpenRouter API 통합, 응답 파싱
│   └── constants.ts                          # 프론트-백엔드 공유 타입/엔드포인트
├── .env.example
└── README.md
```

## 🔒 보안

- **비밀번호**: `crypto.scryptSync` + salt + `timingSafeEqual`로 해싱/검증
- **로그인 타이밍 사이드채널 방지**: 존재하지 않는 이메일도 항상 동일한 연산을 수행해 계정 존재 여부가 응답 시간으로 드러나지 않음
- **세션**: httpOnly 쿠키 + DB에는 토큰의 SHA-256 해시만 저장 (원문 토큰 미저장), 프로덕션에서 `Secure` 플래그 적용
- **브라우저 자동완성 차단**: 로그인 모달에 숨김 decoy 필드를 두어, 이전 사용자의 이메일/비밀번호가 다음 사용자에게 자동완성되는 것을 방지 (공유 PC 환경 고려)
- **Rate limiting**: 로그인/회원가입/이미지 인식/레시피 생성 API에 분당 요청 제한. `X-Forwarded-For`의 마지막 항목(Vercel 엣지가 부여하는 신뢰 가능한 값)을 기준으로 판별해 IP 스푸핑으로 우회 불가
- **데이터 접근 제어(IDOR 방지)**: 삭제 API는 `id`와 `user_id`를 함께 검증하며, 존재하지 않는 id와 타인 소유 id를 동일하게 처리해 정보 노출 방지
- **비밀 관리**: API 키/DB 자격증명은 전부 환경변수, `.gitignore`로 로컬 시크릿 파일 전체 차단

## 🧪 테스트

```bash
npx tsc --noEmit   # 타입 체크
npm run dev        # 개발 서버 실행 후 수동 테스트
```

**수동 테스트 순서** (배포본 https://study02-opal.vercel.app 에서 실제 검증 완료):
1. 회원가입 → 로그인 → 로그아웃 → 다시 로그인
2. 냉장고 사진 업로드 → 재료 인식 → 목록 수동 수정
3. "레시피 추천받기" → 생성된 레시피 확인
4. 레시피 "저장" → "저장한 레시피" 목록에서 확인 → 삭제

## ⚡ 성능 고려사항

- **레시피 생성 응답 시간**: 약 15~35초 (DeepSeek 모델 특성). 대기 중 회전 안내 메시지로 체감 대기시간 완화.
- 더 빠른 응답이 필요하면 `OPENROUTER_RECIPE_MODEL`을 더 빠른 모델로 교체하거나, 스트리밍 응답 도입을 고려할 수 있음 (현재는 미적용).

## 🔄 아키텍처 특징

### 저장소 추상화
데이터 접근 계층을 인터페이스(`lib/repositories/types.ts`)로 추상화:
- 실사용 구현체는 `lib/repositories/supabase/*`, `lib/repositories/index.ts`의 3줄만 바꾸면 다른 저장소로 교체 가능
- `lib/repositories/sqlite/*`는 마이그레이션 이전 구현체로, 롤백/참고용으로만 남아있고 실제로는 사용되지 않음
- 모든 인터페이스 메서드가 `Promise` 반환이라 동기(SQLite)/비동기(Supabase) 구현 모두 호출부 변경 없이 사용 가능

## 🚀 배포

Vercel 프로젝트가 GitHub 저장소와 연결되어 있어 **`main` 브랜치에 push하면 자동으로 재배포**됩니다.

수동으로 배포하려면:
```bash
vercel link      # 최초 1회, 프로젝트 연결
vercel env add <NAME> production   # 환경변수 8개 각각 설정 (.env.local 참고)
vercel deploy --prod
```

## 📝 라이선스

MIT License

## 🙏 감사의 말

- **OpenRouter**: 비전 AI와 레시피 생성 모델 제공
- **Supabase**: 클라우드 데이터베이스 및 인증 지원
- **Vercel**: 호스팅 및 자동 배포

---

**마지막 업데이트**: 2026-07-03
**현재 상태**: Step 1~3 전체 구현 및 프로덕션 배포 완료, 실사용 검증 완료

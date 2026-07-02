# 냉장고를 부탁해 🧊

냉장고 사진을 올리면 AI가 식재료를 인식하고 레시피를 추천해주는 서비스입니다. 마음에 든 레시피를 계정에 저장하여 나중에 다시 확인할 수 있습니다.

## 🌟 주요 기능

### Step 1: 재료 인식 🖼️
- 냉장고 사진 업로드
- 비전 AI(GPT-4o-mini)로 식재료 자동 인식
- 재료 목록 수동 추가/삭제 가능

### Step 2: 레시피 생성 👨‍🍳
- 선택한 재료 기반 AI 레시피 추천
- DeepSeek 모델로 고품질 레시피 생성
- 요리명, 재료, 조리순서, 예상 시간, 난이도, 인분 정보 제공
- "다른 레시피 추천받기"로 새로운 레시피 즉시 생성

### Step 3: 레시피 저장 💾
- 이메일/비밀번호 회원가입/로그인
- 마음에 드는 레시피 계정에 저장
- 저장된 레시피 목록 조회
- 저장된 레시피 상세 보기 및 삭제

## 🛠️ 기술 스택

- **Frontend**: React 18, Next.js 14, TypeScript
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Email/Password (자체 구현)
- **AI/LLM**: OpenRouter API
  - Vision Model: `openai/gpt-4o-mini`
  - Recipe Generation: `deepseek/deepseek-chat`

## 📋 요구사항

- Node.js 22.5+ (SQLite 지원을 위해)
- npm 또는 yarn
- Supabase 계정 및 프로젝트
- OpenRouter API 키

## 🚀 설치 및 실행

### 1. 저장소 클론
```bash
git clone https://github.com/jerrykim168/fridge-recipe.git
cd fridge-recipe
```

### 2. 의존성 설치
```bash
npm install
```

### 3. 환경변수 설정

`.env.local` 파일을 프로젝트 루트에 생성하고 다음 정보를 입력하세요:

```env
# OpenRouter API 설정
OPENROUTER_API_KEY=your_openrouter_api_key
OPENROUTER_VISION_MODEL=openai/gpt-4o-mini
OPENROUTER_RECIPE_MODEL=deepseek/deepseek-chat
OPENROUTER_APP_URL=http://localhost:3000
OPENROUTER_APP_TITLE=냉장고를 부탁해

# Supabase 설정
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

**환경변수 얻는 방법:**

- **OpenRouter API**: https://openrouter.ai/keys
- **Supabase**:
  - Project URL: Supabase 대시보드 → Settings → API
  - Keys: 같은 페이지의 "Project API keys" 섹션

### 4. Supabase 테이블 생성

Supabase 대시보드의 SQL 에디터에서 다음을 실행하세요:

```sql
-- users 테이블
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- sessions 테이블
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at BIGINT NOT NULL,
  created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

-- saved_recipes 테이블
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

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_recipes_user_id ON saved_recipes(user_id);
```

### 5. 개발 서버 실행
```bash
npm run dev
```

브라우저에서 `http://localhost:3000` 접속

## 📁 프로젝트 구조

```
fridge-recipe/
├── app/                      # Next.js App Router
│   ├── page.tsx             # 메인 페이지
│   ├── auth/                # 인증 API
│   └── api/recipes/         # 레시피 API
├── components/              # React 컴포넌트
│   ├── ImageUpload.tsx
│   ├── IngredientsList.tsx
│   ├── RecipeCard.tsx
│   ├── AuthDialog.tsx
│   └── SavedRecipes.tsx
├── context/                 # React Context
│   ├── IngredientsContext.tsx
│   └── SavedRecipesContext.tsx
├── lib/
│   ├── repositories/        # 데이터 접근 계층 (추상화)
│   │   ├── supabase/       # Supabase 구현
│   │   ├── sqlite/         # SQLite 구현 (참고용)
│   │   └── types.ts        # 인터페이스
│   ├── db/
│   │   └── supabase.ts      # Supabase 클라이언트
│   ├── openrouter.ts        # OpenRouter API 통합
│   └── auth/
│       └── password.ts      # 비밀번호 해싱
├── .env.local              # 환경변수 (로컬만, 커밋 X)
└── README.md
```

## 🔒 보안

- ✅ **비밀번호**: crypto.scryptSync로 안전하게 해싱 (salt + 32byte hash)
- ✅ **세션**: httpOnly 쿠키 + SHA-256 해시 저장 (원문 토큰 미저장)
- ✅ **API 키**: 환경변수로 관리, `.gitignore`에 `.env.local` 포함
- ✅ **데이터 접근 제어**: 사용자는 본인 데이터만 조회/삭제 가능

## 🧪 테스트

```bash
# 타입 체크
npx tsc --noEmit

# 개발 서버 실행 및 수동 테스트
npm run dev
```

**수동 테스트 순서:**
1. 회원가입 후 로그인
2. 냉장고 사진 업로드 (또는 샘플 이미지)
3. 재료 목록 확인 및 수정
4. "레시피 추천받기" 클릭
5. 나온 레시피 "저장" 버튼으로 저장
6. 프로필 → "저장한 레시피" 확인
7. 저장된 레시피 삭제

## 📊 성능 고려사항

- **레시피 생성 응답 시간**: 약 15~35초 (DeepSeek 모델 특성)
  - 로딩 중 안내 메시지 및 애니메이션 표시

## 🔄 아키텍처 특징

### 저장소 추상화
데이터 접근 계층을 인터페이스로 추상화하여:
- 저장소 구현체 교체 용이 (SQLite ↔ Supabase)
- 라우트 핸들러는 구현 세부사항 미인식
- 마이그레이션 시 `lib/repositories/index.ts`의 3줄만 수정

### 비동기 설계
모든 저장소 메서드를 `async`로 선언:
- SQLite 구현: 동기 래퍼 → Promise 반환
- Supabase 구현: 네트워크 기반 비동기 호출
- 호출부 코드 변경 없음

## 🚀 배포

### Vercel 배포
```bash
vercel
```

Vercel이 환경변수를 관리합니다.

### 다른 호스팅
Node.js 22.5+를 지원하는 환경에서 실행 가능합니다.

## 📝 라이선스

MIT License

## 📧 문의

[이메일 주소 또는 이슈 링크]

## 🙏 감사의 말

- **OpenRouter**: 비전 AI와 레시피 생성 모델 제공
- **Supabase**: 클라우드 데이터베이스 및 인증 지원

---

**마지막 업데이트**: 2026-07-02  
**현재 상태**: Step 1-3 모두 구현 완료, Supabase 마이그레이션 완료

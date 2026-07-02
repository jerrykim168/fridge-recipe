---
name: project-fridge-signup-password-confirm
description: '냉장고를 부탁해' signup API에 passwordConfirm 서버사이드 검증을 추가한 결정과 아직 남은 FE 연동 갭
metadata:
  type: project
---

`app/api/auth/signup/route.ts`에 `passwordConfirm` 서버사이드 일치 검증을 추가했다(2026-07-02). `lib/constants.ts`의 `SignupRequest` 타입에 `passwordConfirm: string` 필드를 추가해 계약을 변경함 — 이 파일 상단 주석은 "owned by backend-architect"이므로 auth 타입은 backend-architect가 직접 편집 가능한 영역으로 판단하고 진행함(단, [[project-fridge-env-and-contract]]에 기록된 대로 "do not rename fields/endpoints without coordinating" 원칙은 유지 — 필드 추가는 하위 호환이라 확인 없이 진행, rename/삭제였다면 조율 필요했을 것).

**Why:** 클라이언트 검증은 우회 가능(curl 등)하므로 비밀번호 확인 일치 여부는 반드시 서버에서도 재검증해야 한다는 게 이번 요청의 핵심. 검증 순서는 이메일 형식 → 비밀번호 길이 → 비밀번호 일치 → DB 중복 조회(가장 비싼 연산을 마지막에 배치).

**How to apply:** 이 시점(2026-07-02) 기준 `app/`에는 아직 회원가입 폼 UI가 없다(grep 결과 `signup`을 참조하는 프론트엔드 컴포넌트가 없음) — frontend-developer가 회원가입 폼을 만들 때 반드시 `passwordConfirm` 필드를 요청 바디에 포함해야 함, 안 그러면 서버가 항상 400을 반환한다. 이 갭이 남아있는지 다음 세션에서 프론트엔드 작업 시 확인할 것.

관련: [[project-fridge-step3-auth-storage]], [[project-fridge-env-and-contract]]

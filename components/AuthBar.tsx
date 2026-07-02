"use client";

// Top-of-page auth status bar: shows the signed-in email + logout, or
// login/signup entry points when logged out.

import { useAuth } from "@/context/AuthContext";
import page from "@/app/page.module.css";
import s from "./step3.module.css";

export default function AuthBar() {
  const { user, ready, logout, openAuthDialog } = useAuth();

  return (
    <div className={s.authBar}>
      {/* Announce sign-in state changes to screen readers. */}
      <span aria-live="polite" className="visually-hidden">
        {ready && user ? `${user.email} 님으로 로그인되었습니다.` : ""}
        {ready && !user ? "로그아웃 상태입니다." : ""}
      </span>

      {!ready ? (
        // Reserve height to avoid layout shift while /me resolves.
        <span className={s.authInfo} aria-hidden="true">
          &nbsp;
        </span>
      ) : user ? (
        <>
          <span className={s.authInfo}>
            <span className={s.authAvatar} aria-hidden="true">
              👤
            </span>
            <span className={s.authEmail} title={user.email}>
              {user.email}
            </span>
          </span>
          <button
            type="button"
            className={`${page.btn} ${page.btnSecondary} ${s.authBtn}`}
            onClick={() => void logout()}
          >
            로그아웃
          </button>
        </>
      ) : (
        <>
          <span className={s.authInfo}>레시피를 저장하려면 로그인하세요</span>
          <span className={s.authActions}>
            <button
              type="button"
              className={`${page.btn} ${page.btnSecondary} ${s.authBtn}`}
              onClick={() => openAuthDialog("login")}
            >
              로그인
            </button>
            <button
              type="button"
              className={`${page.btn} ${page.btnPrimary} ${s.authBtn}`}
              onClick={() => openAuthDialog("signup")}
            >
              회원가입
            </button>
          </span>
        </>
      )}
    </div>
  );
}

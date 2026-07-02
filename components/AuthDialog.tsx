"use client";

// Accessible modal for email + password login / signup (no social login).
// A single instance is rendered by Providers; opened via useAuth().openAuthDialog.

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { useAuth, type AuthMode } from "@/context/AuthContext";
import { MIN_PASSWORD_LENGTH } from "@/lib/constants";
import page from "@/app/page.module.css";
import s from "./step3.module.css";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function AuthDialog() {
  const { dialogOpen, dialogMode, closeAuthDialog, login, signup } = useAuth();
  const [mode, setMode] = useState<AuthMode>(dialogMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const panelRef = useRef<HTMLDivElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  // Element focused before the dialog opened, so we can restore it on close.
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  const titleId = useId();
  const emailId = useId();
  const passwordId = useId();
  const passwordConfirmId = useId();
  const confirmFeedbackId = useId();
  const errorId = useId();

  // Empty every field. Called on open, on tab/mode switch, and after success —
  // so a previous user's credentials never linger in the inputs.
  const resetForm = useCallback(() => {
    setEmail("");
    setPassword("");
    setPasswordConfirm("");
    setError("");
  }, []);

  // Sync local mode with the mode the opener requested, and start from a clean
  // form each time the dialog opens. Chrome's saved-password manager ignores
  // autocomplete="off" and autofills the (empty, controlled) inputs shortly
  // after mount regardless of our reset above, so re-clear once more on the
  // next tick to override whatever the browser just filled in.
  useEffect(() => {
    if (dialogOpen) {
      setMode(dialogMode);
      resetForm();
      const t = window.setTimeout(resetForm, 60);
      return () => window.clearTimeout(t);
    }
  }, [dialogOpen, dialogMode, resetForm]);

  // Focus management: remember the trigger, focus the first field on open,
  // restore focus on close.
  useEffect(() => {
    if (dialogOpen) {
      restoreFocusRef.current = document.activeElement as HTMLElement | null;
      // Defer to ensure the field is mounted.
      const t = window.setTimeout(() => emailRef.current?.focus(), 0);
      return () => window.clearTimeout(t);
    }
    restoreFocusRef.current?.focus?.();
  }, [dialogOpen]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeAuthDialog();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      // Simple focus trap.
      const nodes = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((el) => el.offsetParent !== null);
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [closeAuthDialog],
  );

  const switchMode = (next: AuthMode) => {
    setMode(next);
    // Clear all fields on tab switch so credentials typed in one mode don't
    // carry over into the other (and reset the confirm-password feedback).
    resetForm();
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    if (!EMAIL_RE.test(trimmedEmail)) {
      setError("올바른 이메일 주소를 입력해 주세요.");
      emailRef.current?.focus();
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`비밀번호는 최소 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`);
      return;
    }
    if (mode === "signup" && password !== passwordConfirm) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }
    setSubmitting(true);
    setError("");
    const result =
      mode === "login"
        ? await login(trimmedEmail, password)
        : await signup(trimmedEmail, password, passwordConfirm);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error || "요청을 처리하지 못했습니다.");
      return;
    }
    // Success: parent closes the dialog once `user` is set; reset local fields.
    resetForm();
  };

  if (!dialogOpen) return null;

  const isLogin = mode === "login";

  // Confirm-password state (signup only). Feedback stays hidden while the
  // confirm field is empty; otherwise it reports match / mismatch live.
  const confirmTouched = passwordConfirm.length > 0;
  const passwordsMatch = password === passwordConfirm;
  const showMismatch = !isLogin && confirmTouched && !passwordsMatch;
  // Block signup submission until the confirm field is non-empty and matches.
  const signupBlocked = !isLogin && (!confirmTouched || !passwordsMatch);

  return (
    <div
      className={s.backdrop}
      onMouseDown={(e) => {
        // Close only when the backdrop itself (not the panel) is clicked.
        if (e.target === e.currentTarget) closeAuthDialog();
      }}
    >
      <div
        ref={panelRef}
        className={s.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={onKeyDown}
      >
        <div className={s.dialogHeader}>
          <h2 id={titleId} className={s.dialogTitle}>
            {isLogin ? "로그인" : "회원가입"}
          </h2>
          <button
            type="button"
            className={s.dialogClose}
            onClick={closeAuthDialog}
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        <div className={s.tabs} role="tablist" aria-label="인증 방식 선택">
          <button
            type="button"
            role="tab"
            aria-selected={isLogin}
            className={`${s.tab} ${isLogin ? s.tabActive : ""}`}
            onClick={() => switchMode("login")}
          >
            로그인
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={!isLogin}
            className={`${s.tab} ${!isLogin ? s.tabActive : ""}`}
            onClick={() => switchMode("signup")}
          >
            회원가입
          </button>
        </div>

        <form className={s.form} onSubmit={onSubmit} noValidate>
          {/* Decoy fields: Chrome's password manager ignores autocomplete="off"
              on the real fields below and autofills them anyway. Browsers
              generally autofill the *first* matching username/password pair
              in the form, so these absorb that instead. Hidden from sighted
              users and screen readers alike; never read from. */}
          <input
            type="text"
            name="username"
            autoComplete="username"
            className="visually-hidden"
            aria-hidden="true"
            tabIndex={-1}
            defaultValue=""
          />
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            className="visually-hidden"
            aria-hidden="true"
            tabIndex={-1}
            defaultValue=""
          />

          <div className={s.field}>
            <label htmlFor={emailId} className={s.label}>
              이메일
            </label>
            <input
              ref={emailRef}
              id={emailId}
              className={page.input}
              type="email"
              inputMode="email"
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              placeholder="you@example.com"
              required
            />
          </div>

          <div className={s.field}>
            <label htmlFor={passwordId} className={s.label}>
              비밀번호
            </label>
            <input
              id={passwordId}
              className={page.input}
              type="password"
              autoComplete={isLogin ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              placeholder={`최소 ${MIN_PASSWORD_LENGTH}자`}
              minLength={MIN_PASSWORD_LENGTH}
              required
            />
          </div>

          {!isLogin && (
            <div className={s.field}>
              <label htmlFor={passwordConfirmId} className={s.label}>
                비밀번호 확인
              </label>
              <input
                id={passwordConfirmId}
                className={page.input}
                type="password"
                autoComplete="new-password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                aria-invalid={showMismatch ? true : undefined}
                aria-describedby={
                  confirmTouched ? confirmFeedbackId : undefined
                }
                placeholder="비밀번호를 다시 입력하세요"
                required
              />
              {/* Live match feedback; aria-live so screen readers hear it.
                  Hidden entirely while the field is empty. */}
              {confirmTouched && (
                <p
                  id={confirmFeedbackId}
                  className={`${s.matchHint} ${
                    passwordsMatch ? s.matchOk : s.matchError
                  }`}
                  aria-live="polite"
                >
                  {passwordsMatch ? (
                    <>
                      <span aria-hidden="true">✅</span> 비밀번호가 일치합니다
                    </>
                  ) : (
                    <>
                      <span aria-hidden="true">❌</span> 비밀번호가 일치하지
                      않습니다
                    </>
                  )}
                </p>
              )}
            </div>
          )}

          {error && (
            <p id={errorId} className={page.error} role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            className={`${page.btn} ${page.btnPrimary} ${s.fullWidth}`}
            disabled={submitting || signupBlocked}
          >
            {submitting ? (
              <span className={s.btnLoading}>
                <span className={page.spinner} aria-hidden="true" />
                처리 중…
              </span>
            ) : isLogin ? (
              "로그인"
            ) : (
              "회원가입"
            )}
          </button>
        </form>

        <p className={s.switchHint}>
          {isLogin ? "아직 계정이 없으신가요? " : "이미 계정이 있으신가요? "}
          <button
            type="button"
            className={s.linkBtn}
            onClick={() => switchMode(isLogin ? "signup" : "login")}
          >
            {isLogin ? "회원가입" : "로그인"}
          </button>
        </p>
      </div>
    </div>
  );
}

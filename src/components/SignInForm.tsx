"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { IconArrow, IconCheck, IconGoogle } from "@/components/icons";
import { useI18n } from "@/components/LanguageProvider";
import { safeRedirectClient } from "@/lib/redirect-client";

function FormInner() {
  const { dict } = useI18n();
  const a = dict.auth;
  const router = useRouter();
  const params = useSearchParams();
  const next = safeRedirectClient(params.get("next"), "/account");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [phase, setPhase] = useState<"email" | "code" | "done">("email");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(() => {
    const queryError = params.get("error");
    if (queryError === "google_unavailable") return "Google sign-in is not configured. Use an email code.";
    return queryError ? "Sign-in link was invalid or expired. Request a new code." : null;
  });
  const [devCode, setDevCode] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function requestCode(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError(a.invalidEmail);
      return;
    }
    setWorking(true);
    const res = await fetch("/api/auth/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), next }),
    });
    const data = await res.json();
    setWorking(false);
    if (!res.ok) {
      setError(data?.error ?? a.failed);
      return;
    }
    setPhase("code");
    setCooldown(20);
    if (data.devCode) setDevCode(data.devCode);
  }

  async function verify(credential: string) {
    setError(null);
    setWorking(true);
    const res = await fetch("/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential: credential.trim(), email: email.trim(), next }),
    });
    const data = await res.json();
    setWorking(false);
    if (!res.ok) {
      setError(data?.error ?? a.failed);
      return;
    }
    setPhase("done");
    setTimeout(() => router.refresh(), 200);
    setTimeout(() => router.push(data.next ?? next), 550);
  }

  if (phase === "done") {
    return (
      <div className="success-burst flex flex-col items-center gap-4 py-10 text-center">
        <span className="toast-check grid h-14 w-14 place-items-center rounded-full bg-success text-white">
          <IconCheck size={26} />
        </span>
        <div>
          <p className="font-serif text-2xl">{a.confirmed}</p>
          <p className="mt-1 text-sm text-muted-ink">{a.takingYou}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {phase === "email" ? (
        <form onSubmit={requestCode} className="space-y-4">
          <div>
            <label className="field-label" htmlFor="email">
              {a.email}
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className="input"
              placeholder={a.emailPlaceholder}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          {error && <ErrorBox>{error}</ErrorBox>}
          <button type="submit" disabled={working} className="btn btn-primary btn-lg btn-block">
            {working ? <Spinner /> : <>
              {a.emailButton}
              <IconArrow size={16} className="arrow" />
            </>}
          </button>
          <p className="text-center text-xs text-muted">
            We&apos;ll email a 6-digit code and a one-tap sign-in link. No password.
          </p>
        </form>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void verify(code);
          }}
          className="space-y-4"
        >
          <p className="text-sm text-muted-ink">
            Code sent to <strong className="text-ink">{email}</strong>.
          </p>
          <div>
            <label className="field-label">6-digit code</label>
            <input
              inputMode="numeric"
              maxLength={6}
              autoFocus
              className="input text-center font-mono text-2xl tracking-[0.6em]"
              placeholder="••••••"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            />
          </div>
          {devCode && (
            <p className="rounded-lg border border-dashed border-bronze/40 bg-amber-soft px-3.5 py-2 text-center text-xs text-bronze-deep">
              Preview inbox: your code is <strong className="font-mono text-sm">{devCode}</strong>
            </p>
          )}
          {error && <ErrorBox>{error}</ErrorBox>}
          <button type="submit" disabled={working || code.length !== 6} className="btn btn-primary btn-lg btn-block">
            {working ? <Spinner /> : a.confirmed.replace(".", "")}
          </button>
          <div className="flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => setPhase("email")}
              className="font-semibold text-espresso hover:underline"
            >
              ← Change email
            </button>
            <button
              type="button"
              disabled={cooldown > 0 || working}
              onClick={() => requestCode()}
              className="font-semibold text-espresso hover:underline disabled:text-faint"
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
            </button>
          </div>
        </form>
      )}

      <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-faint">
        <span className="h-px flex-1 bg-line" /> {a.or} <span className="h-px flex-1 bg-line" />
      </div>

      <a href={`/api/auth/google?next=${encodeURIComponent(next)}`} className="btn btn-outline btn-lg btn-block">
        <IconGoogle size={18} /> {a.google}
      </a>

      <p className="mt-5 rounded-lg bg-info-soft/60 px-4 py-3 text-[0.7rem] leading-relaxed text-info">
        {a.previewNote}
      </p>
      <p className="mt-3 text-center text-xs text-muted">
        {a.acceptA}{" "}
        <Link href="/terms" className="underline-offset-2 hover:underline">{a.terms}</Link>{" "}
        {a.and}{" "}
        <Link href="/privacy" className="underline-offset-2 hover:underline">{a.privacy}</Link>.
      </p>
    </div>
  );
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="rounded-lg bg-oxblood-soft px-3.5 py-2.5 text-sm font-medium text-oxblood">
      {children}
    </p>
  );
}
function Spinner() {
  return <span className="spinner" style={{ width: 16, height: 16 }} />;
}

export function SignInForm() {
  return (
    <Suspense
      fallback={
        <div className="grid place-items-center py-10">
          <span className="spinner text-bronze" />
        </div>
      }
    >
      <FormInner />
    </Suspense>
  );
}

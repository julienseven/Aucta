"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/components/LanguageProvider";

export function SignOutButton({ className = "" }: { className?: string }) {
  const router = useRouter();
  const { dict } = useI18n();
  const [working, setWorking] = useState(false);

  async function signOut() {
    setWorking(true);
    await fetch("/api/session", { method: "DELETE" });
    router.push("/");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={working}
      className={`btn btn-outline ${className}`}
    >
      {working ? (
        <>
          <span className="spinner" style={{ width: 15, height: 15 }} />
          {dict.auth.signingOut}
        </>
      ) : (
        dict.auth.signOut
      )}
    </button>
  );
}

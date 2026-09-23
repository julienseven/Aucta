"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/LanguageProvider";
import { useToast } from "@/components/Toast";
import { IconClose, IconFlag } from "@/components/icons";

export function ReportDialog({
  target,
  signedIn,
  variant = "lot",
  className = "",
}: {
  target: { lotId?: string; sellerId?: string };
  signedIn: boolean;
  variant?: "lot" | "seller";
  className?: string;
}) {
  const { dict } = useI18n();
  const t = dict.trust;
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("suspected_counterfeit");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const reasons = Object.entries(t.reasons);

  async function submit() {
    if (!signedIn) {
      router.push("/sign-in?next=" + encodeURIComponent(window.location.pathname));
      return;
    }
    setBusy(true);
    const res = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetType: variant,
        lotId: target.lotId,
        sellerId: target.sellerId,
        reason,
        message,
      }),
    });
    setBusy(false);
    if (res.ok) {
      setOpen(false);
      setMessage("");
      toast(t.reportSent, "success");
    } else {
      toast(t.reportSent, "error");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1.5 text-xs font-medium text-muted transition-colors hover:text-oxblood ${className}`}
      >
        <IconFlag size={13} />
        {variant === "lot" ? t.reportLot : t.reportSeller}
      </button>

      {open && (
        <div className="fixed inset-0 z-[130] grid place-items-center p-4">
          <button
            className="sheet-backdrop absolute inset-0 bg-ink/50 backdrop-blur-[2px]"
            onClick={() => !busy && setOpen(false)}
            aria-label="Close"
          />
          <div
            role="dialog"
            aria-modal="true"
            className="modal-panel surface relative max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-2xl p-6"
          >
            <button
              className="icon-btn absolute right-3 top-3"
              onClick={() => setOpen(false)}
              aria-label="Close"
            >
              <IconClose size={18} />
            </button>
            <span className="medallion medallion-outline">
              <IconFlag size={16} />
            </span>
            <h3 className="mt-4 font-serif text-2xl">
              {variant === "lot" ? t.reportLot : t.reportSeller}
            </h3>
            <p className="mt-1.5 text-xs leading-relaxed text-muted">
              Reports go straight to the AUCTA desk and are logged for review.
              False or malicious reports are recorded against the reporter.
            </p>

            <div className="mt-5">
              <label className="field-label">{t.reason}</label>
              <div className="select-wrap">
                <select
                  className="input appearance-none pr-9"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                >
                  {reasons.map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-4">
              <label className="field-label">{t.details}</label>
              <textarea
                className="input min-h-[7rem] resize-y py-2.5"
                placeholder={t.detailsPlaceholder}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>

            <div className="mt-5 flex gap-2">
              <button className="btn btn-outline flex-1" onClick={() => setOpen(false)} disabled={busy}>
                Cancel
              </button>
              <button className="btn btn-primary flex-1" onClick={submit} disabled={busy}>
                {busy ? (
                  <>
                    <span className="spinner" style={{ width: 15, height: 15 }} />
                  </>
                ) : (
                  t.submitReport
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

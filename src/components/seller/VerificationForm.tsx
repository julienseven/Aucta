"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/LanguageProvider";
import { useToast } from "@/components/Toast";
import { IconShieldCheck } from "@/components/icons";

export function VerificationForm() {
  const { dict } = useI18n();
  const s = dict.seller;
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    idKind: "KTP",
    idNumber: "",
    city: "",
    province: "",
    phone: "",
    statement: "",
  });
  const set = (k: keyof typeof form, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch("/api/seller/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setBusy(false);
    if (res.ok) {
      toast(s.applicationSent, "success");
      router.refresh();
    }
  }

  return (
    <form onSubmit={submit} className="surface space-y-5 p-6 sm:p-8">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-amber-soft text-bronze-deep">
          <IconShieldCheck size={20} />
        </span>
        <h2 className="font-serif text-2xl">{s.verificationCtaTitle}</h2>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={s.applyFullName}>
          <input className="input" required value={form.fullName} onChange={(e) => set("fullName", e.target.value)} />
        </Field>
        <Field label={s.applyIdKind}>
          <div className="select-wrap">
            <select className="input appearance-none pr-9" value={form.idKind} onChange={(e) => set("idKind", e.target.value)}>
              <option>KTP</option>
              <option>SIM</option>
              <option>Paspor</option>
              <option>NPWP</option>
            </select>
          </div>
        </Field>
        <Field label={s.applyIdNumber}>
          <input className="input" required value={form.idNumber} onChange={(e) => set("idNumber", e.target.value)} placeholder="3273…" />
        </Field>
        <Field label={s.applyPhone}>
          <input className="input" type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+62" />
        </Field>
        <Field label={s.applyCity}>
          <input className="input" required value={form.city} onChange={(e) => set("city", e.target.value)} />
        </Field>
        <Field label={s.applyProvince}>
          <input className="input" required value={form.province} onChange={(e) => set("province", e.target.value)} />
        </Field>
      </div>

      <Field label={s.applyStatement}>
        <textarea
          className="input min-h-[6rem] resize-y py-2.5"
          value={form.statement}
          onChange={(e) => set("statement", e.target.value)}
          placeholder={s.applyStatementPlaceholder}
        />
      </Field>

      <p className="rounded-lg bg-info-soft/60 px-4 py-3 text-xs leading-relaxed text-info">
        Identity documents are checked by the AUCTA desk and never shown to
        buyers. Public catalogue pages display only your city and province.
      </p>

      <button className="btn btn-primary btn-lg" disabled={busy}>
        {busy ? <span className="spinner" style={{ width: 16, height: 16 }} /> : null}
        {s.submitApplication}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

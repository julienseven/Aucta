export function formatRupiah(n: number, opts?: { compact?: boolean }): string {
  if (opts?.compact) {
    if (n >= 1_000_000_000)
      return `Rp ${(n / 1_000_000_000).toLocaleString("en-ID", {
        maximumFractionDigits: 1,
      })}B`;
    if (n >= 1_000_000)
      return `Rp ${(n / 1_000_000).toLocaleString("en-ID", {
        maximumFractionDigits: n % 1_000_000 === 0 ? 0 : 1,
      })}M`;
    if (n >= 1_000)
      return `Rp ${(n / 1_000).toLocaleString("en-ID", {
        maximumFractionDigits: 0,
      })}K`;
  }
  return `Rp ${n.toLocaleString("en-ID")}`;
}

export function formatRupiahInput(n: number): string {
  return n.toLocaleString("en-ID");
}

export function parseRupiahInput(raw: string): number {
  const digits = raw.replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

export type Remaining = {
  totalMs: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  endingSoon: boolean;
  ended: boolean;
  label: string;
};

export function remainingUntil(targetIso: string, now = Date.now()): Remaining {
  const totalMs = new Date(targetIso).getTime() - now;
  const ended = totalMs <= 0;
  const clamped = Math.max(0, totalMs);
  const days = Math.floor(clamped / 86_400_000);
  const hours = Math.floor((clamped % 86_400_000) / 3_600_000);
  const minutes = Math.floor((clamped % 3_600_000) / 60_000);
  const seconds = Math.floor((clamped % 60_000) / 1000);
  const endingSoon = !ended && totalMs <= 120_000;

  let label: string;
  if (ended) label = "Closed";
  else if (days >= 1)
    label = `${days}d ${hours}h left`;
  else if (hours >= 1) label = `${hours}h ${minutes}m left`;
  else if (minutes >= 1)
    label = `${minutes}:${String(seconds).padStart(2, "0")} left`;
  else label = `${seconds}s left`;

  return { totalMs, days, hours, minutes, seconds, endingSoon, ended, label };
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
    timeZoneName: "short",
  });
}

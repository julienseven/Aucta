import { Bars, KpiCard } from "@/components/dashboard/primitives";
import { getArchiveAnalytics } from "@/lib/collector";
import { categoryMap } from "@/lib/config";
import { formatRupiah } from "@/lib/format";
import { IconChart, IconGavel, IconTarget, IconWatch } from "@/components/icons";

export async function ArchiveAnalytics() {
  const a = await getArchiveAnalytics();

  return (
    <div className="mb-8 space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <KpiCard
          label="Realized sales"
          value={a.soldCount}
          icon={IconGavel}
          tone="green"
        />
        <KpiCard
          label="Median hammer price"
          value={formatRupiah(a.median, { compact: true })}
          icon={IconTarget}
          tone="bronze"
        />
        <KpiCard
          label="Average hammer price"
          value={formatRupiah(a.average, { compact: true })}
          icon={IconChart}
          tone="ink"
        />
        <KpiCard
          label="Total realized value"
          value={formatRupiah(a.totalValue, { compact: true })}
          icon={IconWatch}
          tone="bronze"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="surface p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-serif text-lg">Realized value · last 8 weeks</h2>
          </div>
          <Bars
            data={a.weekly.map((w) => ({ label: w.label, value: w.value }))}
            format={(n) => formatRupiah(n, { compact: true })}
          />
        </div>
        <div className="surface p-5 sm:p-6">
          <h2 className="mb-4 font-serif text-lg">Median by category</h2>
          {a.byCategory.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted">No realized sales yet.</p>
          ) : (
            <ul className="space-y-2.5">
              {a.byCategory.map((c) => (
                <li key={c.category} className="text-sm">
                  <div className="mb-1 flex justify-between gap-3">
                    <span className="text-muted-ink">
                      {categoryMap[c.category as keyof typeof categoryMap]?.label ??
                        c.category}
                    </span>
                    <span className="font-mono text-xs font-semibold">
                      {formatRupiah(c.median, { compact: true })}
                      <span className="ml-1.5 font-normal text-muted">
                        · {c.sold}
                      </span>
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-soft">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-bronze-deep to-bronze-soft"
                      style={{
                        width: `${Math.max(
                          (c.value / Math.max(...a.byCategory.map((x) => x.value))) *
                            100,
                          6,
                        )}%`,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

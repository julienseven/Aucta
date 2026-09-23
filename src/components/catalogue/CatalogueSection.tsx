import { Suspense } from "react";
import { queryLots, getWatchIds } from "@/lib/auctions";
import { getSessionUser } from "@/lib/auth";
import { getDict } from "@/lib/i18n/server";
import { CatalogueClient } from "@/components/catalogue/CatalogueClient";
import { CatalogueSkeleton } from "@/components/catalogue/CatalogueSkeleton";

type SP = Record<string, string | string[] | undefined>;

async function parseParams(sp: SP, mode: "open" | "sold") {
  const pick = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };
  return {
    status: mode === "sold" ? "sold" : pick("status"),
    category: pick("category"),
    condition: pick("condition"),
    q: pick("q"),
    min: pick("min"),
    max: pick("max"),
    sort: pick("sort"),
  };
}

async function CatalogueData({
  params,
  mode,
}: {
  params: Awaited<ReturnType<typeof parseParams>>;
  mode: "open" | "sold";
}) {
  const { dict } = await getDict();
  const user = await getSessionUser().catch(() => null);
  const watchIds = user ? await getWatchIds(user.id).catch(() => []) : [];

  const lots = await queryLots({
    status: params.status,
    category: params.category,
    condition: params.condition,
    q: params.q,
    min: params.min ? Number(params.min) : undefined,
    max: params.max ? Number(params.max) : undefined,
    sort: params.sort,
  });

  return (
    <CatalogueClient
      initialLots={lots}
      watchIds={watchIds}
      signedIn={Boolean(user)}
      params={params}
      dict={dict}
      mode={mode}
    />
  );
}

export async function CatalogueSection({
  searchParams,
  mode,
}: {
  searchParams: SP;
  mode: "open" | "sold";
}) {
  const params = await parseParams(searchParams, mode);

  return (
    <Suspense
      fallback={
        <div>
          <div className="mb-5 h-11 w-[34rem] max-w-full rounded-full bg-soft" />
          <CatalogueSkeleton />
        </div>
      }
    >
      <CatalogueData params={params} mode={mode} />
    </Suspense>
  );
}

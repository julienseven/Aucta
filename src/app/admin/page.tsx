import type { Metadata } from "next";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import {
  getAdminOverview,
  getAuditLog,
  getAllSellers,
  getDisputesWithLots,
  getOrdersList,
  getReportsWithTargets,
  getSuspiciousLots,
} from "@/lib/admin";
import { AdminConsole } from "@/components/admin/AdminConsole";
import { IconShieldCheck } from "@/components/icons";

export const metadata: Metadata = {
  title: "Operations console",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getSessionUser().catch(() => null);

  if (user?.role !== "admin") {
    return (
      <div className="page-enter mx-auto flex min-h-[70vh] w-full max-w-md flex-col items-center justify-center px-4 text-center">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-soft text-muted">
          <IconShieldCheck size={28} />
        </span>
        <h1 className="mt-6 font-serif text-3xl">Desk access only</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-ink">
          The operations console is for AUCTA desk members. Sign in with a desk
          account to review verifications, listings and disputes.
        </p>
        <Link href="/sign-in?next=/admin" className="btn btn-primary btn-lg mt-7">
          Sign in
        </Link>
      </div>
    );
  }

  const [overview, suspicious, orders, disputes, reports, sellers, audit] =
    await Promise.all([
      getAdminOverview(),
      getSuspiciousLots(),
      getOrdersList(),
      getDisputesWithLots(),
      getReportsWithTargets(),
      getAllSellers(),
      getAuditLog(60),
    ]);

  // Dates → ISO for the client component.
  const data = JSON.parse(
    JSON.stringify({
      overview,
      suspicious,
      orders,
      disputes,
      reports,
      sellers,
      audit,
    }),
  );

  return (
    <div className="page-enter">
      <AdminConsole data={data} />
    </div>
  );
}

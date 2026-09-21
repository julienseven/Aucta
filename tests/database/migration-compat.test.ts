import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createDatabase } from "../../src/lib/server/database";

const renamed = [
  ["20260914171550_init.sql", "0001_init.sql"],
  ["20260914171552_rpcs.sql", "0002_rpcs.sql"],
  ["20260914171553_auction_detail_alias.sql", "0003_auction_detail_alias.sql"],
  ["20260914171554_harden_auction_permissions.sql", "20260910070304_harden_auction_permissions.sql"],
  ["20260914171556_seller_listing_mutations.sql", "20260911120000_seller_listing_mutations.sql"],
  ["20260914171557_moderation_mutations.sql", "20260911140000_moderation_mutations.sql"],
  ["20260914171559_order_mutations.sql", "20260912013000_order_mutations.sql"],
  ["20260914171600_prepare_hosted_launch.sql", "20260914171353_prepare_hosted_launch.sql"],
  ["20260914171809_tighten_hosted_rpc_grants.sql", "20260914171714_tighten_hosted_rpc_grants.sql"],
];

describe("canonical hosted migration names in local databases", () => {
  it("applies every canonical migration to a fresh database", async () => {
    const database = await createDatabase();
    try {
      const files = (await readdir(path.join(process.cwd(), "supabase/migrations"))).filter((file) => file.endsWith(".sql")).sort();
      const applied = await database.db.query<{ name: string }>("select name from public.aucta_local_migrations where name <> 'bootstrap' order by name");
      expect(applied.rows.map((row) => row.name)).toEqual(files);
      expect(files).toEqual(expect.arrayContaining(renamed.map(([canonical]) => canonical)));
      expect((await database.db.query("select to_regprocedure('public.report_listing(uuid,text)') as rpc")).rows[0]).toMatchObject({ rpc: expect.any(String) });
    } finally {
      await database.db.close();
    }
  }, 60_000);

  it("adopts legacy history without replaying schema or changing persistent data, including on a second restart", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "aucta-migration-compat-"));
    let database: Awaited<ReturnType<typeof createDatabase>> | undefined;
    try {
      database = await createDatabase({ dataDir: directory, seed: true });
      const before = await database.db.query("select id, title from public.listings order by id");
      for (const [canonical, legacy] of renamed) {
        await database.db.query("update public.aucta_local_migrations set name=$1 where name=$2", [legacy, canonical]);
      }
      await database.db.close();
      database = undefined;

      for (let restart = 0; restart < 2; restart++) {
        database = await createDatabase({ dataDir: directory, seed: true });
        expect((await database.db.query("select id, title from public.listings order by id")).rows).toEqual(before.rows);
        const applied = (await database.db.query<{ name: string }>("select name from public.aucta_local_migrations")).rows.map((row) => row.name);
        for (const [canonical, legacy] of renamed) {
          expect(applied).toContain(canonical);
          expect(applied).not.toContain(legacy);
        }
        await database.db.close();
        database = undefined;
      }
    } finally {
      await database?.db.close();
      await rm(directory, { recursive: true, force: true });
    }
  }, 60_000);
});

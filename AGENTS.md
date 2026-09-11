# AUCTA engineering instructions

Follow PRODUCT.md, ARCHITECTURE.md, DATABASE.md and AUCTION_ENGINE.md. The user explicitly authorized parallel agent work. Keep file ownership separate and communicate interface changes. Root integrates and commits; agents do not commit independently.

Use pinned dependency versions. Run npm via `npm.cmd` on Windows. Never modify unrelated Project Arena infrastructure. Never print secrets. Production writes fail closed without real Supabase configuration. Development mode and sample imagery/inventory must be explicit.

Store money in integer IDR. All winners, reserves, permissions, payment transitions and settlement are server/database authoritative. No direct frontend state changes for privileged fields. Test the database operations and negative permissions, not just a pure reference model.

After milestones run typecheck, lint, tests and build. Document unverified cloud dependencies honestly. Do not mark the marketplace complete based on UI alone.

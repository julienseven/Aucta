CREATE TABLE "admin_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"admin_id" uuid NOT NULL,
	"admin_alias" text NOT NULL,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text,
	"reason" text,
	"meta" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"user_id" uuid,
	"token_hash" text NOT NULL,
	"code_hash" text NOT NULL,
	"purpose" text DEFAULT 'magic_link' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bid_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"lot_id" uuid NOT NULL,
	"lot_slug" text,
	"bid_id" bigint,
	"user_id" uuid,
	"alias" text,
	"type" text NOT NULL,
	"amount" bigint,
	"meta" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bids" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"lot_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"alias" text NOT NULL,
	"max_amount" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "disputes" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"order_id" uuid,
	"lot_id" uuid NOT NULL,
	"opened_by_id" uuid,
	"opened_by_alias" text,
	"reason" text NOT NULL,
	"evidence" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"resolution" text,
	"resolved_by" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"to" text NOT NULL,
	"subject" text NOT NULL,
	"text" text NOT NULL,
	"html" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "followed_sellers" (
	"user_id" uuid NOT NULL,
	"seller_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "followed_sellers_user_id_seller_id_pk" PRIMARY KEY("user_id","seller_id")
);
--> statement-breakpoint
CREATE TABLE "lots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"category" text NOT NULL,
	"condition" text NOT NULL,
	"status" text DEFAULT 'upcoming' NOT NULL,
	"stage" text DEFAULT 'house' NOT NULL,
	"description" text NOT NULL,
	"flaws" text DEFAULT '' NOT NULL,
	"provenance" text DEFAULT '' NOT NULL,
	"authenticity" text DEFAULT '' NOT NULL,
	"shipping_notes" text DEFAULT '' NOT NULL,
	"owner_id" uuid,
	"seller_alias" text DEFAULT 'house' NOT NULL,
	"seller_city" text DEFAULT 'Jakarta' NOT NULL,
	"seller_province" text DEFAULT 'DKI Jakarta' NOT NULL,
	"image" text NOT NULL,
	"images" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"image_hashes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"start_amount" bigint NOT NULL,
	"reserve_amount" bigint,
	"current_amount" bigint NOT NULL,
	"shipping_cost" bigint DEFAULT 0 NOT NULL,
	"sold_amount" bigint,
	"leading_alias" text,
	"bid_count" integer DEFAULT 0 NOT NULL,
	"watch_count" integer DEFAULT 0 NOT NULL,
	"report_count" integer DEFAULT 0 NOT NULL,
	"increment_override" bigint,
	"review_note" text,
	"submitted_at" timestamp with time zone,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" uuid,
	"closed_at" timestamp with time zone,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"link" text,
	"lot_id" uuid,
	"data" jsonb DEFAULT '{}'::jsonb,
	"read_at" timestamp with time zone,
	"emailed_at" timestamp with time zone,
	"dedupe_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"lot_id" uuid NOT NULL,
	"buyer_id" uuid,
	"winner_alias" text NOT NULL,
	"hammer_amount" bigint NOT NULL,
	"shipping_cost" bigint DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'awaiting_payment' NOT NULL,
	"tracking_number" text,
	"payment_due_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"ship_reminder_at" timestamp with time zone,
	"shipped_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"reporter_id" uuid,
	"target_type" text NOT NULL,
	"lot_id" uuid,
	"seller_id" uuid,
	"reason" text NOT NULL,
	"message" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"resolution" text,
	"resolved_by" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_searches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"label" text NOT NULL,
	"q" text,
	"category" text,
	"condition" text,
	"min" bigint,
	"max" bigint,
	"alert" boolean DEFAULT true NOT NULL,
	"last_matched_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"alias" text NOT NULL,
	"display_name" text,
	"provider" text DEFAULT 'email' NOT NULL,
	"role" text DEFAULT 'collector' NOT NULL,
	"seller_status" text DEFAULT 'none' NOT NULL,
	"seller_application" jsonb,
	"seller_city" text,
	"seller_province" text,
	"seller_bio" text,
	"metrics" jsonb DEFAULT '{}'::jsonb,
	"suspended" boolean DEFAULT false NOT NULL,
	"suspended_reason" text,
	"seller_verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "watchlist" (
	"user_id" uuid NOT NULL,
	"lot_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "watchlist_user_id_lot_id_pk" PRIMARY KEY("user_id","lot_id")
);
--> statement-breakpoint
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bids" ADD CONSTRAINT "bids_lot_id_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."lots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bids" ADD CONSTRAINT "bids_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "followed_sellers" ADD CONSTRAINT "followed_sellers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "followed_sellers" ADD CONSTRAINT "followed_sellers_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_lot_id_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."lots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_searches" ADD CONSTRAINT "saved_searches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist" ADD CONSTRAINT "watchlist_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist" ADD CONSTRAINT "watchlist_lot_id_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."lots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_events_action_idx" ON "admin_events" USING btree ("action");--> statement-breakpoint
CREATE INDEX "auth_tokens_email_idx" ON "auth_tokens" USING btree ("email");--> statement-breakpoint
CREATE INDEX "auth_tokens_token_idx" ON "auth_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "bid_events_lot_idx" ON "bid_events" USING btree ("lot_id");--> statement-breakpoint
CREATE INDEX "bid_events_type_idx" ON "bid_events" USING btree ("type");--> statement-breakpoint
CREATE INDEX "bids_lot_idx" ON "bids" USING btree ("lot_id");--> statement-breakpoint
CREATE INDEX "bids_user_idx" ON "bids" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "disputes_status_idx" ON "disputes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "email_outbox_to_idx" ON "email_outbox" USING btree ("to","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "lots_slug_idx" ON "lots" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "lots_status_idx" ON "lots" USING btree ("status");--> statement-breakpoint
CREATE INDEX "lots_category_idx" ON "lots" USING btree ("category");--> statement-breakpoint
CREATE INDEX "lots_owner_idx" ON "lots" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "lots_stage_idx" ON "lots" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_dedupe_idx" ON "notifications" USING btree ("user_id","dedupe_key");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_number_idx" ON "orders" USING btree ("number");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "orders_buyer_idx" ON "orders" USING btree ("buyer_id");--> statement-breakpoint
CREATE INDEX "reports_status_idx" ON "reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "saved_searches_user_idx" ON "saved_searches" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "users_alias_idx" ON "users" USING btree ("alias");
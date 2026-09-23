CREATE TABLE "addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"label" text DEFAULT 'Home' NOT NULL,
	"recipient_name" text NOT NULL,
	"phone" text NOT NULL,
	"line1" text NOT NULL,
	"line2" text DEFAULT '' NOT NULL,
	"city" text NOT NULL,
	"province" text NOT NULL,
	"postal_code" text DEFAULT '' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_ref" text,
	"method" text DEFAULT 'bank_transfer' NOT NULL,
	"amount" bigint NOT NULL,
	"currency" text DEFAULT 'IDR' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"redirect_url" text,
	"instructions" jsonb DEFAULT '{}'::jsonb,
	"raw" jsonb DEFAULT '{}'::jsonb,
	"signature_verified" boolean DEFAULT false NOT NULL,
	"idempotency_key" text,
	"expires_at" timestamp with time zone,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "seller_id" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "buyer_alias" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "seller_alias" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "lot_title" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "lot_image" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "snapshot" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "buyer_fee_amount" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "seller_fee_amount" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "amount_due" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "currency" text DEFAULT 'IDR' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "status_reason" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipping_option" text DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipping_label" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipping_address" jsonb;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "carrier" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "carrier_status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipment_proof" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "dispatched_by" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_provider" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_method" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_ref" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "paid_amount" bigint;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "refund_amount" bigint;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "refund_ref" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "refund_reason" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "preparing_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "dispatch_due_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "refunded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "addresses_user_idx" ON "addresses" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "payment_attempts_order_idx" ON "payment_attempts" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "payment_attempts_ref_idx" ON "payment_attempts" USING btree ("provider_ref");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_attempts_idem_idx" ON "payment_attempts" USING btree ("idempotency_key");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "orders_seller_idx" ON "orders" USING btree ("seller_id");
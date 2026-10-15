ALTER TABLE "requests" ADD COLUMN "proof_jti" text;--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN "domain_mismatch" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_proof_jti_unique" UNIQUE("proof_jti");--> statement-breakpoint
CREATE SEQUENCE IF NOT EXISTS requests_id_seq START WITH 1;
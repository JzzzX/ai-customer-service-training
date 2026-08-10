ALTER TABLE "scenario_versions" ADD COLUMN "customer_persona" jsonb;
ALTER TABLE "scenario_versions" ADD COLUMN "difficulty" text DEFAULT 'medium';

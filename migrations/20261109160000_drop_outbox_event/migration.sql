-- Owner directive 2026-11-09: no invented outbox machinery. External events use Openfront webhooks.
DROP TABLE IF EXISTS "OutboxEvent";
DROP TYPE IF EXISTS "OutboxEventStatusType";

-- Add consecutive_failures column to scouts table
-- Tracks failed executions to auto-disable scouts after 3 consecutive failures

ALTER TABLE scouts ADD COLUMN IF NOT EXISTS consecutive_failures INT DEFAULT 0;

COMMENT ON COLUMN scouts.consecutive_failures IS 'Number of consecutive failed executions. Scout is auto-disabled when this reaches 3.';
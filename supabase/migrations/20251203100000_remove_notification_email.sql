-- =============================================================================
-- REMOVE NOTIFICATION EMAIL
-- Users will now receive notifications at their authenticated account email
-- =============================================================================

-- Remove the notification_email column from user_preferences
-- The user's email is now sourced from auth.users table
ALTER TABLE user_preferences DROP COLUMN IF EXISTS notification_email;

-- Clean up the old default row that was used for single-user system
-- (this row used hardcoded UUID '00000000-0000-0000-0000-000000000001')
DELETE FROM user_preferences WHERE id = '00000000-0000-0000-0000-000000000001' AND user_id IS NULL;

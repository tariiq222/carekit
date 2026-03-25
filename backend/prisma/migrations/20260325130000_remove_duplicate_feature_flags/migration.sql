-- Remove waitlist, recurring, and walk_in from feature_flags table.
-- These three features are controlled exclusively by BookingSettings
-- (allowWalkIn, allowRecurring, waitlistEnabled) which also carry their
-- detailed sub-settings (maxRecurringWeeks, waitlistMaxPerSlot, etc.).
-- Keeping them in feature_flags as well creates a dual-control conflict.

DELETE FROM "feature_flags" WHERE "key" IN ('waitlist', 'recurring', 'walk_in');

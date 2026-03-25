-- Feature flags are removed from the system entirely.
-- All 7 features (coupons, gift_cards, intake_forms, chatbot, live_chat,
-- ratings, multi_branch) are always-on core features — not toggles.
-- waitlist / recurring / walk_in were already removed in a prior migration;
-- they are controlled exclusively by BookingSettings.

DROP TABLE IF EXISTS "feature_flags";

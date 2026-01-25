
-- NILAYAM ROBUST PRODUCTION REFRESH SCRIPT (V3)
-- Purpose: Wipe all transactional data while guaranteeing SuperAdmin access.
-- Logic: Identifies SuperAdmin via Public Profile OR Auth Metadata. Restores profile if missing.

BEGIN;

-- 1. Disable triggers
SET session_replication_role = 'replica';

DO $$
DECLARE
    sa_id uuid;
    sa_email text;
    sa_name text;
BEGIN
    -- STEP A: Try to find SuperAdmin in the Public Profile table first
    SELECT id, email, name INTO sa_id, sa_email, sa_name 
    FROM public.users 
    WHERE role = 'SuperAdmin' 
    LIMIT 1;

    -- STEP B: Fallback - If not in Public Profile, look in Supabase Auth Metadata
    IF sa_id IS NULL THEN
        SELECT id, email, (raw_user_meta_data->>'name') INTO sa_id, sa_email, sa_name
        FROM auth.users 
        WHERE (raw_user_meta_data->>'role') = 'SuperAdmin'
        LIMIT 1;
        
        -- If still not found, check for the very first user created (usually the dev/owner)
        IF sa_id IS NULL THEN
            SELECT id, email, (raw_user_meta_data->>'name') INTO sa_id, sa_email, sa_name
            FROM auth.users 
            ORDER BY created_at ASC
            LIMIT 1;
        END IF;
    END IF;

    -- STEP C: Final Safety Check
    IF sa_id IS NULL THEN
        RAISE EXCEPTION 'Safety Violation: No candidate for SuperAdmin found in Auth or Public tables. Aborting to prevent total lockout.';
    END IF;

    -- 2. Clear All Community & Transactional Tables
    TRUNCATE TABLE 
        public.real_estate_listings,
        public.marketplace_messages,
        public.marketplace_items,
        public.community_payments,
        public.maintenance_records,
        public.maintenance_configurations,
        public.expenses,
        public.complaints,
        public.visitors,
        public.bookings,
        public.amenities,
        public.notices,
        public.assets,
        public.audit_logs,
        public.units,
        public.communities
    RESTART IDENTITY CASCADE;

    -- 3. Cleanup Auth System (Remove all identities except SuperAdmin)
    DELETE FROM auth.users WHERE id != sa_id;

    -- 4. Cleanup/Restore Public Profile
    -- We delete all profiles, then re-insert/update the SuperAdmin specifically
    DELETE FROM public.users WHERE id != sa_id;

    INSERT INTO public.users (id, email, name, role, status, theme, avatar_url)
    VALUES (
        sa_id, 
        sa_email, 
        COALESCE(sa_name, 'System Owner'), 
        'SuperAdmin', 
        'active', 
        'light',
        'https://ui-avatars.com/api/?name=SA&background=0d9488&color=fff'
    )
    ON CONFLICT (id) DO UPDATE SET 
        role = 'SuperAdmin',
        community_id = NULL,
        flat_number = NULL,
        profile_data = NULL,
        status = 'active';

    RAISE NOTICE 'Refresh Complete. Preserved SuperAdmin: % (%)', sa_name, sa_email;

END $$;

-- 5. Re-enable triggers
SET session_replication_role = 'origin';

COMMIT;

-- SUCCESS: The database is now pristine. 
-- Only your SuperAdmin account remains, and its profile has been verified/restored.

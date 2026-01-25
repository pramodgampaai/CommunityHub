-- 1. Create Real Estate Listings Table
CREATE TABLE IF NOT EXISTS public.real_estate_listings (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    owner_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    unit_id uuid REFERENCES public.units(id) ON DELETE CASCADE NOT NULL,
    community_id uuid REFERENCES public.communities(id) ON DELETE CASCADE NOT NULL,
    rent_amount numeric NOT NULL,
    deposit_amount numeric NOT NULL,
    available_from date NOT NULL,
    furnishing_status text NOT NULL DEFAULT 'Unfurnished',
    description text,
    image_url text,
    status text DEFAULT 'Active' NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- 2. Modify Marketplace Messages to support Rentals
DO $$ 
BEGIN 
    -- Make item_id nullable to allow rental-only messages
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='marketplace_messages' AND column_name='item_id') THEN
        ALTER TABLE public.marketplace_messages ALTER COLUMN item_id DROP NOT NULL;
    END IF;

    -- Add rental_id column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='marketplace_messages' AND column_name='rental_id') THEN
        ALTER TABLE public.marketplace_messages ADD COLUMN rental_id uuid REFERENCES public.real_estate_listings(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 3. Visitor Evidence Tracking
-- Purpose: Store guest photo evidence captured at the gate
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='visitors' AND column_name='photo_url') THEN
        ALTER TABLE public.visitors ADD COLUMN photo_url text;
    END IF;
END $$;

-- 4. Performance Indexes for Production
CREATE INDEX IF NOT EXISTS idx_re_listings_community ON public.real_estate_listings(community_id);
CREATE INDEX IF NOT EXISTS idx_re_listings_status ON public.real_estate_listings(status);
CREATE INDEX IF NOT EXISTS idx_market_messages_thread ON public.marketplace_messages(item_id, rental_id);
CREATE INDEX IF NOT EXISTS idx_market_messages_read ON public.marketplace_messages(is_read, receiver_id);
CREATE INDEX IF NOT EXISTS idx_visitors_token ON public.visitors(entry_token, community_id);

-- 5. RLS for Real Estate
ALTER TABLE public.real_estate_listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Community view rentals" ON public.real_estate_listings;
CREATE POLICY "Community view rentals" ON public.real_estate_listings
    FOR SELECT TO authenticated
    USING (community_id = (auth.jwt() -> 'user_metadata' ->> 'community_id')::uuid);

DROP POLICY IF EXISTS "Owners manage rentals" ON public.real_estate_listings;
CREATE POLICY "Owners manage rentals" ON public.real_estate_listings
    FOR ALL TO authenticated
    USING (auth.uid() = owner_id);

-- 6. REFRESH SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
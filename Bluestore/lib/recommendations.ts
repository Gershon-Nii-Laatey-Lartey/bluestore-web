/**
 * recommendations.ts
 * Full recommendation engine for Bluestore.
 * 
 * Computes user taste profiles from engagement data (views, saves, chats, calls, searches)
 * and generates personalized listing recommendations with multi-factor scoring.
 */

import { dataCache } from './cache';
import { supabase } from './supabase';

// ─── Signal Weights ───────────────────────────────────────
const WEIGHT_IMPRESSION = 0.1;
const WEIGHT_VIEW = 1.0;
const WEIGHT_SAVE = 3.0;
const WEIGHT_CHAT = 5.0;
const WEIGHT_CALL = 5.0;
const WEIGHT_SEARCH = 2.0;

// ─── Scoring Factors ──────────────────────────────────────
const FACTOR_CATEGORY = 0.35;
const FACTOR_BRAND = 0.20;
const FACTOR_PRICE = 0.15;
const FACTOR_LOCATION = 0.10;
const FACTOR_POPULARITY = 0.10;
const FACTOR_CONDITION = 0.05;
const FACTOR_FRESHNESS = 0.05;
const FACTOR_BOOST = 1.0; // Promoted ads get a massive boost

// ─── Stale threshold (6 hours) ────────────────────────────
const STALE_MS = 6 * 60 * 60 * 1000;

// ─── Types ────────────────────────────────────────────────
interface UserPreferences {
    preferred_categories: Record<string, number>;
    preferred_brands: Record<string, number>;
    preferred_price_range: { min: number; max: number; avg: number };
    preferred_conditions: Record<string, number>;
    preferred_locations: Record<string, number>;
    updated_at: string;
}

interface ScoredListing {
    listing: any;
    score: number;
    reason: string;
}

// ═══════════════════════════════════════════════════════════
//  PHASE 1: Compute User Preferences
// ═══════════════════════════════════════════════════════════

/**
 * Build a weighted preference profile from all user engagement.
 * Upserts into user_preferences table and returns the profile.
 */
export async function computeUserPreferences(userId: string): Promise<UserPreferences | null> {
    try {
        const categories: Record<string, number> = {};
        const brands: Record<string, number> = {};
        const conditions: Record<string, number> = {};
        const locations: Record<string, number> = {};
        const prices: number[] = [];

        // Helper: accumulate scores from listing metadata
        const accumulateFromListings = (listings: any[], weight: number) => {
            for (const item of listings) {
                if (!item) continue;
                if (item.category) categories[item.category] = (categories[item.category] || 0) + weight;
                if (item.brand) brands[item.brand] = (brands[item.brand] || 0) + weight;
                if (item.condition) conditions[item.condition] = (conditions[item.condition] || 0) + weight;
                if (item.location) locations[item.location] = (locations[item.location] || 0) + weight;
                if (item.price) prices.push(Number(item.price));
            }
        };

        // 1. Viewed listings
        const { data: viewed } = await supabase
            .from('viewed_listings')
            .select('listings ( category, brand, condition, location, price )')
            .eq('user_id', userId)
            .order('viewed_at', { ascending: false })
            .limit(100);
        if (viewed) accumulateFromListings(viewed.map((v: any) => v.listings), WEIGHT_VIEW);

        // 2. Saved listings
        const { data: saved } = await supabase
            .from('saved_listings')
            .select('listings ( category, brand, condition, location, price )')
            .eq('user_id', userId)
            .limit(50);
        if (saved) accumulateFromListings(saved.map((s: any) => s.listings), WEIGHT_SAVE);

        // 3. Chat interactions
        const { data: chats } = await supabase
            .from('listing_chats')
            .select('listings ( category, brand, condition, location, price )')
            .eq('user_id', userId)
            .limit(50);
        if (chats) accumulateFromListings(chats.map((c: any) => c.listings), WEIGHT_CHAT);

        // 4. Call interactions
        const { data: calls } = await supabase
            .from('listing_calls')
            .select('listings ( category, brand, condition, location, price )')
            .eq('user_id', userId)
            .limit(50);
        if (calls) accumulateFromListings(calls.map((c: any) => c.listings), WEIGHT_CALL);

        // 5. Search history → match against category/brand names
        const { data: searches } = await supabase
            .from('search_history')
            .select('query')
            .eq('user_id', userId)
            .order('searched_at', { ascending: false })
            .limit(30);

        if (searches) {
            const { data: allCats } = await supabase.from('categories').select('name');
            const { data: allBrands } = await supabase.from('brands').select('name');
            const catNames = new Set((allCats || []).map(c => c.name.toLowerCase()));
            const brandNames = new Set((allBrands || []).map(b => b.name.toLowerCase()));

            for (const s of searches) {
                const q = s.query.toLowerCase();
                for (const cat of catNames) {
                    if (q.includes(cat) || cat.includes(q)) {
                        const name = (allCats || []).find(c => c.name.toLowerCase() === cat)?.name;
                        if (name) categories[name] = (categories[name] || 0) + WEIGHT_SEARCH;
                    }
                }
                for (const brand of brandNames) {
                    if (q.includes(brand) || brand.includes(q)) {
                        const name = (allBrands || []).find(b => b.name.toLowerCase() === brand)?.name;
                        if (name) brands[name] = (brands[name] || 0) + WEIGHT_SEARCH;
                    }
                }
            }
        }

        // Normalize scores to 0–1 range
        const normalize = (obj: Record<string, number>): Record<string, number> => {
            const max = Math.max(...Object.values(obj), 1);
            const result: Record<string, number> = {};
            for (const [k, v] of Object.entries(obj)) {
                result[k] = Math.round((v / max) * 100) / 100;
            }
            return result;
        };

        // Compute price range
        const priceRange = prices.length > 0
            ? {
                min: Math.min(...prices),
                max: Math.max(...prices),
                avg: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
            }
            : { min: 0, max: 0, avg: 0 };

        const preferences: UserPreferences = {
            preferred_categories: normalize(categories),
            preferred_brands: normalize(brands),
            preferred_price_range: priceRange,
            preferred_conditions: normalize(conditions),
            preferred_locations: normalize(locations),
            updated_at: new Date().toISOString(),
        };

        // Upsert to database
        await supabase
            .from('user_preferences')
            .upsert({
                user_id: userId,
                ...preferences,
            }, { onConflict: 'user_id' });

        // Cache locally
        dataCache.set('user_preferences', preferences);

        return preferences;
    } catch (error) {
        console.error('Error computing preferences:', error);
        return null;
    }
}

// ═══════════════════════════════════════════════════════════
//  PHASE 2: Generate Recommendations
// ═══════════════════════════════════════════════════════════

/**
 * Score a single listing against a user's preference profile.
 */
function scoreListing(
    listing: any,
    preferences: UserPreferences,
    maxEngagement: number,
    userLocation?: string
): ScoredListing {
    let score = 0;
    let topReason = 'Recommended for you';

    // 1. Category match (35%)
    const catScore = preferences.preferred_categories[listing.category] || 0;
    score += catScore * FACTOR_CATEGORY;
    if (catScore > 0.7) topReason = `Popular in ${listing.category}`;

    // 2. Brand match (20%)
    const brandScore = preferences.preferred_brands[listing.brand] || 0;
    score += brandScore * FACTOR_BRAND;
    if (brandScore > 0.8) topReason = `You like ${listing.brand}`;

    // 3. Price match (15%) — Gaussian decay from user's average price
    const { avg, min, max } = preferences.preferred_price_range;
    if (avg > 0) {
        const range = Math.max(max - min, avg * 0.5, 50); // prevent division by zero
        const distance = Math.abs(Number(listing.price) - avg) / range;
        const priceScore = Math.exp(-(distance * distance) * 2); // Gaussian
        score += priceScore * FACTOR_PRICE;
        if (priceScore > 0.8) topReason = 'In your price range';
    }

    // 4. Condition match (5%)
    const condScore = preferences.preferred_conditions[listing.condition] || 0;
    score += condScore * FACTOR_CONDITION;

    // 5. Location match (10%)
    if (userLocation && listing.location) {
        const locScore = preferences.preferred_locations[listing.location] || 0;
        if (listing.location === userLocation) {
            score += 1.0 * FACTOR_LOCATION;
        } else {
            score += locScore * FACTOR_LOCATION;
        }
        if (locScore > 0.8) topReason = 'Near you';
    }

    // 6. Popularity (10%) — log-scaled engagement
    const engagement = (listing.views || 0) + (listing.chats_count || 0) * 3 + (listing.calls_count || 0) * 3;
    const popScore = maxEngagement > 0 ? Math.log(1 + engagement) / Math.log(1 + maxEngagement) : 0;
    score += popScore * FACTOR_POPULARITY;
    if (popScore > 0.8 && catScore < 0.3) topReason = 'Trending now';

    // 7. Freshness (5%) — boost items from the last 30 days
    const daysSinceCreated = (Date.now() - new Date(listing.created_at).getTime()) / (1000 * 60 * 60 * 24);
    const freshnessScore = Math.max(0, 1 - daysSinceCreated / 30);
    score += freshnessScore * FACTOR_FRESHNESS;
    if (freshnessScore > 0.9 && catScore > 0.5) topReason = `New in ${listing.category}`;

    // 8. Paid Boost Factor (MASSIVE)
    if (listing.is_boosted) {
        score += FACTOR_BOOST;
        topReason = 'Promoted ad';
    }

    return { listing, score: Math.round(score * 10000) / 10000, reason: topReason };
}

/**
 * Generate and persist personalized recommendations for a user.
 */
export async function generateRecommendations(userId: string, preferences: UserPreferences): Promise<ScoredListing[]> {
    try {
        // 1. Get IDs the user has already interacted with
        const [viewedRes, savedRes, chatsRes, callsRes] = await Promise.all([
            supabase.from('viewed_listings').select('listing_id').eq('user_id', userId),
            supabase.from('saved_listings').select('listing_id').eq('user_id', userId),
            supabase.from('listing_chats').select('listing_id').eq('user_id', userId),
            supabase.from('listing_calls').select('listing_id').eq('user_id', userId),
        ]);

        const interactedIds = new Set<string>();
        for (const res of [viewedRes, savedRes, chatsRes, callsRes]) {
            if (res.data) res.data.forEach((r: any) => interactedIds.add(r.listing_id));
        }

        // 2. Fetch all approved listings (exclude user's own)
        const { data: allListings } = await supabase
            .from('listings')
            .select('id, title, price, category, brand, condition, location, images, views, chats_count, calls_count, created_at, user_id, location_structured, is_boosted')
            .eq('status', 'approved')
            .neq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(500);

        if (!allListings || allListings.length === 0) return [];

        // 3. Compute max engagement for normalization
        const maxEngagement = Math.max(
            ...allListings.map(l => (l.views || 0) + (l.chats_count || 0) * 3 + (l.calls_count || 0) * 3),
            1
        );

        // 4. Get user's primary location
        const { data: profile } = await supabase
            .from('profiles')
            .select('location')
            .eq('id', userId)
            .single();
        const userLocation = profile?.location || '';

        // 5. Score all uninteracted listings
        const unseen = allListings.filter(l => !interactedIds.has(l.id));
        const scored = unseen.map(l => scoreListing(l, preferences, maxEngagement, userLocation));

        // 6. Sort by score descending
        scored.sort((a, b) => b.score - a.score);

        // 7. Take top 50 personalized
        const topPersonalized = scored.slice(0, 50);

        // 8. Add trending items (high engagement in last 7 days, even if not matching profile)
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const trending = allListings
            .filter(l => new Date(l.created_at) >= new Date(sevenDaysAgo))
            .sort((a, b) => {
                const engA = (a.views || 0) + (a.chats_count || 0) * 3;
                const engB = (b.views || 0) + (b.chats_count || 0) * 3;
                return engB - engA;
            })
            .slice(0, 10)
            .map(l => ({
                listing: l,
                score: 0.5, // Fixed mid-range score for trending
                reason: 'Trending now',
            }));

        // 9. Merge: personalized first, then fill with trending (deduplicated)
        const personalizedIds = new Set(topPersonalized.map(r => r.listing.id));
        const merged = [
            ...topPersonalized,
            ...trending.filter(t => !personalizedIds.has(t.listing.id)),
        ];

        // 10. Persist top recommendations to database
        const upsertData = merged.slice(0, 60).map(r => ({
            user_id: userId,
            listing_id: r.listing.id,
            score: r.score,
            reason: r.reason,
            recommendation_type: r.reason === 'Trending now' ? 'trending' : 'personalized',
        }));

        if (upsertData.length > 0) {
            // Clear old recommendations
            await supabase
                .from('user_recommendations')
                .delete()
                .eq('user_id', userId);

            // Insert fresh ones
            await supabase
                .from('user_recommendations')
                .insert(upsertData);
        }

        // Cache locally
        dataCache.set('recommendations', merged);

        return merged;
    } catch (error) {
        console.error('Error generating recommendations:', error);
        return [];
    }
}

// ═══════════════════════════════════════════════════════════
//  PHASE 3: Public API — Fetch & Refresh
// ═══════════════════════════════════════════════════════════

/**
 * Get recommendations for the current user.
 * Uses cached data if fresh, otherwise recomputes.
 */
export async function fetchRecommendations(): Promise<any[]> {
    try {
        // Check cache first
        const cached = dataCache.get('recommendations');
        if (cached && cached.length > 0) return cached.map((r: ScoredListing) => r.listing || r);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];

        // Try loading from database
        const { data: dbRecs } = await supabase
            .from('user_recommendations')
            .select('listing_id, score, reason, recommendation_type, listings ( id, title, price, category, brand, condition, location, images, created_at, user_id )')
            .eq('user_id', user.id)
            .order('score', { ascending: false })
            .limit(30);

        if (dbRecs && dbRecs.length > 0) {
            const results = dbRecs
                .map((r: any) => ({
                    ...r.listings,
                    _score: r.score,
                    _reason: r.reason,
                    _type: r.recommendation_type,
                }))
                .filter(Boolean);
            dataCache.set('recommendations', results);
            return results;
        }

        // If no stored recs, compute from scratch
        return await refreshRecommendations();
    } catch (error) {
        console.error('Error fetching recommendations:', error);
        return [];
    }
}

/**
 * Force a full refresh of preferences + recommendations.
 */
export async function refreshRecommendations(): Promise<any[]> {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];

        const preferences = await computeUserPreferences(user.id);
        if (!preferences) return await getTrendingListings();

        // Check if there's enough data for personalization
        const hasPreferences =
            Object.keys(preferences.preferred_categories).length > 0 ||
            Object.keys(preferences.preferred_brands).length > 0;

        if (!hasPreferences) {
            // Cold start: return trending
            return await getTrendingListings();
        }

        const scored = await generateRecommendations(user.id, preferences);
        return scored.map(s => ({
            ...s.listing,
            _score: s.score,
            _reason: s.reason,
        }));
    } catch (error) {
        console.error('Error refreshing recommendations:', error);
        return await getTrendingListings();
    }
}

/**
 * Check if preferences need recomputation (stale > 6 hours).
 * Called from _layout.tsx on app open.
 */
export async function refreshPreferencesIfStale(): Promise<void> {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: prefs } = await supabase
            .from('user_preferences')
            .select('updated_at')
            .eq('user_id', user.id)
            .single();

        const isStale = !prefs || (Date.now() - new Date(prefs.updated_at).getTime()) > STALE_MS;

        if (isStale) {
            // Run in background — don't block the UI
            computeUserPreferences(user.id).then(p => {
                if (p) generateRecommendations(user.id, p);
            });
        }
    } catch (_) { /* silent */ }
}

// ═══════════════════════════════════════════════════════════
//  PHASE 4: Similar Items & Trending
// ═══════════════════════════════════════════════════════════

/**
 * Get similar listings to a given listing.
 * Used on the product detail page.
 */
export async function getSimilarListings(listingId: string, limit = 6): Promise<any[]> {
    try {
        const cacheKey = `similar_${listingId}`;
        const cached = dataCache.get(cacheKey);
        if (cached) return cached;

        // Get the source listing
        const { data: source } = await supabase
            .from('listings')
            .select('category, brand, price, condition, location')
            .eq('id', listingId)
            .single();

        if (!source) return [];

        const price = Number(source.price);
        const priceMin = Math.max(0, price * 0.5);
        const priceMax = price * 2.0;

        // Query: same category, similar price, exclude self
        let query = supabase
            .from('listings')
            .select('id, title, price, category, brand, condition, location, images, views, created_at, user_id')
            .eq('status', 'approved')
            .eq('category', source.category)
            .neq('id', listingId)
            .gte('price', priceMin)
            .lte('price', priceMax)
            .order('views', { ascending: false })
            .limit(limit * 2); // Fetch more to have room for scoring

        const { data: candidates } = await query;
        if (!candidates || candidates.length === 0) {
            // Fallback: just same category, no price filter
            const { data: fallback } = await supabase
                .from('listings')
                .select('id, title, price, category, brand, condition, location, images, views, created_at, user_id')
                .eq('status', 'approved')
                .eq('category', source.category)
                .neq('id', listingId)
                .order('views', { ascending: false })
                .limit(limit);
            const result = fallback || [];
            dataCache.set(cacheKey, result);
            return result;
        }

        // Sort by similarity: brand match > price closeness > views
        const sorted = candidates.sort((a, b) => {
            let scoreA = 0, scoreB = 0;

            // Brand match bonus
            if (a.brand === source.brand) scoreA += 10;
            if (b.brand === source.brand) scoreB += 10;

            // Condition match bonus
            if (a.condition === source.condition) scoreA += 3;
            if (b.condition === source.condition) scoreB += 3;

            // Location match bonus
            if (a.location === source.location) scoreA += 2;
            if (b.location === source.location) scoreB += 2;

            // Price proximity (closer = better)
            const distA = Math.abs(Number(a.price) - price) / price;
            const distB = Math.abs(Number(b.price) - price) / price;
            scoreA += (1 - distA) * 5;
            scoreB += (1 - distB) * 5;

            // Views tiebreaker
            scoreA += Math.log(1 + (a.views || 0));
            scoreB += Math.log(1 + (b.views || 0));

            return scoreB - scoreA;
        });

        const result = sorted.slice(0, limit);
        dataCache.set(cacheKey, result);
        return result;
    } catch (error) {
        console.error('Error getting similar listings:', error);
        return [];
    }
}

/**
 * Get trending listings (cold start fallback).
 */
export async function getTrendingListings(limit = 20): Promise<any[]> {
    try {
        const cached = dataCache.get('trending_listings');
        if (cached) return cached;

        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

        const { data } = await supabase
            .from('listings')
            .select('id, title, price, category, brand, condition, location, images, views, chats_count, calls_count, created_at, user_id')
            .eq('status', 'approved')
            .gte('created_at', sevenDaysAgo)
            .order('views', { ascending: false })
            .limit(limit);

        if (!data || data.length === 0) {
            // Fallback: just newest listings
            const { data: newest } = await supabase
                .from('listings')
                .select('id, title, price, category, brand, condition, location, images, views, created_at, user_id')
                .eq('status', 'approved')
                .order('created_at', { ascending: false })
                .limit(limit);

            const result = newest || [];
            dataCache.set('trending_listings', result);
            return result;
        }

        const result = data.map(l => ({
            ...l,
            _reason: 'Trending now',
            _type: 'trending',
        }));
        dataCache.set('trending_listings', result);
        return result;
    } catch (error) {
        console.error('Error fetching trending:', error);
        return [];
    }
}

/**
 * Get other listings from the same seller.
 */
export async function getSellerListings(sellerId: string, excludeId: string, limit = 10): Promise<any[]> {
    try {
        const cacheKey = `seller_listings_${sellerId}`;
        const cached = dataCache.get(cacheKey);
        if (cached) return cached.filter((item: any) => item.id !== excludeId);

        const { data } = await supabase
            .from('listings')
            .select('id, title, price, category, brand, condition, location, images, views, created_at, user_id')
            .eq('status', 'approved')
            .eq('user_id', sellerId)
            .neq('id', excludeId)
            .order('created_at', { ascending: false })
            .limit(limit);

        const result = data || [];
        dataCache.set(cacheKey, result);
        return result;
    } catch (error) {
        console.error('Error fetching seller listings:', error);
        return [];
    }
}


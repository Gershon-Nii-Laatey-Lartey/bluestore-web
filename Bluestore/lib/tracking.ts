/**
 * tracking.ts
 * Lightweight helpers for saving search history and tracking engagement.
 * Helps monitor views, chats, and calls per product while ignoring duplicates.
 */

import { dataCache } from './cache';
import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LOCAL_SEARCH_KEY = '@local_search_history';
const LOCAL_VIEWS_KEY = '@local_viewed_listings';

/** Save a search query for the current user. Ignores empty strings. */
export async function saveSearchQuery(query: string) {
    const q = query.trim();
    if (!q) return;
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            await supabase
                .from('search_history')
                .upsert({ user_id: user.id, query: q, searched_at: new Date().toISOString() },
                    { onConflict: 'user_id,query' });
        } else {
            // Store locally
            const local = await AsyncStorage.getItem(LOCAL_SEARCH_KEY);
            let history = local ? JSON.parse(local) : [];
            // Remove if duplicate, add to front
            history = [q, ...history.filter((h: string) => h !== q)].slice(0, 20);
            await AsyncStorage.setItem(LOCAL_SEARCH_KEY, JSON.stringify(history));
        }
    } catch (_) { /* silent */ }
}

/** Mark a listing as viewed by the current user. */
export async function recordListingView(listingId: string) {
    if (!listingId) return;
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            await supabase
                .from('viewed_listings')
                .upsert({ user_id: user.id, listing_id: listingId, viewed_at: new Date().toISOString() },
                    { onConflict: 'user_id,listing_id' });
        } else {
            // Store locally
            const local = await AsyncStorage.getItem(LOCAL_VIEWS_KEY);
            let views = local ? JSON.parse(local) : [];
            // Add unique with timestamp
            const entry = { listing_id: listingId, viewed_at: new Date().toISOString() };
            views = [entry, ...views.filter((v: any) => v.listing_id !== listingId)].slice(0, 30);
            await AsyncStorage.setItem(LOCAL_VIEWS_KEY, JSON.stringify(views));
        }
    } catch (_) { /* silent */ }
}

/** Record that a user initiated a chat for a listing. (Unique per user/listing) */
export async function recordChatStarted(listingId: string) {
    if (!listingId) return;
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        // DB PRIMARY KEY (user_id, listing_id) ensures this only counts once
        await supabase
            .from('listing_chats')
            .insert({ user_id: user.id, listing_id: listingId });
        // Invalidate cached recommendations — strong intent signal
        invalidateRecommendations();
    } catch (_) { /* silent */ }
}

/** Record that a user clicked the call button for a listing. (Unique per user/listing) */
export async function recordCallClick(listingId: string) {
    if (!listingId) return;
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        // DB PRIMARY KEY (user_id, listing_id) ensures this only counts once
        await supabase
            .from('listing_calls')
            .insert({ user_id: user.id, listing_id: listingId });
        // Invalidate cached recommendations — strong intent signal
        invalidateRecommendations();
    } catch (_) { /* silent */ }
}

/** Record that a product was shown in a list (Impression). */
export async function recordListingImpression(listingId: string) {
    if (!listingId) return;
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

        await supabase
            .from('listing_impressions')
            .upsert({
                user_id: user.id,
                listing_id: listingId,
                view_date: today,
                created_at: new Date().toISOString()
            }, { onConflict: 'user_id,listing_id,view_date' });
    } catch (_) { /* silent */ }
}

/**
 * Sync local tracking data to Supabase after the user signs in.
 */
export async function syncUserData(userId: string) {
    try {
        // 1. Sync Search History
        const localSearch = await AsyncStorage.getItem(LOCAL_SEARCH_KEY);
        if (localSearch) {
            const queries = JSON.parse(localSearch);
            if (queries.length > 0) {
                const searchEntries = queries.map((q: string) => ({
                    user_id: userId,
                    query: q,
                    searched_at: new Date().toISOString()
                }));
                await supabase.from('search_history').upsert(searchEntries, { onConflict: 'user_id,query' });
                await AsyncStorage.removeItem(LOCAL_SEARCH_KEY);
            }
        }

        // 2. Sync Viewed Listings
        const localViews = await AsyncStorage.getItem(LOCAL_VIEWS_KEY);
        if (localViews) {
            const views = JSON.parse(localViews);
            if (views.length > 0) {
                const viewEntries = views.map((v: any) => ({
                    user_id: userId,
                    listing_id: v.listing_id,
                    viewed_at: v.viewed_at || new Date().toISOString()
                }));
                await supabase.from('viewed_listings').upsert(viewEntries, { onConflict: 'user_id,listing_id' });
                await AsyncStorage.removeItem(LOCAL_VIEWS_KEY);
            }
        }
    } catch (e) {
        console.error('Sync error:', e);
    }
}

/** Get search history from local or remote depending on auth. */
export async function getCombinedSearchHistory() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data } = await supabase
                .from('search_history')
                .select('query')
                .eq('user_id', user.id)
                .order('searched_at', { ascending: false })
                .limit(20);
            return (data || []).map(r => r.query);
        } else {
            const local = await AsyncStorage.getItem(LOCAL_SEARCH_KEY);
            return local ? JSON.parse(local) : [];
        }
    } catch (_) { return []; }
}

/** Get viewed listings from local or remote. */
export async function getCombinedViewedListings() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data } = await supabase
                .from('viewed_listings')
                .select(`viewed_at, listings ( id, title, brand, category, price, images )`)
                .eq('user_id', user.id)
                .order('viewed_at', { ascending: false })
                .limit(10);
            return (data || []).map((r: any) => r.listings).filter(Boolean);
        } else {
            const local = await AsyncStorage.getItem(LOCAL_VIEWS_KEY);
            if (!local) return [];
            const localViews = JSON.parse(local);
            const ids = localViews.map((v: any) => v.listing_id);
            
            // Fetch listing details for these IDs
            const { data } = await supabase
                .from('listings')
                .select('id, title, brand, category, price, images')
                .in('id', ids);
            
            // Re-order based on viewed order
            return ids.map((id: string) => data?.find(item => item.id === id)).filter(Boolean);
        }
    } catch (_) { return []; }
}

/**
 * Invalidate cached recommendations so they refresh on next Home visit.
 * Called after high-signal actions (chat, call, save).
 */
function invalidateRecommendations() {
    dataCache.delete('recommendations');
    dataCache.delete('user_preferences');
}


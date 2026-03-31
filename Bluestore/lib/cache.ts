/**
 * Simple in-memory cache to prevent redundant loading states
 * and provide an "instant" feel when navigating back to screens.
 */

type CacheEntry = {
    data: any;
    timestamp: number;
};

const cache: Record<string, CacheEntry> = {};
const DEFAULT_TTL = 1000 * 60 * 5; // 5 minutes

export const dataCache = {
    set: (key: string, data: any) => {
        cache[key] = {
            data,
            timestamp: Date.now(),
        };
    },

    get: (key: string, ttl = DEFAULT_TTL) => {
        const entry = cache[key];
        if (!entry) return null;

        // Check if entry is expired
        if (Date.now() - entry.timestamp > ttl) {
            delete cache[key];
            return null;
        }

        return entry.data;
    },

    clear: (key?: string) => {
        if (key) {
            delete cache[key];
        } else {
            Object.keys(cache).forEach(k => delete cache[k]);
        }
    },
    // Alias for clear for more intuitive API
    delete: (key: string) => {
        delete cache[key];
    }
};

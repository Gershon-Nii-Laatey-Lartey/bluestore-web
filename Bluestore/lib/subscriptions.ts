/**
 * Subscription Utils
 * Helper functions to check user limits and tier status.
 */

import { supabase } from './supabase';

export interface SubscriptionStatus {
    can_publish: boolean;
    current_count: number;
    limit: number | null;
    package_name: string;
    is_premium: boolean;
    user_id: string;
}

export const subscriptions = {
    /**
     * Check if a user can publish a new listing based on their package
     */
    getUserStatus: async (userId: string): Promise<SubscriptionStatus> => {
        try {
            // 1. Get current active subscription
            const { data: subs } = await supabase
                .from('user_subscriptions')
                .select('package_id, subscription_packages(name, product_limit)')
                .eq('user_id', userId)
                .eq('status', 'active')
                .order('created_at', { ascending: false })
                .limit(1);

            // 2. Count active listings
            const { count } = await supabase
                .from('listings')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId)
                .neq('status', 'closed'); // Only count listings that aren't closed

            const activeSub = subs?.[0] as any;
            const subLimit = activeSub?.subscription_packages?.product_limit;
            const packageName = activeSub?.subscription_packages?.name || 'Free';
            
            // The "Free" tier is always 5.
            const baseFreeLimit = 5;
            
            // Calculate total limit. 
            // If the package IS "Free", we just use that limit (5).
            // If it's any other package, we ADD it to the base 5.
            let limit: number | null = baseFreeLimit;
            if (activeSub) {
                if (packageName === 'Free') {
                    limit = subLimit ?? baseFreeLimit;
                } else if (subLimit === null) {
                    limit = null; // Unlimited
                } else {
                    limit = subLimit + baseFreeLimit;
                }
            }

            const isPremium = packageName.toLowerCase().includes('premium') || limit === null;

            return {
                can_publish: isPremium || (count !== null && count < (limit as number)),
                current_count: count || 0,
                limit: limit,
                package_name: packageName,
                is_premium: isPremium,
                user_id: userId
            };
        } catch (error) {
            console.error('Error checking user status:', error);
            // Fallback to strict free limit if check fails
            return {
                can_publish: false,
                current_count: 0,
                limit: 5,
                package_name: 'Error/Free',
                is_premium: false,
                user_id: userId
            };
        }
    }
};

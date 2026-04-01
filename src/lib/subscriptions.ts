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
                .neq('status', 'closed');

            const activeSub = subs?.[0] as any;
            const subLimit = activeSub?.subscription_packages?.product_limit;
            const packageName = activeSub?.subscription_packages?.name || 'Free';
            
            const baseFreeLimit = 5;
            let limit: number | null = baseFreeLimit;
            if (activeSub) {
                if (packageName === 'Free') {
                    limit = subLimit ?? baseFreeLimit;
                } else if (subLimit === null) {
                    limit = null;
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

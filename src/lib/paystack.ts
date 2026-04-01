import axios from 'axios';
import { supabase } from './supabase';

const PAYSTACK_SECRET = import.meta.env.VITE_PAYSTACK_SECRET_KEY;
const BASE_URL = 'https://api.paystack.co';

export interface PaystackInitResponse {
    status: boolean;
    message: string;
    data: {
        authorization_url: string;
        access_code: string;
        reference: string;
    };
}

export const paystack = {
    initializeTransaction: async (
        email: string,
        amountGhs: number,
        metadata: any = {}
    ): Promise<PaystackInitResponse | null> => {
        const payload = {
            email,
            amount: Math.round(amountGhs * 100),
            currency: 'GHS',
            metadata: {
                ...metadata,
                custom_fields: Object.entries(metadata).map(([key, value]) => ({
                    display_name: key.replace(/_/g, ' '),
                    variable_name: key,
                    value: value?.toString() || ''
                }))
            },
        };

        try {
            const response = await axios.post(
                `${BASE_URL}/transaction/initialize`,
                payload,
                {
                    headers: {
                        Authorization: `Bearer ${PAYSTACK_SECRET}`,
                        'Content-Type': 'application/json',
                    },
                }
            );
            return response.data;
        } catch (error: any) {
            console.error('Paystack init error:', error.response?.data || error.message);
            return null;
        }
    },

    verifyTransaction: async (reference: string) => {
        try {
            const response = await axios.get(`${BASE_URL}/transaction/verify/${reference}`, {
                headers: {
                    Authorization: `Bearer ${PAYSTACK_SECRET}`,
                },
            });
            return response.data;
        } catch (error) {
            console.error('Paystack verify error:', error);
            return null;
        }
    },

    chargeMobileMoney: async (
        email: string,
        amountGhs: number,
        phoneNumber: string,
        metadata: any = {}
    ): Promise<any> => {
        const payload = {
            email,
            amount: Math.round(amountGhs * 100),
            currency: 'GHS',
            mobile_money: {
                phone: phoneNumber,
                provider: 'mtn'
            },
            metadata: {
                ...metadata,
                custom_fields: Object.entries(metadata).map(([key, value]) => ({
                    display_name: key.replace(/_/g, ' '),
                    variable_name: key,
                    value: value?.toString() || ''
                }))
            }
        };

        try {
            const response = await axios.post(`${BASE_URL}/charge`, payload, {
                headers: {
                    Authorization: `Bearer ${PAYSTACK_SECRET}`,
                    'Content-Type': 'application/json',
                },
            });
            return response.data;
        } catch (error: any) {
            console.error('Paystack charge error:', error.response?.data || error.message);
            const errorMsg = error.response?.data?.data?.message || error.response?.data?.message || 'Charge initialization failed';
            return { status: false, message: errorMsg };
        }
    },

    submitOTP: async (otp: string, reference: string) => {
        try {
            const response = await axios.post(`${BASE_URL}/charge/submit_otp`, 
                { otp, reference },
                {
                    headers: {
                        Authorization: `Bearer ${PAYSTACK_SECRET}`,
                        'Content-Type': 'application/json',
                    },
                }
            );
            return response.data;
        } catch (error: any) {
            console.error('Paystack submit OTP error:', error.response?.data || error.message);
            const errorMsg = error.response?.data?.data?.message || error.response?.data?.message || 'OTP submission failed';
            return { status: false, message: errorMsg };
        }
    },

    handleSuccessfulPayment: async (reference: string, userId: string): Promise<boolean> => {
        try {
            const verification = await paystack.verifyTransaction(reference);
            if (!verification || verification.data.status !== 'success') {
                return false;
            }

            let metadata = verification.data.metadata;
            if (typeof metadata === 'string' && metadata.startsWith('{')) {
                try { metadata = JSON.parse(metadata); } catch (e) { console.warn(e); }
            }

            const packageId = metadata?.package_id;
            const listingId = metadata?.listing_id;

            if (!packageId) return false;

            // 1. Log transaction
            await supabase.from('payment_transactions').insert({
                user_id: userId,
                amount: verification.data.amount / 100,
                reference,
                status: 'success',
                payment_method: verification.data.authorization?.channel || 'unknown',
                package_id: packageId,
                listing_id: listingId,
                metadata: verification.data
            });

            // 2. Fetch package
            const { data: pkg } = await supabase.from('subscription_packages').select('*').eq('id', packageId).single();
            if (!pkg) return false;

            // 3. Update User Subscription or Listing Boost
            if (pkg.package_type === 'subscription') {
                await supabase.from('user_subscriptions').update({ status: 'expired' }).eq('user_id', userId).eq('status', 'active');
                const endDate = pkg.duration_days ? new Date(Date.now() + pkg.duration_days * 24 * 60 * 60 * 1000).toISOString() : null;
                await supabase.from('user_subscriptions').insert({ user_id: userId, package_id: packageId, end_date: endDate, status: 'active' });
            } else if (pkg.package_type === 'boost' && listingId) {
                const endDate = new Date(Date.now() + pkg.duration_days * 24 * 60 * 60 * 1000).toISOString();
                await supabase.from('listing_boosts').insert({ user_id: userId, listing_id: listingId, package_id: packageId, end_date: endDate });
                await supabase.from('listings').update({ is_boosted: true, boost_expires_at: endDate, status: 'pending' }).eq('id', listingId);
            }

            return true;
        } catch (error) {
            console.error('Error handling payment success:', error);
            return false;
        }
    }
};

import base64 from 'base-64';

const HUBTEL_CLIENT_ID = process.env.EXPO_PUBLIC_HUBTEL_CLIENT_ID;
const HUBTEL_CLIENT_SECRET = process.env.EXPO_PUBLIC_HUBTEL_CLIENT_SECRET;
const HUBTEL_SENDER_ID = process.env.EXPO_PUBLIC_HUBTEL_SENDER_ID || 'Bluestore';

const authHeader = 'Basic ' + base64.encode(`${HUBTEL_CLIENT_ID}:${HUBTEL_CLIENT_SECRET}`);

/**
 * Hubtel Auth Implementation
 * Simple system: SMS-based OTP without prefix complications
 */

export interface HubtelSendResponse {
    success: boolean;
    otpCode?: string; // Stored locally for simple verification
    message?: string;
}

export const HubtelAuth = {
    /**
     * Sends a 6-digit OTP to the specified phone number using Hubtel SMS API
     */
    sendOTP: async (phoneNumber: string): Promise<HubtelSendResponse> => {
        try {
            // 1. Generate a 6-digit OTP
            const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

            // 2. Format phone (remove +)
            const formattedPhone = phoneNumber.replace('+', '');

            const message = `Your Bluestore verification code is ${otpCode}. Do not share this with anyone.`;

            console.log('Hubtel SMS Request:', {
                From: HUBTEL_SENDER_ID,
                To: formattedPhone,
                Content: message
            });

            // Using the primary Hubtel SMS Send API
            const response = await fetch(`https://smsc.hubtel.com/v1/messages/send`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': authHeader,
                },
                body: JSON.stringify({
                    From: HUBTEL_SENDER_ID,
                    To: formattedPhone,
                    Content: message,
                    RegisteredDelivery: true
                }),
            });

            const data = await response.json();
            console.log('Hubtel SMS Response:', data);

            // Hubtel SMS API usually returns status in 'status' or via response code
            if (response.status === 200 || response.status === 201) {
                return {
                    success: true,
                    otpCode: otpCode
                };
            }

            throw new Error(data.message || 'Failed to send SMS');
        } catch (error: any) {
            console.error('Hubtel Send OTP Error:', error);
            throw error;
        }
    }
};

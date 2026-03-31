import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'
const APP_NAME = 'Bluestore'

Deno.serve(async (req) => {
    try {
        const payload = await req.json()
        const { record, table, type } = payload

        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        let recipientIds: string[] = []
        let title = APP_NAME
        let body = ''
        let data = {}

        // 1. Handle New Messages: Bluestore: [User Name] - [Message]
        if (table === 'messages' && type === 'INSERT') {
            const { conversation_id, sender_id, text } = record

            const { data: participants } = await supabaseClient
                .from('conversation_participants')
                .select('user_id')
                .eq('conversation_id', conversation_id)
                .neq('user_id', sender_id)

            if (participants?.[0]) recipientIds.push(participants[0].user_id)

            const { data: sender } = await supabaseClient
                .from('profiles')
                .select('full_name, avatar_url')
                .eq('id', sender_id)
                .single()

            const avatarUrl = sender?.avatar_url

            body = `${sender?.full_name || 'Someone'}: ${text}`
            data = { screen: 'chat', conversationId: conversation_id, avatarUrl }
        }

        // 2. Handle New Listing Alerts (For Admins)
        if (table === 'listings' && type === 'INSERT') {
            const { data: admins } = await supabaseClient
                .from('profiles')
                .select('id')
                .eq('role', 'admin')

            recipientIds = admins?.map(a => a.id) || []
            title = `New Listing: ${record.title}`
            body = `A new item needs review in ${record.category}.`
            data = { screen: 'admin_listing', listingId: record.id }
        }

        // 3. Handle Listing Approvals (To User)
        if (table === 'listings' && type === 'UPDATE') {
            const { old_record, record: newRecord } = payload
            if (old_record?.status !== 'approved' && newRecord?.status === 'approved') {
                recipientIds.push(newRecord.user_id)
                title = 'Listing Approved! 🚀'
                body = `Your listing "${newRecord.title}" is now live.`
                data = { screen: 'product', productId: newRecord.id }
            }
        }

        // 4. Handle Verification Submissions (For Admins)
        if (table === 'seller_verifications' && type === 'INSERT') {
            const { data: admins } = await supabaseClient
                .from('profiles')
                .select('id')
                .eq('role', 'admin')

            recipientIds = admins?.map(a => a.id) || []
            title = 'New Verification Request'
            body = `A user has submitted documents for review.`
            data = { screen: 'admin_verifications' }
        }

        if (recipientIds.length === 0) return new Response('No recipients', { status: 200 })

        // Get all push tokens
        const { data: profiles } = await supabaseClient
            .from('profiles')
            .select('push_token')
            .in('id', recipientIds)

        const pushTokens = profiles?.map(p => p.push_token).filter(t => t?.startsWith('ExponentPushToken')) || []

        if (pushTokens.length === 0) return new Response('No valid tokens', { status: 200 })

        // Send notifications
        const notifications = pushTokens.map(token => ({
            to: token,
            title,
            body,
            data,
            sound: 'default',
            ...(table === 'messages' && type === 'INSERT' && (data as any).avatarUrl ? {
                // Android: Sender's photo as large icon
                // Small app icon (subscript) is handled by the OS using notification-icon.png
                mutableContent: true,
                attachments: [{ url: (data as any).avatarUrl }], // iOS
                largeIcon: (data as any).avatarUrl, // Android
            } : {})
        }))

        const response = await fetch(EXPO_PUSH_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(notifications),
        })

        const result = await response.json()
        return new Response(JSON.stringify(result), {
            headers: { 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { 'Content-Type': 'application/json' },
            status: 500,
        })
    }
})

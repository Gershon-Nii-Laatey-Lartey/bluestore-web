import { User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { decode } from 'base64-arraybuffer';

/**
 * Syncs the user profile with metadata from social providers (Google/Apple).
 * Specifically downloads the profile photo and saves it to Supabase Storage.
 */
export async function syncSocialProfile(user: User) {
    if (!user) return;

    try {
        const metadata = user.user_metadata;
        const avatarUrl = metadata?.avatar_url || metadata?.picture;
        const fullName = metadata?.full_name || metadata?.name;

        // 1. Fetch current profile to see if we already have a name/avatar
        const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, avatar_url')
            .eq('id', user.id)
            .single();

        let updates: any = {};

        // 2. Sync full name if missing
        if (!profile?.full_name && fullName) {
            updates.full_name = fullName;
        }

        // 3. Sync avatar if missing and we have a social one
        if (!profile?.avatar_url && avatarUrl) {
            const uploadedUrl = await downloadAndUploadAvatar(user.id, avatarUrl);
            if (uploadedUrl) {
                updates.avatar_url = uploadedUrl;
            }
        }

        // 4. Update profile if there are changes
        if (Object.keys(updates).length > 0) {
            await supabase
                .from('profiles')
                .update(updates)
                .eq('id', user.id);
        }
    } catch (error) {
        console.error('Error syncing social profile:', error);
    }
}

/**
 * Downloads an image from a URL and uploads it to the Supabase 'avatars' bucket.
 */
async function downloadAndUploadAvatar(userId: string, url: string): Promise<string | null> {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        
        // Supabase JS library handles Blob in browser/RN
        const fileName = `${userId}_social_${Date.now()}.jpg`;
        const { error } = await supabase.storage
            .from('avatars')
            .upload(fileName, blob, {
                contentType: 'image/jpeg',
                upsert: true
            });

        if (error) throw error;

        const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(fileName);

        return publicUrl;
    } catch (error) {
        console.error('Error downloading/uploading social avatar:', error);
        return null;
    }
}

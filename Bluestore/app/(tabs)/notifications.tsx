import { ReviewSheet } from '@/components/ReviewSheet';
import { dataCache } from '@/lib/cache';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const BLUE = '#0057FF';

interface Notification {
    id: string;
    type: string;
    title: string;
    message: string;
    is_read: boolean;
    created_at: string;
    payload: any;
}

export default function NotificationsScreen() {
    const router = useRouter();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [isReviewVisible, setIsReviewVisible] = useState(false);
    const [activeReview, setActiveReview] = useState<any>(null);

    useEffect(() => {
        fetchNotifications();
    }, []);

    const fetchNotifications = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Filter out notifications for 'pending' status
            const fetched = (data || []).filter(n => {
                if (n.type === 'listing_status' && n.payload?.status === 'pending') return false;
                return true;
            });

            setNotifications(fetched);
            dataCache.set('unread_notifications_count', fetched.filter(n => !n.is_read).length);
        } catch (error) {
            console.error('Error fetching notifications:', error);
        } finally {
            setIsLoading(false);
            setRefreshing(false);
        }
    };

    const markAsRead = async (id: string) => {
        try {
            const { error } = await supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('id', id);

            if (error) throw error;
            setNotifications(prev => {
                const updated = prev.map(n => n.id === id ? { ...n, is_read: true } : n);
                const unreadCount = updated.filter(n => !n.is_read).length;
                dataCache.set('unread_notifications_count', unreadCount);
                return updated;
            });
        } catch (error) {
            console.error('Error marking as read:', error);
        }
    };

    const deleteNotification = async (id: string) => {
        try {
            const { error } = await supabase
                .from('notifications')
                .delete()
                .eq('id', id);

            if (error) throw error;
            setNotifications(prev => {
                const updated = prev.filter(n => n.id !== id);
                dataCache.set('unread_notifications_count', updated.filter(n => !n.is_read).length);
                return updated;
            });
        } catch (error) {
            console.error('Error deleting notification:', error);
        }
    };

    const clearAllNotifications = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { error } = await supabase
                .from('notifications')
                .delete()
                .eq('user_id', user.id);

            if (error) throw error;
            setNotifications([]);
            dataCache.set('unread_notifications_count', 0);
        } catch (error) {
            console.error('Error clearing all notifications:', error);
        }
    };

    const markAllAsRead = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { error } = await supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('user_id', user.id)
                .eq('is_read', false);

            if (error) throw error;
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
            dataCache.set('unread_notifications_count', 0);
        } catch (error) {
            console.error('Error marking all as read:', error);
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'listing_status':
                return { name: 'list-outline', color: BLUE, bg: '#F0F4FF' };
            case 'message':
                return { name: 'mail-outline', color: '#FF9500', bg: '#FFF9F0' };
            case 'verification':
                return { name: 'shield-checkmark-outline', color: '#27AE60', bg: '#E0F9E9' };
            case 'offer':
                return { name: 'pricetag-outline', color: '#AF52DE', bg: '#F8F0FF' };
            case 'review_request':
                return { name: 'star-outline', color: '#FFB800', bg: '#FFFCEB' };
            default:
                return { name: 'notifications-outline', color: '#8A8A8A', bg: '#F5F5F5' };
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchNotifications();
    };

    const renderItem = ({ item }: { item: Notification }) => {
        const icon = getIcon(item.type);
        const date = new Date(item.created_at);
        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });

        return (
            <TouchableOpacity
                style={[styles.notificationCard, !item.is_read && styles.unreadCard]}
                onPress={() => {
                    markAsRead(item.id);
                    // Handle navigation based on payload if needed
                    if (item.type === 'listing_status' && item.payload?.listing_id) {
                        router.push({ pathname: '/(tabs)/product/[id]', params: { id: item.payload.listing_id } });
                    } else if (item.type === 'message' && item.payload?.chat_room_id) {
                        router.push({ pathname: '/chat/[id]', params: { id: item.payload.chat_room_id } });
                    } else if (item.type === 'review_request' && item.payload) {
                        setActiveReview(item.payload);
                        setIsReviewVisible(true);
                    }
                }}
            >
                <View style={[styles.iconBox, { backgroundColor: icon.bg }]}>
                    <Ionicons name={icon.name as any} size={22} color={icon.color} />
                </View>
                <View style={styles.content}>
                    <View style={styles.topRow}>
                        <View style={{ flex: 1, marginRight: 8 }}>
                            <Text style={[styles.title, !item.is_read && styles.unreadTitle]}>{item.title}</Text>
                        </View>
                        <TouchableOpacity
                            onPress={() => deleteNotification(item.id)}
                            style={styles.deleteBtn}
                        >
                            <Ionicons name="trash-outline" size={16} color="#BABABA" />
                        </TouchableOpacity>
                    </View>
                    <Text style={styles.message} numberOfLines={2}>{item.message}</Text>
                    <Text style={styles.time}>{dateStr}, {timeStr}</Text>
                </View>
                {!item.is_read && <View style={styles.unreadDot} />}
            </TouchableOpacity>
        );
    };

    const { from } = useLocalSearchParams();

    const handleBack = () => {
        if (from === 'profile') {
            router.push('/(tabs)/profile');
        } else if (from === 'home') {
            router.push('/(tabs)');
        } else if (router.canGoBack()) {
            router.back();
        } else {
            router.push('/(tabs)/profile');
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <Stack.Screen options={{ headerShown: false }} />

            <View style={styles.header}>
                <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={24} color="#111111" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Notifications</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                    {notifications.length > 0 && (
                        <TouchableOpacity onPress={clearAllNotifications}>
                            <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                        </TouchableOpacity>
                    )}
                    {notifications.some(n => !n.is_read) ? (
                        <TouchableOpacity onPress={markAllAsRead}>
                            <Ionicons name="checkmark-done" size={20} color={BLUE} />
                        </TouchableOpacity>
                    ) : (
                        <View style={{ width: 24 }} />
                    )}
                </View>
            </View>

            {isLoading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={BLUE} />
                </View>
            ) : (
                <FlatList
                    data={notifications}
                    renderItem={renderItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.list}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BLUE} />
                    }
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <View style={styles.emptyIconCircle}>
                                <Ionicons name="notifications-off-outline" size={48} color="#ABABAB" />
                            </View>
                            <Text style={styles.emptyTitle}>No notifications yet</Text>
                            <Text style={styles.emptyDesc}>We'll notify you when something important happens.</Text>
                        </View>
                    }
                />
            )}

            {activeReview && (
                <ReviewSheet
                    visible={isReviewVisible}
                    onClose={() => setIsReviewVisible(false)}
                    listingId={activeReview.listing_id}
                    sellerId={activeReview.seller_id}
                    listingTitle={activeReview.listing_title}
                    onSuccess={() => {
                        // Optional: mark notification as read or delete it
                        fetchNotifications();
                    }}
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    backBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#F5F5F5',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#111111' },
    markReadText: { fontSize: 12, fontWeight: '700', color: BLUE },
    list: { padding: 16, paddingBottom: 40 },
    notificationCard: {
        flexDirection: 'row',
        padding: 16,
        borderRadius: 16,
        backgroundColor: '#FFFFFF',
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#F0F0F0',
        alignItems: 'center',
    },
    unreadCard: {
        backgroundColor: '#F7FBFF',
        borderColor: '#E1E9F5',
    },
    iconBox: {
        width: 48,
        height: 48,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    content: { flex: 1, marginLeft: 16 },
    topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
    title: { fontSize: 15, fontWeight: '700', color: '#111111' },
    unreadTitle: { color: BLUE },
    deleteBtn: { padding: 4, marginTop: -4, marginRight: -4 },
    time: { fontSize: 11, color: '#ABABAB', marginTop: 6 },
    message: { fontSize: 13, color: '#666666', lineHeight: 18 },
    unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: BLUE, marginLeft: 10, position: 'absolute', top: 16, right: 16 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    empty: { alignItems: 'center', justifyContent: 'center', marginTop: 100, paddingHorizontal: 40 },
    emptyIconCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#F9F9F9',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
    },
    emptyTitle: { fontSize: 20, fontWeight: '800', color: '#111111', marginBottom: 8 },
    emptyDesc: { fontSize: 14, color: '#8A8A8A', textAlign: 'center', lineHeight: 22 },
});

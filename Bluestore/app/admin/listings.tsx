import { supabase } from '@/lib/supabase';
import { Feather, Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

const BLUE = '#0057FF';

export default function ListingModeration() {
    const router = useRouter();
    const [listings, setListings] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected'>('pending');

    useEffect(() => {
        fetchListings();
    }, [activeTab]);

    const fetchListings = async (isRefresh = false) => {
        if (!isRefresh) setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('listings')
                .select('id, title, price, description, location, category, brand, condition, images, user_id, status, created_at, updated_at, location_structured, user:profiles(full_name, avatar_url, is_verified)')
                .eq('status', activeTab)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setListings(data || []);
        } catch (error) {
            console.error('Error fetching listings:', error);
        } finally {
            setIsLoading(false);
            setRefreshing(false);
        }
    };

    const handleAction = async (listingId: string, action: 'approved' | 'rejected' | 'pending' | 'draft' | 'delete') => {
        try {
            if (action === 'delete') {
                const { error } = await supabase.from('listings').delete().eq('id', listingId);
                if (error) throw error;
                Alert.alert('Deleted', 'Listing has been permanently removed.');
            } else {
                const { error } = await supabase
                    .from('listings')
                    .update({ status: action })
                    .eq('id', listingId);
                if (error) throw error;
                Alert.alert('Success', `Listing moved to ${action}.`);
            }
            setListings(prev => prev.filter(l => l.id !== listingId));
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Action failed.');
        }
    };

    const confirmDelete = (id: string, title: string) => {
        Alert.alert('Delete Listing', `Are you sure you want to permanently delete "${title}"?`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'DELETE', style: 'destructive', onPress: () => handleAction(id, 'delete') }
        ]);
    };

    const Tab = ({ label, value }: { label: string, value: typeof activeTab }) => (
        <TouchableOpacity
            style={[styles.tab, activeTab === value && styles.tabActive]}
            onPress={() => setActiveTab(value)}
        >
            <Text style={[styles.tabText, activeTab === value && styles.tabTextActive]}>{label}</Text>
        </TouchableOpacity>
    );

    const renderListing = ({ item }: { item: any }) => (
        <View style={styles.card}>
            <View style={styles.cardTop}>
                <Image source={{ uri: item.images?.[0] }} style={styles.listingImg} />
                <View style={styles.listingMeta}>
                    <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.price}>GH₵{item.price}</Text>
                    <View style={styles.sellerRow}>
                        <Image source={{ uri: item.user?.avatar_url }} style={styles.sellerAvatar} />
                        <Text style={styles.sellerName}>{item.user?.full_name || 'Seller'}</Text>
                        {item.user?.is_verified && <Ionicons name="checkmark-circle" size={14} color={BLUE} />}
                    </View>
                </View>
                <View style={styles.topRightActions}>
                    <TouchableOpacity
                        style={styles.actionIconBtn}
                        onPress={() => router.push({ pathname: '/(tabs)/product/edit/[id]', params: { id: item.id } } as any)}
                    >
                        <Feather name="edit-3" size={16} color="#8A8A8A" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.actionIconBtn}
                        onPress={() => confirmDelete(item.id, item.title)}
                    >
                        <Feather name="trash-2" size={16} color="#FF4136" />
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.cardActions}>
                {activeTab === 'pending' ? (
                    <>
                        <TouchableOpacity
                            style={[styles.btn, styles.approveBtn]}
                            onPress={() => handleAction(item.id, 'approved')}
                        >
                            <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                            <Text style={styles.btnText}>Approve</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.btn, styles.rejectBtn]}
                            onPress={() => handleAction(item.id, 'rejected')}
                        >
                            <Ionicons name="close" size={20} color="#FFFFFF" />
                            <Text style={styles.btnText}>Reject</Text>
                        </TouchableOpacity>
                    </>
                ) : (
                    <>
                        <TouchableOpacity
                            style={styles.revertBtn}
                            onPress={() => handleAction(item.id, 'pending')}
                        >
                            <Text style={styles.revertText}>Move back to Pending</Text>
                        </TouchableOpacity>
                        {activeTab === 'approved' && (
                            <TouchableOpacity
                                style={styles.hideBtn}
                                onPress={() => handleAction(item.id, 'draft')}
                            >
                                <Feather name="eye-off" size={14} color="#8A8A8A" />
                                <Text style={styles.hideText}>Hide (Draft)</Text>
                            </TouchableOpacity>
                        )}
                    </>
                )}

                <TouchableOpacity
                    style={styles.detailsBtn}
                    onPress={() => router.push({ pathname: '/product/[id]', params: { id: item.id } })}
                >
                    <Feather name="eye" size={18} color="#8A8A8A" />
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ title: 'Manage Listings' }} />

            <View style={styles.tabsContainer}>
                <Tab label="Pending" value="pending" />
                <Tab label="Approved" value="approved" />
                <Tab label="Rejected" value="rejected" />
            </View>

            <FlatList
                data={listings}
                keyExtractor={item => item.id}
                renderItem={renderListing}
                contentContainerStyle={styles.listContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchListings(true)} tintColor={BLUE} />}
                ListEmptyComponent={() => (
                    <View style={styles.emptyContainer}>
                        {isLoading ? (
                            <ActivityIndicator color={BLUE} />
                        ) : (
                            <>
                                <Ionicons name="cube-outline" size={48} color="#EBEBEB" />
                                <Text style={styles.emptyText}>No listings to moderate.</Text>
                            </>
                        )}
                    </View>
                )}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    tabsContainer: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#F5F5F5',
        gap: 10,
    },
    tab: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: '#F9F9F9',
        alignItems: 'center',
    },
    tabActive: { backgroundColor: '#111111' },
    tabText: { fontSize: 13, fontWeight: '700', color: '#8A8A8A' },
    tabTextActive: { color: '#FFFFFF' },

    listContent: { padding: 20 },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#F0F0F0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    cardTop: { flexDirection: 'row', gap: 15, marginBottom: 15 },
    listingImg: { width: 80, height: 80, borderRadius: 12, backgroundColor: '#F9F9F9' },
    listingMeta: { flex: 1, justifyContent: 'center' },
    topRightActions: { gap: 10 },
    actionIconBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#F9F9F9', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#F0F0F0' },
    title: { fontSize: 16, fontWeight: '800', color: '#111111', marginBottom: 4 },
    price: { fontSize: 17, fontWeight: '900', color: BLUE, marginBottom: 6 },
    sellerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    sellerAvatar: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#F0F0F0' },
    sellerName: { fontSize: 12, fontWeight: '600', color: '#8A8A8A' },

    cardActions: { flexDirection: 'row', gap: 10, alignItems: 'center' },
    btn: {
        flex: 1,
        height: 44,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    approveBtn: { backgroundColor: '#00B850' },
    rejectBtn: { backgroundColor: '#FF4136' },
    btnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
    detailsBtn: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#F9F9F9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    revertBtn: { flex: 1, height: 44, justifyContent: 'center', alignItems: 'center' },
    revertText: { color: BLUE, fontSize: 13, fontWeight: '700', textDecorationLine: 'underline' },
    hideBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12 },
    hideText: { color: '#8A8A8A', fontSize: 12, fontWeight: '600' },

    emptyContainer: { paddingVertical: 100, alignItems: 'center' },
    emptyText: { marginTop: 12, fontSize: 15, color: '#ABABAB', fontWeight: '500' },
});

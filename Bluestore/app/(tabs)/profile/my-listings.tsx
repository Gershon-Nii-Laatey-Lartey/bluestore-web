import { BuyerSelectionSheet } from '@/components/BuyerSelectionSheet';
import { supabase } from '@/lib/supabase';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    FlatList,
    Image,
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const BLUE = '#0057FF';
const { width } = Dimensions.get('window');

type LayoutType = 'list' | 'grid';

export default function MyListingsScreen() {
    const router = useRouter();
    const [listings, setListings] = useState<any[]>([]);
    const [filteredListings, setFilteredListings] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [layout, setLayout] = useState<LayoutType>('list');

    // Menu State
    const [menuVisible, setMenuVisible] = useState(false);
    const [selectedListing, setSelectedListing] = useState<any>(null);
    const [isBuyerSelectVisible, setIsBuyerSelectVisible] = useState(false);

    // Stats
    const [stats, setStats] = useState({
        total: 0,
        active: 0,
        pending: 0,
        sold: 0
    });

    useEffect(() => {
        fetchMyListings();
    }, []);

    useEffect(() => {
        if (searchQuery.trim() === '') {
            setFilteredListings(listings);
        } else {
            const filtered = listings.filter(item =>
                item.title.toLowerCase().includes(searchQuery.toLowerCase())
            );
            setFilteredListings(filtered);
        }
    }, [searchQuery, listings]);

    const fetchMyListings = async () => {
        try {
            setIsLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not logged in');

            const { data, error } = await supabase
                .from('listings')
                .select('id, title, price, description, location, category, brand, condition, images, user_id, status, created_at, updated_at, location_structured, is_boosted, boost_expires_at')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            const fetchedListings = data || [];
            setListings(fetchedListings);
            setFilteredListings(fetchedListings);

            setStats({
                total: fetchedListings.length,
                active: fetchedListings.filter(l => l.status === 'approved').length,
                pending: fetchedListings.filter(l => l.status === 'pending').length,
                sold: fetchedListings.filter(l => l.status === 'closed').length
            });

        } catch (error: any) {
            console.error('Fetch listings error:', error);
            Alert.alert('Error', error.message || 'Failed to load your listings');
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    const handleRefresh = () => {
        setIsRefreshing(true);
        fetchMyListings();
    };

    const openMenu = (item: any) => {
        setSelectedListing(item);
        setMenuVisible(true);
    };

    const handleConfirmSold = async (buyerId?: string) => {
        setIsBuyerSelectVisible(false);
        if (!selectedListing) return;

        try {
            const { error: listingError } = await supabase
                .from('listings')
                .update({ status: 'closed' })
                .eq('id', selectedListing.id);

            if (listingError) throw listingError;

            if (buyerId) {
                // Send notification to buyer
                const { data: { user: seller } } = await supabase.auth.getUser();
                if (seller) {
                    await supabase.from('notifications').insert({
                        user_id: buyerId,
                        type: 'review_request',
                        title: 'How was your purchase?',
                        content: `You've been marked as the buyer of "${selectedListing.title}". Help other users by leaving a review for the seller!`,
                        payload: {
                            listing_id: selectedListing.id,
                            seller_id: seller.id,
                            listing_title: selectedListing.title
                        }
                    });
                }
            }

            fetchMyListings();
            Alert.alert('Listing Closed', 'Item successfully marked as sold.');

        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to close listing');
        }
    };

    const handleAction = async (action: 'edit' | 'close' | 'delete' | 'republish') => {
        setMenuVisible(false);
        if (!selectedListing) return;

        if (action === 'edit') {
            router.push({ pathname: '/(tabs)/product/edit/[id]', params: { id: selectedListing.id } });
        } else if (action === 'close') {
            setIsBuyerSelectVisible(true);
        } else if (action === 'republish') {
            Alert.alert(
                'List Again',
                'Make this item available for sale again?',
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Yes, List Again',
                        onPress: async () => {
                            const { error } = await supabase
                                .from('listings')
                                .update({ status: 'approved' })
                                .eq('id', selectedListing.id);

                            if (error) Alert.alert('Error', error.message);
                            else {
                                Alert.alert('Success', 'Item is now available for sale!');
                                fetchMyListings();
                            }
                        }
                    }
                ]
            );
        } else if (action === 'delete') {
            Alert.alert(
                'Delete Listing',
                'This action cannot be undone. Are you sure?',
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: async () => {
                            try {
                                // 1. Attempt to clean up engagement records (ignoring errors if DB already has cascades)
                                try {
                                    await Promise.allSettled([
                                        supabase.from('listing_chats').delete().eq('listing_id', selectedListing.id),
                                        supabase.from('listing_calls').delete().eq('listing_id', selectedListing.id),
                                        supabase.from('viewed_listings').delete().eq('listing_id', selectedListing.id),
                                        supabase.from('listing_impressions').delete().eq('listing_id', selectedListing.id),
                                        supabase.from('saved_listings').delete().eq('listing_id', selectedListing.id)
                                    ]);
                                } catch (e) {
                                    console.warn('Silent skip on auxiliary cleanup:', e);
                                }

                                // 2. Delete the actual listing
                                const { error } = await supabase
                                    .from('listings')
                                    .delete()
                                    .eq('id', selectedListing.id);

                                if (error) throw error;
                                fetchMyListings();
                                Alert.alert('Success', 'Listing deleted permanently.');
                            } catch (error: any) {
                                Alert.alert('Error', error.message || 'Failed to delete listing. Please ensure all related chats are closed.');
                            }
                        }
                    }
                ]
            );
        }
    };

    const getStatusStyle = (status: string) => {
        switch (status.toLowerCase()) {
            case 'approved':
                return { bg: '#E8F5E9', text: '#2E7D32', label: 'Active' };
            case 'pending':
                return { bg: '#FFF3E0', text: '#EF6C00', label: 'Reviewing' };
            case 'closed':
            case 'sold':
                return { bg: '#F5F5F5', text: '#616161', label: 'Sold' };
            case 'rejected':
                return { bg: '#FFEBEE', text: '#C62828', label: 'Rejected' };
            default:
                return { bg: '#F5F5F5', text: '#9E9E9E', label: status };
        }
    };

    const renderGridItem = ({ item }: { item: any }) => {
        const status = getStatusStyle(item.status);
        return (
            <TouchableOpacity
                style={styles.gridCard}
                onPress={() => router.push({ pathname: '/(tabs)/product/[id]', params: { id: item.id } })}
            >
                <Image source={{ uri: item.images[0] }} style={styles.gridImg} />
                <View style={[styles.gridStatus, { backgroundColor: status.bg }]}>
                    <Text style={[styles.statusText, { color: status.text }]}>{status.label}</Text>
                </View>
                {item.is_boosted && (
                    <View style={styles.gridBoostOverlay}>
                        <View style={styles.gridBoostBadge}>
                            <Ionicons name="flash" size={10} color="#FFF" />
                            <Text style={styles.gridBoostText}>BOOSTED</Text>
                        </View>
                        {item.boost_expires_at && (
                            <View style={styles.expiryBadge}>
                                <Text style={styles.expiryText}>
                                    {Math.max(0, Math.ceil((new Date(item.boost_expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))}d left
                                </Text>
                            </View>
                        )}
                    </View>
                )}
                <View style={styles.gridInfo}>
                    <Text style={styles.gridTitle} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.gridPrice}>GH₵ {parseFloat(item.price).toLocaleString()}</Text>
                </View>
                <TouchableOpacity
                    style={styles.menuTriggerSmall}
                    onPress={() => openMenu(item)}
                >
                    <Feather name="more-vertical" size={16} color="#FFF" />
                </TouchableOpacity>
            </TouchableOpacity>
        );
    };

    const renderListItem = ({ item }: { item: any }) => {
        const status = getStatusStyle(item.status);
        return (
            <TouchableOpacity
                style={styles.listCard}
                onPress={() => router.push({ pathname: '/(tabs)/product/[id]', params: { id: item.id } })}
            >
                <Image source={{ uri: item.images[0] }} style={styles.listImg} />
                <View style={styles.listInfo}>
                    <View>
                        <View style={styles.listHeaderRow}>
                            <Text style={styles.listTitle} numberOfLines={1}>{item.title}</Text>
                            <TouchableOpacity
                                onPress={() => openMenu(item)}
                                style={styles.menuTrigger}
                            >
                                <Feather name="more-horizontal" size={20} color="#666" />
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.listPrice}>GH₵ {parseFloat(item.price).toLocaleString()}</Text>
                        {item.is_boosted && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
                                <View style={styles.listBoostBadge}>
                                    <Ionicons name="flash" size={10} color="#FFF" />
                                    <Text style={styles.listBoostText}>BOOSTED</Text>
                                </View>
                                {item.boost_expires_at && (
                                    <View style={[styles.expiryBadge, { marginTop: 6 }]}>
                                        <Text style={styles.expiryText}>
                                            {Math.max(0, Math.ceil((new Date(item.boost_expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))}d left
                                        </Text>
                                    </View>
                                )}
                            </View>
                        )}
                    </View>

                    <View style={styles.listFooter}>
                        <View style={[styles.pillBadge, { backgroundColor: status.bg }]}>
                            <Text style={[styles.pillText, { color: status.text }]}>{status.label.toUpperCase()}</Text>
                        </View>
                        <Text style={styles.dateText}>{new Date(item.created_at).toLocaleDateString()}</Text>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Custom Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.push('/(tabs)/profile')} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#111111" />
                </TouchableOpacity>
                <View style={styles.headerContent}>
                    <Text style={styles.headerTitle}>My Listings</Text>
                    <Text style={styles.headerSub}>{stats.total} total items listed</Text>
                </View>
                <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/(tabs)/publish')}>
                    <Feather name="plus" size={20} color="#FFF" />
                </TouchableOpacity>
            </View>

            {/* Controls Section (Moved Search up) */}
            <View style={styles.controls}>
                <View style={styles.searchWrapper}>
                    <Ionicons name="search" size={18} color="#ABABAB" />
                    <TextInput
                        placeholder="Search your items..."
                        style={styles.searchInput}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholderTextColor="#ABABAB"
                    />
                </View>
                <View style={styles.layoutToggle}>
                    <TouchableOpacity
                        style={[styles.toggleBtn, layout === 'list' && styles.toggleActive]}
                        onPress={() => setLayout('list')}
                    >
                        <Ionicons name="list" size={18} color={layout === 'list' ? BLUE : '#666'} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.toggleBtn, layout === 'grid' && styles.toggleActive]}
                        onPress={() => setLayout('grid')}
                    >
                        <Ionicons name="grid" size={18} color={layout === 'grid' ? BLUE : '#666'} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Quick Stats Bar (Now after search) */}
            <View style={styles.statsBar}>
                <View style={[styles.statItem, { backgroundColor: '#F0F4FF' }]}>
                    <Text style={[styles.statVal, { color: BLUE }]}>{stats.active}</Text>
                    <Text style={styles.statLabel}>Active</Text>
                </View>
                <View style={[styles.statItem, { backgroundColor: '#FFF7ED' }]}>
                    <Text style={[styles.statVal, { color: '#EA580C' }]}>{stats.pending}</Text>
                    <Text style={styles.statLabel}>Pending</Text>
                </View>
                <View style={[styles.statItem, { backgroundColor: '#F0FDFA' }]}>
                    <Text style={[styles.statVal, { color: '#0D9488' }]}>{stats.sold}</Text>
                    <Text style={styles.statLabel}>Sold</Text>
                </View>
            </View>

            {isLoading && !isRefreshing ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={BLUE} />
                </View>
            ) : (
                <FlatList
                    key={layout}
                    data={filteredListings}
                    renderItem={layout === 'grid' ? renderGridItem : renderListItem}
                    numColumns={layout === 'grid' ? 2 : 1}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.listContent}
                    columnWrapperStyle={layout === 'grid' ? styles.gridRow : null}
                    refreshing={isRefreshing}
                    onRefresh={handleRefresh}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <View style={styles.emptyIconCircle}>
                                <Feather name="package" size={40} color="#ABABAB" />
                            </View>
                            <Text style={styles.emptyTitle}>
                                {searchQuery ? 'No matching items' : 'Your store is empty'}
                            </Text>
                            <Text style={styles.emptyDesc}>
                                {searchQuery ? 'Try searching for something else.' : 'Start earning by listing your first item today!'}
                            </Text>
                        </View>
                    }
                />
            )}

            {/* Action Menu Modal */}
            <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setMenuVisible(false)}
                >
                    <View style={styles.menuContainer}>
                        <View style={styles.menuHeader}>
                            <Text style={styles.menuHeaderText} numberOfLines={1}>{selectedListing?.title}</Text>
                        </View>

                        <TouchableOpacity style={styles.menuItem} onPress={() => handleAction('edit')}>
                            <Feather name="edit-3" size={18} color="#111111" />
                            <Text style={styles.menuItemText}>Edit Listing</Text>
                        </TouchableOpacity>

                        {selectedListing?.status === 'closed' ? (
                            <TouchableOpacity style={styles.menuItem} onPress={() => handleAction('republish')}>
                                <Feather name="refresh-cw" size={18} color={BLUE} />
                                <Text style={[styles.menuItemText, { color: BLUE }]}>List Again</Text>
                            </TouchableOpacity>
                        ) : (
                            selectedListing?.status === 'approved' && (
                                <TouchableOpacity style={styles.menuItem} onPress={() => handleAction('close')}>
                                    <Feather name="check-circle" size={18} color="#2E7D32" />
                                    <Text style={[styles.menuItemText, { color: '#2E7D32' }]}>Mark as Sold</Text>
                                </TouchableOpacity>
                            )
                        )}

                        <TouchableOpacity style={styles.menuItem} onPress={() => handleAction('delete')}>
                            <Feather name="trash-2" size={18} color="#C62828" />
                            <Text style={[styles.menuItemText, { color: '#C62828' }]}>Delete Permanently</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.menuClose} onPress={() => setMenuVisible(false)}>
                            <Text style={styles.menuCloseText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

            <BuyerSelectionSheet
                visible={isBuyerSelectVisible}
                onClose={() => setIsBuyerSelectVisible(false)}
                listingId={selectedListing?.id}
                onSelect={handleConfirmSold}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 15,
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F8F8F8',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerContent: {
        flex: 1,
        marginLeft: 15,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#111111',
    },
    headerSub: {
        fontSize: 12,
        color: '#8A8A8A',
        fontWeight: '600',
        marginTop: 2,
    },
    addBtn: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: '#111111',
        alignItems: 'center',
        justifyContent: 'center',
    },
    statsBar: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        gap: 12,
        marginBottom: 20,
    },
    statItem: {
        flex: 1,
        padding: 12,
        borderRadius: 16,
        alignItems: 'center',
    },
    statVal: {
        fontSize: 18,
        fontWeight: '800',
    },
    statLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: '#666',
        marginTop: 2,
        textTransform: 'uppercase',
    },
    controls: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        alignItems: 'center',
        gap: 12,
        marginVertical: 10,
    },
    searchWrapper: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F5F5F5',
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 44,
    },
    searchInput: {
        flex: 1,
        marginLeft: 8,
        fontSize: 14,
        color: '#111111',
        height: '100%',
    },
    layoutToggle: {
        flexDirection: 'row',
        backgroundColor: '#F5F5F5',
        borderRadius: 12,
        padding: 4,
    },
    toggleBtn: {
        width: 36,
        height: 36,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    toggleActive: {
        backgroundColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 1,
    },
    listContent: {
        paddingHorizontal: 20,
        paddingBottom: 30,
    },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    // List Card Styles
    listCard: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 12,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#F0F0F0',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.03,
        shadowRadius: 8,
    },
    listImg: {
        width: 100,
        height: 100,
        borderRadius: 16,
        backgroundColor: '#F5F5F5',
    },
    listInfo: {
        flex: 1,
        marginLeft: 15,
        justifyContent: 'space-between',
        paddingVertical: 2,
    },
    listHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    listTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111111',
        flex: 1,
    },
    menuTrigger: {
        padding: 4,
        marginRight: -4,
    },
    listPrice: {
        fontSize: 16,
        fontWeight: '800',
        color: BLUE,
        marginTop: 2,
    },
    listFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    pillBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
    },
    pillText: {
        fontSize: 10,
        fontWeight: '800',
    },
    dateText: {
        fontSize: 11,
        color: '#ABABAB',
        fontWeight: '600',
    },

    // Grid Card Styles
    gridRow: {
        justifyContent: 'space-between',
    },
    gridCard: {
        width: (width - 52) / 2,
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#F0F0F0',
        overflow: 'hidden',
        position: 'relative',
    },
    gridImg: {
        width: '100%',
        height: 160,
        backgroundColor: '#F5F5F5',
    },
    gridStatus: {
        position: 'absolute',
        top: 10,
        left: 10,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    statusText: {
        fontSize: 9,
        fontWeight: '800',
    },
    gridInfo: {
        padding: 12,
    },
    gridTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#111111',
    },
    gridPrice: {
        fontSize: 14,
        fontWeight: '800',
        color: BLUE,
        marginTop: 4,
    },
    menuTriggerSmall: {
        position: 'absolute',
        top: 10,
        right: 10,
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
    },

    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'flex-end',
    },
    menuContainer: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        paddingBottom: 40,
    },
    menuHeader: {
        marginBottom: 20,
        paddingBottom: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#F5F5F5',
    },
    menuHeaderText: {
        fontSize: 16,
        fontWeight: '800',
        color: '#111111',
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 15,
        gap: 16,
    },
    menuItemText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111111',
    },
    menuClose: {
        marginTop: 10,
        paddingVertical: 15,
        alignItems: 'center',
        backgroundColor: '#F9F9F9',
        borderRadius: 16,
    },
    menuCloseText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#666',
    },

    // Empty State
    empty: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 60,
        paddingHorizontal: 40,
    },
    emptyIconCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#F9F9F9',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#111111',
        marginBottom: 8,
    },
    emptyDesc: {
        fontSize: 14,
        color: '#8A8A8A',
        textAlign: 'center',
        lineHeight: 20,
    },
    gridBoostBadge: {
        position: 'absolute',
        top: 130,
        left: 10,
        backgroundColor: '#FF9500',
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 6,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
    },
    gridBoostText: {
        fontSize: 8,
        fontWeight: '900',
        color: '#FFF',
    },
    listBoostBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FF9500',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        alignSelf: 'flex-start',
        marginTop: 6,
        gap: 4,
    },
    listBoostText: {
        fontSize: 9,
        fontWeight: '900',
        color: '#FFF',
    },
    gridBoostOverlay: {
        position: 'absolute',
        top: 130,
        left: 10,
        right: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    expiryBadge: {
        backgroundColor: 'rgba(255,255,255,0.9)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#FF9500',
    },
    expiryText: {
        fontSize: 8,
        fontWeight: '700',
        color: '#FF9500',
    },
});

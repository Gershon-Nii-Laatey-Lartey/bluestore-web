import { LocationSelector } from '@/components/LocationSelector';
import { ProductCard } from '@/components/ProductCard';
import { Skeleton } from '@/components/Skeleton';
import { useLocation } from '@/context/LocationContext';
import { dataCache } from '@/lib/cache';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Dimensions,
    FlatList,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');
const BLUE = '#0057FF';

export default function SavedScreen() {
    const router = useRouter();
    const [savedItems, setSavedItems] = useState<any[]>([]);
    const [filteredItems, setFilteredItems] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const { location, setLocation } = useLocation();
    const [isLocationModalVisible, setIsLocationModalVisible] = useState(false);

    useEffect(() => {
        fetchSavedItems();
    }, []);

    useEffect(() => {
        // Local search filtering
        if (!searchQuery.trim()) {
            setFilteredItems(savedItems);
        } else {
            const lowerQuery = searchQuery.toLowerCase();
            const filtered = savedItems.filter(item =>
                item.listing?.title?.toLowerCase().includes(lowerQuery) ||
                item.listing?.category?.toLowerCase().includes(lowerQuery)
            );
            setFilteredItems(filtered);
        }
    }, [searchQuery, savedItems]);

    const fetchSavedItems = async (isRefresh = false) => {
        const cached = dataCache.get('saved_listings');
        if (cached && !isRefresh) {
            setSavedItems(cached);
            setIsLoading(false);
        }

        try {
            if (!cached && !isRefresh) setIsLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setSavedItems([]);
                setIsLoading(false);
                return;
            }

            const { data, error } = await supabase
                .from('saved_listings')
                .select(`
                    id,
                    listing_id,
                    listing:listings (id, title, price, description, location, category, brand, condition, images, user_id, status, created_at, updated_at, location_structured)
                `)
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            setSavedItems(data || []);
            dataCache.set('saved_listings', data || []);
        } catch (error) {
            console.error('Error fetching saved items:', error);
            // Don't show alert for background fetch unless critical
            if (!isRefresh && !cached) Alert.alert("Error", "Could not load saved items.");
        } finally {
            setIsLoading(false);
            setRefreshing(false);
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await fetchSavedItems(true);
    };

    const unsaveItem = async (listingId: string) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Optimistic UI update
            const updated = savedItems.filter(i => i.listing_id !== listingId);
            setSavedItems(updated);
            dataCache.set('saved_listings', updated);

            const { error } = await supabase
                .from('saved_listings')
                .delete()
                .eq('user_id', user.id)
                .eq('listing_id', listingId);

            if (error) throw error;
        } catch (error) {
            console.error('Error unsaving:', error);
            Alert.alert("Error", "Failed to remove item.");
        }
    };

    return (
        <View style={styles.safe}>
            {/* Home-style Header */}
            <SafeAreaView edges={['top']} style={styles.headerSafe}>
                <View style={styles.topHeader}>
                    <TouchableOpacity
                        style={styles.locationGroup}
                        activeOpacity={0.7}
                        onPress={() => setIsLocationModalVisible(true)}
                    >
                        <View style={styles.locationIconWrap}>
                            <Ionicons name="location" size={16} color={BLUE} />
                        </View>
                        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Text style={styles.locationText} numberOfLines={1} ellipsizeMode="tail">{location.name}</Text>
                            <Ionicons name="chevron-down" size={10} color="#8A8A8A" />
                        </View>
                    </TouchableOpacity>
                    <View style={styles.headerActions}>
                        <TouchableOpacity style={styles.headerBtn}>
                            <Ionicons name="notifications-outline" size={22} color="#111111" />
                            <View style={styles.statusDot} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.headerBtn}
                            onPress={() => router.push('/saved')}
                        >
                            <Ionicons name="heart" size={22} color={BLUE} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Search Bar Row with Title integrated or back button */}
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={() => router.back()}
                        style={styles.backBtn}
                    >
                        <Ionicons name="chevron-back" size={24} color="#111111" />
                    </TouchableOpacity>
                    <View style={styles.searchBar}>
                        <Ionicons name="search-outline" size={20} color="#ABABAB" />
                        <TextInput
                            placeholder="Search your saved items..."
                            placeholderTextColor="#BABABA"
                            style={styles.searchInput}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery('')}>
                                <Ionicons name="close-circle" size={20} color="#ABABAB" />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </SafeAreaView>

            {isLoading ? (
                <View style={{ flex: 1 }}>
                    <View style={styles.pageTitleArea}>
                        <Text style={styles.title}>Saved Items</Text>
                    </View>
                    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                        <View style={styles.grid}>
                            {[1, 2, 3, 4, 5, 6].map((i) => (
                                <View key={i} style={styles.itemCard}>
                                    <Skeleton width={(width - 64) / 2} height={180} borderRadius={20} style={{ marginBottom: 12 }} />
                                    <Skeleton width={60} height={10} style={{ marginBottom: 6 }} />
                                    <Skeleton width={(width - 64) / 2 * 0.8} height={16} style={{ marginBottom: 6 }} />
                                    <Skeleton width={50} height={18} />
                                </View>
                            ))}
                        </View>
                    </ScrollView>
                </View>
            ) : (
                <FlatList
                    data={filteredItems}
                    keyExtractor={(item) => item.id}
                    numColumns={2}
                    columnWrapperStyle={{ justifyContent: 'space-between', paddingHorizontal: 24 }}
                    contentContainerStyle={{ paddingBottom: 40 }}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={BLUE} />
                    }
                    ListHeaderComponent={() => (
                        <View style={styles.pageTitleArea}>
                            <Text style={styles.title}>Saved Items</Text>
                        </View>
                    )}
                    renderItem={({ item }) => {
                        const listing = item.listing;
                        if (!listing) return null;
                        return (
                            <View style={{ width: (width - 64) / 2, marginBottom: 24 }}>
                                <ProductCard
                                    item={listing}
                                    isSaved={true}
                                    onToggleFavorite={unsaveItem}
                                />
                            </View>
                        );
                    }}
                    ListEmptyComponent={() => (
                        <View style={styles.emptyWrap}>
                            <View style={styles.iconCircle}>
                                <Ionicons name="heart-outline" size={48} color={BLUE} />
                            </View>
                            <Text style={styles.emptyTitle}>
                                {searchQuery ? 'No matching items' : 'No saved items yet'}
                            </Text>
                            <Text style={styles.emptyDesc}>
                                {searchQuery
                                    ? 'Try changing your search terms.'
                                    : 'Items you save while shopping will appear here for quick access.'}
                            </Text>
                        </View>
                    )}
                />
            )}

            <LocationSelector
                visible={isLocationModalVisible}
                onClose={() => setIsLocationModalVisible(false)}
                onSelect={(data: any) => {
                    setLocation(data);
                    setIsLocationModalVisible(false);
                }}
                initialLocation={{ latitude: location.latitude, longitude: location.longitude }}
                title="Search Location"
            />
        </View>
    );
}

const styles = StyleSheet.create({
    safe: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    headerSafe: {
        backgroundColor: '#FFFFFF',
    },
    topHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 12,
    },
    locationGroup: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginRight: 10,
    },
    locationIconWrap: {
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: '#F0F4FF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    locationLabel: {
        fontSize: 12,
        color: '#8A8A8A',
        fontWeight: '500',
        marginBottom: 2,
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    locationText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#111111',
    },
    headerActions: {
        flexDirection: 'row',
        gap: 8,
    },
    headerBtn: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: '#F5F5F5',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: '#EBEBEB',
    },
    statusDot: {
        position: 'absolute',
        top: 12,
        right: 12,
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: BLUE,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 12,
        gap: 12,
    },
    backBtn: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: '#F5F5F5',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: '#EBEBEB',
    },
    searchBar: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F5F5F5',
        height: 48,
        borderRadius: 14,
        paddingHorizontal: 16,
        borderWidth: 1,
        borderColor: '#EBEBEB',
    },
    searchInput: {
        flex: 1,
        marginLeft: 10,
        fontSize: 14,
        color: '#111111',
    },
    pageTitleArea: {
        paddingHorizontal: 24,
        paddingTop: 12,
        paddingBottom: 20,
    },
    title: {
        fontSize: 22,
        fontWeight: '700',
        color: '#111111',
    },
    scroll: {
        paddingHorizontal: 24,
        paddingBottom: 40,
    },
    loadingWrap: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    itemCard: {
        width: (width - 64) / 2,
        marginBottom: 24,
    },
    imagePlaceholder: {
        height: 200,
        backgroundColor: '#F5F5F5',
        borderRadius: 24,
        marginBottom: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: '#EBEBEB',
    },
    listingImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    tag: {
        position: 'absolute',
        top: 12,
        left: 12,
        backgroundColor: BLUE,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    tagText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    heartBtn: {
        position: 'absolute',
        top: 12,
        right: 12,
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#F0F0F0',
    },
    info: {
        paddingHorizontal: 4,
    },
    nameText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#111111',
        marginBottom: 4,
    },
    priceText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#111111',
    },
    emptyWrap: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 80,
    },
    iconCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#F0F4FF',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
    },
    emptyTitle: {
        fontSize: 20,
        fontFamily: 'Inter_600SemiBold',
        color: '#111111',
        marginBottom: 8,
    },
    emptyDesc: {
        fontSize: 15,
        fontFamily: 'Inter_400Regular',
        color: '#8A8A8A',
        textAlign: 'center',
        lineHeight: 22,
    },
});

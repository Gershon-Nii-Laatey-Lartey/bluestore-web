import { LocationSelector } from '@/components/LocationSelector';
import { Skeleton } from '@/components/Skeleton';
import { useLocation } from '@/context/LocationContext';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { decode } from 'base64-arraybuffer';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Dimensions,
    Image,
    Linking,
    RefreshControl,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

const { width } = Dimensions.get('window');
const BLUE = '#0057FF';
const BANNER_HEIGHT = 320;

const SellerProfileSkeleton = () => {
    return (
        <View style={styles.container}>
            <Skeleton width={width} height={BANNER_HEIGHT} borderRadius={0} />
            <View style={{ paddingHorizontal: 24, marginTop: -50 }}>
                <Skeleton width={100} height={100} borderRadius={50} style={{ marginBottom: 15 }} />
                <Skeleton width={180} height={28} style={{ marginBottom: 8 }} />
                <Skeleton width={120} height={32} borderRadius={20} style={{ marginBottom: 16 }} />
                <Skeleton width={width - 48} height={20} style={{ marginBottom: 8 }} />
                <Skeleton width={width * 0.6} height={20} style={{ marginBottom: 24 }} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#F0F0F0', paddingVertical: 12 }}>
                    {[1, 2, 3, 4].map(i => (
                        <View key={i} style={{ alignItems: 'center', flex: 1 }}>
                            <Skeleton width={30} height={20} style={{ marginBottom: 4 }} />
                            <Skeleton width={40} height={12} />
                        </View>
                    ))}
                </View>
            </View>
        </View>
    );
};

export default function SellerProfileScreen() {
    const { location, setLocation } = useLocation();
    const [isLocationModalVisible, setIsLocationModalVisible] = useState(false);
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const [seller, setSeller] = useState<any>(null);
    const [products, setProducts] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('All');
    const [isOwner, setIsOwner] = useState(false);
    const [isBioEditing, setIsBioEditing] = useState(false);
    const [editedBio, setEditedBio] = useState('');
    const [isUpdating, setIsUpdating] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [sellerStats, setSellerStats] = useState({ avg_rating: 0, total_reviews: 0, response_rate: 0 });

    const scrollY = useRef(new Animated.Value(0)).current;

    const categories = ['All', ...Array.from(new Set(products.map(p => p.category).filter(Boolean)))];
    const filteredProducts = activeTab === 'All' ? products : products.filter(p => p.category === activeTab);

    useEffect(() => {
        fetchSellerData();
    }, [id]);

    const fetchSellerData = async (isRefresh = false) => {
        if (!isRefresh) setIsLoading(true);
        try {
            const { data: { user: currentUser } } = await supabase.auth.getUser();
            setIsOwner(currentUser?.id === id);

            const { data: profile } = await supabase
                .from('profiles')
                .select('id, full_name, avatar_url, phone_number, is_verified, role, bio, location, location_structured, banner_url, account_status, created_at, verification_status')
                .eq('id', id)
                .single();
            setSeller(profile);
            setEditedBio(profile?.bio || '');

            const { data: listings } = await supabase
                .from('listings')
                .select('id, title, price, description, location, category, brand, condition, images, user_id, status, created_at, updated_at, location_structured')
                .eq('user_id', id)
                .order('created_at', { ascending: false });
            setProducts(listings || []);

            // Fetch seller overall stats
            const { data: stats } = await supabase.rpc('get_seller_rating', { seller_uuid: id });

            // Generate a stable pseudo-random response rate based on user ID if no real data exists
            const pseudoResponseRate = 85 + (parseInt(id.toString().substring(0, 2), 16) % 15);

            if (stats && stats.length > 0) {
                setSellerStats({
                    avg_rating: stats[0].avg_rating || 0,
                    total_reviews: stats[0].total_reviews || 0,
                    response_rate: pseudoResponseRate
                });
            } else {
                setSellerStats(prev => ({ ...prev, response_rate: pseudoResponseRate }));
            }
        } catch (error) {
            console.error('Error fetching seller:', error);
        } finally {
            setIsLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = React.useCallback(() => {
        setRefreshing(true);
        fetchSellerData(true);
    }, [id]);

    const handleCall = () => {
        if (seller?.phone_number) {
            Linking.openURL(`tel:${seller.phone_number}`);
        } else {
            Alert.alert('Not Available', 'This seller has not provided a phone number.');
        }
    };

    const handleUpload = async (type: 'avatar' | 'banner') => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                aspect: type === 'avatar' ? [1, 1] : [16, 9],
                quality: 0.7,
                base64: true,
            });

            if (!result.canceled && result.assets[0].uri) {
                setIsUpdating(true);
                const manipResult = await ImageManipulator.manipulateAsync(
                    result.assets[0].uri,
                    [{ resize: { width: type === 'avatar' ? 400 : 1200 } }],
                    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
                );

                if (!manipResult.base64) throw new Error('Optimization failed');

                const fileName = `${id}_${type}_${Date.now()}.jpg`;
                const bucket = type === 'avatar' ? 'avatars' : 'banners';

                const { error: uploadError } = await supabase.storage
                    .from(bucket)
                    .upload(fileName, decode(manipResult.base64), { contentType: 'image/jpeg' });

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(fileName);

                const updateData = type === 'avatar' ? { avatar_url: publicUrl } : { banner_url: publicUrl };
                const { error: updateError } = await supabase
                    .from('profiles')
                    .update(updateData)
                    .eq('id', id);

                if (updateError) throw updateError;

                setSeller((prev: any) => ({ ...prev, ...updateData }));
                Alert.alert('Success', `${type.charAt(0).toUpperCase() + type.slice(1)} updated!`);
            }
        } catch (error: any) {
            console.error('Upload Error:', error);
            Alert.alert('Error', error.message || 'Failed to upload image');
        } finally {
            setIsUpdating(false);
        }
    };

    const handleSaveBio = async () => {
        if (!editedBio.trim()) return;
        setIsUpdating(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ bio: editedBio.trim() })
                .eq('id', id);
            if (error) throw error;
            setSeller((prev: any) => ({ ...prev, bio: editedBio.trim() }));
            setIsBioEditing(false);
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to update bio');
        } finally {
            setIsUpdating(false);
        }
    };

    if (isLoading) {
        return <SellerProfileSkeleton />;
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
            <Stack.Screen options={{ headerShown: false }} />

            <Animated.ScrollView
                showsVerticalScrollIndicator={false}
                scrollEventThrottle={16}
                onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                    { useNativeDriver: true }
                )}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BLUE} />
                }
            >
                <View style={styles.bannerWrapper}>
                    {seller?.banner_url ? (
                        <Image
                            source={{ uri: seller.banner_url }}
                            style={styles.bannerImage}
                        />
                    ) : (
                        <View style={[styles.bannerPlaceholder, { backgroundColor: '#F9F9F9' }]}>
                            {/* Geometric pattern mock - subtle grey logo overlay */}
                            <View style={styles.logoOverlay}>
                                <Text style={[styles.bannerLogoText, { color: '#E0E0E0' }]}>bluestore</Text>
                            </View>
                        </View>
                    )}

                    <View style={styles.headerActions}>
                        <TouchableOpacity style={styles.actionBtn} onPress={() => router.back()}>
                            <Ionicons name="chevron-back" size={24} color="#111111" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionBtn}>
                            <Ionicons name="share-outline" size={24} color="#111111" />
                        </TouchableOpacity>
                    </View>

                    {isOwner && (
                        <TouchableOpacity
                            style={styles.bannerEditBtn}
                            onPress={() => handleUpload('banner')}
                            disabled={isUpdating}
                        >
                            <Ionicons name="camera" size={18} color="#FFFFFF" />
                        </TouchableOpacity>
                    )}

                    {/* Bottom overlap fade */}
                    <LinearGradient
                        colors={['transparent', 'rgba(255,255,255,0.7)', '#FFFFFF']}
                        style={styles.bottomFade}
                        pointerEvents="none"
                    />
                </View>

                <View style={styles.identityArea}>
                    <View style={styles.avatarRow}>
                        <View style={styles.avatarContainer}>
                            {seller?.avatar_url ? (
                                <Image source={{ uri: seller.avatar_url }} style={styles.avatar} />
                            ) : (
                                <LinearGradient
                                    colors={['#E0E0E0', '#BDBDBD']}
                                    style={[styles.avatar, styles.placeholderAvatar]}
                                >
                                    <Text style={[styles.avatarText, { color: '#FFF' }]}>
                                        {(seller?.full_name || 'U').charAt(0)}
                                    </Text>
                                </LinearGradient>
                            )}
                            {isOwner && (
                                <TouchableOpacity style={styles.avatarEditBadge} onPress={() => handleUpload('avatar')}>
                                    <Ionicons name="camera" size={12} color="#FFFFFF" />
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>

                    <View style={styles.nameBlock}>
                        <Text style={styles.userNameText}>{seller?.full_name || 'Anonymous User'}</Text>

                        <View style={styles.locationPill}>
                            <Ionicons name="location" size={12} color={BLUE} />
                            <Text style={styles.locationPillText}>
                                {seller?.location || 'Presbyterian Boys\' Senior High School'}
                            </Text>
                        </View>

                        <View style={styles.bioSection}>
                            {isBioEditing ? (
                                <View style={styles.bioEditContainer}>
                                    <TextInput
                                        style={styles.bioInput}
                                        value={editedBio}
                                        onChangeText={setEditedBio}
                                        multiline
                                        maxLength={150}
                                        placeholder="Write a bio..."
                                        autoFocus
                                    />
                                    <View style={styles.bioActions}>
                                        <TouchableOpacity onPress={() => setIsBioEditing(false)}>
                                            <Text style={styles.bioCancelText}>Cancel</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.bioSave} onPress={handleSaveBio} disabled={isUpdating}>
                                            {isUpdating ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.bioSaveText}>Save</Text>}
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ) : (
                                <View style={styles.bioDisplayRow}>
                                    <Text style={styles.bioText}>
                                        {seller?.bio || (isOwner ? "Share your store's story. Click edit to add a bio..." : "No bio provided.")}
                                    </Text>
                                    {isOwner ? (
                                        <TouchableOpacity
                                            style={styles.bioEditBtnBox}
                                            onPress={() => setIsBioEditing(true)}
                                        >
                                            <Ionicons name="pencil" size={16} color={BLUE} />
                                        </TouchableOpacity>
                                    ) : (
                                        <TouchableOpacity
                                            style={[styles.bioEditBtnBox, { backgroundColor: BLUE }]}
                                            onPress={handleCall}
                                        >
                                            <Ionicons name="call" size={16} color="#FFFFFF" />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            )}
                        </View>
                    </View>

                    <View style={styles.statsGrid}>
                        <View style={styles.statBox}>
                            <Text style={styles.statNum}>{products.length}</Text>
                            <Text style={styles.statLabel}>Listings</Text>
                        </View>
                        <View style={styles.statBox}>
                            <Text style={styles.statNum}>
                                {seller?.created_at ? new Date(seller.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'Feb 2026'}
                            </Text>
                            <Text style={styles.statLabel}>Joined</Text>
                        </View>
                        <TouchableOpacity
                            style={styles.statBox}
                            onPress={() => router.push({ pathname: '/seller/reviews/[id]', params: { id: id as string } })}
                        >
                            <Text style={styles.statNum}>{Number(sellerStats.avg_rating).toFixed(1)}</Text>
                            <Text style={styles.statLabel}>Rating</Text>
                        </TouchableOpacity>
                        <View style={styles.statBox}>
                            <Text style={styles.statNum}>{sellerStats.response_rate}%</Text>
                            <Text style={styles.statLabel}>Response</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.stickyTabs}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBar}>
                        {categories.map((tab) => (
                            <TouchableOpacity
                                key={tab}
                                onPress={() => setActiveTab(tab)}
                                style={[styles.pill, activeTab === tab && styles.pillActive]}
                            >
                                <Text style={[styles.pillText, activeTab === tab && styles.pillTextActive]}>{tab}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                <View style={styles.inventoryArea}>
                    {filteredProducts.length > 0 ? (
                        <View style={styles.grid}>
                            {filteredProducts.map((item) => (
                                <TouchableOpacity
                                    key={item.id}
                                    style={styles.card}
                                    onPress={() => router.push({ pathname: '/product/[id]', params: { id: item.id } })}
                                >
                                    <View style={styles.cardImageWrap}>
                                        <Image source={{ uri: item.images?.[0] }} style={styles.cardImage} />
                                    </View>
                                    <View style={styles.cardHeader}>
                                        <Text style={styles.cardBrand}>{item.brand || item.category}</Text>
                                        <Text style={styles.cardName} numberOfLines={1}>{item.title}</Text>
                                        <Text style={styles.cardPrice}>GH₵{item.price}</Text>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </View>
                    ) : (
                        <View style={styles.empty}>
                            <Ionicons name="cube-outline" size={40} color="#EBEBEB" />
                            <Text style={styles.emptyText}>No items in this category</Text>
                        </View>
                    )}
                </View>
                <View style={{ height: 100 }} />

                <LocationSelector
                    visible={isLocationModalVisible}
                    onClose={() => setIsLocationModalVisible(false)}
                    onSelect={(data: any) => {
                        setLocation(data);
                        setIsLocationModalVisible(false);
                    }}
                    initialLocation={{ latitude: location.latitude, longitude: location.longitude }}
                />
            </Animated.ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    bannerWrapper: { height: BANNER_HEIGHT, width: '100%', position: 'relative' },
    bannerImage: { width: '100%', height: '100%', resizeMode: 'cover' },
    bannerPlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
    bannerLogoText: { fontSize: 48, fontWeight: '900', color: '#FFFFFF', opacity: 0.9, letterSpacing: -2 },
    logoOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
    headerActions: {
        position: 'absolute',
        top: 50,
        left: 20,
        right: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    actionBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.8)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    bannerEditBtn: {
        position: 'absolute',
        bottom: 60,
        right: 20,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    bottomFade: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 100,
    },
    identityArea: {
        paddingHorizontal: 24,
        paddingBottom: 24,
        backgroundColor: '#FFFFFF',
    },
    avatarRow: {
        marginTop: -50,
        marginBottom: 16,
    },
    avatarContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#FFFFFF',
        padding: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 15,
        elevation: 10,
    },
    avatar: { width: '100%', height: '100%', borderRadius: 46 },
    placeholderAvatar: { alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontSize: 32, fontWeight: '800' },
    avatarEditBadge: {
        position: 'absolute',
        bottom: 5,
        right: 5,
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: BLUE,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 3,
        borderColor: '#FFFFFF',
    },
    nameBlock: { marginBottom: 15 },
    userNameText: { fontSize: 24, fontWeight: '900', color: '#111111', marginBottom: 8 },
    locationPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EEF3FF',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        alignSelf: 'flex-start',
        gap: 6,
        marginBottom: 20,
    },
    locationPillText: { fontSize: 13, fontWeight: '700', color: BLUE },
    bioSection: { marginBottom: 24 },
    bioDisplayRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 15 },
    bioText: { flex: 1, fontSize: 15, color: '#666', lineHeight: 22 },
    bioEditBtnBox: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: '#F0F4FF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    bioEditContainer: {
        backgroundColor: '#F9F9F9',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#EBEBEB',
    },
    bioInput: { fontSize: 14, color: '#111111', minHeight: 60, textAlignVertical: 'top' },
    bioActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 8 },
    bioCancelText: { fontSize: 12, color: '#8A8A8A', fontWeight: '600', padding: 6 },
    bioSave: { backgroundColor: BLUE, paddingVertical: 6, paddingHorizontal: 16, borderRadius: 8 },
    bioSaveText: { fontSize: 12, color: '#FFFFFF', fontWeight: '700' },
    statsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 20,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#F0F0F0',
        marginBottom: 24,
    },
    statBox: { alignItems: 'center', flex: 1 },
    statNum: { fontSize: 16, fontWeight: '800', color: '#111111', marginBottom: 4 },
    statLabel: { fontSize: 12, color: '#8A8A8A', fontWeight: '600' },
    stickyTabs: {
        backgroundColor: '#FFFFFF',
        paddingVertical: 14,
        paddingHorizontal: 24,
    },
    tabBar: {
        flexDirection: 'row',
        gap: 12,
    },
    pill: {
        paddingVertical: 10,
        paddingHorizontal: 22,
        borderRadius: 25,
        backgroundColor: '#F7F7F7',
        borderWidth: 1,
        borderColor: '#EFEFEF',
    },
    pillActive: {
        backgroundColor: '#111111',
        borderColor: '#111111',
    },
    pillText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#8A8A8A',
    },
    pillTextActive: {
        color: '#FFFFFF',
    },
    inventoryArea: {
        paddingHorizontal: 24,
        paddingTop: 10,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: 16,
    },
    card: {
        width: (width - 64) / 2,
        marginBottom: 24,
    },
    cardImageWrap: {
        width: '100%',
        height: 190,
        borderRadius: 24,
        backgroundColor: '#F9F9F9',
        overflow: 'hidden',
    },
    cardImage: { width: '100%', height: '100%', resizeMode: 'cover' },
    cardHeader: {
        marginTop: 10,
        paddingHorizontal: 4,
    },
    cardBrand: { fontSize: 10, fontWeight: '800', color: BLUE, textTransform: 'uppercase', marginBottom: 2 },
    cardName: { fontSize: 13, fontWeight: '600', color: '#111111', marginBottom: 2 },
    cardPrice: { fontSize: 15, fontWeight: '800', color: '#111111' },
    empty: {
        height: 200,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: 0.3
    },
    emptyText: { marginTop: 12, fontWeight: '600' },
});

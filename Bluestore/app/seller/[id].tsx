import { LocationSelector } from '@/components/LocationSelector';
import { ReportSheet } from '@/components/ReportSheet';
import { Skeleton } from '@/components/Skeleton';
import { useLocation } from '@/context/LocationContext';
import { dataCache } from '@/lib/cache';
import { supabase } from '@/lib/supabase';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { decode } from 'base64-arraybuffer';
import { Image as ExpoImage } from 'expo-image';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useAuthDrawer } from '@/context/AuthDrawerContext';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Linking,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');
const BLUE = '#0057FF';
const BANNER_HEIGHT = 340;
const AVATAR_SIZE = 100;

export default function SellerProfileScreen() {
    const { location, setLocation } = useLocation();
    const [isLocationModalVisible, setIsLocationModalVisible] = useState(false);
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { session } = useAuth();
    const { showAuthDrawer } = useAuthDrawer();
    const [seller, setSeller] = useState<any>(null);
    const [products, setProducts] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('All');
    const [isOwner, setIsOwner] = useState(false);
    const [isBioEditing, setIsBioEditing] = useState(false);
    const [editedBio, setEditedBio] = useState('');
    const [isUpdating, setIsUpdating] = useState(false);
    const [isReportVisible, setIsReportVisible] = useState(false);
    const [sellerStats, setSellerStats] = useState({ avg_rating: 0, total_reviews: 0, response_rate: 0 });

    const categories = ['All', ...Array.from(new Set(products.map(p => p.category).filter(Boolean)))];
    const filteredProducts = activeTab === 'All' ? products : products.filter(p => p.category === activeTab);

    const getResponseTime = (rate: number) => {
        if (rate >= 95) return 'minutes';
        if (rate >= 85) return 'an hour';
        if (rate >= 70) return 'a few hours';
        return 'a day';
    };

    useEffect(() => {
        const fetchSellerData = async () => {
            const cacheKey = `seller_${id}`;
            const cached = dataCache.get(cacheKey);
            if (cached) {
                setSeller(cached.seller);
                setProducts(cached.products);
                setSellerStats(cached.stats);
                setIsLoading(false);
            } else {
                setIsLoading(true);
            }

            try {
                const currentUser = session?.user;
                setIsOwner(currentUser?.id === id);

                // Fetch Profile
                const { data: profile } = await supabase.from('profiles').select('*').eq('id', id).single();
                if (profile) {
                    setSeller(profile);
                    setEditedBio(profile.bio || '');
                }

                // Fetch Products
                const { data: listings } = await supabase.from('listings').select('*').eq('user_id', id).eq('status', 'approved').order('created_at', { ascending: false });
                if (listings) setProducts(listings);

                // Fetch reviews count for stats
                const { data: revs } = await supabase.from('reviews').select('*').eq('seller_id', id);
                const total = revs?.length || 0;
                const avg = total > 0 ? (revs?.reduce((acc: any, r: any) => acc + r.rating, 0) || 0) / total : 0;
                const stats = { avg_rating: avg, total_reviews: total, response_rate: 98 };
                setSellerStats(stats);

                // Cache
                dataCache.set(cacheKey, { seller: profile, products: listings, stats });

            } catch (err) {
                console.error('Error:', err);
            } finally {
                setIsLoading(false);
            }
        };

        if (id) fetchSellerData();
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
        return (
            <View style={styles.container}>
                <Skeleton width={width} height={BANNER_HEIGHT} borderRadius={0} />
                <View style={[styles.contentSkeleton]}>
                    <Skeleton width={AVATAR_SIZE} height={AVATAR_SIZE} borderRadius={AVATAR_SIZE / 2} style={{ marginBottom: 20 }} />
                    <Skeleton width={180} height={28} style={{ marginBottom: 10 }} />
                    <Skeleton width={width * 0.7} height={16} style={{ marginBottom: 30 }} />
                    <View style={{ flexDirection: 'row', gap: 15 }}>
                        <Skeleton width={80} height={40} borderRadius={20} />
                        <Skeleton width={80} height={40} borderRadius={20} />
                        <Skeleton width={80} height={40} borderRadius={20} />
                    </View>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
            <Stack.Screen options={{ headerShown: false }} />

            <ScrollView
                showsVerticalScrollIndicator={false}
                stickyHeaderIndices={[2]}
                contentContainerStyle={styles.scrollContent}
            >
                <View style={styles.bannerWrapper}>
                    {seller?.banner_url ? (
                        <ExpoImage
                            source={{ uri: seller.banner_url }}
                            style={styles.bannerImage}
                            contentFit="cover"
                            transition={200}
                        />
                    ) : (
                        <LinearGradient
                            colors={[BLUE, '#00C2FF']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.bannerPlaceholder}
                        />
                    )}

                    <LinearGradient
                        colors={['rgba(0,0,0,0.2)', 'transparent']}
                        style={styles.topFade}
                    />

                    <LinearGradient
                        colors={['transparent', 'rgba(255,255,255,0.4)', '#FFFFFF']}
                        style={styles.bottomFade}
                    />

                    <SafeAreaView edges={['top']} style={styles.navBar}>
                        <TouchableOpacity onPress={() => router.back()} style={styles.blurBtn}>
                            <Feather name="chevron-left" size={24} color="#111111" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.blurBtn}>
                            <Feather name="share-2" size={20} color="#111111" />
                        </TouchableOpacity>
                    </SafeAreaView>

                    {isOwner && (
                        <TouchableOpacity
                            style={styles.bannerEditBtn}
                            onPress={() => handleUpload('banner')}
                            disabled={isUpdating}
                        >
                            <Ionicons name="camera" size={18} color="#FFFFFF" />
                        </TouchableOpacity>
                    )}
                </View>

                <View style={styles.identityArea}>
                    <View style={styles.headerMain}>
                        <View style={styles.avatarContainer}>
                            {seller?.avatar_url ? (
                                <ExpoImage source={{ uri: seller.avatar_url }} style={styles.avatar} transition={150} />
                            ) : (
                                <LinearGradient
                                    colors={[BLUE, '#00C2FF']}
                                    style={[styles.avatar, styles.placeholderAvatar]}
                                >
                                    <Text style={[styles.avatarText, { color: '#FFF' }]}>
                                        {(seller?.full_name || 'U').charAt(0)}
                                    </Text>
                                </LinearGradient>
                            )}
                            {isOwner && (
                                <TouchableOpacity
                                    style={styles.avatarEditBadge}
                                    onPress={() => handleUpload('avatar')}
                                    disabled={isUpdating}
                                >
                                    <Ionicons name="camera" size={12} color="#FFFFFF" />
                                </TouchableOpacity>
                            )}
                        </View>

                        <View style={styles.nameBlock}>
                            <View style={styles.nameBadgeRow}>
                                <Text style={styles.displayName}>{seller?.full_name || 'Premium Global'}</Text>
                                {seller?.is_verified && (
                                    <View style={styles.verifiedIcon}>
                                        <MaterialCommunityIcons name="check-decagram" size={16} color={BLUE} />
                                    </View>
                                )}
                            </View>

                            <View style={styles.actionRow}>
                                {!isOwner && (
                                    <TouchableOpacity style={styles.callBtn} onPress={handleCall}>
                                        <Ionicons name="call" size={16} color="#FFFFFF" />
                                        <Text style={styles.callBtnText}>Call Seller</Text>
                                    </TouchableOpacity>
                                )}
                                {seller?.location && (
                                    <View style={styles.locationBadge}>
                                        <Ionicons name="location" size={12} color={BLUE} />
                                        <Text style={styles.locationText}>{seller.location}</Text>
                                    </View>
                                )}
                            </View>

                            {!isOwner && (
                                <TouchableOpacity
                                    style={styles.reportSellerBtn}
                                    onPress={() => {
                                        if (!session) {
                                            showAuthDrawer();
                                        } else {
                                            setIsReportVisible(true);
                                        }
                                    }}
                                >
                                    <Ionicons name="flag-outline" size={12} color="#ABABAB" />
                                    <Text style={styles.reportSellerText}>Report Seller</Text>
                                </TouchableOpacity>
                            )}

                            {isBioEditing ? (
                                <View style={styles.bioEditContainer}>
                                    <TextInput
                                        style={styles.bioInput}
                                        value={editedBio}
                                        onChangeText={setEditedBio}
                                        placeholder="Tell people about your store..."
                                        multiline
                                        maxLength={150}
                                        autoFocus
                                    />
                                    <View style={styles.bioActions}>
                                        <TouchableOpacity onPress={() => setIsBioEditing(false)} style={styles.bioCancel}>
                                            <Text style={styles.bioCancelText}>Cancel</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={handleSaveBio} style={styles.bioSave} disabled={isUpdating}>
                                            {isUpdating ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.bioSaveText}>Save</Text>}
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ) : (
                                <View style={styles.bioRow}>
                                    <View style={styles.taglineWrapper}>
                                        <Text style={styles.tagline}>
                                            {seller?.bio || (isOwner ? "Share your store's story. Click edit to add a bio..." : "This seller hasn't added a bio yet.")}
                                        </Text>
                                    </View>
                                    {isOwner && (
                                        <TouchableOpacity
                                            style={styles.bioEditBtn}
                                            onPress={() => setIsBioEditing(true)}
                                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                        >
                                            <Feather name="edit-3" size={16} color={BLUE} />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            )}
                        </View>
                    </View>

                    <View style={styles.statsStripJustified}>
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{products.length}</Text>
                            <Text style={styles.statTitle}>Listings</Text>
                        </View>
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>
                                {seller?.created_at ? new Date(seller.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '---'}
                            </Text>
                            <Text style={styles.statTitle}>Joined</Text>
                        </View>
                        <TouchableOpacity
                            style={styles.statItem}
                            onPress={() => router.push({ pathname: '/seller/reviews/[id]', params: { id: id as string } })}
                        >
                            <Text style={styles.statValue}>{Number(sellerStats.avg_rating).toFixed(1)}</Text>
                            <Text style={styles.statTitle}>Rating</Text>
                        </TouchableOpacity>
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{getResponseTime(sellerStats.response_rate)}</Text>
                            <Text style={styles.statTitle}>Replies in</Text>
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

                <View style={styles.tabContentArea}>
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
                                            <ExpoImage
                                                source={{ uri: item.images?.[0] }}
                                                style={styles.cardImage}
                                                transition={200}
                                                cachePolicy="disk"
                                            />
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
                </View>
                <LocationSelector
                    visible={isLocationModalVisible}
                    onClose={() => setIsLocationModalVisible(false)}
                    onSelect={(data: any) => {
                        setLocation(data);
                        setIsLocationModalVisible(false);
                    }}
                    initialLocation={{ latitude: location.latitude, longitude: location.longitude }}
                />
            </ScrollView>

            <ReportSheet
                visible={isReportVisible}
                onClose={() => setIsReportVisible(false)}
                targetType="profile"
                targetId={id as string}
                targetTitle={seller?.full_name}
                reportedUserId={id as string}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    scrollContent: { flexGrow: 1 },
    bannerWrapper: { height: BANNER_HEIGHT, width: '100%', position: 'relative' },
    bannerImage: { width: '100%', height: '100%', resizeMode: 'cover' },
    bannerPlaceholder: { width: '100%', height: '100%' },
    topFade: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 120
    },
    bottomFade: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 180
    },
    navBar: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'android' ? 24 : 10,
    },
    blurBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.7)',
        alignItems: 'center',
        justifyContent: 'center',
        ...Platform.select({
            ios: { borderShadow: 'rgba(0,0,0,0.1)', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
            android: { elevation: 3 }
        })
    },
    identityArea: {
        marginTop: -100,
        paddingHorizontal: 24,
        paddingBottom: 20,
    },
    headerMain: {
        flexDirection: 'column',
    },
    avatarContainer: {
        width: AVATAR_SIZE,
        height: AVATAR_SIZE,
        borderRadius: AVATAR_SIZE / 2,
        backgroundColor: '#FFFFFF',
        padding: 5,
        elevation: 10,
        shadowColor: 'rgba(0,0,0,0.3)',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 15,
        marginBottom: 16,
    },
    avatar: { width: '100%', height: '100%', borderRadius: AVATAR_SIZE / 2, backgroundColor: '#F5F5F5' },
    placeholderAvatar: { alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontSize: 32, fontWeight: '700', color: BLUE },
    nameBlock: {},
    nameBadgeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    displayName: { fontSize: 28, fontWeight: '800', color: '#111111', letterSpacing: -0.5 },
    verifiedIcon: {
        marginLeft: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    taglineWrapper: { flex: 1 },
    tagline: { fontSize: 15, color: '#666', lineHeight: 22, marginTop: 4 },
    statsStrip: {
        marginTop: 24,
        paddingRight: 40,
        gap: 28,
    },
    statsStripJustified: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 24,
        paddingRight: 10,
    },
    actionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginTop: 8,
        marginBottom: 12,
    },
    callBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: BLUE,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        gap: 6,
    },
    callBtnText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '700',
    },
    locationBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F0F4FF',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
        gap: 4,
    },
    locationText: { fontSize: 12, fontWeight: '700', color: BLUE },
    statItem: {
        alignItems: 'flex-start',
    },
    statValue: {
        fontSize: 16,
        fontWeight: '900',
        color: '#111111',
    },
    statTitle: {
        fontSize: 11,
        color: '#8A8A8A',
        fontWeight: '600',
        marginTop: 2,
        textTransform: 'capitalize'
    },
    bannerEditBtn: {
        position: 'absolute',
        bottom: 80,
        right: 24,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    avatarEditBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: BLUE,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 3,
        borderColor: '#FFFFFF',
    },
    bioRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
    },
    bioEditBtn: {
        marginTop: 6,
        padding: 8,
        backgroundColor: '#F0F4FF',
        borderRadius: 8,
    },
    bioEditContainer: {
        marginTop: 8,
        backgroundColor: '#F9F9F9',
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: '#EBEBEB',
    },
    bioInput: {
        fontSize: 14,
        color: '#111111',
        minHeight: 60,
        textAlignVertical: 'top',
    },
    bioActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12,
        marginTop: 8,
    },
    bioCancel: {
        paddingVertical: 6,
        paddingHorizontal: 12,
    },
    bioCancelText: {
        fontSize: 12,
        color: '#8A8A8A',
        fontWeight: '600',
    },
    bioSave: {
        backgroundColor: BLUE,
        paddingVertical: 6,
        paddingHorizontal: 16,
        borderRadius: 8,
        minWidth: 60,
        alignItems: 'center',
    },
    bioSaveText: {
        fontSize: 12,
        color: '#FFFFFF',
        fontWeight: '700',
    },
    stickyTabs: {
        backgroundColor: '#FFFFFF',
        paddingVertical: 14,
        paddingHorizontal: 24,
        zIndex: 100,
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
        position: 'relative',
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
    tabContentArea: {},
    contentSkeleton: { paddingHorizontal: 24, marginTop: -60 },
    reportSellerBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        gap: 4,
    },
    reportSellerText: {
        fontSize: 11,
        color: '#ABABAB',
        fontWeight: '600',
        textDecorationLine: 'underline',
    },
});

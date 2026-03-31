import { ProductCard } from '@/components/ProductCard';
import { ReportSheet } from '@/components/ReportSheet';
import { Skeleton } from '@/components/Skeleton';
import { dataCache } from '@/lib/cache';
import { getSimilarListings, getSellerListings } from '@/lib/recommendations';
import { supabase } from '@/lib/supabase';
import { recordCallClick, recordChatStarted, recordListingView } from '@/lib/tracking';
import { Feather, Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image as ExpoImage } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useAuthDrawer } from '@/context/AuthDrawerContext';
import {
    ActivityIndicator,
    Alert,
    Clipboard,
    Dimensions,
    Linking,
    Modal,
    NativeScrollEvent,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    UIManager,
    View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    Extrapolation,
    interpolate,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');
const IMAGE_HEIGHT = width * 1.0;
const BLUE = '#0057FF';
const THUMB_SIZE = 70;

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface Listing {
    id: string;
    user_id: string;
    title: string;
    description: string;
    price: string | number;
    category: string;
    condition: string;
    images: string[];
    brand?: string;
    views?: number;
    location?: string;
    location_structured?: any;
    is_boosted?: boolean;
    boost_expires_at?: string;
}

interface SellerProfile {
    id: string;
    full_name: string;
    avatar_url: string;
    is_verified: boolean;
    created_at: string;
    phone_number?: string;
}

const ProductDetailsScreen = () => {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const [listing, setListing] = useState<Listing | null>(null);
    const [seller, setSeller] = useState<SellerProfile | null>(null);
    const [isFavorite, setIsFavorite] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const { session } = useAuth();
    const { showAuthDrawer } = useAuthDrawer();
    const [isDeleting, setIsDeleting] = useState(false);
    const [showOptions, setShowOptions] = useState(false);
    const [activeImageIndex, setActiveImageIndex] = useState(0);
    const [isReportVisible, setIsReportVisible] = useState(false);
    const [reviews, setReviews] = useState<any[]>([]);
    const [sellerStats, setSellerStats] = useState({ avg_rating: 0, total_reviews: 0, response_rate: 0 });
    const [similarItems, setSimilarItems] = useState<any[]>([]);
    const [sellerListings, setSellerListings] = useState<any[]>([]);
    const [isLoadingSimilarItems, setIsLoadingSimilarItems] = useState(true);
    const [isLoadingSellerListings, setIsLoadingSellerListings] = useState(true);

    const mainScrollRef = useRef<ScrollView>(null);
    const thumbScrollRef = useRef<ScrollView>(null);
    const insets = useSafeAreaInsets();
    const [isGalleryVisible, setIsGalleryVisible] = useState(false);
    const [modalActiveIndex, setModalActiveIndex] = useState(0);

    const modalMainScrollRef = useRef<ScrollView>(null);
    const modalThumbScrollRef = useRef<ScrollView>(null);

    // Shared values for performant animations
    const translateY = useSharedValue(0);
    const callBtnWidth = useSharedValue(80);
    const [isCopied, setIsCopied] = useState(false);

    // Main Tap Gesture: Opens Modal only if NOT swiping
    const mainTapGesture = Gesture.Tap()
        .maxDistance(10)
        .onEnd(() => {
            runOnJS(setModalActiveIndex)(activeImageIndex);
            runOnJS(setIsGalleryVisible)(true);
        });

    // Modal Pan Gesture: Pull-to-dismiss without interfering with horizontal swiping
    const modalPanGesture = Gesture.Pan()
        .activeOffsetY([20, 500]) // Respond to downward drag
        .failOffsetX([-40, 40]) // Fail if swiping sideways
        .onUpdate((e) => {
            // Clamp to avoid sliding up
            translateY.value = Math.max(0, e.translationY);
        })
        .onEnd((e) => {
            if (e.translationY > 100) {
                // Slower, smooth exit animation
                translateY.value = withTiming(IMAGE_HEIGHT * 2, { duration: 300 }, () => {
                    runOnJS(setIsGalleryVisible)(false);
                });
            } else {
                // Slower spring for the "reset" motion
                translateY.value = withSpring(0, { damping: 20, stiffness: 90 });
            }
        });

    const modalAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
        opacity: interpolate(
            translateY.value,
            [0, 300],
            [1, 0.5],
            Extrapolation.CLAMP
        ),
    }));

    const animatedCallBtnStyle = useAnimatedStyle(() => ({
        width: callBtnWidth.value,
    }));

    const heartScale = useSharedValue(1);
    const animatedHeartStyle = useAnimatedStyle(() => ({
        transform: [{ scale: heartScale.value }]
    }));

    const getResponseTimeText = (rate: number) => {
        if (rate >= 95) return 'minutes';
        if (rate >= 85) return 'an hour';
        if (rate >= 70) return 'a few hours';
        return 'a day';
    };

    useEffect(() => {
        fetchListing();
    }, [id]);

    const fetchListing = async () => {
        const cacheKey = `listing_${id}`;
        const cached = dataCache.get(cacheKey);
        let fetchedProfile = null;

        if (cached) {
            setListing(cached.listing);
            setSeller(cached.seller);
            setReviews(cached.reviews);
            setSellerStats(cached.stats);
            setIsLoading(false);
        } else {
            setIsLoading(true);
        }

        try {
            const { data, error } = await supabase
                .from('listings')
                .select('id, title, price, description, location, category, brand, condition, images, user_id, status, created_at, updated_at, location_structured, is_boosted, boost_expires_at')
                .eq('id', id)
                .single();

            if (error) throw error;
            setListing(data);

            // Perceived performance: Show text immediately
            if (!cached) setIsLoading(false);
            const authUser = session?.user;

            // Block access if draft and not owner
            if (data.status !== 'approved' && authUser?.id !== data.user_id) {
                Alert.alert('Not Found', 'This listing is no longer available or is still under review.');
                router.back();
                return;
            }

            // Track this view silently
            recordListingView(data.id);

            if (data.user_id) {
                const { data: profileData } = await supabase
                    .from('profiles')
                    .select('id, full_name, avatar_url, phone_number, is_verified, role, bio, location, location_structured, banner_url, account_status, created_at, verification_status')
                    .eq('id', data.user_id)
                    .single();
                fetchedProfile = profileData;
                setSeller(fetchedProfile);
            }

            if (session?.user) {
                const { data: fav } = await supabase
                    .from('saved_listings')
                    .select('id')
                    .eq('user_id', session.user.id)
                    .eq('listing_id', id)
                    .maybeSingle();
                setIsFavorite(!!fav);
            }

            // Fetch seller's last 3 reviews
            const { data: reviewsData } = await supabase
                .from('reviews')
                .select('*, reviewer:profiles!reviewer_id(full_name, avatar_url)')
                .eq('receiver_id', data.user_id)
                .order('created_at', { ascending: false })
                .limit(3);

            setReviews(reviewsData || []);

            // Fetch seller overall stats
            const { data: stats } = await supabase.rpc('get_seller_rating', { seller_uuid: data.user_id });

            // Stable pseudo-random response rate
            const pseudoResponseRate = 85 + (parseInt(data.user_id.toString().substring(0, 2), 16) % 15);

            let currentStats = { avg_rating: 0, total_reviews: 0, response_rate: pseudoResponseRate };
            if (stats && stats.length > 0) {
                currentStats = {
                    avg_rating: stats[0].avg_rating || 0,
                    total_reviews: stats[0].total_reviews || 0,
                    response_rate: pseudoResponseRate
                };
            }
            setSellerStats(currentStats);

            // Update cache with everything we have
            dataCache.set(cacheKey, {
                listing: data,
                seller: fetchedProfile,
                reviews: reviewsData || [],
                stats: currentStats
            });

            // Fetch similar items in the background
            setIsLoadingSimilarItems(true);
            getSimilarListings(data.id, 8).then(items => {
                setSimilarItems(items);
                setIsLoadingSimilarItems(false);
            }).catch(() => setIsLoadingSimilarItems(false));

            // Fetch other listings from same seller
            setIsLoadingSellerListings(true);
            getSellerListings(data.user_id, data.id, 10).then(items => {
                setSellerListings(items);
                setIsLoadingSellerListings(false);
            }).catch(() => setIsLoadingSellerListings(false));

        } catch (error: any) {
            console.error('Error fetching product:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleFavorite = async () => {
        try {
            if (!session?.user) {
                showAuthDrawer();
                return;
            }
            const user = session.user;

            const newFav = !isFavorite;
            setIsFavorite(newFav);

            // Haptic feedback
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

            // Heart Burst Animation
            heartScale.value = withTiming(newFav ? 1.4 : 0.8, { duration: 100 }, () => {
                heartScale.value = withSpring(1);
            });

            if (!newFav) {
                await supabase.from('saved_listings').delete().eq('user_id', user.id).eq('listing_id', id);
            } else {
                await supabase.from('saved_listings').insert([{ user_id: user.id, listing_id: id }]);
            }
        } catch (error) {
            console.error('Favorite error:', error);
            setIsFavorite(!isFavorite); // Revert
        }
    };

    const handleChat = async () => {
        if (!listing || !seller) return;
        try {
            if (!session?.user) {
                showAuthDrawer();
                return;
            }
            const user = session.user;

            // Track this unique chat start
            recordChatStarted(id as string);

            if (user.id === seller.id) {
                Alert.alert('Note', 'This is your own listing!');
                return;
            }

            // Look for an existing conversation specifically for THIS listing that the user is part of
            const { data: existingConvo } = await supabase
                .from('conversation_participants')
                .select('conversation_id, conversations!inner(id, listing_id)')
                .eq('user_id', user.id)
                .eq('conversations.listing_id', id)
                .maybeSingle();

            if (existingConvo) {
                router.push({ pathname: '/chat/[id]', params: { id: existingConvo.conversation_id } });
            } else {
                // Navigate to ChatRoom in "new" mode, passing listing and recipient info
                router.push({
                    pathname: '/chat/[id]',
                    params: {
                        id: 'new',
                        listingId: id as string,
                        recipientId: seller.id
                    }
                });
            }
        } catch (error) {
            console.error('Chat error:', error);
            Alert.alert('Error', 'Could not start chat.');
        }
    };

    const handleCall = () => {
        const phone = seller?.phone_number;
        if (!phone) {
            Alert.alert('No phone number', 'The seller has not provided a phone number.');
            return;
        }

        if (!isCopied) {
            // First click: Copy number and animate expand
            Clipboard.setString(phone);
            setIsCopied(true);
            callBtnWidth.value = withTiming(115, { duration: 250 });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
            // Second click: Trigger call and reset
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            recordCallClick(id as string);
            Linking.openURL(`tel:${phone}`);
            setIsCopied(false);
            callBtnWidth.value = withTiming(80, { duration: 250 });
        }
    };

    const handleDelete = async () => {
        Alert.alert(
            'Delete Listing',
            'Are you sure you want to delete this listing? This action cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setIsDeleting(true);

                            // 1. Attempt to clean up engagement records (ignoring errors if DB already has cascades)
                            try {
                                await Promise.allSettled([
                                    supabase.from('listing_chats').delete().eq('listing_id', id),
                                    supabase.from('listing_calls').delete().eq('listing_id', id),
                                    supabase.from('viewed_listings').delete().eq('listing_id', id),
                                    supabase.from('listing_impressions').delete().eq('listing_id', id),
                                    supabase.from('saved_listings').delete().eq('listing_id', id)
                                ]);
                            } catch (e) {
                                console.warn('Silent skip on auxiliary cleanup:', e);
                            }

                            // 2. Delete the actual listing
                            const { error } = await supabase
                                .from('listings')
                                .delete()
                                .eq('id', id);
                            if (error) throw error;
                            Alert.alert('Deleted', 'Listing has been removed.');
                            router.replace('/(tabs)');
                        } catch (error: any) {
                            Alert.alert('Error', error.message || 'Failed to delete listing');
                        } finally {
                            setIsDeleting(false);
                        }
                    }
                }
            ]
        );
    };

    const isOwner = session?.user?.id === listing?.user_id;

    const onMainScroll = (e: { nativeEvent: NativeScrollEvent }) => {
        const idx = Math.round(e.nativeEvent.contentOffset.x / width);
        if (idx !== activeImageIndex) {
            setActiveImageIndex(idx);
            thumbScrollRef.current?.scrollTo({ x: idx * (THUMB_SIZE + 6) - width / 2 + THUMB_SIZE / 2, animated: true });
        }
    };

    const selectImage = (idx: number) => {
        setActiveImageIndex(idx);
        mainScrollRef.current?.scrollTo({ x: idx * width, animated: true });
        thumbScrollRef.current?.scrollTo({ x: idx * (THUMB_SIZE + 6) - width / 2 + THUMB_SIZE / 2, animated: true });
    };

    if (isLoading) {
        return (
            <View style={styles.container}>
                <Stack.Screen options={{ headerShown: false }} />
                <ScrollView showsVerticalScrollIndicator={false}>
                    <Skeleton width={width} height={IMAGE_HEIGHT} borderRadius={0} />
                    <View style={styles.content}>
                        <Skeleton width={80} height={12} style={{ marginBottom: 10 }} />
                        <Skeleton width={width * 0.7} height={28} style={{ marginBottom: 10 }} />
                        <Skeleton width={120} height={30} style={{ marginBottom: 20 }} />
                        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
                            <Skeleton width={100} height={46} borderRadius={12} />
                            <Skeleton width={80} height={46} borderRadius={12} />
                        </View>
                        <Skeleton width={100} height={20} style={{ marginBottom: 10 }} />
                        <Skeleton width="100%" height={80} style={{ marginBottom: 20 }} />
                        <Skeleton width="100%" height={80} borderRadius={16} />
                    </View>
                </ScrollView>
            </View>
        );
    }

    if (!listing) {
        return (
            <View style={styles.center}>
                <Text style={styles.errorText}>Product not found</Text>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtnLarge}>
                    <Text style={styles.backBtnText}>Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const images: string[] = listing.images || [];
    const memberSince = seller?.created_at
        ? new Date(seller.created_at).getFullYear()
        : null;

    return (
        <View style={styles.container}>
            <Stack.Screen
                options={{
                    headerShown: false,
                }}
            />

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
                {/* Image Gallery */}
                <View style={styles.galleryContainer}>
                    {/* Floating Header Actions */}
                    <View style={[styles.floatingHeader, { top: insets.top || 10 }]}>
                        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
                            <Feather name="chevron-left" size={24} color="#111111" />
                        </TouchableOpacity>
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                            {isOwner && (
                                <TouchableOpacity
                                    onPress={() => router.push({ pathname: '/(tabs)/product/edit/[id]', params: { id: id as string } })}
                                    style={[styles.headerBtn, { backgroundColor: '#111111' }]}
                                >
                                    <Feather name="edit-2" size={18} color="#FFFFFF" />
                                </TouchableOpacity>
                            )}
                            {isOwner && (
                                <TouchableOpacity
                                    onPress={handleDelete}
                                    style={[styles.headerBtn, { backgroundColor: '#FFEEED' }]}
                                    disabled={isDeleting}
                                >
                                    {isDeleting ? <ActivityIndicator size="small" color="#EA4335" /> : <Ionicons name="trash-outline" size={20} color="#EA4335" />}
                                </TouchableOpacity>
                            )}
                            {!isOwner && (
                                <TouchableOpacity onPress={toggleFavorite} style={styles.headerBtn} activeOpacity={0.7}>
                                    <Animated.View style={animatedHeartStyle}>
                                        <Ionicons
                                            name={isFavorite ? 'heart' : 'heart-outline'}
                                            size={22}
                                            color={isFavorite ? '#FF4B4B' : '#111111'}
                                        />
                                    </Animated.View>
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity style={styles.headerBtn}>
                                <Feather name="share-2" size={20} color="#111111" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <GestureDetector gesture={mainTapGesture}>
                        <View style={{ width, height: IMAGE_HEIGHT }}>
                            <ScrollView
                                ref={mainScrollRef}
                                horizontal
                                pagingEnabled
                                showsHorizontalScrollIndicator={false}
                                onMomentumScrollEnd={onMainScroll}
                                scrollEventThrottle={16}
                            >
                                {images.length > 0 ? images.map((imageUri, i) => (
                                    <ExpoImage
                                        key={i}
                                        source={{ uri: imageUri }}
                                        style={{ width, height: IMAGE_HEIGHT }}
                                        contentFit="cover"
                                        transition={200}
                                        cachePolicy="memory-disk"
                                    />
                                )) : (
                                    <View style={[styles.mainImage, styles.imagePlaceholder]}>
                                        <Feather name="image" size={48} color="#EBEBEB" />
                                    </View>
                                )}
                            </ScrollView>
                        </View>
                    </GestureDetector>



                    {images.length > 1 && (
                        <View style={styles.counterBadge}>
                            <Text style={styles.counterText}>{activeImageIndex + 1}/{images.length}</Text>
                        </View>
                    )}
                </View>

                {/* Full Screen Gallery Modal */}
                <Modal
                    visible={isGalleryVisible}
                    transparent
                    animationType="none"
                    onRequestClose={() => setIsGalleryVisible(false)}
                    onShow={() => {
                        translateY.value = 0; // Reset position on show
                        modalMainScrollRef.current?.scrollTo({ x: modalActiveIndex * width, animated: false });
                    }}
                >
                    <GestureDetector gesture={modalPanGesture}>
                        <Animated.View style={[styles.modalBg, modalAnimatedStyle]}>
                            <StatusBar barStyle="light-content" />

                            {/* Immersive Main Scroll */}
                            <ScrollView
                                ref={modalMainScrollRef}
                                horizontal
                                pagingEnabled
                                showsHorizontalScrollIndicator={false}
                                onMomentumScrollEnd={(e) => {
                                    const idx = Math.round(e.nativeEvent.contentOffset.x / width);
                                    if (idx !== modalActiveIndex) {
                                        setModalActiveIndex(idx);
                                        modalThumbScrollRef.current?.scrollTo({
                                            x: idx * (80 + 8) - width / 2 + 40,
                                            animated: true
                                        });
                                    }
                                }}
                                scrollEventThrottle={16}
                                style={{ flex: 1 }}
                            >
                                {images.map((imageUri, i) => (
                                    <View key={i} style={[styles.modalImgWrapper, { height: '100%', justifyContent: 'center' }]}>
                                        <ExpoImage
                                            source={{ uri: imageUri }}
                                            style={{ width: width, height: width * 1.5 }}
                                            contentFit="contain"
                                            transition={200}
                                            cachePolicy="disk"
                                        />
                                    </View>
                                ))}
                            </ScrollView>

                            {/* Top Close Button */}
                            <TouchableOpacity
                                style={[styles.modalCloseBtn, { top: (insets.top || 10) + 10 }]}
                                onPress={() => setIsGalleryVisible(false)}
                            >
                                <Ionicons name="close" size={28} color="#FFFFFF" />
                            </TouchableOpacity>

                            {/* Bottom Thumbnail Strip */}
                            <View style={[styles.modalThumbContainer, { paddingBottom: (insets.bottom || 20) + 10 }]}>
                                <ScrollView
                                    ref={modalThumbScrollRef}
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
                                >
                                    {images.map((imageUri, i) => (
                                        <TouchableOpacity
                                            key={i}
                                            onPress={() => {
                                                setModalActiveIndex(i);
                                                modalMainScrollRef.current?.scrollTo({ x: i * width, animated: true });
                                            }}
                                            style={[
                                                styles.modalThumb,
                                                modalActiveIndex === i && styles.modalThumbActive
                                            ]}
                                        >
                                            <ExpoImage
                                                source={{ uri: imageUri }}
                                                style={styles.modalThumbImg}
                                                contentFit="cover"
                                                cachePolicy="disk"
                                            />
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>
                        </Animated.View>
                    </GestureDetector>
                </Modal>

                {/* Thumbnails */}
                {images.length > 1 && (
                    <ScrollView
                        ref={thumbScrollRef}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.thumbStrip}
                        style={{ marginTop: 10 }}
                    >
                        {images.map((imageUri, i) => (
                            <TouchableOpacity
                                key={i}
                                onPress={() => selectImage(i)}
                                style={[styles.thumb, activeImageIndex === i && styles.thumbActive]}
                                activeOpacity={0.8}
                            >
                                <ExpoImage
                                    source={{ uri: imageUri }}
                                    style={styles.thumbImg}
                                    contentFit="cover"
                                    transition={150}
                                    cachePolicy="disk"
                                />
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                )}

                <View style={styles.content}>
                    <Text style={styles.brandText}>{listing.brand || listing.category}</Text>
                    <View style={styles.titleRow}>
                        <Text style={styles.titleText}>{listing.title}</Text>
                        {isOwner && listing.is_boosted && listing.boost_expires_at && (
                            <View style={styles.boostExpiryBadge}>
                                <Ionicons name="flash" size={12} color="#FF9500" />
                                <Text style={styles.boostExpiryText}>
                                    Promoted: {Math.max(0, Math.ceil((new Date(listing.boost_expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))} days left
                                </Text>
                            </View>
                        )}
                    </View>
                    <Text style={styles.priceText}>GH₵{listing.price}</Text>

                    <View style={styles.chipsRow}>
                        <View style={styles.chip}>
                            <Ionicons name="checkmark-circle-outline" size={12} color={BLUE} />
                            <Text style={styles.chipText}>{listing.condition}</Text>
                        </View>

                        {listing.location && (
                            <View style={styles.chip}>
                                <Ionicons name="location-outline" size={12} color={BLUE} />
                                <Text style={styles.chipText}>{listing.location}</Text>
                            </View>
                        )}
                    </View>

                    <View style={styles.divider} />

                    {/* Contact Buttons Moved Here */}
                    <View style={styles.mainActions}>
                        <TouchableOpacity style={styles.chatBtn} onPress={handleChat}>
                            <Ionicons name="chatbubble-ellipses-outline" size={18} color="#FFFFFF" />
                            <Text style={styles.chatBtnText}>Message Seller</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleCall} activeOpacity={0.8}>
                            <Animated.View style={[styles.callBtn, animatedCallBtnStyle]}>
                                <Ionicons
                                    name={isCopied ? "checkmark-circle" : "call-outline"}
                                    size={18}
                                    color={BLUE}
                                />
                                <Text style={styles.callBtnText}>{isCopied ? "Copied" : "Call"}</Text>
                            </Animated.View>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.divider} />



                    <Text style={styles.sectionTitle}>Description</Text>
                    <Text style={styles.descText}>{listing.description || 'No description provided.'}</Text>



                    <View style={styles.divider} />

                    {/* Pro Seller Card Integration */}
                    {seller && (
                        <View style={styles.sellerCard}>
                            <View style={styles.sellerTop}>
                                <TouchableOpacity
                                    style={styles.avatarWrap}
                                    onPress={() => router.push({ pathname: '/seller/[id]', params: { id: seller.id } })}
                                >
                                    {seller.avatar_url ? (
                                        <ExpoImage source={{ uri: seller.avatar_url }} style={styles.avatar} transition={150} />
                                    ) : (
                                        <View style={styles.avatarFallback}>
                                            <Text style={styles.avatarInitial}>
                                                {(seller.full_name || 'U').charAt(0).toUpperCase()}
                                            </Text>
                                        </View>
                                    )}
                                    {seller.is_verified && (
                                        <View style={styles.verifiedBadge}>
                                            <Ionicons name="checkmark" size={8} color="#FFFFFF" />
                                        </View>
                                    )}
                                </TouchableOpacity>

                                <View style={styles.sellerMeta}>
                                    <TouchableOpacity onPress={() => router.push({ pathname: '/seller/[id]', params: { id: seller.id } })}>
                                        <Text style={styles.sellerName}>{seller.full_name || 'Seller'}</Text>
                                    </TouchableOpacity>
                                    <View style={styles.statusRow}>
                                        <View style={[styles.statusBadge, { backgroundColor: seller.is_verified ? '#EEF3FF' : '#F5F5F5' }]}>
                                            <Ionicons
                                                name={seller.is_verified ? "shield-checkmark" : "person-outline"}
                                                size={10}
                                                color={seller.is_verified ? BLUE : '#8A8A8A'}
                                            />
                                            <Text style={[styles.statusText, { color: seller.is_verified ? BLUE : '#8A8A8A' }]}>
                                                {seller.is_verified ? 'Verified Seller' : 'Regular Seller'}
                                            </Text>
                                        </View>
                                        {memberSince && (
                                            <Text style={styles.sinceText}>Since {memberSince}</Text>
                                        )}
                                    </View>
                                </View>

                                <TouchableOpacity
                                    style={styles.profileBtn}
                                    onPress={() => router.push({ pathname: '/seller/[id]', params: { id: seller.id } })}
                                >
                                    <Text style={styles.profileBtnText}>Profile</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    {/* Seller Reviews Preview */}
                    {seller && (
                        <View style={styles.reviewsPreview}>
                            <View style={styles.reviewsHeader}>
                                <View style={styles.ratingRow}>
                                    <Ionicons name="star" size={16} color="#FFB800" />
                                    <Text style={styles.ratingValue}>{Number(sellerStats.avg_rating).toFixed(1)}</Text>
                                    <Text style={styles.totalReviews} numberOfLines={1}>({sellerStats.total_reviews} reviews)</Text>
                                    <View style={{ width: 4 }} />
                                    <Text style={styles.responseRate} numberOfLines={1}>Replies in {getResponseTimeText(sellerStats.response_rate)}</Text>
                                </View>
                                {reviews.length > 0 && (
                                    <TouchableOpacity
                                        onPress={() => router.push({ pathname: '/seller/reviews/[id]', params: { id: seller.id } })}
                                        style={{ flexShrink: 0 }}
                                    >
                                        <Text style={styles.viewMoreText}>View More</Text>
                                    </TouchableOpacity>
                                )}
                            </View>

                            {reviews.length > 0 ? (
                                <View style={styles.reviewsList}>
                                    {reviews.map((rev) => (
                                        <View key={rev.id} style={styles.reviewItem}>
                                            <View style={styles.reviewTop}>
                                                <View style={styles.stars}>
                                                    {[1, 2, 3, 4, 5].map(s => (
                                                        <Ionicons
                                                            key={s}
                                                            name={rev.rating >= s ? "star" : "star-outline"}
                                                            size={10}
                                                            color="#FFB800"
                                                        />
                                                    ))}
                                                </View>
                                                <Text style={styles.reviewDate}>
                                                    {new Date(rev.created_at).toLocaleDateString()}
                                                </Text>
                                            </View>
                                            {rev.comment && (
                                                <Text style={styles.reviewComment} numberOfLines={2}>
                                                    {rev.comment}
                                                </Text>
                                            )}
                                            <View style={styles.reviewerRow}>
                                                <Text style={styles.reviewerName}>by {rev.reviewer?.full_name || 'Buyer'}</Text>
                                                {rev.is_verified && (
                                                    <View style={styles.verifiedTag}>
                                                        <Ionicons name="checkmark-circle" size={10} color="#00B850" />
                                                        <Text style={styles.verifiedTagText}>Verified Purchase</Text>
                                                    </View>
                                                )}
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            ) : (
                                <View style={styles.emptyReviews}>
                                    <Text style={styles.emptyReviewsText}>No reviews yet for this seller.</Text>
                                </View>
                            )}
                        </View>
                    )}

                    <TouchableOpacity
                        style={styles.reportListingBtn}
                        onPress={() => setIsReportVisible(true)}
                    >
                        <Ionicons name="flag-outline" size={14} color="#ABABAB" />
                        <Text style={styles.reportListingText}>Report this listing</Text>
                    </TouchableOpacity>

                    {/* More from Seller */}
                    {(isLoadingSellerListings || sellerListings.length > 0) && (
                        <View style={{ marginBottom: 40 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                <Text style={{ fontSize: 18, fontWeight: '700', color: '#111' }}>More from {seller?.full_name?.split(' ')[0] || 'Seller'}</Text>
                                <TouchableOpacity onPress={() => router.push({ pathname: '/seller/[id]', params: { id: listing.user_id } })}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                        <Text style={{ fontSize: 14, fontWeight: '600', color: BLUE }}>See Shop</Text>
                                        <Feather name="chevron-right" size={14} color={BLUE} />
                                    </View>
                                </TouchableOpacity>
                            </View>

                            {isLoadingSellerListings ? (
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                                    {[1, 2, 3, 4].map((i) => (
                                        <View key={i} style={{ width: 160 }}>
                                            <Skeleton width={160} height={160} borderRadius={20} style={{ marginBottom: 8 }} />
                                            <Skeleton width={120} height={12} style={{ marginBottom: 4 }} />
                                            <Skeleton width={60} height={14} />
                                        </View>
                                    ))}
                                </ScrollView>
                            ) : (
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                                    {sellerListings.map((item) => (
                                        <TouchableOpacity
                                            key={item.id}
                                            style={{ width: 160 }}
                                            onPress={() => router.push({ pathname: '/(tabs)/product/[id]', params: { id: item.id } })}
                                            activeOpacity={0.9}
                                        >
                                            <View style={{
                                                height: 160, backgroundColor: '#F5F5F5', borderRadius: 20,
                                                marginBottom: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#EBEBEB',
                                            }}>
                                                {item.images?.[0] ? (
                                                    <ExpoImage
                                                        source={{ uri: item.images[0] }}
                                                        style={{ width: '100%', height: '100%' }}
                                                        contentFit="cover"
                                                        transition={200}
                                                        cachePolicy="memory-disk"
                                                    />
                                                ) : (
                                                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                                                        <Ionicons name="image-outline" size={24} color="#EBEBEB" />
                                                    </View>
                                                )}
                                            </View>
                                            <Text style={{ fontSize: 12, fontWeight: '600', color: '#333', lineHeight: 16 }} numberOfLines={1}>
                                                {item.title}
                                            </Text>
                                            <Text style={{ fontSize: 14, fontWeight: '800', color: BLUE, marginTop: 4 }}>
                                                GH₵{item.price}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            )}
                        </View>
                    )}

                    {/* Related Products Grid */}
                    {(isLoadingSimilarItems || similarItems.length > 0) && (
                        <View style={{ marginBottom: 20 }}>
                            <View style={{ marginBottom: 16 }}>
                                <Text style={{ fontSize: 18, fontWeight: '700', color: '#111' }}>You May Also Like</Text>
                                <View style={{ width: 40, height: 3, backgroundColor: BLUE, marginTop: 6, borderRadius: 2 }} />
                            </View>

                            {isLoadingSimilarItems ? (
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 16 }}>
                                    {[1, 2, 3, 4].map((i) => (
                                        <View key={i} style={{ width: (width - 48) / 2 }}>
                                            <Skeleton width={(width - 48) / 2} height={180} borderRadius={24} style={{ marginBottom: 12 }} />
                                            <Skeleton width={80} height={12} style={{ marginBottom: 6 }} />
                                            <Skeleton width={(width - 48) / 2 * 0.8} height={16} />
                                        </View>
                                    ))}
                                </View>
                            ) : (
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 16 }}>
                                    {similarItems.map((item) => (
                                        <ProductCard
                                            key={item.id}
                                            item={item}
                                        />
                                    ))}
                                </View>
                            )}
                        </View>
                    )}

                    <View style={{ height: 40 }} />
                </View>
            </ScrollView>

            <ReportSheet
                visible={isReportVisible}
                onClose={() => setIsReportVisible(false)}
                targetType="listing"
                targetId={id as string}
                targetTitle={listing?.title || ''}
                reportedUserId={listing?.user_id || ''}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' },

    galleryContainer: {
        width,
        height: IMAGE_HEIGHT,
        backgroundColor: '#F9F9F9',
        position: 'relative',
    },
    mainImage: {
        width,
        height: IMAGE_HEIGHT,
        resizeMode: 'cover',
    },
    imagePlaceholder: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    counterBadge: {
        position: 'absolute',
        bottom: 12,
        left: 15,
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 12,
    },
    counterText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '700',
    },

    thumbStrip: {
        paddingHorizontal: 20,
        gap: 6,
    },
    thumb: {
        width: THUMB_SIZE,
        height: THUMB_SIZE,
        borderRadius: 10,
        overflow: 'hidden',
        borderWidth: 1.5,
        borderColor: 'transparent',
        backgroundColor: '#F2F2F2',
    },
    thumbActive: {
        borderColor: BLUE,
        backgroundColor: '#FFFFFF',
    },
    thumbImg: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    floatingHeader: {
        position: 'absolute',
        left: 0,
        right: 0,
        zIndex: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
    },
    headerBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.9)',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },

    scroll: {},
    content: {
        paddingHorizontal: 16,
        paddingTop: 18,
    },
    brandText: { fontSize: 13, fontWeight: '700', color: BLUE, textTransform: 'uppercase', marginBottom: 6, letterSpacing: 0.5 },
    titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8 },
    titleText: { fontSize: 24, fontWeight: '800', color: '#111111', flex: 1 },
    boostExpiryBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF9F0', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, gap: 4, borderWidth: 1, borderColor: '#FFE8CC' },
    boostExpiryText: { fontSize: 11, fontWeight: '700', color: '#FF9500' },
    priceText: { fontSize: 26, fontWeight: '900', color: BLUE, marginBottom: 20 },
    chipsRow: {
        flexDirection: 'row',
        gap: 6,
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#F0F4FF',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 15,
    },
    chipText: {
        fontSize: 11,
        fontWeight: '600',
        color: BLUE,
    },
    divider: {
        height: 1,
        backgroundColor: '#F2F2F2',
        marginVertical: 18,
    },

    // Main Actions Before Description
    mainActions: {
        flexDirection: 'row',
        gap: 10,
    },
    chatBtn: {
        flex: 1,
        height: 46,
        backgroundColor: BLUE,
        borderRadius: 12,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 6,
    },
    chatBtnText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '700',
    },
    callBtn: {
        width: 80,
        height: 46,
        borderRadius: 12,
        backgroundColor: '#EEF3FF',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.2,
        borderColor: '#D6E4FF',
        flexDirection: 'row',
        gap: 4,
    },
    callBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: BLUE,
    },

    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111111',
        marginBottom: 8,
    },
    descText: {
        fontSize: 14,
        color: '#555555',
        lineHeight: 22,
    },

    // Sized Down Profile Card
    sellerCard: {
        backgroundColor: '#F9F9F9',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#EEEEEE',
        padding: 12,
    },
    sellerTop: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    avatarWrap: {
        position: 'relative',
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
    },
    avatarFallback: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: BLUE,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarInitial: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '800',
    },
    verifiedBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: BLUE,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: '#F9F9F9',
    },
    sellerMeta: {
        flex: 1,
    },
    sellerName: {
        fontSize: 14,
        fontWeight: '700',
        color: '#111111',
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 2,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 10,
    },
    statusText: {
        fontSize: 9,
        fontWeight: '700',
    },
    sinceText: {
        fontSize: 10,
        color: '#ABABAB',
    },
    profileBtn: {
        paddingVertical: 5,
        paddingHorizontal: 10,
        backgroundColor: '#FFFFFF',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#EBEBEB',
    },
    profileBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#111111',
    },



    errorText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111111',
    },
    backBtnLarge: {
        marginTop: 20,
        paddingHorizontal: 24,
        paddingVertical: 12,
        backgroundColor: BLUE,
        borderRadius: 12,
    },
    backBtnText: {
        color: '#FFFFFF',
        fontWeight: '700',
    },

    // Modal Styles
    modalBg: {
        flex: 1,
        backgroundColor: '#000000',
    },
    modalCloseBtn: {
        position: 'absolute',
        right: 20,
        zIndex: 20,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalImgWrapper: {
        width: width,
    },
    modalThumbContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingTop: 15,
    },
    modalThumb: {
        width: 80,
        height: 80,
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: 'transparent',
    },
    modalThumbActive: {
        borderColor: '#FFFFFF',
    },
    modalThumbImg: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    reportListingBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 32,
        gap: 6,
        paddingVertical: 10,
    },
    reportListingText: {
        fontSize: 13,
        color: '#ABABAB',
        fontWeight: '600',
        textDecorationLine: 'underline',
    },

    // Reviews Styles
    reviewsPreview: {
        marginTop: 20,
        backgroundColor: '#FAFAFA',
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: '#F0F0F0',
    },
    reviewsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        gap: 8,
    },
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        flex: 1,
        flexWrap: 'wrap',
    },
    ratingValue: {
        fontSize: 18,
        fontWeight: '800',
        color: '#111111',
    },
    totalReviews: {
        fontSize: 13,
        color: '#8A8A8A',
        fontWeight: '500',
    },
    responseRate: {
        fontSize: 12,
        color: '#00B850',
        fontWeight: '700',
        backgroundColor: '#E8F8EE',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
    },
    viewMoreText: {
        fontSize: 13,
        fontWeight: '700',
        color: BLUE,
    },
    reviewsList: {
        gap: 16,
    },
    reviewItem: {
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    reviewTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    stars: {
        flexDirection: 'row',
        gap: 1,
    },
    reviewDate: {
        fontSize: 10,
        color: '#ABABAB',
        fontWeight: '500',
    },
    reviewComment: {
        fontSize: 13,
        color: '#444',
        lineHeight: 18,
        marginBottom: 8,
    },
    reviewerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    reviewerName: {
        fontSize: 11,
        fontWeight: '600',
        color: '#8A8A8A',
    },
    verifiedTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#E8F8EE',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    verifiedTagText: {
        fontSize: 9,
        fontWeight: '700',
        color: '#00B850',
    },
    emptyReviews: {
        paddingVertical: 20,
        alignItems: 'center',
    },
    emptyReviewsText: {
        fontSize: 13,
        color: '#ABABAB',
        fontStyle: 'italic',
    },
    boostOverlay: {
        position: 'absolute',
        bottom: 20,
        left: 20,
        backgroundColor: 'rgba(255, 149, 0, 0.95)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 10,
    },
    boostOverlayText: {
        fontSize: 11,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: 0.5,
    },
    boostCardMini: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF9F0',
        padding: 16,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#FFEBCF',
        marginBottom: 24,
        gap: 16,
    },
    boostIconWrap: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#FF9500',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    boostTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#111',
    },
    boostSub: {
        fontSize: 12,
        color: '#666',
        marginTop: 2,
    },
});

export default ProductDetailsScreen;

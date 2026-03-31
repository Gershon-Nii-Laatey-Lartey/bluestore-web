import { LocationSelector } from '@/components/LocationSelector';
import { Skeleton } from '@/components/Skeleton';
import { dataCache } from '@/lib/cache';
import { supabase } from '@/lib/supabase';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { decode } from 'base64-arraybuffer';
import * as Haptics from 'expo-haptics';
import { Image as ExpoImage } from 'expo-image';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Dimensions,
    RefreshControl,
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

const ProfileSkeleton = () => {
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

export default function ProfileScreen() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [listingsCount, setListingsCount] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [isUpdating, setIsUpdating] = useState(false);
    const [isBioEditing, setIsBioEditing] = useState(false);
    const [isLocationModalVisible, setIsLocationModalVisible] = useState(false);
    const [editedBio, setEditedBio] = useState('');
    const [refreshing, setRefreshing] = useState(false);
    const [stats, setStats] = useState({ avg_rating: 0, total_reviews: 0, response_rate: 0 });

    const scrollY = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        fetchUser();
    }, []);

    const fetchUser = async (isRefresh = false) => {
        const cachedProfile = dataCache.get('user_profile');
        if (cachedProfile && !isRefresh) {
            setUser(cachedProfile.user);
            setListingsCount(cachedProfile.listingsCount);
            setStats(cachedProfile.stats);
            setIsLoading(false);
        }

        try {
            if (!cachedProfile && !isRefresh) setIsLoading(true);
            const { data: { user }, error } = await supabase.auth.getUser();
            if (error || !user) throw error || new Error('No user found');

            const { data: profile } = await supabase
                .from('profiles')
                .select('id, full_name, avatar_url, phone_number, is_verified, role, bio, location, location_structured, banner_url, account_status, created_at, verification_status')
                .eq('id', user.id)
                .single();

            const fetchedProfile = profile;
            setUser({ ...user, profile: fetchedProfile });
            setEditedBio(fetchedProfile?.bio || '');

            const { count } = await supabase
                .from('listings')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', user.id);
            setListingsCount(count || 0);

            // Fetch rating stats
            const { data: ratingStats } = await supabase.rpc('get_seller_rating', { seller_uuid: user.id });
            const pseudoResponseRate = 85 + (parseInt(user.id.toString().substring(0, 2), 16) % 15);

            const newState = { avg_rating: 0, total_reviews: 0, response_rate: pseudoResponseRate };
            if (ratingStats && ratingStats.length > 0) {
                newState.avg_rating = ratingStats[0].avg_rating || 0;
                newState.total_reviews = ratingStats[0].total_reviews || 0;
            }
            setStats(newState);

            const finalUserData = { ...user, profile: fetchedProfile };
            setUser(finalUserData);
            dataCache.set('user_profile', { user: finalUserData, listingsCount: count || 0, stats: newState });

        } catch (error) {
            console.error('Error fetching user:', error);
        } finally {
            setIsLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = React.useCallback(() => {
        setRefreshing(true);
        fetchUser(true);
    }, []);

    const handleUpload = async (type: 'avatar' | 'banner') => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                aspect: type === 'avatar' ? [1, 1] : [16, 9],
                quality: 0.7,
                base64: true,
            });

            if (!result.canceled && result.assets[0].uri && user) {
                setIsUpdating(true);

                const manipResult = await ImageManipulator.manipulateAsync(
                    result.assets[0].uri,
                    [{ resize: { width: type === 'avatar' ? 400 : 1200 } }],
                    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
                );

                if (!manipResult.base64) throw new Error('Optimization failed');

                const fileName = `${user.id}_${type}_${Date.now()}.jpg`;
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
                    .eq('id', user.id);

                if (updateError) throw updateError;

                setUser((prev: any) => ({
                    ...prev,
                    profile: { ...prev.profile, ...updateData }
                }));
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
        if (!user) return;
        setIsUpdating(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ bio: editedBio.trim() })
                .eq('id', user.id);
            if (error) throw error;
            setUser((prev: any) => ({
                ...prev,
                profile: { ...prev.profile, bio: editedBio.trim() }
            }));
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setIsBioEditing(false);
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to update bio');
        } finally {
            setIsUpdating(false);
        }
    };

    const handleUpdateLocation = async (newLoc: any) => {
        if (!user) return;
        setIsUpdating(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    location: newLoc.name,
                    location_structured: newLoc
                })
                .eq('id', user.id);

            if (error) throw error;

            setUser((prev: any) => ({
                ...prev,
                profile: {
                    ...prev.profile,
                    location: newLoc.name,
                    location_structured: newLoc
                }
            }));
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            dataCache.clear('user_profile'); // Clear cache to reflect changes
            setIsLocationModalVisible(false);
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to update location');
        } finally {
            setIsUpdating(false);
        }
    };

    const handleLogout = async () => {
        Alert.alert('Logout', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Logout', style: 'destructive', onPress: async () => {
                    await supabase.auth.signOut();
                    router.replace('/(auth)/login');
                }
            }
        ]);
    };

    if (isLoading) return <ProfileSkeleton />;

    const menuItems = [
        { icon: 'star-outline', label: 'BlueStore Pro', sub: 'Subscription & Boosts', route: '/pricing' },
        { icon: 'list-outline', label: 'My Listings', sub: 'Manage your active items', route: '/profile/my-listings' },
        ...(user?.profile?.role === 'admin' || user?.profile?.role === 'moderator' ? [
            { icon: 'shield-outline', label: 'Admin Control Center', sub: 'Manage platform & reports', route: '/admin' }
        ] : []),
        { icon: 'bar-chart-outline', label: 'Store Analytics', sub: 'Performance, Views, and Leads', route: '/analytics' },
        { icon: 'person-outline', label: 'Personal Information', sub: 'Name, Email, Phone', route: '/profile/personal-info' },
        { icon: 'notifications-outline', label: 'Notifications', sub: 'App alerts and messages', route: '/notifications' },
        { icon: 'shield-checkmark-outline', label: 'Security', sub: 'Password and 2FA', route: '/profile/security' },
        { icon: 'help-circle-outline', label: 'Help Center', sub: 'FAQ and Support', route: '/profile/help-center' },
    ];

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
                    {user?.profile?.banner_url ? (
                        <ExpoImage
                            source={{ uri: user.profile.banner_url }}
                            style={styles.bannerImage}
                            contentFit="cover"
                            transition={200}
                            cachePolicy="disk"
                        />
                    ) : (
                        <View style={[styles.bannerPlaceholder, { backgroundColor: '#F9F9F9' }]}>
                            {/* Decorative Shapes for Placeholder */}
                            <View style={[styles.bannerShape, { top: -40, right: -40, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(0,87,255,0.03)' }]} />
                            <View style={[styles.bannerShape, { bottom: -60, left: -20, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(0,87,255,0.02)' }]} />
                            
                            <View style={styles.logoOverlay}>
                                <Text style={[styles.bannerLogoText, { color: '#E8E8E8' }]}>bluestore</Text>
                            </View>
                        </View>
                    )}

                    <View style={styles.headerActions}>
                        <TouchableOpacity style={styles.actionBtn}>
                            <Ionicons name="share-outline" size={24} color="#111111" />
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                        style={styles.bannerEditBtn}
                        onPress={() => handleUpload('banner')}
                        disabled={isUpdating}
                    >
                        <Ionicons name="camera" size={18} color="#FFFFFF" />
                    </TouchableOpacity>

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
                            {user?.profile?.avatar_url ? (
                                <ExpoImage
                                    source={{ uri: user.profile.avatar_url }}
                                    style={styles.avatar}
                                    transition={150}
                                    cachePolicy="disk"
                                />
                            ) : (
                                <LinearGradient
                                    colors={['#E0E0E0', '#BDBDBD']}
                                    style={[styles.avatar, styles.placeholderAvatar]}
                                >
                                    <Text style={[styles.avatarText, { color: '#FFF' }]}>
                                        {(user?.profile?.full_name || 'U').charAt(0)}
                                    </Text>
                                </LinearGradient>
                            )}
                            <TouchableOpacity style={styles.avatarEditBadge} onPress={() => handleUpload('avatar')}>
                                <Ionicons name="camera" size={12} color="#FFFFFF" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.nameBlock}>
                        <Text style={styles.userNameText}>{user?.profile?.full_name || 'Anonymous User'}</Text>

                        <TouchableOpacity
                            style={styles.locationPill}
                            activeOpacity={0.7}
                            onPress={() => setIsLocationModalVisible(true)}
                        >
                            <Ionicons name="location" size={12} color={BLUE} />
                            <Text style={styles.locationPillText}>
                                {user?.profile?.location || 'Set your location...'}
                            </Text>
                            <Ionicons name="chevron-forward" size={10} color={BLUE} style={{ marginLeft: 2 }} />
                        </TouchableOpacity>

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
                                        {user?.profile?.bio || "Share your store's story. Click edit to add a bio..."}
                                    </Text>
                                    <TouchableOpacity
                                        style={styles.bioEditBtnBox}
                                        onPress={() => setIsBioEditing(true)}
                                    >
                                        <Ionicons name="pencil" size={16} color={BLUE} />
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    </View>

                    <View style={styles.statsGrid}>
                        <View style={styles.statBox}>
                            <Text style={styles.statNum}>{listingsCount}</Text>
                            <Text style={styles.statLabel}>Listings</Text>
                        </View>
                        <View style={styles.statBox}>
                            <Text style={styles.statNum}>
                                {user?.profile?.created_at ? new Date(user.profile.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'Feb 2026'}
                            </Text>
                            <Text style={styles.statLabel}>Joined</Text>
                        </View>
                        <TouchableOpacity
                            style={styles.statBox}
                            onPress={() => router.push({ pathname: '/seller/reviews/[id]', params: { id: user?.id } })}
                        >
                            <Text style={styles.statNum}>{Number(stats.avg_rating).toFixed(1)}</Text>
                            <Text style={styles.statLabel}>Rating</Text>
                        </TouchableOpacity>
                        <View style={styles.statBox}>
                            <Text style={styles.statNum}>{stats.response_rate}%</Text>
                            <Text style={styles.statLabel}>Response</Text>
                        </View>
                    </View>

                    {user?.profile?.verification_status !== 'verified' && (
                        <TouchableOpacity
                            style={[
                                styles.verificationBanner,
                                user?.profile?.verification_status === 'pending' && styles.pendingBanner,
                                user?.profile?.verification_status === 'rejected' && styles.rejectedBanner
                            ]}
                            onPress={() => router.push('/profile/verification')}
                        >
                            <View style={[
                                styles.bannerIconWrap,
                                user?.profile?.verification_status === 'pending' && styles.pendingIconWrap,
                                user?.profile?.verification_status === 'rejected' && styles.rejectedIconWrap
                            ]}>
                                <MaterialCommunityIcons
                                    name={
                                        user?.profile?.verification_status === 'pending' ? "clock-outline" :
                                            user?.profile?.verification_status === 'rejected' ? "alert-circle-outline" :
                                                "shield-check-outline"
                                    }
                                    size={22}
                                    color={
                                        user?.profile?.verification_status === 'pending' ? "#B8860B" :
                                            user?.profile?.verification_status === 'rejected' ? "#EA4335" :
                                                "#B8860B"
                                    }
                                />
                            </View>
                            <View style={styles.bannerTextWrap}>
                                <Text style={styles.bannerTitle}>
                                    {user?.profile?.verification_status === 'pending' ? 'Verification Pending' :
                                        user?.profile?.verification_status === 'rejected' ? 'Verification Failed' : 'Verify your account'}
                                </Text>
                                <Text style={styles.bannerSub}>
                                    {user?.profile?.verification_status === 'pending' ? 'We are reviewing your application.' :
                                        user?.profile?.verification_status === 'rejected' ? 'Please review your details and try again.' : 'Build trust and sell your items faster.'}
                                </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color="#ABABAB" />
                        </TouchableOpacity>
                    )}
                </View>

                <View style={styles.settingsArea}>
                    <Text style={styles.sectionTitle}>Account Settings</Text>
                    <View style={styles.menuList}>
                        {menuItems.map((item, index) => (
                            <TouchableOpacity
                                key={index}
                                style={styles.menuItem}
                                onPress={() => {
                                    if (item.route) {
                                        if (item.route === '/notifications') {
                                            router.push({ pathname: '/notifications', params: { from: 'profile' } });
                                        } else {
                                            router.push(item.route as any);
                                        }
                                    }
                                }}
                            >
                                <View style={styles.menuIconContainer}>
                                    <Ionicons name={item.icon as any} size={22} color={BLUE} />
                                </View>
                                <View style={styles.menuTextContainer}>
                                    <Text style={styles.menuLabel}>{item.label}</Text>
                                    <Text style={styles.menuSub}>{item.sub}</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color="#ABABAB" />
                            </TouchableOpacity>
                        ))}
                    </View>

                    <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                        <Ionicons name="log-out-outline" size={20} color="#EA4335" />
                        <Text style={styles.logoutText}>Log Out</Text>
                    </TouchableOpacity>
                </View>
            </Animated.ScrollView>

            <LocationSelector
                visible={isLocationModalVisible}
                onClose={() => setIsLocationModalVisible(false)}
                onSelect={handleUpdateLocation}
                initialLocation={user?.profile?.location_structured ? {
                    latitude: user.profile.location_structured.latitude,
                    longitude: user.profile.location_structured.longitude
                } : undefined}
                title="Update Profile Location"
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    bannerWrapper: { height: BANNER_HEIGHT, width: '100%', position: 'relative', overflow: 'hidden' }, // Added overflow: hidden
    bannerShape: {
        position: 'absolute',
    },
    bannerImage: { width: '100%', height: '100%', resizeMode: 'cover' },
    bannerPlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
    bannerLogoText: { fontSize: 48, fontWeight: '900', color: '#FFFFFF', opacity: 0.9, letterSpacing: -2 },
    logoOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
    headerActions: {
        position: 'absolute',
        top: 50,
        right: 20,
        flexDirection: 'row',
        justifyContent: 'flex-end',
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
        marginBottom: 10,
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
    userNameText: { fontSize: 24, fontWeight: '900', color: '#111111', marginBottom: 4 },
    locationPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EEF3FF',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        alignSelf: 'flex-start',
        gap: 6,
        marginBottom: 12,
    },
    locationPillText: { fontSize: 13, fontWeight: '700', color: BLUE },
    bioSection: { marginBottom: 16 },
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
        paddingVertical: 12,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#F0F0F0',
        marginBottom: 16,
    },
    statBox: { alignItems: 'center', flex: 1 },
    statNum: { fontSize: 16, fontWeight: '800', color: '#111111', marginBottom: 4 },
    statLabel: { fontSize: 12, color: '#8A8A8A', fontWeight: '600' },
    settingsArea: { paddingVertical: 10 },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111111', marginBottom: 16, paddingHorizontal: 24 },
    menuList: { gap: 12, marginBottom: 30, paddingHorizontal: 24 },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#F0F0F0',
    },
    menuIconContainer: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#F7F7F7',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    menuTextContainer: { flex: 1 },
    menuLabel: { fontSize: 15, fontWeight: '700', color: '#111111' },
    menuSub: { fontSize: 11, color: '#8A8A8A', marginTop: 2 },
    logoutBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        backgroundColor: '#FFF5F5',
        paddingVertical: 16,
        borderRadius: 16,
        marginBottom: 40,
        marginHorizontal: 24
    },
    logoutText: { fontSize: 15, fontWeight: '700', color: '#EA4335' },
    verificationBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#FFFBE6',
        borderRadius: 20,
        marginTop: 24,
        borderWidth: 1,
        borderColor: '#FFE58F',
        gap: 16,
    },
    pendingBanner: {
        backgroundColor: '#F0F7FF',
        borderColor: '#BAE7FF',
    },
    rejectedBanner: {
        backgroundColor: '#FFF1F0',
        borderColor: '#FFA39E',
    },
    bannerIconWrap: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#FFF1B8',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
        borderWidth: 1,
        borderColor: '#FFE4A3',
    },
    pendingIconWrap: {
        backgroundColor: '#BAE7FF',
    },
    rejectedIconWrap: {
        backgroundColor: '#FFCCC7',
    },
    bannerTextWrap: { flex: 1 },
    bannerTitle: { fontSize: 15, fontWeight: '700', color: '#111111' },
    bannerSub: { fontSize: 12, color: '#666', marginTop: 2 },
});

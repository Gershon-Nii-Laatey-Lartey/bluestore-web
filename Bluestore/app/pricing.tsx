import { subscriptions } from '@/lib/subscriptions';
import { paystack } from '@/lib/paystack';
import { supabase } from '@/lib/supabase';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Dimensions,
    FlatList,
    Image,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PaymentDrawer } from '@/components/PaymentDrawer';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Skeleton } from '@/components/Skeleton';

const { width } = Dimensions.get('window');
const BLUE = '#0057FF';
const GOLD = '#FFD700';

type TabType = 'plans' | 'boosts';

function PricingSkeleton() {
    return (
        <View style={styles.container}>
            <SafeAreaView edges={['top']} style={styles.headerSafe}>
                <View style={[styles.header, { justifyContent: 'space-between' }]}>
                    <Skeleton width={44} height={44} borderRadius={22} />
                    <Skeleton width={150} height={20} borderRadius={6} />
                    <View style={{ width: 44 }} />
                </View>
            </SafeAreaView>
            <ScrollView contentContainerStyle={styles.scrollContent} scrollEnabled={false}>
                <Skeleton width="100%" height={160} borderRadius={28} style={{ marginBottom: 32 }} />
                <View style={[styles.tabContainer, { padding: 6 }]}>
                    <Skeleton width="48%" height={36} borderRadius={12} />
                    <View style={{ width: '4%' }} />
                    <Skeleton width="48%" height={36} borderRadius={12} />
                </View>
                <View style={styles.packageList}>
                    {[1, 2, 3].map((i) => (
                        <View key={i} style={[styles.packageCard, { borderColor: '#F5F5F5' }]}>
                            <View style={styles.pkgHeader}>
                                <View style={{ gap: 8 }}>
                                    <Skeleton width={120} height={20} borderRadius={6} />
                                    <Skeleton width={80} height={12} borderRadius={4} />
                                </View>
                                <Skeleton width={60} height={28} borderRadius={8} />
                            </View>
                            <Skeleton width="100%" height={14} borderRadius={4} style={{ marginBottom: 8 }} />
                            <Skeleton width="80%" height={14} borderRadius={4} style={{ marginBottom: 24 }} />
                            <View style={{ gap: 12, marginBottom: 28 }}>
                                <View style={{ flexDirection: 'row', gap: 10 }}>
                                    <Skeleton width={16} height={16} borderRadius={8} />
                                    <Skeleton width={180} height={14} borderRadius={4} />
                                </View>
                                <View style={{ flexDirection: 'row', gap: 10 }}>
                                    <Skeleton width={16} height={16} borderRadius={8} />
                                    <Skeleton width={140} height={14} borderRadius={4} />
                                </View>
                            </View>
                            <Skeleton width="100%" height={56} borderRadius={18} />
                        </View>
                    ))}
                </View>
            </ScrollView>
        </View>
    );
}

export default function PricingScreen() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<TabType>('plans');
    const [packages, setPackages] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [userStatus, setUserStatus] = useState<any>(null);
    const [myListings, setMyListings] = useState<any[]>([]);
    const [isListingModalVisible, setIsListingModalVisible] = useState(false);
    
    const [paymentVisible, setPaymentVisible] = useState(false);
    const [selectedPackage, setSelectedPackage] = useState<any>(null);
    const [targetListingId, setTargetListingId] = useState<string | null>(null);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    // Animation refs for listing selector
    const slideAnim = React.useRef(new Animated.Value(Dimensions.get('window').height)).current;
    const fadeAnim = React.useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (isListingModalVisible) {
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.spring(slideAnim, {
                    toValue: 0,
                    tension: 50,
                    friction: 8,
                    useNativeDriver: true,
                })
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 0,
                    duration: 250,
                    useNativeDriver: true,
                }),
                Animated.timing(slideAnim, {
                    toValue: Dimensions.get('window').height,
                    duration: 250,
                    useNativeDriver: true,
                })
            ]).start();
        }
    }, [isListingModalVisible]);

    useEffect(() => {
        fetchData();
        fetchMyListings();
    }, []);

    const fetchData = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setCurrentUserId(user.id);
                const status = await subscriptions.getUserStatus(user.id);
                setUserStatus(status);
            }

            const { data } = await supabase
                .from('subscription_packages')
                .select('*')
                .eq('is_active', true)
                .order('price_ghs', { ascending: true });
            
            if (data) setPackages(data);
        } catch (error) {
            console.error('Error fetching pricing:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchMyListings = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
            .from('listings')
            .select('id, title, images, status, is_boosted')
            .eq('user_id', user.id)
            .eq('status', 'approved')
            .order('created_at', { ascending: false });
        
        if (data) setMyListings(data);
    };

    const handlePurchaseInitiation = (pkg: any) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        
        if (pkg.price_ghs === 0) {
            Alert.alert('Active Plan', 'You are already on the Free tier.');
            return;
        }

        setSelectedPackage(pkg);

        if (pkg.package_type === 'boost') {
            if (myListings.length === 0) {
                Alert.alert('No Active Listings', 'Publish a listing first before purchasing a boost.');
                return;
            }
            setIsListingModalVisible(true);
        } else {
            setPaymentVisible(true);
        }
    };

    const handleListingSelect = (listingId: string) => {
        setTargetListingId(listingId);
        handleCloseListingDrawer();
        setPaymentVisible(true);
    };

    const handleCloseListingDrawer = () => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 250,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: Dimensions.get('window').height,
                duration: 250,
                useNativeDriver: true,
            })
        ]).start(() => setIsListingModalVisible(false));
    };

    const handlePaymentSuccess = async (ref: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        try {
            const success = await paystack.handleSuccessfulPayment(ref, user.id);
            if (success) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Alert.alert('Payment Successful!', `${selectedPackage.name} has been activated.`);
                await fetchData();
            } else {
                Alert.alert('Verification Failed', 'Something went wrong while verifying your payment.');
            }
        } catch (error) {
            console.error('Verify error:', error);
            Alert.alert('Error', 'An error occurred during verification.');
        }
    };

    const filteredPackages = packages.filter(p => 
        activeTab === 'plans' ? p.package_type === 'subscription' : p.package_type === 'boost'
    );

    if (loading) {
        return <PricingSkeleton />;
    }

    return (
        <View style={styles.container}>
            <SafeAreaView edges={['top']} style={styles.headerSafe}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Ionicons name="close" size={24} color="#111" />
                    </TouchableOpacity>
                    <View style={styles.headerTitleContainer}>
                        <Text style={styles.title}>Bluestore Pro</Text>
                        <View style={styles.proBadge}>
                            <Text style={styles.proBadgeText}>PRO</Text>
                        </View>
                    </View>
                </View>
            </SafeAreaView>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Current Plan Overview */}
                {userStatus && (
                    <LinearGradient
                        colors={['#111111', '#333333']}
                        style={styles.heroCard}
                    >
                        <View style={styles.heroHeader}>
                            <View>
                                <Text style={styles.heroLabel}>Active Membership</Text>
                                <Text style={styles.heroTitle}>{userStatus.package_name}</Text>
                            </View>
                            <View style={styles.heroIconWrap}>
                                <Ionicons name="shield-checkmark" size={32} color={GOLD} />
                            </View>
                        </View>

                        <View style={styles.usageContainer}>
                            <View style={styles.usageTextRow}>
                                <Text style={styles.usageLabel}>Inventory Usage</Text>
                                <Text style={styles.usageValue}>
                                    {userStatus.limit ? `${userStatus.current_count}/${userStatus.limit}` : 'Unlimited'}
                                </Text>
                            </View>
                            <View style={styles.usageBarBg}>
                                <View style={[
                                    styles.usageBarFill, 
                                    { width: userStatus.limit ? `${(userStatus.current_count / userStatus.limit) * 100}%` : '100%' }
                                ]} />
                            </View>
                        </View>
                    </LinearGradient>
                )}

                {/* Tabs */}
                <View style={styles.tabContainer}>
                    <TouchableOpacity 
                        style={[styles.tab, activeTab === 'plans' && styles.tabActive]}
                        onPress={() => {
                            setActiveTab('plans');
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }}
                    >
                        <Text style={[styles.tabText, activeTab === 'plans' && styles.tabTextActive]}>Inventory Plans</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[styles.tab, activeTab === 'boosts' && styles.tabActive]}
                        onPress={() => {
                            setActiveTab('boosts');
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }}
                    >
                        <Text style={[styles.tabText, activeTab === 'boosts' && styles.tabTextActive]}>Boost Ad</Text>
                    </TouchableOpacity>
                </View>

                {/* Packages List */}
                <View style={styles.packageList}>
                    {filteredPackages.map((pkg) => {
                            const isCurrent = userStatus?.package_name === pkg.name;
                            const hasPaidPlan = userStatus?.package_name && 
                                               userStatus.package_name !== 'Free' && 
                                               userStatus.package_name !== 'Error/Free';
                            const isLocked = activeTab === 'plans' && hasPaidPlan && !isCurrent && pkg.name !== 'Free';

                            return (
                                <TouchableOpacity
                                    key={pkg.id}
                                    style={[
                                        styles.packageCard, 
                                        isCurrent && styles.packageCardCurrent,
                                        isLocked && styles.packageCardLocked
                                    ]}
                                    activeOpacity={0.8}
                                    onPress={() => !isCurrent && !isLocked && handlePurchaseInitiation(pkg)}
                                    disabled={isCurrent || isLocked}
                                >
                                {isCurrent && (
                                    <View style={styles.currentBadge}>
                                        <Text style={styles.currentBadgeText}>CURRENT PLAN</Text>
                                    </View>
                                )}
                                {pkg.name === 'Standard 20' && !isCurrent && (
                                    <View style={[styles.currentBadge, { backgroundColor: BLUE }]}>
                                        <Text style={[styles.currentBadgeText, { color: '#FFF' }]}>RECOMMENDED</Text>
                                    </View>
                                )}
                                {pkg.name === '30 Days Boost' && (
                                    <View style={[styles.currentBadge, { backgroundColor: '#FF3B30' }]}>
                                        <Text style={[styles.currentBadgeText, { color: '#FFF' }]}>BEST VALUE</Text>
                                    </View>
                                )}
                                <View style={styles.pkgHeader}>
                                    <View>
                                        <Text style={styles.pkgName}>{pkg.name}</Text>
                                        <Text style={styles.pkgType}>{pkg.package_type === 'boost' ? 'Promotion' : 'Monthly'}</Text>
                                    </View>
                                    <View style={styles.priceContainer}>
                                        <Text style={styles.pricePrefix}>GH₵</Text>
                                        <Text style={styles.priceVal}>{pkg.price_ghs}</Text>
                                    </View>
                                </View>

                                <Text style={styles.pkgDesc}>{pkg.description}</Text>

                                <View style={styles.features}>
                                    {pkg.features?.map((f: string, i: number) => (
                                        <View key={i} style={styles.featureItem}>
                                            <Ionicons name="checkmark" size={16} color={GOLD} />
                                            <Text style={styles.featureText}>{f}</Text>
                                        </View>
                                    ))}
                                </View>

                                {pkg.name !== 'Free' && (
                                    <TouchableOpacity 
                                        style={[
                                            styles.pkgAction, 
                                            (isCurrent || isLocked) && { backgroundColor: '#F0F0F0' },
                                            (!isCurrent && !isLocked && activeTab === 'boosts') && { backgroundColor: '#FFF', borderWidth: 1.5, borderColor: '#111' },
                                            (pkg.name === 'Premium' && !isCurrent && !isLocked) && { backgroundColor: GOLD }
                                        ]}
                                        onPress={() => handlePurchaseInitiation(pkg)}
                                        disabled={isCurrent || isLocked}
                                    >
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                            {(isCurrent || isLocked) && (
                                                <Ionicons name="lock-closed" size={16} color="#666" />
                                            )}
                                            <Text style={[
                                                styles.pkgActionText, 
                                                (isCurrent || isLocked) && { color: '#666' },
                                                (!isCurrent && !isLocked && activeTab === 'boosts') && { color: '#111' },
                                                (pkg.name === 'Premium' && !isCurrent && !isLocked) && { color: '#111' }
                                            ]}>
                                                {isCurrent 
                                                    ? (pkg.package_type === 'subscription' ? 'Plan is Active' : 'Already Active') 
                                                    : isLocked 
                                                        ? 'Locked' 
                                                        : activeTab === 'boosts' 
                                                            ? 'Choose Listing' 
                                                            : `Get ${pkg.name}`}
                                            </Text>
                                            {!isCurrent && !isLocked && <Ionicons name="arrow-forward" size={16} color={pkg.name === 'Premium' ? '#111' : activeTab === 'boosts' ? '#111' : '#FFF'} />}
                                        </View>
                                    </TouchableOpacity>
                                )}
                                {isCurrent && pkg.package_type === 'subscription' && (
                                    <Text style={styles.lockReason}>
                                        This plan is currently active on your account
                                    </Text>
                                )}
                                {isLocked && (
                                    <Text style={styles.lockReason}>
                                        You already have an active {userStatus.package_name} plan
                                    </Text>
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </ScrollView>

            {/* Listing Selection Drawer */}
            <Modal
                visible={isListingModalVisible}
                transparent={true}
                animationType="none"
                onRequestClose={handleCloseListingDrawer}
            >
                <View style={styles.modalRoot}>
                    <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
                        <TouchableOpacity style={styles.flex1} activeOpacity={1} onPress={handleCloseListingDrawer} />
                    </Animated.View>
                    
                    <Animated.View style={[
                        styles.sheetContainer,
                        { transform: [{ translateY: slideAnim }] }
                    ]}>
                        <SafeAreaView edges={['bottom']}>
                            <View style={styles.modalHeader}>
                                <View>
                                    <Text style={styles.modalTitle}>Select Ad to Boost</Text>
                                    <Text style={styles.modalSub}>Choose an approved listing to promote</Text>
                                </View>
                                <TouchableOpacity onPress={handleCloseListingDrawer} style={styles.modalClose}>
                                    <Ionicons name="close" size={24} color="#111" />
                                </TouchableOpacity>
                            </View>

                            <FlatList
                                data={myListings.filter(l => !l.is_boosted)}
                                keyExtractor={(item) => item.id}
                                renderItem={({ item }) => (
                                    <TouchableOpacity 
                                        style={styles.listingSelectItem}
                                        onPress={() => handleListingSelect(item.id)}
                                    >
                                        <Image source={{ uri: item.images?.[0] }} style={styles.listingSelectImg} />
                                        <View style={styles.listingSelectInfo}>
                                            <Text style={styles.listingSelectTitle} numberOfLines={1}>{item.title}</Text>
                                            <Text style={styles.listingSelectStatus}>{item.status.toUpperCase()}</Text>
                                        </View>
                                        <Ionicons name="chevron-forward" size={20} color="#ABABAB" />
                                    </TouchableOpacity>
                                )}
                                contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
                                ListEmptyComponent={
                                    <View style={{ padding: 40, alignItems: 'center' }}>
                                        <Ionicons name="flash-off-outline" size={48} color="#CCC" />
                                        <Text style={{ marginTop: 16, color: '#999', textAlign: 'center' }}>
                                            No eligible listings found. All your approved listings are either boosted or you haven't published any yet.
                                        </Text>
                                    </View>
                                }
                            />
                        </SafeAreaView>
                    </Animated.View>
                </View>
            </Modal>

            {selectedPackage && (
                <PaymentDrawer 
                    visible={paymentVisible}
                    onClose={() => setPaymentVisible(false)}
                    onSuccess={handlePaymentSuccess}
                    amount={selectedPackage.price_ghs}
                    description={selectedPackage.package_type === 'boost' ? `Promotion for your listing` : `Bluestore ${selectedPackage.name}`}
                    metadata={{
                        package_id: selectedPackage.id,
                        user_id: currentUserId,
                        listing_id: targetListingId,
                        package_type: selectedPackage.package_type
                    }}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    headerSafe: { backgroundColor: '#FFFFFF' },
    header: { paddingHorizontal: 24, paddingVertical: 12, flexDirection: 'row', alignItems: 'center' },
    backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center' },
    headerTitleContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginRight: 44, gap: 8 },
    title: { fontSize: 20, fontWeight: '800', color: '#111' },
    proBadge: { backgroundColor: GOLD, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    proBadgeText: { fontSize: 10, fontWeight: '900', color: '#111' },
    scrollContent: { padding: 24 },
    heroCard: { padding: 24, borderRadius: 28, marginBottom: 32 },
    heroHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 },
    heroLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
    heroTitle: { color: '#FFF', fontSize: 28, fontWeight: '800', marginTop: 4 },
    heroIconWrap: { width: 56, height: 56, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
    usageContainer: { gap: 12 },
    usageTextRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    usageLabel: { color: '#FFF', fontSize: 14, fontWeight: '600' },
    usageValue: { color: '#FFF', fontSize: 14, fontWeight: '800' },
    usageBarBg: { height: 6, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 3 },
    usageBarFill: { height: '100%', backgroundColor: GOLD, borderRadius: 3 },
    tabContainer: { flexDirection: 'row', backgroundColor: '#F5F5F5', borderRadius: 16, padding: 6, marginBottom: 28 },
    tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 12 },
    tabActive: { backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
    tabText: { fontSize: 14, fontWeight: '600', color: '#8A8A8A' },
    tabTextActive: { color: '#111', fontWeight: '800' },
    packageList: { gap: 20 },
    packageCard: { padding: 24, borderRadius: 28, borderWidth: 1.5, borderColor: '#F0F0F0', backgroundColor: '#FFF' },
    packageCardCurrent: { borderColor: GOLD, backgroundColor: '#FFFEF5' },
    currentBadge: { position: 'absolute', top: -12, right: 24, backgroundColor: GOLD, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
    currentBadgeText: { fontSize: 9, fontWeight: '900', color: '#111' },
    pkgHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    pkgName: { fontSize: 22, fontWeight: '800', color: '#111' },
    pkgType: { fontSize: 12, fontWeight: '600', color: '#8A8A8A', textTransform: 'uppercase', marginTop: 2 },
    priceContainer: { flexDirection: 'row', alignItems: 'flex-start' },
    pricePrefix: { fontSize: 14, fontWeight: '700', color: '#111', marginTop: 4, marginRight: 2 },
    priceVal: { fontSize: 24, fontWeight: '900', color: '#111' },
    pkgDesc: { fontSize: 14, color: '#666', lineHeight: 20, marginBottom: 24 },
    features: { gap: 12, marginBottom: 28 },
    featureItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    featureText: { fontSize: 14, color: '#444', fontWeight: '500' },
    pkgAction: { height: 56, backgroundColor: '#111', borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    pkgActionText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
    modalHeader: { 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: 24,
        paddingHorizontal: 24 
    },
    modalTitle: { fontSize: 20, fontWeight: '800', color: '#111' },
    modalClose: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center' },
    listingSelectItem: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#F9F9F9', borderRadius: 16, marginBottom: 12, gap: 16 },
    listingSelectImg: { width: 50, height: 50, borderRadius: 12 },
    listingSelectInfo: { flex: 1 },
    listingSelectTitle: { fontSize: 15, fontWeight: '700', color: '#111' },
    listingSelectStatus: { fontSize: 10, fontWeight: '800', color: '#8A8A8A', marginTop: 4 },
    modalRoot: { flex: 1, justifyContent: 'flex-end' },
    overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
    sheetContainer: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 20, width: '100%', maxHeight: '85%' },
    modalSub: { fontSize: 13, color: '#8A8A8A', marginTop: 2 },
    flex1: { flex: 1 },
    packageCardLocked: {
        opacity: 0.4,
        backgroundColor: '#FCFCFC',
        borderColor: '#F0F0F0',
    },
    lockReason: {
        fontSize: 12,
        color: '#666',
        textAlign: 'center',
        marginTop: 12,
        fontStyle: 'italic',
        fontWeight: '500',
    },
});

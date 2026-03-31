import { paystack } from '@/lib/paystack';
import { subscriptions } from '@/lib/subscriptions';
import { supabase } from '@/lib/supabase';
import { Feather, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { PaymentDrawer } from '@/components/PaymentDrawer';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');
const BLUE = '#0057FF';

export default function PromoteScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const [listing, setListing] = useState<any>(null);
    const [packages, setPackages] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);

    const [userStatus, setUserStatus] = useState<any>(null);

    useEffect(() => {
        fetchData();
    }, [id]);

    const fetchData = async () => {
        try {
            // 1. Fetch listing
            const { data: listData, error: listError } = await supabase
                .from('listings')
                .select('*')
                .eq('id', id)
                .single();
            
            if (listError) throw listError;
            setListing(listData);

            // 2. Fetch boost packages
            const { data: pkgData, error: pkgError } = await supabase
                .from('subscription_packages')
                .select('*')
                .eq('package_type', 'boost')
                .eq('is_active', true)
                .order('price_ghs', { ascending: true });
            
            if (pkgError) throw pkgError;
            setPackages(pkgData);

            // 3. Fetch user subscription status
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const status = await subscriptions.getUserStatus(user.id);
                setUserStatus(status);
            }
        } catch (error) {
            console.error('Error fetching promotion data:', error);
            Alert.alert('Error', 'Could not load promotion options.');
        } finally {
            setLoading(false);
        }
    };

    const handleFreeContinue = async () => {
        Alert.alert(
            'Success!',
            'Your listing has been submitted and is pending review.',
            [{ text: 'Go to Home', onPress: () => router.replace('/(tabs)') }]
        );
    };

    const [paymentVisible, setPaymentVisible] = useState(false);
    const [selectedPackage, setSelectedPackage] = useState<any>(null);

    const handleBoostPurchase = async (pkg: any) => {
        setSelectedPackage(pkg);
        setPaymentVisible(true);
    };

    const handlePaymentSuccess = async (ref: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        try {
            const success = await paystack.handleSuccessfulPayment(ref, user.id);
            if (success) {
                Alert.alert(
                    'Boost Activated!',
                    'Your listing is now boosted and will appear at the top of results.',
                    [{ text: 'Awesome!', onPress: () => router.replace('/(tabs)') }]
                );
            } else {
                Alert.alert('Error', 'Payment verification failed.');
            }
        } catch (error) {
            console.error('Verify error:', error);
        }
    };

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator color={BLUE} size="large" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <SafeAreaView edges={['top']} style={styles.headerSafe}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.replace('/(tabs)')} style={styles.closeBtn}>
                        <Ionicons name="close" size={24} color="#111111" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Promote Listing</Text>
                </View>
            </SafeAreaView>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.successBadge}>
                    <View style={styles.checkCircle}>
                        <Ionicons name="checkmark" size={32} color="#FFF" />
                    </View>
                    <Text style={styles.successTitle}>Listing Submitted!</Text>
                    <Text style={styles.successSub}>Reach more buyers by boosting your ad</Text>
                </View>

                {userStatus && (
                    <View style={styles.quotaContainer}>
                        <View style={styles.quotaHeader}>
                            <Text style={styles.quotaTitle}>Free Ad Quota</Text>
                            <Text style={styles.quotaCount}>
                                {userStatus.current_count} / {userStatus.limit} Used
                            </Text>
                        </View>
                        <View style={styles.quotaBarBg}>
                            <View 
                                style={[
                                    styles.quotaBarFill, 
                                    { width: `${Math.min((userStatus.current_count / userStatus.limit) * 100, 100)}%` }
                                ]} 
                            />
                        </View>
                        <Text style={styles.quotaHint}>
                            You have {Math.max(userStatus.limit - userStatus.current_count, 0)} free listings remaining.
                        </Text>
                    </View>
                )}

                <View style={styles.previewCard}>
                    <Image source={{ uri: listing?.images?.[0] }} style={styles.previewImage} />
                    <View style={styles.previewInfo}>
                        <Text style={styles.previewTitle} numberOfLines={1}>{listing?.title}</Text>
                        <Text style={styles.previewPrice}>GH₵{listing?.price}</Text>
                    </View>
                </View>

                <Text style={styles.sectionTitle}>Select a Boost Plan</Text>

                {packages.map((pkg) => {
                    const isLocked = listing?.is_boosted;
                    return (
                        <TouchableOpacity
                            key={pkg.id}
                            style={[styles.packageCard, isLocked && styles.packageCardLocked]}
                            onPress={() => !isLocked && handleBoostPurchase(pkg)}
                            disabled={processingId !== null || isLocked}
                        >
                        <LinearGradient
                            colors={['#FFF', '#FDFDFD']}
                            style={styles.packageInner}
                        >
                            <View style={styles.packageHeader}>
                                <View style={styles.packageBadge}>
                                    <Feather name="zap" size={14} color="#FF9500" />
                                    <Text style={styles.packageBadgeText}>BOOST</Text>
                                </View>
                                <Text style={styles.packagePrice}>GH₵{pkg.price_ghs}</Text>
                            </View>
                            
                            <Text style={styles.packageName}>{pkg.name}</Text>
                            <Text style={styles.packageDesc}>{pkg.description}</Text>

                            <View style={styles.features}>
                                {pkg.features?.map((f: string, i: number) => (
                                    <View key={i} style={styles.featureItem}>
                                        <Ionicons name="checkmark" size={16} color={BLUE} />
                                        <Text style={styles.featureText}>{f}</Text>
                                    </View>
                                ))}
                            </View>

                            <View style={[styles.actionBtn, isLocked && { backgroundColor: '#F0F0F0' }]}>
                                {processingId === pkg.id ? (
                                    <ActivityIndicator color="#FFF" />
                                ) : (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        {isLocked && <Ionicons name="lock-closed" size={16} color="#666" />}
                                        <Text style={[styles.actionBtnText, isLocked && { color: '#666' }]}>
                                            {isLocked ? 'Boost Active' : `Boost Now • GH₵${pkg.price_ghs}`}
                                        </Text>
                                    </View>
                                )}
                            </View>
                            {isLocked && (
                                <Text style={styles.lockReason}>
                                    This listing is already boosted
                                </Text>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>
                )})}

                <TouchableOpacity 
                    style={styles.freeBtn} 
                    onPress={handleFreeContinue}
                    disabled={processingId !== null}
                >
                    <Text style={styles.freeBtnText}>No thanks, continue with free listing</Text>
                </TouchableOpacity>
            </ScrollView>

            {selectedPackage && (
                <PaymentDrawer 
                    visible={paymentVisible}
                    onClose={() => setPaymentVisible(false)}
                    onSuccess={handlePaymentSuccess}
                    amount={selectedPackage.price_ghs}
                    description={`Boosting "${listing?.title}" • ${selectedPackage.duration_days} days`}
                    metadata={{
                        package_id: selectedPackage.id,
                        user_id: listing?.user_id,
                        listing_id: id,
                        package_type: 'boost'
                    }}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFF' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    headerSafe: { backgroundColor: '#FFF' },
    header: { paddingHorizontal: 20, paddingVertical: 16, flexDirection: 'row', alignItems: 'center' },
    closeBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center' },
    headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700', marginRight: 44 },
    scrollContent: { padding: 24, alignItems: 'center' },
    successBadge: { alignItems: 'center', marginBottom: 32 },
    checkCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#34C759', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    successTitle: { fontSize: 24, fontWeight: '800', color: '#111' },
    successSub: { fontSize: 16, color: '#666', marginTop: 4 },
    previewCard: { flexDirection: 'row', backgroundColor: '#F9F9F9', borderRadius: 20, padding: 12, width: '100%', marginBottom: 40, borderWidth: 1, borderColor: '#EEE' },
    previewImage: { width: 60, height: 60, borderRadius: 12 },
    previewInfo: { marginLeft: 16, justifyContent: 'center' },
    previewTitle: { fontSize: 16, fontWeight: '600', color: '#111', width: width - 150 },
    previewPrice: { fontSize: 14, fontWeight: '700', color: BLUE, marginTop: 4 },
    sectionTitle: { fontSize: 20, fontWeight: '800', color: '#111', alignSelf: 'flex-start', marginBottom: 20 },
    packageCard: { width: '100%', marginBottom: 16, borderRadius: 24, overflow: 'hidden', borderWidth: 1.5, borderColor: '#EEE' },
    packageInner: { padding: 24 },
    packageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    packageBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF8E6', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, gap: 4 },
    packageBadgeText: { fontSize: 10, fontWeight: '800', color: '#FF9500' },
    packagePrice: { fontSize: 20, fontWeight: '900', color: '#111' },
    packageName: { fontSize: 22, fontWeight: '800', color: '#111', marginBottom: 4 },
    packageDesc: { fontSize: 14, color: '#666', marginBottom: 16 },
    features: { gap: 10, marginBottom: 24 },
    featureItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    featureText: { fontSize: 14, color: '#444', fontWeight: '500' },
    actionBtn: { height: 56, backgroundColor: BLUE, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    actionBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
    freeBtn: { paddingVertical: 20, width: '100%', alignItems: 'center' },
    freeBtnText: { color: '#8A8A8A', fontSize: 15, fontWeight: '600' },
    quotaContainer: { width: '100%', backgroundColor: '#F9F9F9', borderRadius: 20, padding: 20, marginBottom: 24, borderWidth: 1, borderColor: '#EEE' },
    quotaHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    quotaTitle: { fontSize: 14, fontWeight: '700', color: '#111' },
    quotaCount: { fontSize: 13, fontWeight: '600', color: '#666' },
    quotaBarBg: { height: 8, backgroundColor: '#EBEBEB', borderRadius: 4, overflow: 'hidden' },
    quotaBarFill: { height: '100%', backgroundColor: BLUE, borderRadius: 4 },
    quotaHint: { fontSize: 12, color: '#8A8A8A', marginTop: 10, fontStyle: 'italic' },
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

import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    FlatList,
    Image,
    Modal,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const BLUE = '#0057FF';

export default function UserManagement() {
    const router = useRouter();
    const { filter: initialFilter } = useLocalSearchParams();
    const [users, setUsers] = useState<any[]>([]);
    const [verificationQueue, setVerificationQueue] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [filter, setFilter] = useState<'all' | 'unverified' | 'admins'>((initialFilter as any) || 'all');

    // Modal for Verification Review
    const [selectedVerification, setSelectedVerification] = useState<any>(null);

    useEffect(() => {
        if (filter === 'unverified') {
            fetchVerificationQueue();
        } else {
            fetchUsers();
        }
    }, [filter]);

    const fetchUsers = async (isRefresh = false) => {
        if (!isRefresh) setIsLoading(true);
        try {
            let query = supabase
                .from('profiles')
                .select('id, full_name, avatar_url, phone_number, is_verified, role, bio, location, location_structured, banner_url, account_status, created_at, verification_status')
                .order('created_at', { ascending: false });

            if (filter === 'admins') {
                query = query.in('role', ['admin', 'moderator']);
            }

            const { data, error } = await query;
            if (error) throw error;
            setUsers(data || []);
        } catch (error) {
            console.error('Error fetching users:', error);
        } finally {
            setIsLoading(false);
            setRefreshing(false);
        }
    };

    const fetchVerificationQueue = async (isRefresh = false) => {
        if (!isRefresh) setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('seller_verifications')
                .select(`
                    *,
                    profiles (full_name, avatar_url, phone_number)
                `)
                .eq('status', 'pending')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setVerificationQueue(data || []);
        } catch (error) {
            console.error('Error fetching verifications:', error);
        } finally {
            setIsLoading(false);
            setRefreshing(false);
        }
    };

    const handleVerification = async (id: string, userId: string, status: 'approved' | 'rejected') => {
        try {
            const { error: verError } = await supabase
                .from('seller_verifications')
                .update({ status })
                .eq('id', id);

            if (verError) throw verError;

            // Update profile
            await supabase.from('profiles').update({
                verification_status: status as any,
                is_verified: status === 'approved'
            }).eq('id', userId);

            Alert.alert('Success', `Verification ${status}.`);
            setSelectedVerification(null);
            fetchVerificationQueue();
        } catch (error: any) {
            Alert.alert('Error', error.message);
        }
    };

    const handleAction = async (userId: string, action: 'user' | 'moderator' | 'admin') => {
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ role: action })
                .eq('id', userId);

            if (error) throw error;
            Alert.alert('Role Updated', `User is now a ${action}.`);
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: action } : u));
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Action failed.');
        }
    };

    const updateAccountStatus = async (userId: string, status: 'active' | 'banned' | 'suspended') => {
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ account_status: status })
                .eq('id', userId);

            if (error) throw error;
            Alert.alert('Success', `User status updated to ${status}.`);
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, account_status: status } : u));
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Action failed.');
        }
    };

    const renderUser = ({ item }: { item: any }) => (
        <View style={styles.card}>
            <View style={styles.cardTop}>
                {item.avatar_url ? (
                    <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
                ) : (
                    <View style={styles.avatarPlaceholder}>
                        <Text style={styles.avatarTxt}>{(item.full_name || 'U').charAt(0)}</Text>
                    </View>
                )}
                <View style={styles.info}>
                    <View style={styles.nameRow}>
                        <Text style={styles.name}>{item.full_name || 'Anonymous'}</Text>
                        {item.role !== 'user' && (
                            <View style={[styles.roleBadge, item.role === 'admin' ? styles.adminBadge : styles.modBadge]}>
                                <Text style={styles.roleText}>{item.role.toUpperCase()}</Text>
                            </View>
                        )}
                    </View>
                    <Text style={styles.subText}>{item.phone_number || 'No phone'}</Text>
                    <Text style={styles.subText}>Joined {new Date(item.created_at).toLocaleDateString()}</Text>
                </View>

                <View style={[styles.statusBadge, item.is_verified && styles.verifiedBadge]}>
                    <Ionicons
                        name={item.is_verified ? "shield-checkmark" : "shield-outline"}
                        size={14}
                        color={item.is_verified ? "#00B850" : "#8A8A8A"}
                    />
                    <Text style={[styles.statusText, item.is_verified && { color: '#00B850' }]}>
                        {item.is_verified ? 'VERIFIED' : 'UNVERIFIED'}
                    </Text>
                </View>
            </View>

            <View style={styles.actions}>
                <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => router.push({ pathname: '/seller/[id]', params: { id: item.id } })}
                >
                    <Text style={styles.actionText}>View Profile</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => {
                        Alert.alert('Account Actions', `Manage ${item.full_name}:`, [
                            { text: 'Cancel', style: 'cancel' },
                            {
                                text: 'Set Role', onPress: () => {
                                    Alert.alert('Change Role', 'Select new role:', [
                                        { text: 'Standard User', onPress: () => handleAction(item.id, 'user') },
                                        { text: 'Moderator', onPress: () => handleAction(item.id, 'moderator') },
                                        { text: 'Admin', onPress: () => handleAction(item.id, 'admin') },
                                    ]);
                                }
                            },
                            item.account_status === 'active'
                                ? { text: 'BAN USER', style: 'destructive', onPress: () => updateAccountStatus(item.id, 'banned') }
                                : { text: 'Restore Account', onPress: () => updateAccountStatus(item.id, 'active') }
                        ]);
                    }}
                >
                    <Text style={[styles.actionText, { color: BLUE }]}>Manage Account</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    const renderVerification = ({ item }: { item: any }) => (
        <TouchableOpacity style={styles.card} onPress={() => setSelectedVerification(item)}>
            <View style={styles.cardTop}>
                <Image
                    source={{ uri: item.profiles?.avatar_url || 'https://via.placeholder.com/40' }}
                    style={styles.avatar}
                />
                <View style={styles.info}>
                    <Text style={styles.name}>{item.profiles?.full_name || 'Store Owner'}</Text>
                    <Text style={styles.subText}>{item.id_type} submission</Text>
                    <Text style={styles.subText}>{new Date(item.created_at).toLocaleDateString()}</Text>
                </View>
                <View style={styles.pendingBadge}>
                    <Text style={styles.pendingBadgeText}>REVIEW</Text>
                </View>
            </View>
            <View style={styles.verFooter}>
                <Text style={styles.verFooterText}>Click to review documents</Text>
                <Ionicons name="chevron-forward" size={16} color="#8A8A8A" />
            </View>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ title: 'User Management' }} />

            <View style={styles.filterBar}>
                {[
                    { id: 'all', label: 'All Users', icon: 'people' },
                    { id: 'unverified', label: 'Verification Queue', icon: 'shield-checkmark', badge: verificationQueue.length },
                    { id: 'admins', label: 'Staff', icon: 'ribbon' }
                ].map(opt => (
                    <TouchableOpacity
                        key={opt.id}
                        onPress={() => setFilter(opt.id as any)}
                        style={[styles.filterBtn, filter === opt.id && styles.filterBtnActive]}
                    >
                        <Text style={[styles.filterText, filter === opt.id && styles.filterTextActive]}>
                            {opt.label}{opt.badge ? ` (${opt.badge})` : ''}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            <FlatList
                data={filter === 'unverified' ? verificationQueue : users}
                keyExtractor={item => item.id}
                renderItem={filter === 'unverified' ? renderVerification : renderUser}
                contentContainerStyle={styles.list}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => filter === 'unverified' ? fetchVerificationQueue(true) : fetchUsers(true)} tintColor={BLUE} />}
                ListEmptyComponent={() => (
                    <View style={styles.empty}>
                        <Ionicons name="people-outline" size={48} color="#EBEBEB" />
                        <Text style={styles.emptyText}>No items found here.</Text>
                    </View>
                )}
            />

            {/* Verification Review Modal */}
            <Modal
                visible={!!selectedVerification}
                animationType="slide"
                onRequestClose={() => setSelectedVerification(null)}
            >
                <SafeAreaView style={styles.modalContent}>
                    <View style={[styles.modalHeader, { paddingTop: Platform.OS === 'ios' ? 20 : 0 }]}>
                        <TouchableOpacity onPress={() => setSelectedVerification(null)}>
                            <Ionicons name="close" size={28} color="#111" />
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>Verification Review</Text>
                        <View style={{ width: 28 }} />
                    </View>

                    <ScrollView contentContainerStyle={styles.modalScroll}>
                        {selectedVerification && (
                            <View>
                                <View style={styles.userSummary}>
                                    <Image source={{ uri: selectedVerification.profiles?.avatar_url }} style={styles.largeAvatar} />
                                    <Text style={styles.largeName}>{selectedVerification.full_legal_name}</Text>
                                    <Text style={styles.modalSub}>{selectedVerification.id_type} • ID: {selectedVerification.id_number || 'N/A'}</Text>
                                </View>

                                <View style={styles.docSection}>
                                    <Text style={styles.sectionLabel}>Identification Documents</Text>
                                    <View style={styles.docRow}>
                                        <View style={styles.docItem}>
                                            <Text style={styles.smallLabel}>FRONT</Text>
                                            <Image source={{ uri: selectedVerification.id_front_url }} style={styles.docPreview} />
                                        </View>
                                        {selectedVerification.id_back_url && (
                                            <View style={styles.docItem}>
                                                <Text style={styles.smallLabel}>BACK</Text>
                                                <Image source={{ uri: selectedVerification.id_back_url }} style={styles.docPreview} />
                                            </View>
                                        )}
                                    </View>
                                    <View style={styles.docItem}>
                                        <Text style={styles.smallLabel}>LIVE SELFIE</Text>
                                        <Image source={{ uri: selectedVerification.selfie_url }} style={styles.docPreviewLarge} />
                                    </View>
                                </View>

                                <View style={styles.infoSection}>
                                    <Text style={styles.sectionLabel}>Address Details</Text>
                                    <Text style={styles.infoValue}>{selectedVerification.address_line1}</Text>
                                    {selectedVerification.address_line2 && <Text style={styles.infoValue}>{selectedVerification.address_line2}</Text>}
                                    <Text style={styles.infoValue}>{selectedVerification.city}, {selectedVerification.state} {selectedVerification.postal_code}</Text>
                                </View>

                                <View style={styles.modalActions}>
                                    <TouchableOpacity
                                        style={[styles.modalBtn, styles.rejectBtn]}
                                        onPress={() => handleVerification(selectedVerification.id, selectedVerification.user_id, 'rejected')}
                                    >
                                        <Text style={styles.rejectText}>Reject Request</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.modalBtn, styles.approveBtn]}
                                        onPress={() => handleVerification(selectedVerification.id, selectedVerification.user_id, 'approved')}
                                    >
                                        <Text style={styles.approveText}>Approve Seller</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}
                    </ScrollView>
                </SafeAreaView>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    filterBar: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#F5F5F5', gap: 10 },
    filterBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: '#F9F9F9', minWidth: 80, alignItems: 'center' },
    filterBtnActive: { backgroundColor: '#111111' },
    filterText: { fontSize: 12, fontWeight: '700', color: '#8A8A8A' },
    filterTextActive: { color: '#FFFFFF' },

    list: { padding: 20 },
    card: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#F0F0F0' },
    cardTop: { flexDirection: 'row', gap: 15, alignItems: 'center' },
    avatar: { width: 50, height: 50, borderRadius: 25 },
    avatarPlaceholder: { width: 50, height: 50, borderRadius: 25, backgroundColor: BLUE, alignItems: 'center', justifyContent: 'center' },
    avatarTxt: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
    info: { flex: 1 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
    name: { fontSize: 16, fontWeight: '800', color: '#111111' },
    subText: { fontSize: 12, color: '#8A8A8A', fontWeight: '500' },

    statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F9F9F9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    verifiedBadge: { backgroundColor: '#E8F8EE' },
    statusText: { fontSize: 9, fontWeight: '900', color: '#8A8A8A' },

    roleBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    adminBadge: { backgroundColor: '#FFEDEA' },
    modBadge: { backgroundColor: '#FFF4E5' },
    roleText: { fontSize: 8, fontWeight: '900', color: '#FF4136' },

    actions: { flexDirection: 'row', marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#F5F5F5', gap: 20 },
    actionBtn: { paddingVertical: 4 },
    actionText: { fontSize: 13, fontWeight: '700', color: '#111111' },

    pendingBadge: { backgroundColor: '#FFF5E6', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    pendingBadgeText: { fontSize: 10, fontWeight: '900', color: '#B8860B' },
    verFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 15, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F5F5F5' },
    verFooterText: { fontSize: 12, fontWeight: '600', color: '#8A8A8A' },

    modalContent: { flex: 1, backgroundColor: '#FFF' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
    modalTitle: { fontSize: 17, fontWeight: '800' },
    modalScroll: { padding: 20 },
    userSummary: { alignItems: 'center', marginBottom: 30 },
    largeAvatar: { width: 80, height: 80, borderRadius: 40, marginBottom: 12 },
    largeName: { fontSize: 22, fontWeight: '900', color: '#111' },
    modalSub: { fontSize: 14, color: '#8A8A8A', fontWeight: '600' },

    docSection: { marginBottom: 30 },
    sectionLabel: { fontSize: 13, fontWeight: '800', color: '#111', marginBottom: 15, textTransform: 'uppercase', letterSpacing: 0.5 },
    docRow: { flexDirection: 'row', gap: 10, marginBottom: 15 },
    docItem: { flex: 1, gap: 8 },
    smallLabel: { fontSize: 10, fontWeight: '800', color: '#8A8A8A' },
    docPreview: { width: '100%', height: 120, borderRadius: 12, backgroundColor: '#F9F9F9' },
    docPreviewLarge: { width: '100%', height: 200, borderRadius: 12, backgroundColor: '#F9F9F9' },

    infoSection: { backgroundColor: '#F9F9F9', padding: 20, borderRadius: 20, marginBottom: 30 },
    infoValue: { fontSize: 15, fontWeight: '600', color: '#444', marginBottom: 4 },

    modalActions: { gap: 12, paddingBottom: 40 },
    modalBtn: { height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    rejectBtn: { backgroundColor: '#FFF5F5' },
    approveBtn: { backgroundColor: '#111' },
    rejectText: { color: '#FF4136', fontSize: 16, fontWeight: '800' },
    approveText: { color: '#FFF', fontSize: 16, fontWeight: '800' },

    empty: { paddingVertical: 100, alignItems: 'center' },
    emptyText: { marginTop: 12, fontSize: 14, color: '#ABABAB' },
});

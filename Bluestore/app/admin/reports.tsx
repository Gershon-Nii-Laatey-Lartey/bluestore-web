import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
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

export default function SafetyCenter() {
    const router = useRouter();
    const [reports, setReports] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [statusFilter, setStatusFilter] = useState<'pending' | 'resolved' | 'dismissed'>('pending');

    useEffect(() => {
        fetchReports();
    }, [statusFilter]);

    const fetchReports = async (isRefresh = false) => {
        if (!isRefresh) setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('reports')
                .select(`
                    *,
                    reporter:reporter_id(full_name, avatar_url),
                    reported_user:reported_user_id(full_name, avatar_url, account_status)
                `)
                .eq('status', statusFilter)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setReports(data || []);
        } catch (error) {
            console.error('Error fetching reports:', error);
        } finally {
            setIsLoading(false);
            setRefreshing(false);
        }
    };

    const handleResolve = async (reportId: string, action: 'resolved' | 'dismissed', reportedUserId?: string) => {
        try {
            const { error: updateError } = await supabase
                .from('reports')
                .update({ status: action })
                .eq('id', reportId);

            if (updateError) throw updateError;

            if (action === 'resolved' && reportedUserId) {
                // Logic to ban user or take further action could go here
                // For now, we'll just show success
            }

            Alert.alert('Action Taken', `Report has been marked as ${action}.`);
            setReports(prev => prev.filter(r => r.id !== reportId));
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Action failed.');
        }
    };

    const handleBan = async (userId: string) => {
        Alert.alert('Ban User', 'Are you sure you want to ban this user? This is permanent.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'BAN USER',
                style: 'destructive',
                onPress: async () => {
                    try {
                        const { error } = await supabase
                            .from('profiles')
                            .update({ account_status: 'banned' })
                            .eq('id', userId);
                        if (error) throw error;
                        Alert.alert('User Banned', 'Account access restricted.');
                    } catch (e: any) {
                        Alert.alert('Error', e.message);
                    }
                }
            }
        ]);
    };

    const renderReport = ({ item }: { item: any }) => (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <View style={[styles.typeBadge, { backgroundColor: item.reason === 'scam' ? '#FFEDEA' : '#FFF4E5' }]}>
                    <Text style={[styles.typeText, { color: item.reason === 'scam' ? '#FF4136' : '#FFB800' }]}>
                        {item.reason.toUpperCase()}
                    </Text>
                </View>
                <Text style={styles.date}>{new Date(item.created_at).toLocaleDateString()}</Text>
            </View>

            <View style={styles.userRow}>
                <View style={styles.userColumn}>
                    <Text style={styles.userLabel}>Reporter</Text>
                    <View style={styles.userMini}>
                        <Image source={{ uri: item.reporter?.avatar_url }} style={styles.miniAvatar} />
                        <Text style={styles.userName} numberOfLines={1}>{item.reporter?.full_name || 'Reporter'}</Text>
                    </View>
                </View>
                <Ionicons name="arrow-forward" size={16} color="#EBEBEB" />
                <View style={styles.userColumn}>
                    <Text style={styles.userLabel}>Reported</Text>
                    <View style={styles.userMini}>
                        <Image source={{ uri: item.reported_user?.avatar_url }} style={styles.miniAvatar} />
                        <Text style={styles.userName} numberOfLines={1}>{item.reported_user?.full_name || 'Reported'}</Text>
                    </View>
                </View>
            </View>

            <View style={styles.reasonBox}>
                <Text style={styles.reasonTitle}>Reason / Description:</Text>
                <Text style={styles.reasonText}>{item.details || 'No detailed reason provided.'}</Text>
            </View>

            {statusFilter === 'pending' && (
                <View style={styles.actions}>
                    <TouchableOpacity
                        style={[styles.btn, styles.resolveBtn]}
                        onPress={() => handleResolve(item.id, 'resolved', item.reported_user_id)}
                    >
                        <Text style={styles.btnText}>Mark Resolved</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.btn, styles.dismissBtn]}
                        onPress={() => handleResolve(item.id, 'dismissed')}
                    >
                        <Text style={styles.dismissBtnText}>Dismiss</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.banIconBtn}
                        onPress={() => handleBan(item.reported_user_id)}
                    >
                        <Ionicons name="hammer-outline" size={20} color="#FF4136" />
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );

    const Tab = ({ label, value }: { label: string, value: typeof statusFilter }) => (
        <TouchableOpacity
            style={[styles.tab, statusFilter === value && styles.tabActive]}
            onPress={() => setStatusFilter(value)}
        >
            <Text style={[styles.tabText, statusFilter === value && styles.tabTextActive]}>{label}</Text>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ title: 'Safety & Reports' }} />

            <View style={styles.tabs}>
                <Tab label="Pending" value="pending" />
                <Tab label="Resolved" value="resolved" />
                <Tab label="Dismissed" value="dismissed" />
            </View>

            <FlatList
                data={reports}
                keyExtractor={item => item.id}
                renderItem={renderReport}
                contentContainerStyle={styles.list}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchReports(true)} tintColor={BLUE} />}
                ListEmptyComponent={() => (
                    <View style={styles.empty}>
                        {isLoading ? (
                            <ActivityIndicator color={BLUE} />
                        ) : (
                            <>
                                <Ionicons name="shield-outline" size={48} color="#EBEBEB" />
                                <Text style={styles.emptyText}>Safety is priority. No reports here.</Text>
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
    tabs: { flexDirection: 'row', padding: 15, gap: 10, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
    tab: { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: '#F9F9F9', alignItems: 'center' },
    tabActive: { backgroundColor: '#111111' },
    tabText: { fontSize: 13, fontWeight: '700', color: '#8A8A8A' },
    tabTextActive: { color: '#FFFFFF' },

    list: { padding: 20 },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#F0F0F0',
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    typeBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    typeText: { fontSize: 10, fontWeight: '800' },
    date: { fontSize: 11, color: '#ABABAB', fontWeight: '500' },

    userRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 15, backgroundColor: '#F9F9F9', padding: 12, borderRadius: 14 },
    userColumn: { flex: 1 },
    userLabel: { fontSize: 9, fontWeight: '800', color: '#ABABAB', textTransform: 'uppercase', marginBottom: 4 },
    userMini: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    miniAvatar: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#EBEBEB' },
    userName: { fontSize: 13, fontWeight: '700', color: '#111111' },

    reasonBox: { marginBottom: 20 },
    reasonTitle: { fontSize: 12, fontWeight: '800', color: '#111111', marginBottom: 6 },
    reasonText: { fontSize: 13, color: '#666', lineHeight: 18 },

    actions: { flexDirection: 'row', gap: 10 },
    btn: { flex: 1, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    resolveBtn: { backgroundColor: '#00B850' },
    dismissBtn: { backgroundColor: '#F9F9F9', borderWidth: 1, borderColor: '#EBEBEB' },
    btnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
    dismissBtnText: { color: '#8A8A8A', fontSize: 13, fontWeight: '700' },
    banIconBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#FFEDEA', alignItems: 'center', justifyContent: 'center' },

    empty: { paddingVertical: 100, alignItems: 'center' },
    emptyText: { marginTop: 12, fontSize: 14, color: '#ABABAB', fontWeight: '600' },
});

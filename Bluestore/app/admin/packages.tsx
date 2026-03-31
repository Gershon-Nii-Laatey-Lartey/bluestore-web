import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const BLUE = '#0057FF';

export default function AdminPackagesScreen() {
    const router = useRouter();
    const [packages, setPackages] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        checkAdmin();
        fetchPackages();
    }, []);

    const checkAdmin = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single();
            if (data?.role === 'admin') setIsAdmin(true);
            else {
                Alert.alert('Access Denied', 'Admin privileges required.');
                router.replace('/(tabs)/profile');
            }
        }
    };

    const fetchPackages = async () => {
        const { data } = await supabase
            .from('subscription_packages')
            .select('*')
            .order('price_ghs', { ascending: true });
        if (data) setPackages(data);
        setLoading(false);
    };

    const updatePackage = async (id: string, updates: any) => {
        const { error } = await supabase
            .from('subscription_packages')
            .update(updates)
            .eq('id', id);
        
        if (error) Alert.alert('Error', error.message);
        else fetchPackages();
    };

    const renderPackage = ({ item }: { item: any }) => (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <Text style={styles.packageName}>{item.name}</Text>
                <TouchableOpacity onPress={() => updatePackage(item.id, { is_active: !item.is_active })}>
                    <Ionicons 
                        name={item.is_active ? "eye" : "eye-off"} 
                        size={20} 
                        color={item.is_active ? BLUE : "#8A8A8A"} 
                    />
                </TouchableOpacity>
            </View>
            
            <View style={styles.field}>
                <Text style={styles.label}>Price (GHS)</Text>
                <TextInput
                    style={styles.input}
                    defaultValue={item.price_ghs.toString()}
                    keyboardType="numeric"
                    onEndEditing={(e) => updatePackage(item.id, { price_ghs: parseFloat(e.nativeEvent.text) })}
                />
            </View>

            <View style={styles.field}>
                <Text style={styles.label}>Product Limit</Text>
                <TextInput
                    style={styles.input}
                    defaultValue={item.product_limit?.toString() || ''}
                    placeholder="Unlimited"
                    keyboardType="numeric"
                    onEndEditing={(e) => updatePackage(item.id, { product_limit: e.nativeEvent.text ? parseInt(e.nativeEvent.text) : null })}
                />
            </View>

            <View style={styles.field}>
                <Text style={styles.label}>Duration (Days)</Text>
                <TextInput
                    style={styles.input}
                    defaultValue={item.duration_days?.toString() || ''}
                    placeholder="Lifetime"
                    keyboardType="numeric"
                    onEndEditing={(e) => updatePackage(item.id, { duration_days: e.nativeEvent.text ? parseInt(e.nativeEvent.text) : null })}
                />
            </View>
        </View>
    );

    if (loading) return <View style={styles.center}><ActivityIndicator color={BLUE} /></View>;

    return (
        <View style={styles.container}>
            <SafeAreaView edges={['top']} style={styles.headerSafe}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Ionicons name="close" size={24} color="#111" />
                    </TouchableOpacity>
                    <Text style={styles.title}>Manage Packages</Text>
                </View>
            </SafeAreaView>

            <FlatList
                data={packages}
                keyExtractor={(item) => item.id}
                renderItem={renderPackage}
                contentContainerStyle={styles.list}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FAFAFA' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    headerSafe: { backgroundColor: '#FFF' },
    header: { padding: 20, flexDirection: 'row', alignItems: 'center', gap: 16 },
    backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    title: { fontSize: 18, fontWeight: '700' },
    list: { padding: 20 },
    card: { backgroundColor: '#FFF', borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#EEE' },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    packageName: { fontSize: 16, fontWeight: '700' },
    field: { marginBottom: 12 },
    label: { fontSize: 12, color: '#8A8A8A', marginBottom: 4 },
    input: { height: 44, backgroundColor: '#F9F9F9', borderRadius: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: '#EEE' }
});

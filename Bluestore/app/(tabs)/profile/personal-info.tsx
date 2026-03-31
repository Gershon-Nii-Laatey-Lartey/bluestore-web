import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const BLUE = '#0057FF';

export default function PersonalInfoScreen() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [user, setUser] = useState<any>(null);
    const [profile, setProfile] = useState<any>(null);

    // Form data
    const [fullName, setFullName] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [email, setEmail] = useState('');

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            setIsLoading(true);
            const { data: { user }, error: userError } = await supabase.auth.getUser();
            if (userError || !user) throw userError || new Error('Not authenticated');

            setUser(user);
            setEmail(user.email || '');

            const { data, error } = await supabase
                .from('profiles')
                .select('id, full_name, avatar_url, phone_number, is_verified, role, bio, location, location_structured, banner_url, account_status, created_at, verification_status')
                .eq('id', user.id)
                .single();

            if (error) throw error;
            setProfile(data);
            setFullName(data.full_name || '');
            setPhoneNumber(data.phone_number || '');
        } catch (error: any) {
            console.error('Fetch profile error:', error);
            Alert.alert('Error', error.message || 'Failed to load profile');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        if (!fullName.trim()) {
            Alert.alert('Error', 'Full name is required');
            return;
        }

        try {
            setIsSaving(true);
            const { error } = await supabase
                .from('profiles')
                .update({
                    full_name: fullName.trim(),
                    phone_number: phoneNumber.trim(),
                    updated_at: new Date().toISOString(),
                })
                .eq('id', user.id);

            if (error) throw error;

            Alert.alert('Success', 'Profile updated successfully');
            router.back();
        } catch (error: any) {
            console.error('Update profile error:', error);
            Alert.alert('Error', error.message || 'Failed to update profile');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={BLUE} />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <Stack.Screen options={{
                headerShown: false,
            }} />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.push('/(tabs)/profile')} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={24} color="#111111" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Personal Information</Text>
                <View style={{ width: 44 }} />
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <View style={styles.section}>
                        <Text style={styles.sectionLabel}>ACCOUNT DETAILS</Text>

                        <View style={styles.field}>
                            <Text style={styles.label}>Full Name</Text>
                            <View style={styles.inputWrapper}>
                                <Ionicons name="person-outline" size={20} color="#8A8A8A" style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    value={fullName}
                                    onChangeText={setFullName}
                                    placeholder="Enter your full name"
                                    placeholderTextColor="#ABABAB"
                                />
                            </View>
                        </View>

                        <View style={styles.field}>
                            <Text style={styles.label}>Email Address</Text>
                            <View style={[styles.inputWrapper, styles.disabledInput]}>
                                <Ionicons name="mail-outline" size={20} color="#ABABAB" style={styles.inputIcon} />
                                <TextInput
                                    style={[styles.input, { color: '#8A8A8A' }]}
                                    value={email}
                                    editable={false}
                                />
                                <Ionicons name="lock-closed-outline" size={16} color="#ABABAB" />
                            </View>
                            <Text style={styles.helperText}>Email cannot be changed here.</Text>
                        </View>

                        <View style={styles.field}>
                            <Text style={styles.label}>Phone Number</Text>
                            <View style={styles.inputWrapper}>
                                <Ionicons name="call-outline" size={20} color="#8A8A8A" style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    value={phoneNumber}
                                    onChangeText={setPhoneNumber}
                                    placeholder="Enter phone number"
                                    placeholderTextColor="#ABABAB"
                                    keyboardType="phone-pad"
                                />
                            </View>
                        </View>
                        <View style={styles.field}>
                            <Text style={styles.label}>Account Status</Text>
                            <View style={[styles.inputWrapper, { backgroundColor: profile?.verification_status === 'verified' ? '#E1F8EB' : profile?.verification_status === 'pending' ? '#FFF9E6' : '#F2F2F2', borderColor: profile?.verification_status === 'verified' ? '#00C851' : profile?.verification_status === 'pending' ? '#FFE4A3' : '#E0E0E0' }]}>
                                <Ionicons
                                    name={profile?.is_verified ? "shield-checkmark" : "shield-outline"}
                                    size={20}
                                    color={profile?.is_verified ? "#00C851" : "#8A8A8A"}
                                    style={styles.inputIcon}
                                />
                                <Text style={[styles.input, { color: profile?.is_verified ? "#00C851" : "#8A8A8A", textTransform: 'capitalize' }]}>
                                    {profile?.verification_status || 'Unverified'}
                                </Text>
                                <Ionicons name="lock-closed-outline" size={16} color="#ABABAB" />
                            </View>
                            <Text style={styles.helperText}>Verifying your account improves store visibility.</Text>
                        </View>
                    </View>

                    <TouchableOpacity
                        style={[styles.saveBtn, isSaving && styles.saveBtnDisabled]}
                        onPress={handleSave}
                        disabled={isSaving}
                    >
                        {isSaving ? (
                            <ActivityIndicator color="#FFFFFF" />
                        ) : (
                            <Text style={styles.saveBtnText}>Save Changes</Text>
                        )}
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    backBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#F5F5F5',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#111111' },
    scrollContent: { padding: 24 },
    section: { marginBottom: 32 },
    sectionLabel: {
        fontSize: 12,
        fontWeight: '800',
        color: '#8A8A8A',
        letterSpacing: 1,
        marginBottom: 20,
    },
    field: { marginBottom: 24 },
    label: {
        fontSize: 14,
        fontWeight: '700',
        color: '#111111',
        marginBottom: 10,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F9F9F9',
        borderRadius: 12,
        paddingHorizontal: 16,
        height: 56,
        borderWidth: 1,
        borderColor: '#EBEBEB',
    },
    disabledInput: {
        backgroundColor: '#F2F2F2',
        borderColor: '#E0E0E0',
    },
    inputIcon: { marginRight: 12 },
    input: {
        flex: 1,
        fontSize: 16,
        color: '#111111',
        fontWeight: '500',
    },
    helperText: {
        fontSize: 12,
        color: '#8A8A8A',
        marginTop: 8,
        fontStyle: 'italic',
    },
    saveBtn: {
        backgroundColor: '#111111',
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    saveBtnDisabled: { opacity: 0.7 },
    saveBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});

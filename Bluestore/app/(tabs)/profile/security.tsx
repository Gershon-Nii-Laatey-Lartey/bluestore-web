import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React, { useState } from 'react';
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

export default function SecurityScreen() {
    const router = useRouter();
    const [isSaving, setIsSaving] = useState(false);

    // Password state
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPasswords, setShowPasswords] = useState(false);

    const handleChangePassword = async () => {
        if (!newPassword || !confirmPassword) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }

        if (newPassword !== confirmPassword) {
            Alert.alert('Error', 'Passwords do not match');
            return;
        }

        if (newPassword.length < 6) {
            Alert.alert('Error', 'Password must be at least 6 characters');
            return;
        }

        try {
            setIsSaving(true);
            const { error } = await supabase.auth.updateUser({
                password: newPassword
            });

            if (error) throw error;

            Alert.alert('Success', 'Password updated successfully');
            setNewPassword('');
            setConfirmPassword('');
        } catch (error: any) {
            console.error('Update password error:', error);
            Alert.alert('Error', error.message || 'Failed to update password');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <Stack.Screen options={{ headerShown: false }} />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.push('/(tabs)/profile')} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={24} color="#111111" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Security Settings</Text>
                <View style={{ width: 44 }} />
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionLabel}>UPDATE PASSWORD</Text>
                            <TouchableOpacity onPress={() => setShowPasswords(!showPasswords)}>
                                <Ionicons
                                    name={showPasswords ? "eye-off-outline" : "eye-outline"}
                                    size={20}
                                    color={BLUE}
                                />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.field}>
                            <Text style={styles.label}>New Password</Text>
                            <View style={styles.inputWrapper}>
                                <Ionicons name="lock-closed-outline" size={20} color="#8A8A8A" style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    value={newPassword}
                                    onChangeText={setNewPassword}
                                    placeholder="At least 6 characters"
                                    placeholderTextColor="#ABABAB"
                                    secureTextEntry={!showPasswords}
                                />
                            </View>
                        </View>

                        <View style={styles.field}>
                            <Text style={styles.label}>Confirm New Password</Text>
                            <View style={styles.inputWrapper}>
                                <Ionicons name="lock-closed-outline" size={20} color="#8A8A8A" style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    value={confirmPassword}
                                    onChangeText={setConfirmPassword}
                                    placeholder="Re-enter new password"
                                    placeholderTextColor="#ABABAB"
                                    secureTextEntry={!showPasswords}
                                />
                            </View>
                        </View>

                        <TouchableOpacity
                            style={[styles.actionBtn, isSaving && styles.btnDisabled]}
                            onPress={handleChangePassword}
                            disabled={isSaving}
                        >
                            {isSaving ? (
                                <ActivityIndicator color="#FFFFFF" />
                            ) : (
                                <Text style={styles.actionBtnText}>Update Password</Text>
                            )}
                        </TouchableOpacity>
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.section}>
                        <Text style={styles.sectionLabel}>AUTHENTICATION</Text>

                        <View style={styles.menuItem}>
                            <View style={styles.menuInfo}>
                                <View style={styles.iconCircle}>
                                    <Ionicons name="shield-checkmark-outline" size={20} color={BLUE} />
                                </View>
                                <View>
                                    <Text style={styles.menuTitle}>Two-Factor Authentication</Text>
                                    <Text style={styles.menuSub}>Add an extra layer of security</Text>
                                </View>
                            </View>
                            <TouchableOpacity onPress={() => Alert.alert('Coming Soon', '2FA will be available in the next update!')}>
                                <Text style={styles.setupLink}>Setup</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.menuItem}>
                            <View style={styles.menuInfo}>
                                <View style={[styles.iconCircle, { backgroundColor: '#FFEEED' }]}>
                                    <Ionicons name="remove-circle-outline" size={20} color="#EA4335" />
                                </View>
                                <View>
                                    <Text style={styles.menuTitle}>Deactivate Account</Text>
                                    <Text style={styles.menuSub}>Temporarily hide your profile</Text>
                                </View>
                            </View>
                            <TouchableOpacity onPress={() => Alert.alert('Note', 'Please contact support to deactivate your account.')}>
                                <Ionicons name="chevron-forward" size={18} color="#ABABAB" />
                            </TouchableOpacity>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
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
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    sectionLabel: {
        fontSize: 12,
        fontWeight: '800',
        color: '#8A8A8A',
        letterSpacing: 1,
    },
    field: { marginBottom: 20 },
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
    inputIcon: { marginRight: 12 },
    input: {
        flex: 1,
        fontSize: 16,
        color: '#111111',
        fontWeight: '500',
    },
    actionBtn: {
        backgroundColor: '#111111',
        height: 56,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 10,
    },
    btnDisabled: { opacity: 0.7 },
    actionBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
    divider: { height: 1, backgroundColor: '#F0F0F0', marginBottom: 32 },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 24,
    },
    menuInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    iconCircle: {
        width: 40,
        height: 40,
        borderRadius: 10,
        backgroundColor: '#F0F4FF',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    menuTitle: { fontSize: 15, fontWeight: '700', color: '#111111' },
    menuSub: { fontSize: 12, color: '#8A8A8A', marginTop: 2 },
    setupLink: { fontSize: 14, fontWeight: '700', color: BLUE },
});

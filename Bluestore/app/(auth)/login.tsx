import GoogleLogo from '@/components/GoogleLogo';
import PhoneInput from '@/components/PhoneInput';
import { supabase } from '@/lib/supabase';
import { AntDesign, FontAwesome, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
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
import { CountryCode } from 'react-native-country-picker-modal';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LoginScreen() {
    const router = useRouter();
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [callingCode, setCallingCode] = useState('+233');
    const [focusedField, setFocusedField] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleCountryChange = (code: string, _cc: CountryCode) => {
        setCallingCode(code);
    };

    const handleLogin = async () => {
        if (!phone.trim() || !password.trim() || isLoading) return;

        setIsLoading(true);
        const cleanPhone = phone.trim().replace(/^0+/, '');
        const fullPhone = `${callingCode}${cleanPhone}`;

        try {
            const { error, data: { session } } = await supabase.auth.signInWithPassword({
                phone: fullPhone,
                password: password,
            });

            if (error) {
                if (error.message === 'Invalid login credentials') {
                    throw new Error('Incorrect phone number or password');
                }
                throw error;
            }

            if (session) {
                router.replace('/(tabs)');
            }
        } catch (error: any) {
            Alert.alert('Login Failed', error.message || 'Check your credentials and try again');
        } finally {
            setIsLoading(false);
        }
    };

    const handleBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/(auth)/signup');
        }
    };

    return (
        <SafeAreaView style={styles.safe}>
            <KeyboardAvoidingView
                style={styles.flex}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <ScrollView
                    contentContainerStyle={styles.scroll}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    {/* Back button */}
                    <TouchableOpacity
                        onPress={handleBack}
                        style={styles.backBtn}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    >
                        <View style={styles.backBtnInner}>
                            <Ionicons name="chevron-back" size={20} color="#111111" />
                        </View>
                    </TouchableOpacity>

                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.title}>Welcome back</Text>
                        <Text style={styles.subtitle}>Enter your phone number to continue</Text>
                    </View>

                    {/* Form */}
                    <View style={styles.form}>
                        <View style={styles.fieldWrap}>
                            <Text style={styles.label}>Phone number</Text>
                            <PhoneInput
                                value={phone}
                                onChangeText={setPhone}
                                onChangeCountry={handleCountryChange}
                                focused={focusedField === 'phone'}
                                onFocus={() => setFocusedField('phone')}
                                onBlur={() => setFocusedField(null)}
                                returnKeyType="next"
                                autoFocus
                            />
                        </View>

                        <View style={styles.fieldWrap}>
                            <Text style={styles.label}>Password</Text>
                            <View style={[styles.inputContainer, focusedField === 'password' && styles.inputFocused]}>
                                <TextInput
                                    style={styles.inputFlex}
                                    placeholder="Enter your password"
                                    placeholderTextColor="#BABABA"
                                    value={password}
                                    onChangeText={setPassword}
                                    onFocus={() => setFocusedField('password')}
                                    onBlur={() => setFocusedField(null)}
                                    secureTextEntry={!showPassword}
                                    returnKeyType="done"
                                />
                                <TouchableOpacity
                                    onPress={() => setShowPassword(!showPassword)}
                                    style={styles.eyeBtn}
                                >
                                    <Ionicons
                                        name={showPassword ? "eye-off-outline" : "eye-outline"}
                                        size={22}
                                        color="#8A8A8A"
                                    />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>

                    {/* CTA */}
                    <TouchableOpacity
                        style={[styles.button, (!phone.trim() || !password.trim() || isLoading) && styles.buttonDisabled]}
                        onPress={handleLogin}
                        activeOpacity={0.85}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <ActivityIndicator color="#FFFFFF" />
                        ) : (
                            <Text style={styles.buttonText}>Log in</Text>
                        )}
                    </TouchableOpacity>

                    {/* Sign up link */}
                    <View style={styles.accountRow}>
                        <Text style={styles.accountText}>Don't have an account? </Text>
                        <TouchableOpacity onPress={() => router.replace('/(auth)/signup')}>
                            <Text style={styles.accountLink}>Sign up</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Divider */}
                    <View style={styles.dividerRow}>
                        <View style={styles.dividerLine} />
                        <Text style={styles.dividerLabel}>or</Text>
                        <View style={styles.dividerLine} />
                    </View>

                    {/* Social Buttons */}
                    <View style={styles.socialRow}>
                        <TouchableOpacity style={styles.socialBtn} activeOpacity={0.75}>
                            <GoogleLogo />
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.socialBtn} activeOpacity={0.75}>
                            <FontAwesome name="facebook" size={22} color="#1877F2" />
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.socialBtn} activeOpacity={0.75}>
                            <AntDesign name="apple" size={22} color="#111111" />
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const BORDER_RADIUS = 16;
const INPUT_BG = '#F5F5F5';
const BORDER_DEFAULT = '#EBEBEB';
const BORDER_FOCUS = '#ABABAB';
const BUTTON_BG = '#ABABAB';
const TEXT_DARK = '#111111';
const TEXT_MUTED = '#8A8A8A';
const ACCENT = '#444444';

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#FFFFFF' },
    flex: { flex: 1 },
    scroll: {
        flexGrow: 1,
        paddingHorizontal: 28,
        paddingTop: 48,
        paddingBottom: 48,
    },
    backBtn: {
        marginBottom: 16,
        marginLeft: -4, // Nudge slightly for better optical alignment
        alignSelf: 'flex-start',
    },
    backBtnInner: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: '#F5F5F5',
        borderWidth: 1.5,
        borderColor: '#EBEBEB',
        alignItems: 'center',
        justifyContent: 'center',
    },
    header: { marginBottom: 48 },
    title: {
        fontSize: 30,
        fontWeight: '700',
        color: TEXT_DARK,
        letterSpacing: -0.5,
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 15,
        color: TEXT_MUTED,
        fontWeight: '400',
        lineHeight: 22,
    },
    form: { gap: 20, marginBottom: 36 },
    fieldWrap: { gap: 8 },
    label: { fontSize: 13, fontWeight: '600', color: TEXT_DARK, letterSpacing: 0.1 },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: INPUT_BG,
        borderWidth: 1.5,
        borderColor: BORDER_DEFAULT,
        borderRadius: BORDER_RADIUS,
        paddingHorizontal: 18,
    },
    inputFlex: {
        flex: 1,
        paddingVertical: 16,
        fontSize: 16,
        color: TEXT_DARK,
    },
    eyeBtn: {
        padding: 4,
    },
    inputFocused: { borderColor: BORDER_FOCUS, backgroundColor: '#FFFFFF' },
    button: {
        backgroundColor: BUTTON_BG,
        borderRadius: 50,
        paddingVertical: 18,
        alignItems: 'center',
        marginBottom: 24,
    },
    buttonDisabled: { opacity: 0.5 },
    buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', letterSpacing: 0.2 },
    accountRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    accountText: { fontSize: 14, color: TEXT_MUTED },
    accountLink: { fontSize: 14, color: ACCENT, fontWeight: '600', textDecorationLine: 'underline' },
    dividerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
        gap: 12,
    },
    dividerLine: { flex: 1, height: 1, backgroundColor: '#EBEBEB' },
    dividerLabel: { fontSize: 13, color: '#BABABA', fontWeight: '500' },
    socialRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 20,
    },
    socialBtn: {
        width: 58,
        height: 58,
        borderRadius: 29,
        backgroundColor: '#F5F5F5',
        borderWidth: 1.5,
        borderColor: '#EBEBEB',
        alignItems: 'center',
        justifyContent: 'center',
    },
});

import { HubtelAuth } from '@/lib/hubtel';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const OTP_LENGTH = 6;

export default function OtpScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{
        phone: string,
        fullName?: string,
        password?: string,
        otpCode: string,
        type: string
    }>();

    const [currentSentOtp, setCurrentSentOtp] = useState(params.otpCode);
    const [otpValue, setOtpValue] = useState('');
    const [isInputFocused, setIsInputFocused] = useState(false);
    const [countdown, setCountdown] = useState(32);
    const [canResend, setCanResend] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const hiddenInputRef = useRef<TextInput>(null);

    // Countdown timer
    useEffect(() => {
        if (countdown <= 0) {
            setCanResend(true);
            return;
        }
        const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
        return () => clearTimeout(timer);
    }, [countdown]);

    // Focus input on mount
    useEffect(() => {
        const timer = setTimeout(() => {
            hiddenInputRef.current?.focus();
        }, 500);
        return () => clearTimeout(timer);
    }, []);

    const handleResend = async () => {
        if (!canResend || isLoading) return;

        setIsLoading(true);
        try {
            const result = await HubtelAuth.sendOTP(params.phone);

            if (result.otpCode) setCurrentSentOtp(result.otpCode);

            setOtpValue('');
            setCountdown(60);
            setCanResend(false);
            hiddenInputRef.current?.focus();
            Alert.alert('Success', 'Verification code has been resent');
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to resend code');
        } finally {
            setIsLoading(false);
        }
    };

    const handleOtpChange = (value: string) => {
        // Only allow digits and limit to OTP_LENGTH
        const sanitized = value.replace(/[^0-9]/g, '').slice(0, OTP_LENGTH);
        setOtpValue(sanitized);

        // Auto-submit when fully filled
        if (sanitized.length === OTP_LENGTH) {
            // Give a small delay for the UI to update
            setTimeout(() => {
                handleSubmitInternal(sanitized);
            }, 100);
        }
    };

    const maskedPhone = params.phone
        ? params.phone.replace(/(\+\d{3})\d+(\d{4})/, '$1 **-***-$2')
        : '';

    const isFilled = otpValue.length === OTP_LENGTH;

    const handleSubmitInternal = async (token: string) => {
        if (isLoading) return;
        setIsLoading(true);

        try {


            // 1. Verify OTP client-side
            if (token !== currentSentOtp) {
                throw new Error('The verification code you entered is incorrect');
            }

            // 2. Auth: Native Supabase Phone Signup
            const phone = params.phone;
            const password = params.password || '';



            // Create user with phone directly
            const { error: signUpError, data: { session } } = await supabase.auth.signUp({
                phone: phone,
                password: password,
                options: {
                    data: {
                        full_name: params.fullName || 'User',
                        phone_number: phone,
                    }
                }
            });

            if (signUpError) {
                if (signUpError.message.includes('rate limit')) {
                    Alert.alert('Too Many Attempts', 'Please wait a minute.');
                } else {
                    Alert.alert('Auth Error', signUpError.message);
                }
                return;
            }

            if (session) {

                router.replace('/(tabs)');
            } else {
                console.warn('No session returned after auth');
            }
        } catch (error: any) {
            console.error('Verification/Auth failed:', error);
            Alert.alert('Verification Failed', error.message || 'Invalid code');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = () => {
        if (isFilled) {
            handleSubmitInternal(otpValue);
        }
    };

    const renderOtpBoxes = () => {
        const boxes = [];
        for (let i = 0; i < OTP_LENGTH; i++) {
            const digit = otpValue[i] || '';
            const isFocused = isInputFocused && otpValue.length === i;

            boxes.push(
                <View
                    key={i}
                    style={[
                        styles.otpBox,
                        isFocused && styles.otpBoxFocused,
                        digit !== '' && styles.otpBoxFilled,
                    ]}
                >
                    <Text style={styles.otpText}>{digit}</Text>
                    {isFocused && <View style={styles.cursor} />}
                </View>
            );
        }
        return boxes;
    };

    return (
        <SafeAreaView style={styles.safe}>
            <KeyboardAvoidingView
                style={styles.flex}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <View style={styles.container}>
                    {/* Back */}
                    <TouchableOpacity
                        onPress={() => router.back()}
                        style={styles.backBtn}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    >
                        <View style={styles.backBtnInner}>
                            <Ionicons name="chevron-back" size={20} color="#111111" />
                        </View>
                    </TouchableOpacity>

                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.title}>Confirm your number</Text>
                        <Text style={styles.subtitle}>
                            Enter the code sent to{' '}
                            <Text style={styles.phoneHighlight}>{maskedPhone || params.phone}</Text>
                        </Text>
                    </View>

                    {/* Hidden Input for handling Auto-fill and multi-character inputs efficiently */}
                    <TextInput
                        ref={hiddenInputRef}
                        style={styles.hiddenInput}
                        value={otpValue}
                        onChangeText={handleOtpChange}
                        keyboardType="number-pad"
                        maxLength={OTP_LENGTH}
                        autoFocus={false}
                        onFocus={() => setIsInputFocused(true)}
                        onBlur={() => setIsInputFocused(false)}
                        textContentType="oneTimeCode"
                        autoComplete="one-time-code"
                        editable={!isLoading}
                    />

                    {/* Stylized OTP Boxes (Visual only, tapping them focuses the hidden input) */}
                    <Pressable
                        style={styles.otpRow}
                        onPress={() => hiddenInputRef.current?.focus()}
                    >
                        {renderOtpBoxes()}
                    </Pressable>

                    {/* Resend */}
                    <View style={styles.resendRow}>
                        {canResend ? (
                            <TouchableOpacity onPress={handleResend} disabled={isLoading}>
                                <Text style={[styles.resendActive, isLoading && { opacity: 0.5 }]}>Resend code</Text>
                            </TouchableOpacity>
                        ) : (
                            <Text style={styles.resendTimer}>
                                Resend code in {countdown}
                            </Text>
                        )}
                    </View>

                    {/* Submit */}
                    <View style={styles.buttonWrap}>
                        <TouchableOpacity
                            style={[
                                styles.button,
                                (!isFilled || isLoading) && styles.buttonDisabled,
                                isFilled && { backgroundColor: BLUE }
                            ]}
                            onPress={handleSubmit}
                            activeOpacity={0.85}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <ActivityIndicator color="#FFFFFF" />
                            ) : (
                                <Text style={styles.buttonText}>Submit</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const BOX_SIZE = 46;
const BORDER_RADIUS_BOX = 12;
const BLUE = '#0057FF';
const BUTTON_BG = '#ABABAB';
const TEXT_DARK = '#111111';
const TEXT_MUTED = '#8A8A8A';

const styles = StyleSheet.create({
    safe: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    flex: {
        flex: 1,
    },
    container: {
        flex: 1,
        paddingHorizontal: 28,
        paddingTop: 48,
        paddingBottom: 40,
    },
    backBtn: {
        marginBottom: 16,
        marginLeft: -4,
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
    header: {
        marginBottom: 40,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: TEXT_DARK,
        letterSpacing: -0.5,
        marginBottom: 10,
    },
    subtitle: {
        fontSize: 15,
        color: TEXT_MUTED,
        lineHeight: 22,
    },
    phoneHighlight: {
        color: TEXT_DARK,
        fontWeight: '600',
    },
    hiddenInput: {
        position: 'absolute',
        width: '100%',
        height: BOX_SIZE,
        top: 0,
        opacity: 0.01,
        zIndex: -1,
    },
    otpRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 6,
        marginBottom: 20,
    },
    otpBox: {
        flex: 1,
        height: BOX_SIZE,
        borderRadius: BORDER_RADIUS_BOX,
        borderWidth: 1.5,
        borderColor: '#DEDEDE',
        backgroundColor: '#F5F5F5',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    otpText: {
        fontSize: 22,
        fontWeight: '700',
        color: TEXT_DARK,
    },
    otpBoxFocused: {
        borderColor: BLUE,
        backgroundColor: '#FFFFFF',
        borderWidth: 2,
    },
    otpBoxFilled: {
        borderColor: '#111111',
        backgroundColor: '#FFFFFF',
    },
    cursor: {
        position: 'absolute',
        width: 2,
        height: 24,
        backgroundColor: BLUE,
    },
    resendRow: {
        alignItems: 'center',
        marginBottom: 48,
    },
    resendTimer: {
        fontSize: 14,
        color: TEXT_MUTED,
    },
    resendActive: {
        fontSize: 14,
        color: '#444444',
        fontWeight: '600',
        textDecorationLine: 'underline',
    },
    buttonWrap: {
        marginTop: 'auto' as any,
    },
    button: {
        backgroundColor: BUTTON_BG,
        borderRadius: 50,
        paddingVertical: 18,
        alignItems: 'center',
    },
    buttonDisabled: {
        opacity: 0.5,
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
        letterSpacing: 0.2,
    },
});

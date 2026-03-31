import { paystack } from '@/lib/paystack';
import { supabase } from '@/lib/supabase';
import { Feather, Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Dimensions,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PhoneInput from './PhoneInput';

const BLUE = '#0057FF';
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface PaymentDrawerProps {
    visible: boolean;
    onClose: () => void;
    onSuccess: (reference: string) => void;
    amount: number;
    description: string;
    metadata: any;
}

type PaymentStep = 'phone' | 'otp' | 'processing' | 'success' | 'failed';

export function PaymentDrawer({ visible, onClose, onSuccess, amount, description, metadata }: PaymentDrawerProps) {
    const [step, setStep] = useState<PaymentStep>('phone');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [otp, setOtp] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [reference, setReference] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [userEmail, setUserEmail] = useState('');
    
    // Animation refs
    const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            resetState();
            fetchUserData();
            // Start entry animation
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
        }
    }, [visible]);

    const handleClose = () => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 250,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: SCREEN_HEIGHT,
                duration: 250,
                useNativeDriver: true,
            })
        ]).start(() => onClose());
    };

    const resetState = () => {
        setStep('phone');
        setOtp('');
        setIsSubmitting(false);
        setReference('');
        setErrorMessage('');
    };

    const fetchUserData = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setUserEmail(user.email || `${user.id}@bluestore.com`);
                
                // Get phone from profile
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('phone_number')
                    .eq('id', user.id)
                    .single();
                
                if (profile?.phone_number) {
                    const cleanPhone = profile.phone_number.replace('+233', '').trim();
                    setPhoneNumber(cleanPhone);
                }
            }
        } catch (e) {
            console.error('Error fetching user for payment:', e);
        }
    };

    const handleInitiateCharge = async () => {
        if (phoneNumber.length < 9) {
            Alert.alert('Invalid Number', 'Please enter a valid phone number.');
            return;
        }

        setIsSubmitting(true);
        setErrorMessage('');

        const fullPhone = phoneNumber.startsWith('0') 
            ? `233${phoneNumber.substring(1)}` 
            : phoneNumber.startsWith('233') ? phoneNumber : `233${phoneNumber}`;

        try {
            const res = await paystack.chargeMobileMoney(userEmail, amount, fullPhone, metadata);
            
            if (res.status === true) {
                setReference(res.data.reference);
                if (res.data.status === 'send_otp') setStep('otp');
                else {
                    setStep('processing');
                    pollStatus(res.data.reference);
                }
            } else {
                setErrorMessage(res.message || 'Payment failed to initialize.');
                setStep('failed');
            }
        } catch (error: any) {
            setErrorMessage(error.message || 'An unexpected error occurred.');
            setStep('failed');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSubmitOtp = async () => {
        if (otp.length < 4) return;
        setIsSubmitting(true);
        try {
            const res = await paystack.submitOTP(otp, reference);
            if (res.status === true) {
                setStep('processing');
                pollStatus(reference);
            } else {
                setErrorMessage(res.message || 'Invalid OTP');
            }
        } catch (error: any) {
            setErrorMessage(error.message || 'OTP verification failed.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const pollStatus = async (ref: string) => {
        let attempts = 0;
        const maxAttempts = 20;
        const check = async () => {
            attempts++;
            const verification = await paystack.verifyTransaction(ref);
            if (verification?.data?.status === 'success') {
                setStep('success');
                setTimeout(() => {
                    onSuccess(ref);
                    handleClose();
                }, 1500);
                return;
            }
            if (verification?.data?.status === 'failed') {
                setErrorMessage(verification.data.gateway_response || 'Transaction failed.');
                setStep('failed');
                return;
            }
            if (attempts < maxAttempts && visible) setTimeout(check, 3000);
            else if (attempts >= maxAttempts) {
                setErrorMessage('Transaction timed out. Please check your momo prompt.');
                setStep('failed');
            }
        };
        check();
    };

    const renderHeader = () => (
        <View style={styles.header}>
            <View>
                <Text style={styles.title}>{step === 'otp' ? 'Enter OTP' : 'Payment Method'}</Text>
                <Text style={styles.subTitle}>{description}</Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color="#111111" />
            </TouchableOpacity>
        </View>
    );

    const renderPhoneStep = () => (
        <View style={styles.stepContent}>
            <Text style={styles.label}>Mobile Money Number</Text>
            <PhoneInput 
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                focused={true}
            />
            <Text style={styles.hint}>You will receive a prompt on this phone to authorize the GH₵ {amount} payment.</Text>
            <TouchableOpacity 
                style={[styles.primaryBtn, isSubmitting && styles.disabledBtn]} 
                onPress={handleInitiateCharge}
                disabled={isSubmitting}
            >
                {isSubmitting ? <ActivityIndicator color="#FFF" /> : (
                    <>
                        <Text style={styles.primaryBtnText}>Pay GH₵ {amount}</Text>
                        <Feather name="arrow-right" size={18} color="#FFF" />
                    </>
                )}
            </TouchableOpacity>
        </View>
    );

    const renderOtpStep = () => (
        <View style={styles.stepContent}>
            <Text style={styles.label}>Verification Code</Text>
            <View style={styles.otpContainer}>
                <TextInput
                    style={styles.otpInput}
                    value={otp}
                    onChangeText={setOtp}
                    placeholder="000000"
                    keyboardType="number-pad"
                    maxLength={6}
                    autoFocus
                />
            </View>
            <Text style={styles.hint}>Enter the code sent to your phone to proceed.</Text>
            <TouchableOpacity 
                style={[styles.primaryBtn, (otp.length < 4 || isSubmitting) && styles.disabledBtn]} 
                onPress={handleSubmitOtp}
                disabled={otp.length < 4 || isSubmitting}
            >
                {isSubmitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryBtnText}>Verify and Pay</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.backLink} onPress={() => setStep('phone')}>
                <Text style={styles.backLinkText}>Use a different number</Text>
            </TouchableOpacity>
        </View>
    );

    const renderProcessingStep = () => (
        <View style={[styles.stepContent, styles.center]}>
            <ActivityIndicator size="large" color={BLUE} />
            <Text style={styles.statusTitle}>Processing Payment...</Text>
            <Text style={styles.statusDesc}>Please confirm the prompt on your phone ({phoneNumber})</Text>
        </View>
    );

    const renderSuccessStep = () => (
        <View style={[styles.stepContent, styles.center]}>
            <View style={styles.successCircle}><Ionicons name="checkmark" size={40} color="#FFF" /></View>
            <Text style={styles.statusTitle}>Payment Successful!</Text>
            <Text style={styles.statusDesc}>
                {metadata?.package_type === 'boost' ? 'Your listing has been boosted.' : 'Your plan has been activated.'}
            </Text>
        </View>
    );

    const renderFailedStep = () => (
        <View style={[styles.stepContent, styles.center]}>
            <View style={[styles.successCircle, { backgroundColor: '#FF4B4B' }]}><Ionicons name="close" size={40} color="#FFF" /></View>
            <Text style={styles.statusTitle}>Payment Failed</Text>
            <Text style={[styles.statusDesc, { color: '#FF4B4B' }]}>{errorMessage}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={resetState}>
                <Text style={styles.retryBtnText}>Try Again</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
            <View style={styles.modalRoot}>
                <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
                    <Pressable style={styles.flex1} onPress={handleClose} />
                </Animated.View>
                
                <KeyboardAvoidingView 
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={styles.keyboardView}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
                >
                    <Animated.View style={[
                        styles.sheetContainer,
                        { transform: [{ translateY: slideAnim }] }
                    ]}>
                        <SafeAreaView edges={['bottom']}>
                            {renderHeader()}
                            <View style={styles.content}>
                                {step === 'phone' && renderPhoneStep()}
                                {step === 'otp' && renderOtpStep()}
                                {step === 'processing' && renderProcessingStep()}
                                {step === 'success' && renderSuccessStep()}
                                {step === 'failed' && renderFailedStep()}
                            </View>
                        </SafeAreaView>
                    </Animated.View>
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalRoot: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    flex1: {
        flex: 1,
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    keyboardView: {
        width: '100%',
    },
    sheetContainer: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        paddingTop: 20,
        width: '100%',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        marginBottom: 20,
    },
    title: { fontSize: 20, fontWeight: '800', color: '#111111' },
    subTitle: { fontSize: 13, color: '#8A8A8A', marginTop: 2 },
    closeBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F5F5F5',
        alignItems: 'center',
        justifyContent: 'center',
    },
    content: {
        paddingBottom: 40,
    },
    stepContent: {
        paddingHorizontal: 24,
    },
    label: {
        fontSize: 14,
        fontWeight: '700',
        color: '#111111',
        marginBottom: 12,
    },
    hint: {
        fontSize: 13,
        color: '#8A8A8A',
        marginTop: 16,
        lineHeight: 18,
    },
    primaryBtn: {
        flexDirection: 'row',
        backgroundColor: '#111111',
        height: 56,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 24,
        gap: 10,
    },
    disabledBtn: {
        opacity: 0.6,
    },
    primaryBtnText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
    },
    otpContainer: {
        backgroundColor: '#F5F5F5',
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: '#EBEBEB',
    },
    otpInput: {
        height: 56,
        paddingHorizontal: 20,
        fontSize: 20,
        fontWeight: '700',
        letterSpacing: 4,
        color: '#111111',
        textAlign: 'center',
    },
    backLink: {
        marginTop: 20,
        alignItems: 'center',
    },
    backLinkText: {
        color: BLUE,
        fontWeight: '600',
        fontSize: 14,
    },
    center: {
        alignItems: 'center',
        paddingVertical: 30,
    },
    statusTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#111111',
        marginTop: 20,
    },
    statusDesc: {
        fontSize: 14,
        color: '#8A8A8A',
        marginTop: 8,
        textAlign: 'center',
        paddingHorizontal: 40,
    },
    successCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#2E7D32',
        alignItems: 'center',
        justifyContent: 'center',
    },
    retryBtn: {
        marginTop: 24,
        paddingVertical: 12,
        paddingHorizontal: 24,
        backgroundColor: '#F5F5F5',
        borderRadius: 12,
    },
    retryBtnText: {
        color: '#111111',
        fontWeight: '700',
    },
});

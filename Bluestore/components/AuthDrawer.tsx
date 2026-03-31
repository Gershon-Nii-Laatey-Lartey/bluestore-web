import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    Animated,
    Dimensions,
    Pressable,
    Platform,
} from 'react-native';
import { Ionicons, FontAwesome, AntDesign } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import GoogleLogo from './GoogleLogo';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

WebBrowser.maybeCompleteAuthSession();

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface AuthDrawerProps {
    visible: boolean;
    onClose: () => void;
}

export function AuthDrawer({ visible, onClose }: AuthDrawerProps) {
    const router = useRouter();
    const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            WebBrowser.warmUpAsync();
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
            WebBrowser.coolDownAsync();
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

    const handleSocialLogin = async (provider: 'google' | 'apple') => {
        try {
            const redirectTo = Linking.createURL('/');
            
            const { data, error } = await supabase.auth.signInWithOAuth({
                provider,
                options: {
                    redirectTo,
                    skipBrowserRedirect: true,
                },
            });

            if (error) throw error;
            if (data?.url) {
                const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
                if (result.type === 'success' && result.url) {
                    const { params, errorCode } = Linking.parse(result.url);
                    if (errorCode) throw new Error(errorCode);
                    
                    const access_token = params?.access_token as string;
                    const refresh_token = params?.refresh_token as string;

                    if (access_token && refresh_token) {
                        const { error: sessionError } = await supabase.auth.setSession({
                            access_token,
                            refresh_token,
                        });
                        if (sessionError) throw sessionError;
                        handleClose();
                    }
                }
            }
        } catch (error: any) {
            console.error(`${provider} login error:`, error.message);
        }
    };

    const handlePhoneLogin = () => {
        handleClose();
        // Slightly delay to allow drawer to close before navigating
        setTimeout(() => {
            router.push('/(auth)/login');
        }, 300);
    };

    return (
        <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
            <View style={styles.modalRoot}>
                <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
                    <Pressable style={styles.flex1} onPress={handleClose} />
                </Animated.View>
                
                <Animated.View style={[
                    styles.sheetContainer,
                    { transform: [{ translateY: slideAnim }] }
                ]}>
                    <SafeAreaView edges={['bottom']}>
                        <View style={styles.header}>
                            <View>
                                <Text style={styles.title}>Sign in to Bluestore</Text>
                                <Text style={styles.subTitle}>Unlock the best features</Text>
                            </View>
                            <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
                                <Ionicons name="close" size={24} color="#111111" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.options}>
                            <TouchableOpacity 
                                style={[styles.optionBtn, styles.primaryBtn]} 
                                onPress={handlePhoneLogin}
                            >
                                <View style={styles.iconContainer}>
                                    <Ionicons name="call" size={20} color="#FFFFFF" />
                                </View>
                                <Text style={[styles.optionText, styles.primaryBtnText]}>Continue with Phone</Text>
                                <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.7)" />
                            </TouchableOpacity>

                            <TouchableOpacity 
                                style={styles.optionBtn} 
                                onPress={() => handleSocialLogin('google')}
                            >
                                <View style={styles.iconContainer}>
                                    <GoogleLogo size={20} />
                                </View>
                                <Text style={styles.optionText}>Continue with Google</Text>
                                <Ionicons name="chevron-forward" size={16} color="#ABABAB" />
                            </TouchableOpacity>

                            <TouchableOpacity 
                                style={styles.optionBtn} 
                                onPress={() => handleSocialLogin('apple')}
                            >
                                <View style={styles.iconContainer}>
                                    <AntDesign name="apple" size={20} color="#111111" />
                                </View>
                                <Text style={styles.optionText}>Continue with Apple</Text>
                                <Ionicons name="chevron-forward" size={16} color="#ABABAB" />
                            </TouchableOpacity>
                        </View>
                    </SafeAreaView>
                </Animated.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalRoot: { flex: 1, justifyContent: 'flex-end' },
    flex1: { flex: 1 },
    overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
    sheetContainer: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        paddingTop: 20,
        paddingBottom: Platform.OS === 'ios' ? 28 : 40,
        width: '100%',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 28,
        marginBottom: 24,
    },
    title: { fontSize: 22, fontWeight: '800', color: '#111111', letterSpacing: -0.5 },
    subTitle: { fontSize: 14, color: '#8A8A8A', marginTop: 3, fontWeight: '500' },
    closeBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F5F5F5',
        alignItems: 'center',
        justifyContent: 'center',
    },
    options: {
        paddingHorizontal: 24,
        gap: 12,
    },
    optionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FAFAFA',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: '#F0F0F0',
    },
    primaryBtn: {
        backgroundColor: '#0057FF',
        borderColor: '#0057FF',
    },
    iconContainer: {
        width: 28,
        height: 28,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    optionText: {
        flex: 1,
        fontSize: 15,
        fontWeight: '700',
        color: '#111111',
    },
    primaryBtnText: {
        color: '#FFFFFF',
    },
});

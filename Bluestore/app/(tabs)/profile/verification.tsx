import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { decode } from 'base64-arraybuffer';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import { Stack, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    KeyboardAvoidingView,
    LayoutAnimation,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');
const BLUE = '#0057FF';

type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected' | 'loading';

export default function VerificationScreen() {
    const router = useRouter();
    const [status, setStatus] = useState<VerificationStatus>('loading');
    const [step, setStep] = useState(0); // 0: Start, 1: ID Type, 2: Upload Docs, 3: Selfie, 4: Details, 5: Finished
    const [isLoading, setIsLoading] = useState(false);

    // Form Data
    const [idType, setIdType] = useState<'National ID' | 'Passport' | 'Driver License' | ''>('');
    const [idFront, setIdFront] = useState<{ uri: string, base64: string } | null>(null);
    const [idBack, setIdBack] = useState<{ uri: string, base64: string } | null>(null);
    const [selfie, setSelfie] = useState<{ uri: string, base64: string } | null>(null);
    const [legalName, setLegalName] = useState('');
    const [address1, setAddress1] = useState('');
    const [address2, setAddress2] = useState('');
    const [city, setCity] = useState('');
    const [postalCode, setPostalCode] = useState('');
    const [captureStep, setCaptureStep] = useState<'front' | 'back' | 'selfie'>('front');
    const cameraRef = useRef<CameraView>(null);
    const [cameraPermission, requestCameraPermission] = useCameraPermissions();

    useEffect(() => {
        checkStatus();
        requestCameraPermission();

        // Real-time listener for status changes
        let subscription: any;
        const setupRealtime = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            subscription = supabase
                .channel('verification-status')
                .on('postgres_changes', {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'profiles',
                    filter: `id=eq.${user.id}`
                }, (payload) => {
                    if (payload.new && payload.new.verification_status) {
                        setStatus(payload.new.verification_status as VerificationStatus);
                    }
                })
                .subscribe();
        };
        setupRealtime();

        return () => { if (subscription) subscription.unsubscribe(); };
    }, []);

    const checkStatus = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const { data: profile } = await supabase.from('profiles').select('verification_status').eq('id', user.id).single();
            if (profile) setStatus(profile.verification_status as VerificationStatus);
            else setStatus('unverified');
        } catch (e) {
            setStatus('unverified');
        }
    };

    const handleTryAgain = () => {
        setStep(0);
        setStatus('unverified');
    };

    const captureIdImage = async (side: 'front' | 'back' | 'selfie') => {
        if (!cameraPermission?.granted) {
            const { granted } = await requestCameraPermission();
            if (!granted) {
                Alert.alert('Permission Required', 'Please allow camera access to capture your ID.');
                return;
            }
        }

        if (cameraRef.current) {
            try {
                const photo = await cameraRef.current.takePictureAsync({
                    quality: 0.8,
                    base64: false,
                    exif: false,
                });

                if (photo) {
                    // Optimize capture
                    const manipResult = await ImageManipulator.manipulateAsync(
                        photo.uri,
                        [{ resize: { width: 1200 } }],
                        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
                    );

                    if (manipResult.base64) {
                        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                        const img = { uri: manipResult.uri, base64: manipResult.base64 };

                        if (side === 'front') {
                            setIdFront(img);
                            if (idType !== 'Passport') {
                                setCaptureStep('back');
                            }
                        } else if (side === 'back') {
                            setIdBack(img);
                        } else {
                            setSelfie(img);
                        }
                    }
                }
            } catch (e) {
                console.error('Capture Error:', e);
                Alert.alert('Error', 'Failed to capture photo. Please try again.');
            }
        }
    };

    const takeSelfie = async () => {
        setStep(3);
        setCaptureStep('selfie');
    };

    const handleSubmit = async () => {
        if (!legalName || !address1 || !city) {
            Alert.alert('Incomplete Form', 'Please provide your legal name and full address.');
            return;
        }

        setIsLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not logged in');

            // 1. Upload Images to 'verification_docs' bucket
            const uploadMap = [
                { key: 'id_front', data: idFront, path: 'front.jpg' },
                { key: 'id_back', data: idBack, path: 'back.jpg' },
                { key: 'selfie', data: selfie, path: 'selfie.jpg' },
            ].filter(item => item.data);

            const urls: Record<string, string> = {};

            for (const item of uploadMap) {
                const fileName = `${user.id}/${Date.now()}_${item.path}`;
                const { error: uploadError } = await supabase.storage
                    .from('verification_docs')
                    .upload(fileName, decode(item.data!.base64), { contentType: 'image/jpeg' });

                if (uploadError) throw uploadError;
                const { data: { publicUrl } } = supabase.storage.from('verification_docs').getPublicUrl(fileName);
                urls[item.key] = publicUrl;
            }

            // 2. Insert into seller_verifications
            const { error: insertError } = await supabase.from('seller_verifications').insert({
                user_id: user.id,
                full_legal_name: legalName,
                id_type: idType,
                id_front_url: urls['id_front'],
                id_back_url: urls['id_back'] || null,
                selfie_url: urls['selfie'],
                address_line1: address1,
                address_line2: address2,
                city,
                postal_code: postalCode,
                status: 'pending'
            });

            if (insertError) throw insertError;

            // 3. Update profile status
            await supabase.from('profiles').update({ verification_status: 'pending' }).eq('id', user.id);

            setStep(5);
        } catch (error: any) {
            console.error('Submit Error:', error);
            Alert.alert('Submission Failed', error.message || 'An unexpected error occurred.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleBack = () => {
        if (step > 0 && step < 5) {
            setStep(step - 1);
        } else {
            router.push('/(tabs)/profile');
        }
    };

    const renderHeader = () => (
        <View style={styles.header}>
            <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
                <Ionicons name="chevron-back" size={24} color="#111111" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Account Verification</Text>
            <View style={{ width: 44 }} />
        </View>
    );

    const renderIntro = () => (
        <View style={styles.stepContent}>
            <View style={styles.iconCircle}>
                <Ionicons name="shield-checkmark" size={48} color={BLUE} />
            </View>
            <Text style={styles.stepTitle}>Seller Identity Check</Text>
            <Text style={styles.stepDesc}>
                To sell on Bluestore, we need to verify your identity. This helps protect our community and builds trust with buyers.
            </Text>
            <View style={styles.infoBox}>
                <Ionicons name="information-circle" size={20} color={BLUE} />
                <Text style={styles.infoText}>Your data is encrypted and only used for security auditing.</Text>
            </View>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => setStep(1)}>
                <Text style={styles.primaryBtnText}>Start Verification</Text>
            </TouchableOpacity>
        </View>
    );

    const renderIdType = () => (
        <View style={styles.stepContent}>
            <Text style={styles.stepTitleSub}>Select ID Type</Text>
            <Text style={styles.stepLabel}>What document are you providing?</Text>
            <View style={styles.idGrid}>
                {(['National ID', 'Passport', 'Driver License'] as const).map((type) => (
                    <TouchableOpacity
                        key={type}
                        style={[styles.idTypeCard, idType === type && styles.idTypeCardActive]}
                        onPress={() => setIdType(type)}
                    >
                        <Ionicons
                            name={type === 'Passport' ? 'airplane-outline' : type === 'National ID' ? 'card-outline' : 'car-outline'}
                            size={32}
                            color={idType === type ? BLUE : '#8A8A8A'}
                        />
                        <Text style={[styles.idTypeText, idType === type && styles.idTypeTextActive]}>{type}</Text>
                        {idType === type && (
                            <View style={styles.checkBadge}>
                                <Ionicons name="checkmark" size={12} color="#FFF" />
                            </View>
                        )}
                    </TouchableOpacity>
                ))}
            </View>
            <TouchableOpacity
                style={[styles.nextBtn, !idType && styles.btnDisabled]}
                onPress={() => setStep(2)}
                disabled={!idType}
            >
                <Text style={styles.nextBtnText}>Next Step</Text>
            </TouchableOpacity>
        </View >
    );

    const renderUploadDocs = () => {
        const isPassport = idType === 'Passport';
        const currentLabel = captureStep === 'front' ? 'Front Side' : 'Back Side';
        const currentDesc = captureStep === 'front'
            ? `Place the front of your ${idType} in the frame`
            : `Now flip your ${idType} and capture the back side`;

        return (
            <View style={styles.stepContent}>
                <Text style={[styles.stepTitleSub, { alignSelf: 'center' }]}>{currentLabel}</Text>
                <Text style={styles.stepDesc}>{currentDesc}</Text>

                {/* Camera Viewfinder with Feed */}
                <View style={styles.viewfinderContainer}>
                    {cameraPermission?.granted ? (
                        <CameraView
                            ref={cameraRef}
                            style={styles.camera}
                            facing="back"
                        >
                            <TouchableOpacity
                                style={styles.viewfinderFrame}
                                onPress={() => captureIdImage(captureStep)}
                                activeOpacity={0.7}
                            >
                                <View style={[styles.corner, styles.topLeft]} />
                                <View style={[styles.corner, styles.topRight]} />
                                <View style={[styles.corner, styles.bottomLeft]} />
                                <View style={[styles.corner, styles.bottomRight]} />

                                <View style={styles.captureIndicator}>
                                    <Ionicons name="camera" size={32} color="#FFF" />
                                </View>
                            </TouchableOpacity>
                        </CameraView>
                    ) : (
                        <View style={styles.cameraPlaceholder}>
                            <Ionicons name="videocam-off-outline" size={48} color="#ABABAB" />
                            <TouchableOpacity onPress={requestCameraPermission} style={styles.retryBtn}>
                                <Text style={styles.retryText}>Grant Camera Permission</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {/* Captured Previews */}
                <View style={styles.previewStrip}>
                    <TouchableOpacity
                        style={[styles.previewItem, idFront && styles.previewItemActive]}
                        onPress={() => setCaptureStep('front')}
                    >
                        {idFront ? (
                            <Image source={{ uri: idFront.uri }} style={styles.previewImage} />
                        ) : (
                            <Ionicons name="card-outline" size={24} color="#ABABAB" />
                        )}
                        <Text style={styles.previewLabel}>Front</Text>
                    </TouchableOpacity>

                    {!isPassport && (
                        <TouchableOpacity
                            style={[styles.previewItem, idBack && styles.previewItemActive]}
                            onPress={() => setCaptureStep('back')}
                        >
                            {idBack ? (
                                <Image source={{ uri: idBack.uri }} style={styles.previewImage} />
                            ) : (
                                <Ionicons name="card-outline" size={24} color="#ABABAB" />
                            )}
                            <Text style={styles.previewLabel}>Back</Text>
                        </TouchableOpacity>
                    )}
                </View>

                <View style={styles.spacer} />

                <TouchableOpacity
                    style={[styles.nextBtn, (!idFront || (!isPassport && !idBack)) && styles.btnDisabled]}
                    onPress={() => setStep(3)}
                    disabled={!idFront || (!isPassport && !idBack)}
                >
                    <Text style={styles.nextBtnText}>Continue to Selfie</Text>
                </TouchableOpacity>
            </View>
        );
    };

    const renderSelfie = () => (
        <View style={styles.stepContent}>
            <Text style={styles.stepTitleSub}>Liveness Check</Text>
            <Text style={styles.stepDesc}>Take a selfie holding your ID next to your face.</Text>

            <View style={styles.selfieCameraContainer}>
                {cameraPermission?.granted ? (
                    <CameraView
                        ref={cameraRef}
                        style={styles.camera}
                        facing="front"
                    >
                        <TouchableOpacity
                            style={styles.selfieOverlay}
                            onPress={() => captureIdImage('selfie')}
                        >
                            <View style={styles.selfieGuide} />
                            <View style={styles.captureIndicatorLarge}>
                                <Ionicons name="camera" size={40} color="#FFF" />
                            </View>
                        </TouchableOpacity>
                    </CameraView>
                ) : (
                    <View style={styles.cameraPlaceholder} />
                )}

                {selfie && (
                    <View style={styles.selfiePreviewOverlay}>
                        <Image source={{ uri: selfie.uri }} style={styles.selfiePreview} />
                        <TouchableOpacity style={styles.retakeSelfieBtn} onPress={() => setSelfie(null)}>
                            <Text style={styles.retakeSelfieText}>Retake Selfie</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            <TouchableOpacity
                style={[styles.nextBtn, !selfie && styles.btnDisabled]}
                onPress={() => setStep(4)}
                disabled={!selfie}
            >
                <Text style={styles.nextBtnText}>Review Details</Text>
            </TouchableOpacity>
        </View>
    );

    const renderDetails = () => (
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            <View style={styles.stepContent}>
                <Text style={styles.stepTitleSub}>Final Details</Text>
                <Text style={styles.stepDesc}>Provide your legal residential information.</Text>

                <View style={styles.formArea}>
                    <View style={styles.inputField}>
                        <Text style={styles.inputLabel}>Full Legal Name</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Same as your ID"
                            value={legalName}
                            onChangeText={setLegalName}
                        />
                    </View>

                    <View style={styles.inputField}>
                        <Text style={styles.inputLabel}>Residential Address Line 1</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Street, house number"
                            value={address1}
                            onChangeText={setAddress1}
                        />
                    </View>

                    <View style={styles.inputField}>
                        <Text style={styles.inputLabel}>Postal Code / ZIP</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="E.g., GA-120-XXXX"
                            value={postalCode}
                            onChangeText={setPostalCode}
                        />
                    </View>

                    <View style={styles.inputField}>
                        <Text style={styles.inputLabel}>City/Region</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="E.g., Accra, Greater Accra"
                            value={city}
                            onChangeText={setCity}
                        />
                    </View>
                </View>

                <TouchableOpacity
                    style={[styles.primaryBtn, isLoading && styles.btnDisabled]}
                    onPress={handleSubmit}
                    disabled={isLoading}
                >
                    {isLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryBtnText}>Submit Verification</Text>}
                </TouchableOpacity>
            </View>
        </ScrollView>
    );

    const renderFinished = () => (
        <View style={styles.stepContent}>
            <View style={styles.successCircle}>
                <Ionicons name="checkmark-done" size={64} color="#00C851" />
            </View>
            <Text style={styles.stepTitle}>Application Submitted!</Text>
            <Text style={styles.stepDesc}>
                We're reviewing your documents. You'll receive a notification within 24-48 hours.
            </Text>
            <TouchableOpacity style={styles.nextBtn} onPress={() => router.replace('/(tabs)/profile')}>
                <Text style={styles.nextBtnText}>Return to Profile</Text>
            </TouchableOpacity>
        </View>
    );

    const renderStatusScreen = (status: VerificationStatus) => {
        const isVerified = status === 'verified';
        const isRejected = status === 'rejected';

        return (
            <View style={styles.stepContent}>
                <View style={[
                    styles.iconCircle,
                    isVerified && { backgroundColor: '#E1F8EB' },
                    isRejected && { backgroundColor: '#FFF5F5' },
                    status === 'pending' && styles.iconCircleYellow
                ]}>
                    <Ionicons
                        name={isVerified ? "checkmark-circle" : isRejected ? "close-circle" : "time"}
                        size={48}
                        color={isVerified ? "#00C851" : isRejected ? "#EA4335" : "#B8860B"}
                    />
                </View>
                <Text style={styles.stepTitle}>
                    {isVerified ? 'Profile Verified' : isRejected ? 'Verification Rejected' : 'Review in Progress'}
                </Text>
                <Text style={styles.stepDesc}>
                    {isVerified
                        ? 'Your identity has been confirmed. You now have the verified badge on your profile.'
                        : isRejected
                            ? 'Unfortunately, we could not verify your identity. Please ensure your documents are clear and valid.'
                            : 'Your verification request is being processed. This usually takes around 24 hours.'}
                </Text>
                <TouchableOpacity style={styles.nextBtn} onPress={() => isRejected ? handleTryAgain() : router.push('/(tabs)/profile')}>
                    <Text style={styles.nextBtnText}>{isRejected ? 'Try Again' : 'Go Back'}</Text>
                </TouchableOpacity>

                {status === 'pending' && (
                    <TouchableOpacity
                        style={[styles.retryBtn, { marginTop: 16, backgroundColor: 'transparent', borderWidth: 1, borderColor: '#EBEBEB' }]}
                        onPress={checkStatus}
                    >
                        <Text style={[styles.retryText, { color: '#666' }]}>Refresh Status</Text>
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <Stack.Screen options={{ headerShown: false }} />
            {renderHeader()}

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                {status === 'loading' ? (
                    <View style={styles.center}><ActivityIndicator color={BLUE} size="large" /></View>
                ) : (status === 'pending' || status === 'verified' || status === 'rejected') ? (
                    renderStatusScreen(status)
                ) : (
                    <>
                        {step === 0 && renderIntro()}
                        {step === 1 && renderIdType()}
                        {step === 2 && renderUploadDocs()}
                        {step === 3 && renderSelfie()}
                        {step === 4 && renderDetails()}
                        {step === 5 && renderFinished()}
                    </>
                )}
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
    backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#111111' },
    stepContent: { padding: 24, alignItems: 'center', flex: 1 },
    iconCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#F0F4FF', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
    iconCircleYellow: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#FFF9E6', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
    stepTitle: { fontSize: 24, fontWeight: '800', color: '#111111', marginBottom: 12, textAlign: 'center' },
    stepTitleSub: { fontSize: 22, fontWeight: '700', color: '#111111', marginBottom: 8, alignSelf: 'flex-start' },
    stepDesc: { fontSize: 15, color: '#666', textAlign: 'center', lineHeight: 22, marginBottom: 32 },
    infoBox: { flexDirection: 'row', backgroundColor: '#F7FBFF', padding: 16, borderRadius: 12, gap: 12, alignItems: 'center', marginBottom: 40 },
    infoText: { flex: 1, fontSize: 12, color: '#666', lineHeight: 18 },
    primaryBtn: { backgroundColor: '#111111', width: '100%', height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
    primaryBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
    stepLabel: { fontSize: 14, fontWeight: '500', color: '#8A8A8A', alignSelf: 'flex-start', marginBottom: 20 },
    idGrid: { width: '100%', gap: 16, marginBottom: 40 },
    idTypeCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9F9F9', padding: 20, borderRadius: 16, borderWidth: 1.5, borderColor: '#EBEBEB', gap: 16 },
    idTypeCardActive: { borderColor: BLUE, backgroundColor: '#F0F4FF' },
    idTypeText: { fontSize: 16, fontWeight: '700', color: '#8A8A8A' },
    idTypeTextActive: { color: BLUE },
    checkBadge: { width: 22, height: 22, borderRadius: 11, backgroundColor: BLUE, alignItems: 'center', justifyContent: 'center', position: 'absolute', right: 20 },

    // Viewfinder Styles
    viewfinderContainer: {
        width: '100%',
        aspectRatio: 1.58, // Standard ID card ratio
        backgroundColor: '#000',
        borderRadius: 24,
        overflow: 'hidden',
        marginBottom: 24,
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
    },
    camera: {
        flex: 1,
    },
    cameraPlaceholder: {
        flex: 1,
        backgroundColor: '#F5F5F5',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
    },
    retryBtn: {
        backgroundColor: BLUE,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
    },
    retryText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: '700',
    },
    viewfinderFrame: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.3)', // Dim the rest of the feed
    },
    captureIndicator: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(255,255,255,0.3)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#FFF',
    },
    corner: {
        position: 'absolute',
        width: 60,
        height: 60,
        borderColor: '#FFF',
    },
    topLeft: { top: 20, left: 20, borderTopWidth: 5, borderLeftWidth: 5, borderTopLeftRadius: 15 },
    topRight: { top: 20, right: 20, borderTopWidth: 5, borderRightWidth: 5, borderTopRightRadius: 15 },
    bottomLeft: { bottom: 20, left: 20, borderBottomWidth: 5, borderLeftWidth: 5, borderBottomLeftRadius: 15 },
    bottomRight: { bottom: 20, right: 20, borderBottomWidth: 5, borderRightWidth: 5, borderBottomRightRadius: 15 },

    // Selfie Specific Styles
    selfieCameraContainer: {
        width: width - 80,
        height: width - 80,
        borderRadius: (width - 80) / 2,
        overflow: 'hidden',
        backgroundColor: '#000',
        marginBottom: 32,
        borderWidth: 4,
        borderColor: '#F0F4FF',
    },
    selfieOverlay: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    selfieGuide: {
        width: '80%',
        height: '80%',
        borderRadius: 1000,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.5)',
        borderStyle: 'dashed',
    },
    captureIndicatorLarge: {
        position: 'absolute',
        bottom: 20,
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: 'rgba(255,255,255,0.3)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 3,
        borderColor: '#FFF',
    },
    selfiePreviewOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#000',
        alignItems: 'center',
        justifyContent: 'center',
    },
    selfiePreview: {
        width: '100%',
        height: '100%',
    },
    retakeSelfieBtn: {
        position: 'absolute',
        bottom: 20,
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 20,
    },
    retakeSelfieText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '700',
    },

    // Preview Styles
    previewStrip: {
        flexDirection: 'row',
        width: '100%',
        gap: 16,
        marginBottom: 20,
    },
    previewItem: {
        flex: 1,
        height: 80,
        backgroundColor: '#F9F9F9',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#EBEBEB',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
    },
    previewItemActive: {
        borderColor: BLUE,
        backgroundColor: '#F0F4FF',
    },
    previewImage: {
        width: '100%',
        height: '100%',
        borderRadius: 11,
    },
    previewLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: '#8A8A8A',
        position: 'absolute',
        bottom: -20,
    },
    retakeBtn: {
        marginTop: 20,
        padding: 10,
    },
    retakeText: {
        fontSize: 14,
        color: '#8A8A8A',
        fontWeight: '600',
        textDecorationLine: 'underline',
    },

    nextBtn: { backgroundColor: BLUE, width: '100%', height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    nextBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
    btnDisabled: { opacity: 0.5 },
    spacer: { height: 40 },
    formArea: { width: '100%', gap: 20, marginBottom: 40 },
    inputField: { gap: 8 },
    inputLabel: { fontSize: 14, fontWeight: '700', color: '#111111', marginLeft: 4 },
    input: { backgroundColor: '#F5F5F5', borderRadius: 16, padding: 16, borderWidth: 1.5, borderColor: '#EBEBEB', fontSize: 15 },
    successCircle: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#E1F8EB', alignItems: 'center', justifyContent: 'center', marginBottom: 32 },
});

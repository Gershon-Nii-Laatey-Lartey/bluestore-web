import { LocationSelector } from '@/components/LocationSelector';
import { Skeleton } from '@/components/Skeleton';
import { subscriptions } from '@/lib/subscriptions';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { decode } from 'base64-arraybuffer';
import * as Haptics from 'expo-haptics';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    FlatList,
    Image,
    KeyboardAvoidingView,
    Modal,
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

export default function PublishScreen() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);

    // Form State
    const [title, setTitle] = useState('');
    const [price, setPrice] = useState('');
    const [description, setDescription] = useState('');
    const [location, setLocation] = useState('');
    const [category, setCategory] = useState('');
    const [brand, setBrand] = useState('');
    const [condition, setCondition] = useState('Brand New');
    const [selectedImages, setSelectedImages] = useState<{ uri: string, base64: string }[]>([]);
    const [specifiedBrand, setSpecifiedBrand] = useState('');
    const [coords, setCoords] = useState<{ latitude: number, longitude: number } | null>(null);
    const [locationStructured, setLocationStructured] = useState<any | null>(null);
    const [isLocationModalVisible, setIsLocationModalVisible] = useState(false);
    const [isProcessingImages, setIsProcessingImages] = useState(false);
    const [pendingImagesCount, setPendingImagesCount] = useState(0);
    const [userStatus, setUserStatus] = useState<any>(null);

    // Profile Phone
    const [userPhone, setUserPhone] = useState('');

    // DB Data
    const [dbCategories, setDbCategories] = useState<{ id: string, name: string, icon?: string, color?: string }[]>([]);
    const [dbBrands, setDbBrands] = useState<string[]>([]);
    const [conditions] = useState(['Brand New', 'Like New', 'Used - Good', 'Used - Fair', 'Other']);

    // UI Modal Content (Dynamic)
    const [modalVisible, setModalVisible] = useState(false);
    const [modalType, setModalType] = useState<'category' | 'brand' | 'condition'>('category');
    const [modalData, setModalData] = useState<string[]>([]);

    const openModal = (type: 'category' | 'brand' | 'condition') => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setModalType(type);
        if (type === 'category') setModalData(dbCategories.map(c => c.name));
        else if (type === 'condition') setModalData(conditions);
        else if (type === 'brand') setModalData(dbBrands);
        setModalVisible(true);
    };

    useEffect(() => {
        const loadCategories = async () => {
            const { data, error } = await supabase
                .from('categories')
                .select('id, name, icon, color')
                .order('name');
            if (data) setDbCategories(data);
        };
        const fetchUserPhone = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data } = await supabase.from('profiles').select('phone_number').eq('id', user.id).single();
                if (data?.phone_number) setUserPhone(data.phone_number);

                const status = await subscriptions.getUserStatus(user.id);
                setUserStatus(status);
            }
        };
        loadCategories();
        fetchUserPhone();
    }, []);

    useEffect(() => {
        const loadBrands = async () => {
            const selectedCat = dbCategories.find(c => c.name === category);
            if (!selectedCat) return;

            const { data, error } = await supabase
                .from('category_brands')
                .select('brands(name)')
                .eq('category_id', selectedCat.id);

            if (data) {
                const names = data.map((item: any) => item.brands.name);
                const finalBrands = names.includes('Other') ? names : [...names, 'Other'];
                setDbBrands(finalBrands);
            }
        };
        if (category) loadBrands();
    }, [category, dbCategories]);

    const slideAnim = useRef(new Animated.Value(600)).current;

    useEffect(() => {
        if (modalVisible) {
            Animated.spring(slideAnim, {
                toValue: 0,
                friction: 8,
                tension: 50,
                useNativeDriver: true,
            }).start();
        } else {
            slideAnim.setValue(600);
        }
    }, [modalVisible]);

    const handleCloseModal = () => {
        Animated.timing(slideAnim, {
            toValue: 600,
            duration: 250,
            useNativeDriver: true,
        }).start(() => setModalVisible(false));
    };

    const pickImage = async () => {
        if (selectedImages.length >= 10) {
            Alert.alert('Limit Reached', 'You can only upload up to 10 photos.');
            return;
        }

        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Required', 'Please allow access to your photos to upload product images.');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsMultipleSelection: true,
            selectionLimit: 10 - selectedImages.length,
            quality: 0.7,
            base64: true,
        });

        if (!result.canceled && result.assets) {
            setPendingImagesCount(result.assets.length);
            setIsProcessingImages(true);
            const optimizedImages: { uri: string, base64: string }[] = [];
            try {
                for (const asset of result.assets) {
                    const manipResult = await ImageManipulator.manipulateAsync(
                        asset.uri,
                        [{ resize: { width: 1080 } }],
                        { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
                    );

                    if (manipResult.base64) {
                        optimizedImages.push({
                            uri: manipResult.uri,
                            base64: manipResult.base64
                        });
                    }
                }
                setSelectedImages(prev => [...prev, ...optimizedImages].slice(0, 10));
            } catch (error) {
                console.error("Image optimization failed:", error);
                Alert.alert('Error', 'Failed to compress some images');
            } finally {
                setIsProcessingImages(false);
                setPendingImagesCount(0);
                if (optimizedImages.length > 0) {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }
            }
        }
    };

    const resetForm = () => {
        setTitle('');
        setPrice('');
        setDescription('');
        setLocation('');
        setCategory('');
        setBrand('');
        setSpecifiedBrand('');
        setCondition('Brand New');
        setSelectedImages([]);
        setCoords(null);
        setLocationStructured(null);
    };

    const handlePublish = async (isManualDraft = false) => {
        if (!isManualDraft && (!title.trim() || !category || !price.trim() || !location.trim())) {
            Alert.alert('Incomplete Form', 'Title, category, price, and location are required.');
            return;
        }

        if (!isManualDraft && selectedImages.length === 0) {
            Alert.alert('Photos Required', 'Please add at least one photo of your item.');
            return;
        }

        if (!isManualDraft && !description.trim()) {
            Alert.alert('Incomplete Form', 'Please add a description before publishing.');
            return;
        }

        setIsLoading(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                Alert.alert('Not Logged In', 'You must be logged in to post a listing.');
                setIsLoading(false);
                return;
            }

            // Check subscription limits
            const status = await subscriptions.getUserStatus(user.id);
            if (!status.can_publish && !isManualDraft) { // Changed statusToSave !== 'draft' to !isManualDraft
                Alert.alert(
                    'Limit Reached',
                    `You have reached your limit of ${status.limit} active listings on the ${status.package_name} plan.`,
                    [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Upgrade Plan', onPress: () => router.push('/pricing') }
                    ]
                );
                setIsLoading(false);
                return;
            }

            const uploadedUrls: string[] = [];
            for (let i = 0; i < selectedImages.length; i++) {
                const img = selectedImages[i];
                const fileName = `${user.id}/${Date.now()}_${i}.jpg`;

                const { error: uploadError } = await supabase.storage
                    .from('listing_images')
                    .upload(fileName, decode(img.base64), {
                        contentType: 'image/jpeg',
                    });

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                    .from('listing_images')
                    .getPublicUrl(fileName);

                uploadedUrls.push(publicUrl);
            }

            const listingData = {
                user_id: user.id,
                title: title.trim(),
                category,
                price: parseFloat(price),
                condition,
                location: location.trim(),
                description: description.trim(),
                brand: brand === 'Other' ? specifiedBrand.trim() || 'Other' : brand.trim() || 'Generic',
                status: isManualDraft ? 'draft' : 'pending', 
                images: uploadedUrls.length > 0 ? uploadedUrls : ['https://via.placeholder.com/400'],
                tags: [category, brand.trim()].filter(Boolean),
                location_structured: locationStructured ? {
                    ...locationStructured,
                    latitude: coords?.latitude,
                    longitude: coords?.longitude
                } : null,
            };

            const { data: newListing, error } = await supabase
                .from('listings')
                .insert([listingData])
                .select()
                .single();

            if (error) throw error;

            if (isManualDraft) {
                Alert.alert('Draft Saved', 'Your draft has been saved.', [{
                    text: 'Great!',
                    onPress: () => {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        resetForm();
                        router.replace('/(tabs)');
                    }
                }]);
            } else {
                // For live listings, it starts as a draft then goes to promote screen
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                resetForm();
                router.replace({ pathname: '/promote/[id]', params: { id: newListing.id } });
            }

        } catch (error: any) {
            console.error('Publishing Error:', error);
            Alert.alert('Publishing Failed', error.message || 'An unexpected error occurred.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
        >
            <View style={styles.container}>
                <SafeAreaView edges={['top']} style={styles.headerSafe}>
                    <View style={styles.header}>
                        <View style={styles.headerTitleRow}>
                            <TouchableOpacity
                                onPress={() => router.back()}
                                style={styles.backBtn}
                            >
                                <Ionicons name="chevron-back" size={24} color="#111111" />
                            </TouchableOpacity>
                            <Text style={styles.title}>List an Item</Text>
                        </View>
                        <TouchableOpacity style={styles.draftBtn} onPress={() => handlePublish(true)}>
                            <Text style={styles.draftText}>Save Draft</Text>
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>

                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {(selectedImages.length > 0 || isProcessingImages) ? (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 32 }}>
                            {selectedImages.map((img, idx) => (
                                <View key={idx} style={{ marginRight: 12 }}>
                                    <Image source={{ uri: img.uri }} style={{ width: 180, height: 180, borderRadius: 24 }} />
                                    <TouchableOpacity
                                        style={{ position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 16, padding: 6 }}
                                        onPress={() => {
                                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                            setSelectedImages(prev => prev.filter((_, i) => i !== idx));
                                        }}
                                    >
                                        <Ionicons name="close" size={20} color="#FFF" />
                                    </TouchableOpacity>
                                    {idx === 0 ? (
                                        <View style={{ position: 'absolute', bottom: 12, left: 12, backgroundColor: BLUE, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
                                            <Text style={{ color: '#FFF', fontSize: 10, fontWeight: '800' }}>COVER</Text>
                                        </View>
                                    ) : (
                                        <TouchableOpacity
                                            style={{ position: 'absolute', bottom: 12, left: 12, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}
                                            onPress={() => {
                                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                                setSelectedImages(prev => {
                                                    const newArr = [...prev];
                                                    const clickedImg = newArr.splice(idx, 1)[0];
                                                    newArr.unshift(clickedImg);
                                                    return newArr;
                                                });
                                            }}
                                        >
                                            <Text style={{ color: '#FFF', fontSize: 10, fontWeight: '700' }}>MAKE COVER</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            ))}
                            {isProcessingImages && Array.from({ length: pendingImagesCount }).map((_, idx) => (
                                <View key={`pending-${idx}`} style={{ marginRight: 12 }}>
                                    <Skeleton width={180} height={180} borderRadius={24} />
                                </View>
                            ))}
                            {selectedImages.length + pendingImagesCount < 10 && !isProcessingImages && (
                                <TouchableOpacity style={[styles.uploadArea, { width: 180, marginBottom: 0 }]} onPress={pickImage}>
                                    <Ionicons name="add" size={36} color={BLUE} />
                                    <Text style={[styles.uploadTitle, { marginTop: 8, fontSize: 14 }]}>Add More</Text>
                                </TouchableOpacity>
                            )}
                        </ScrollView>
                    ) : (
                        <TouchableOpacity
                            style={styles.uploadArea}
                            onPress={pickImage}
                        >
                            <View style={styles.uploadCircle}>
                                <Ionicons name="camera" size={32} color={BLUE} />
                            </View>
                            <Text style={styles.uploadTitle}>Add Photos</Text>
                            <Text style={styles.uploadSub}>Up to 10 photos. First one is the cover.</Text>
                        </TouchableOpacity>
                    )}

                    <View style={styles.form}>
                        <View style={styles.field}>
                            <Text style={styles.label}>Title</Text>
                            <View style={styles.inputContainer}>
                                <TextInput
                                    placeholder="What are you selling?"
                                    placeholderTextColor="#BABABA"
                                    style={styles.input}
                                    value={title}
                                    onChangeText={setTitle}
                                />
                            </View>
                        </View>

                        <TouchableOpacity style={styles.inputBox} activeOpacity={0.7} onPress={() => openModal('category')}>
                            <View style={styles.inputInner}>
                                <View style={styles.inputLeft}>
                                    <View style={styles.inputIconWrap}>
                                        <Ionicons name="grid-outline" size={18} color="#111111" />
                                    </View>
                                    <View>
                                        <Text style={styles.inputLabel}>Category</Text>
                                        <Text style={styles.inputValue}>{category || 'Select Category'}</Text>
                                    </View>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color="#ABABAB" />
                            </View>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.inputBox} activeOpacity={0.7} onPress={() => openModal('brand')}>
                            <View style={styles.inputInner}>
                                <View style={styles.inputLeft}>
                                    <View style={styles.inputIconWrap}>
                                        <Ionicons name="pricetag-outline" size={18} color="#111111" />
                                    </View>
                                    <View>
                                        <Text style={styles.inputLabel}>Brand</Text>
                                        <Text style={styles.inputValue}>{brand || 'Select Brand'}</Text>
                                    </View>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color="#ABABAB" />
                            </View>
                        </TouchableOpacity>
                        {brand === 'Other' && (
                            <View style={[styles.field, { marginTop: -10 }]}>
                                <Text style={styles.label}>Specify Brand</Text>
                                <View style={styles.inputContainer}>
                                    <TextInput
                                        placeholder="Enter brand name"
                                        placeholderTextColor="#BABABA"
                                        style={styles.input}
                                        value={specifiedBrand}
                                        onChangeText={setSpecifiedBrand}
                                    />
                                </View>
                            </View>
                        )}

                        <View style={styles.row}>
                            <View style={[styles.field, { flex: 1, marginRight: 12 }]}>
                                <Text style={styles.label}>Price</Text>
                                <View style={[styles.inputContainer, styles.priceRow]}>
                                    <Text style={styles.currency}>GH₵</Text>
                                    <TextInput
                                        placeholder="0.00"
                                        placeholderTextColor="#BABABA"
                                        keyboardType="numeric"
                                        style={[styles.input, { flex: 1, paddingLeft: 8 }]}
                                        value={price}
                                        onChangeText={setPrice}
                                    />
                                </View>
                            </View>
                            <View style={[styles.field, { flex: 1 }]}>
                                <Text style={styles.label}>Condition</Text>
                                <TouchableOpacity
                                    style={styles.inputContainer}
                                    onPress={() => openModal('condition')}
                                >
                                    <Text style={styles.selectorText}>{condition}</Text>
                                    <Ionicons name="chevron-down" size={18} color="#BABABA" />
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View style={styles.field}>
                            <Text style={styles.label}>Phone Number</Text>
                            <View style={[styles.inputContainer, { backgroundColor: '#F0F0F0', borderColor: '#E0E0E0' }]}>
                                <Ionicons name="call-outline" size={18} color="#ABABAB" />
                                <TextInput
                                    style={[styles.input, { color: '#8A8A8A', marginLeft: 8 }]}
                                    value={userPhone}
                                    editable={false}
                                    placeholder="Phone number from profile"
                                />
                                <Ionicons name="lock-closed-outline" size={14} color="#BABABA" />
                            </View>
                            <Text style={{ fontSize: 11, color: '#8A8A8A', fontStyle: 'italic', marginLeft: 4 }}>
                                Managed in Profile settings
                            </Text>
                        </View>

                        <View style={styles.field}>
                            <Text style={styles.label}>Location</Text>
                            <TouchableOpacity
                                style={styles.inputContainer}
                                onPress={() => setIsLocationModalVisible(true)}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                    <Ionicons name="location-outline" size={20} color={location ? BLUE : "#BABABA"} />
                                    <Text style={[
                                        styles.input,
                                        { marginLeft: 8, color: location ? '#111111' : '#BABABA' }
                                    ]}>
                                        {location || 'E.g., Accra, Ghana'}
                                    </Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color="#BABABA" />
                            </TouchableOpacity>
                        </View>

                        <LocationSelector
                            visible={isLocationModalVisible}
                            onClose={() => setIsLocationModalVisible(false)}
                            showScopes={false}
                            title="Product Location"
                            onSelect={(data) => {
                                setLocation(data.name || data.address);
                                setCoords({ latitude: data.latitude, longitude: data.longitude });
                                setLocationStructured(data);
                                setIsLocationModalVisible(false);
                            }}
                        />

                        <View style={styles.field}>
                            <Text style={styles.label}>Description</Text>
                            <View style={[styles.inputContainer, { height: 140, alignItems: 'flex-start', paddingTop: 16 }]}>
                                <TextInput
                                    placeholder="Describe your item..."
                                    placeholderTextColor="#BABABA"
                                    multiline
                                    style={[styles.input, { height: '100%' }]}
                                    value={description}
                                    onChangeText={setDescription}
                                    textAlignVertical="top"
                                />
                            </View>
                        </View>

                        <TouchableOpacity
                            style={[styles.publishBtn, isLoading && { opacity: 0.7 }]}
                            onPress={() => handlePublish()}
                            disabled={isLoading}
                        >
                            <LinearGradient
                                colors={['#0057FF', '#0047D5']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={StyleSheet.absoluteFill}
                            />
                            {isLoading ? (
                                <ActivityIndicator color="#FFFFFF" />
                            ) : (
                                <Text style={styles.publishText}>Publish Listing</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                    <View style={{ height: 40 }} />
                </ScrollView>

                <Modal
                    visible={modalVisible}
                    transparent={true}
                    animationType="fade"
                    onRequestClose={handleCloseModal}
                >
                    <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={handleCloseModal}>
                        <Animated.View style={[
                            styles.modalContent,
                            { transform: [{ translateY: slideAnim }] }
                        ]}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>
                                    {modalType === 'category' ? 'Select Category' : modalType === 'brand' ? 'Select Brand' : 'Select Condition'}
                                </Text>
                                <TouchableOpacity onPress={handleCloseModal}>
                                    <Ionicons name="close" size={24} color="#111111" />
                                </TouchableOpacity>
                            </View>
                            <FlatList
                                data={modalData}
                                keyExtractor={(item) => item}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        style={styles.modalOption}
                                        onPress={() => {
                                            if (modalType === 'category') {
                                                setCategory(item);
                                                setBrand('');
                                            }
                                            else if (modalType === 'condition') setCondition(item);
                                            else if (modalType === 'brand') setBrand(item);
                                            handleCloseModal();
                                        }}
                                    >
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                            {modalType === 'category' && (
                                                <View style={{
                                                    width: 32,
                                                    height: 32,
                                                    borderRadius: 8,
                                                    backgroundColor: (dbCategories.find(c => c.name === item)?.color || '#F9F9F9'),
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}>
                                                    <Ionicons name={(dbCategories.find(c => c.name === item)?.icon || 'cube-outline') as any} size={16} color="#111" />
                                                </View>
                                            )}
                                            <Text style={[
                                                styles.modalOptionText,
                                                (modalType === 'category' ? category : modalType === 'brand' ? brand : condition) === item && styles.modalOptionTextActive
                                            ]}>
                                                {item}
                                            </Text>
                                        </View>
                                        {(modalType === 'category' ? category : modalType === 'brand' ? brand : condition) === item && (
                                            <Ionicons name="checkmark" size={20} color={BLUE} />
                                        )}
                                    </TouchableOpacity>
                                )}
                            />
                        </Animated.View>
                    </TouchableOpacity>
                </Modal>
            </View >
        </KeyboardAvoidingView >
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    headerSafe: { backgroundColor: '#FFFFFF' },
    header: { paddingHorizontal: 24, paddingTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#EBEBEB' },
    title: { fontSize: 22, fontWeight: '700', color: '#111111' },
    draftBtn: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#FFFFFF', borderRadius: 50, borderWidth: 1.5, borderColor: '#EBEBEB' },
    draftText: { fontSize: 13, fontWeight: '700', color: '#111111' },
    scrollContent: { paddingHorizontal: 24, paddingBottom: 20 },
    uploadArea: { height: 180, backgroundColor: '#F9F9F9', borderRadius: 24, borderWidth: 1.5, borderColor: '#EBEBEB', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', marginBottom: 32 },
    uploadCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
    uploadTitle: { fontSize: 16, fontWeight: '700', color: '#111111' },
    uploadSub: { fontSize: 13, color: '#8A8A8A', marginTop: 4 },
    form: { gap: 22 },
    field: { gap: 8 },
    label: { fontSize: 14, fontWeight: '700', color: '#111111', marginLeft: 4 },
    inputContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F5F5F5', height: 56, borderRadius: 16, paddingHorizontal: 16, borderWidth: 1.5, borderColor: '#EBEBEB' },
    input: { flex: 1, fontSize: 15, color: '#111111', fontWeight: '500' },
    selectorText: { fontSize: 15, color: '#111111', fontWeight: '500' },
    row: { flexDirection: 'row' },
    inputBox: { backgroundColor: '#F5F5F5', borderRadius: 16, padding: 16, borderWidth: 1.5, borderColor: '#EBEBEB' },
    inputInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    inputLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    inputIconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#EBEBEB' },
    inputLabel: { fontSize: 12, fontWeight: '700', color: '#8A8A8A', textTransform: 'uppercase', letterSpacing: 0.5 },
    inputValue: { fontSize: 15, fontWeight: '600', color: '#111111', marginTop: 2 },
    priceRow: { paddingLeft: 16 },
    currency: { fontSize: 16, fontWeight: '700', color: '#111111' },
    publishBtn: { height: 62, borderRadius: 50, alignItems: 'center', justifyContent: 'center', marginTop: 12, overflow: 'hidden' },
    publishText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, maxHeight: '70%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 18, fontWeight: '700', color: '#111111' },
    modalOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
    modalOptionText: { fontSize: 16, color: '#111111' },
    modalOptionTextActive: { fontWeight: '700', color: BLUE },
});

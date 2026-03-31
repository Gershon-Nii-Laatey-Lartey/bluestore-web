import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    Keyboard,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
const MapView = Platform.OS === 'web' ? View : require('react-native-maps').default;
const PROVIDER_GOOGLE = Platform.OS === 'web' ? null : require('react-native-maps').PROVIDER_GOOGLE;

const { width, height } = Dimensions.get('window');
const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
const BLUE = '#0057FF';

export interface LocationData {
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    city?: string;
    district?: string;
    region?: string;
    country?: string;
}

interface LocationSelectorProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (data: LocationData) => void;
    initialLocation?: { latitude: number; longitude: number };
    showScopes?: boolean;
    title?: string;
}

export const LocationSelector: React.FC<LocationSelectorProps> = ({
    visible,
    onClose,
    onSelect,
    initialLocation,
    showScopes = true, // Default to true as most usage is for filtering
    title = 'Show product from:',
}) => {
    const insets = useSafeAreaInsets();
    const mapRef = useRef<MapView>(null);
    const sheetTranslateY = useSharedValue(height);
    const overlayOpacity = useSharedValue(0);
    const isManualSelection = useRef(false);

    const [region, setRegion] = useState({
        latitude: initialLocation?.latitude || 5.6037,
        longitude: initialLocation?.longitude || -0.1870,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
    });

    const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);
    const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);

    const [searchQuery, setSearchQuery] = useState('');
    const [predictions, setPredictions] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    useEffect(() => {
        if (visible) {
            overlayOpacity.value = withTiming(1, { duration: 300 });
            sheetTranslateY.value = withTiming(0, { duration: 350 });

            (async () => {
                let { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') return;

                let location = await Location.getCurrentPositionAsync({});
                if (!initialLocation) {
                    const newRegion = {
                        ...region,
                        latitude: location.coords.latitude,
                        longitude: location.coords.longitude,
                    };
                    setRegion(newRegion);
                    mapRef.current?.animateToRegion(newRegion, 1000);
                    updateLocationFromCoords(location.coords.latitude, location.coords.longitude);
                }
            })();
        } else {
            overlayOpacity.value = withTiming(0, { duration: 200 });
            sheetTranslateY.value = withTiming(height, { duration: 250 });
        }
    }, [visible]);

    const updateLocationFromCoords = async (lat: number, lng: number) => {
        if (isManualSelection.current) {
            isManualSelection.current = false;
            return;
        }

        setIsReverseGeocoding(true);
        try {
            const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;

            // Nominatim recommends setting a User-Agent
            const response = await fetch(nominatimUrl, {
                headers: {
                    'User-Agent': 'Bluestore/1.0'
                }
            });
            const json = await response.json();

            if (json && json.address) {
                const addr = json.address;

                // Nominatim's specific community fields
                const suburb = addr.neighbourhood || addr.suburb || addr.quarter || addr.city_district || addr.hamlet || addr.village;
                const city = addr.city || addr.town || addr.municipality;
                const district = addr.county || addr.state_district;
                const state = addr.state || addr.region;
                const country = addr.country;

                // Priority for UI display name
                const finalName = (suburb || city || district || json.name || 'Selected Location').toString().trim();

                const addressHierarchy = [
                    suburb !== finalName ? suburb : null,
                    city !== finalName ? city : null,
                    district !== finalName ? district : null,
                    state,
                    country
                ].filter(Boolean);

                const uniqueAddressParts: string[] = [];
                const seen = new Set();
                addressHierarchy.forEach(part => {
                    const norm = part!.toLowerCase().trim();
                    if (!seen.has(norm)) {
                        uniqueAddressParts.push(part!);
                        seen.add(norm);
                    }
                });

                const finalAddress = uniqueAddressParts.join(', ');

                setSelectedLocation({
                    name: finalName,
                    address: finalAddress || json.display_name,
                    latitude: lat,
                    longitude: lng,
                    city: city || undefined,
                    district: district || undefined,
                    region: state || undefined,
                    country: country || undefined,
                });

                setSearchQuery(json.display_name);
            }
        } catch (error) {
            console.error('Nominatim error:', error);
        } finally {
            setIsReverseGeocoding(false);
        }
    };

    const handlePoiClick = async (event: any) => {
        const { name, coordinate } = event.nativeEvent;
        isManualSelection.current = true;

        mapRef.current?.animateToRegion({
            ...region,
            latitude: coordinate.latitude,
            longitude: coordinate.longitude,
        }, 600);

        setIsReverseGeocoding(true);
        try {
            const lat = coordinate.latitude;
            const lng = coordinate.longitude;
            const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;

            const response = await fetch(nominatimUrl, {
                headers: {
                    'User-Agent': 'Bluestore/1.0'
                }
            });
            const json = await response.json();

            if (json && json.address) {
                const addr = json.address;
                const suburb = addr.neighbourhood || addr.suburb || addr.quarter || addr.city_district || addr.hamlet || addr.village;
                const city = addr.city || addr.town || addr.municipality;
                const district = addr.county || addr.state_district;
                const state = addr.state || addr.region;
                const country = addr.country;

                const finalName = (name || suburb || city || district || json.name || 'Selected Location').toString().trim();

                const addressHierarchy = [
                    suburb !== finalName ? suburb : null,
                    city !== finalName ? city : null,
                    district !== finalName ? district : null,
                    state,
                    country
                ].filter(Boolean);

                const uniqueAddressParts: string[] = [];
                const seen = new Set();
                addressHierarchy.forEach(part => {
                    const norm = part!.toLowerCase().trim();
                    if (!seen.has(norm)) {
                        uniqueAddressParts.push(part!);
                        seen.add(norm);
                    }
                });

                const finalAddress = uniqueAddressParts.join(', ');

                setSelectedLocation({
                    name: finalName,
                    address: finalAddress || json.display_name,
                    latitude: lat,
                    longitude: lng,
                    city: city || undefined,
                    district: district || undefined,
                    region: state || undefined,
                    country: country || undefined,
                });
                setSearchQuery(json.display_name);
            }
        } catch (error) {
            console.error('POI Geocoding error:', error);
            setSelectedLocation({
                name: (name || 'Landmark').trim(),
                address: 'Location selected',
                latitude: coordinate.latitude,
                longitude: coordinate.longitude,
            });
        } finally {
            setIsReverseGeocoding(false);
        }
    };

    const handleRegionChangeComplete = (newRegion: any) => {
        setRegion(newRegion);
        updateLocationFromCoords(newRegion.latitude, newRegion.longitude);
    };

    const searchPlaces = async (text: string) => {
        setSearchQuery(text);
        if (text.length < 3) {
            setPredictions([]);
            return;
        }

        setIsSearching(true);
        try {
            const searchUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text)}&format=json&addressdetails=1&limit=5`;
            const response = await fetch(searchUrl, {
                headers: {
                    'User-Agent': 'Bluestore/1.0'
                }
            });
            const json = await response.json();
            setPredictions(json || []);
        } catch (error) {
            console.error('Search error:', error);
        } finally {
            setIsSearching(false);
        }
    };

    const handleSelectPrediction = async (item: any) => {
        setPredictions([]);
        setSearchQuery(item.display_name);
        Keyboard.dismiss();

        isManualSelection.current = true;
        const lat = parseFloat(item.lat);
        const lng = parseFloat(item.lon);

        const newRegion = {
            latitude: lat,
            longitude: lng,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01
        };
        setRegion(newRegion);
        mapRef.current?.animateToRegion(newRegion, 1000);

        const addr = item.address || {};
        const suburb = addr.neighbourhood || addr.suburb || addr.quarter || addr.city_district || addr.hamlet || addr.village;
        const city = addr.city || addr.town || addr.municipality;
        const district = addr.county || addr.state_district;
        const state = addr.state || addr.region;
        const country = addr.country;

        const finalName = (suburb || city || district || item.display_name.split(',')[0]).toString().trim();

        setSelectedLocation({
            name: finalName,
            address: item.display_name,
            latitude: lat,
            longitude: lng,
            city: city || undefined,
            district: district || undefined,
            region: state || undefined,
            country: country || undefined,
        });
    };

    const animatedSheetStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: sheetTranslateY.value }],
    }));

    const animatedOverlayStyle = useAnimatedStyle(() => ({
        opacity: overlayOpacity.value,
    }));

    if (!visible) return null;

    return (
        <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
            <View style={styles.container}>
                <Animated.View style={[styles.overlay, animatedOverlayStyle]}>
                    <TouchableOpacity style={styles.dismissArea} activeOpacity={1} onPress={onClose} />
                </Animated.View>

                <Animated.View style={[styles.sheet, animatedSheetStyle]}>
                    <View style={styles.sheetInner}>

                        {/* Map Content */}
                        <View style={styles.mapContainer}>
                            <MapView
                                ref={mapRef}
                                style={styles.map}
                                provider={PROVIDER_GOOGLE}
                                initialRegion={region}
                                onRegionChangeComplete={handleRegionChangeComplete}
                                onPoiClick={handlePoiClick}
                                showsUserLocation
                                showsMyLocationButton={false}
                            />

                            {/* Center Pin */}
                            <View style={styles.markerFixed} pointerEvents="none">
                                <View style={styles.pinContainer}>
                                    <View style={styles.pinDot} />
                                    <View style={styles.pinLine} />
                                </View>
                            </View>

                            {/* Close Button on Map */}
                            <TouchableOpacity style={styles.mapCloseBtn} onPress={onClose}>
                                <Ionicons name="close" size={22} color="#111" />
                            </TouchableOpacity>

                            {/* My Location Tool */}
                            <TouchableOpacity
                                style={styles.myLocationBtn}
                                onPress={async () => {
                                    let location = await Location.getCurrentPositionAsync({});
                                    mapRef.current?.animateToRegion({
                                        ...region,
                                        latitude: location.coords.latitude,
                                        longitude: location.coords.longitude,
                                    }, 1000);
                                }}
                            >
                                <Ionicons name="navigate" size={20} color="#111" />
                            </TouchableOpacity>
                        </View>

                        {/* Search Bar section at the bottom */}
                        <View style={styles.searchSection}>
                            <View style={styles.searchBar}>
                                <Ionicons name="search" size={20} color="#9BA1A6" style={styles.searchIcon} />
                                <TextInput
                                    placeholder="Search building, street or area"
                                    placeholderTextColor="#9BA1A6"
                                    style={[styles.searchInput, { color: '#111' }]}
                                    value={searchQuery}
                                    onChangeText={searchPlaces}
                                />
                                {isSearching && <ActivityIndicator size="small" color={BLUE} style={{ marginRight: 12 }} />}
                            </View>

                            {predictions.length > 0 && (
                                <View style={styles.predictionsList}>
                                    {predictions.map((item) => {
                                        const parts = item.display_name.split(',');
                                        const mainText = parts[0].trim();
                                        const subText = parts.slice(1).join(',').trim();
                                        return (
                                            <TouchableOpacity
                                                key={item.place_id}
                                                style={styles.predictionRow}
                                                onPress={() => handleSelectPrediction(item)}
                                            >
                                                <View style={styles.locationIconCircle}>
                                                    <Ionicons name="location" size={16} color="#444" />
                                                </View>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={styles.predictionMain} numberOfLines={1}>
                                                        {mainText}
                                                    </Text>
                                                    <Text style={styles.predictionSub} numberOfLines={1}>
                                                        {subText || ''}
                                                    </Text>
                                                </View>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            )}
                        </View>

                        {/* Footer Scoping & Confirm Button */}
                        <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
                            {showScopes && selectedLocation && !isReverseGeocoding && (
                                <View style={styles.scopeContainer}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                                        <Ionicons name="funnel-outline" size={14} color="#666" style={{ marginRight: 6 }} />
                                        <Text style={styles.scopeTitle}>{title}</Text>
                                    </View>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scopeScroll}>
                                        {Array.from(new Set([
                                            selectedLocation.country ? `All ${selectedLocation.country}` : null,
                                            selectedLocation.region,
                                            selectedLocation.city,
                                            selectedLocation.district,
                                            selectedLocation.name
                                        ].filter(Boolean))).map((scopeName, idx) => {
                                            const cleanScope = scopeName!.startsWith('All ') ? scopeName!.replace('All ', '') : scopeName!;
                                            const isSelected = selectedLocation.name === cleanScope;
                                            return (
                                                <TouchableOpacity
                                                    key={idx}
                                                    style={[styles.scopeChip, isSelected && styles.activeScopeChip]}
                                                    onPress={() => {
                                                        setSelectedLocation({ ...selectedLocation, name: cleanScope });
                                                    }}
                                                >
                                                    <Text style={[styles.scopeChipText, isSelected && styles.activeScopeChipText]}>
                                                        {scopeName}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </ScrollView>
                                </View>
                            )}

                            <TouchableOpacity
                                style={[styles.selectBtn, !selectedLocation && styles.disabledBtn]}
                                onPress={() => selectedLocation && onSelect(selectedLocation)}
                                disabled={!selectedLocation || isReverseGeocoding}
                            >
                                {isReverseGeocoding ? (
                                    <ActivityIndicator color="white" />
                                ) : (
                                    <Text style={styles.selectBtnText}>Confirm Location</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    dismissArea: {
        flex: 1,
    },
    sheet: {
        position: 'absolute',
        top: 60,
        left: 0,
        right: 0,
        bottom: -100,
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -10 },
        shadowOpacity: 0.1,
        shadowRadius: 15,
        elevation: 20,
    },
    sheetInner: {
        flex: 1,
        marginBottom: 100,
    },
    searchSection: {
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 20,
        backgroundColor: '#FFF',
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F0F2F5',
        borderRadius: 16,
        paddingHorizontal: 15,
        height: 54,
    },
    searchIcon: {
        marginRight: 10,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        fontWeight: '500',
    },
    predictionsList: {
        marginTop: 10,
        backgroundColor: '#FFF',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#F0F2F5',
        maxHeight: 200,
        overflow: 'hidden',
    },
    predictionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#F5F5F7',
    },
    locationIconCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#F0F2F5',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    predictionMain: {
        fontSize: 15,
        fontWeight: '600',
        color: '#111',
    },
    predictionSub: {
        fontSize: 13,
        color: '#666',
        marginTop: 1,
    },
    mapContainer: {
        flex: 1,
        position: 'relative',
    },
    map: {
        flex: 1,
    },
    markerFixed: {
        left: '50%',
        marginLeft: -16,
        top: '50%',
        marginTop: -38,
        position: 'absolute',
        alignItems: 'center',
    },
    pinContainer: {
        alignItems: 'center',
    },
    pinDot: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: BLUE,
        borderWidth: 4,
        borderColor: 'white',
        shadowColor: BLUE,
        shadowOpacity: 0.3,
        shadowRadius: 10,
    },
    pinLine: {
        width: 3,
        height: 12,
        backgroundColor: BLUE,
        marginTop: -1,
        borderRadius: 1.5,
    },
    myLocationBtn: {
        position: 'absolute',
        right: 15,
        bottom: 15,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'white',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 5,
    },
    scopeContainer: {
        marginBottom: 16,
    },
    scopeTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#666',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    scopeScroll: {
        paddingVertical: 4,
    },
    scopeChip: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: '#F0F2F5',
        marginRight: 10,
        borderWidth: 1,
        borderColor: '#E1E4E8',
    },
    activeScopeChip: {
        backgroundColor: BLUE,
        borderColor: BLUE,
    },
    scopeChipText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#444',
    },
    activeScopeChipText: {
        color: '#FFF',
    },
    mapCloseBtn: {
        position: 'absolute',
        left: 15,
        top: 15,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.9)',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        zIndex: 10,
    },
    footer: {
        backgroundColor: '#FFF',
        paddingHorizontal: 20,
        paddingTop: 20,
        borderTopWidth: 1,
        borderTopColor: '#F0F2F5',
    },
    locationInfo: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 20,
        width: '100%',
    },
    addressWrap: {
        marginLeft: 12,
        width: width - 80,
    },
    addressName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111',
        flexShrink: 1,
    },
    addressFull: {
        fontSize: 13,
        color: '#666',
        marginTop: 2,
        flexShrink: 1,
    },
    selectBtn: {
        backgroundColor: BLUE,
        height: 56,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: BLUE,
        shadowOpacity: 0.2,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 6,
    },
    disabledBtn: {
        backgroundColor: '#E5E5E5',
    },
    selectBtnText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '700',
    },
});

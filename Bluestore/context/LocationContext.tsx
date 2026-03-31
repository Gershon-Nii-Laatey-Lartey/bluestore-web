import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';

interface LocationData {
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    city?: string;
    district?: string;
    region?: string;
    country?: string;
}

interface LocationContextType {
    location: LocationData;
    setLocation: (location: LocationData) => void;
}

const DEFAULT_LOCATION: LocationData = {
    name: 'Accra, Ghana',
    address: 'Accra, Greater Accra, Ghana',
    latitude: 5.6037,
    longitude: -0.1870,
};

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export const LocationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [location, setLocationState] = useState<LocationData>(DEFAULT_LOCATION);

    useEffect(() => {
        // Load persisted search location on mount
        const loadLocation = async () => {
            try {
                const savedSearch = await AsyncStorage.getItem('search_location');
                if (savedSearch) {
                    setLocationState(JSON.parse(savedSearch));
                } else {
                    // Try to fetch current search pref from Supabase if authenticated
                    const { data: { user } } = await supabase.auth.getUser();
                    if (user) {
                        const { data: profile } = await supabase
                            .from('profiles')
                            .select('search_location_structured, location_structured')
                            .eq('id', user.id)
                            .single();

                        const locToUse = profile?.search_location_structured || profile?.location_structured;
                        if (locToUse) {
                            setLocationState(locToUse);
                            await AsyncStorage.setItem('search_location', JSON.stringify(locToUse));
                        }
                    }
                }
            } catch (e) {
                console.error('Failed to load search location', e);
            }
        };
        loadLocation();
    }, []);

    const setLocation = async (newLocation: LocationData) => {
        try {
            setLocationState(newLocation);
            await AsyncStorage.setItem('search_location', JSON.stringify(newLocation));

            // Sync with Supabase profiles.search_location_structured
            // This is ONLY for filtering, doesn't change their home profile
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                await supabase
                    .from('profiles')
                    .update({
                        search_location_structured: newLocation
                    })
                    .eq('id', user.id);
            }
        } catch (e) {
            console.error('Failed to save search location', e);
        }
    };

    return (
        <LocationContext.Provider value={{ location, setLocation }}>
            {children}
        </LocationContext.Provider>
    );
};

export const useLocation = () => {
    const context = useContext(LocationContext);
    if (context === undefined) {
        throw new Error('useLocation must be used within a LocationProvider');
    }
    return context;
};

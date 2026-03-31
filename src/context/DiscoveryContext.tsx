import React, { createContext, useContext, useState, ReactNode } from 'react';

interface Location {
    name: string;
    address: string;
    latitude: number;
    longitude: number;
}

interface DiscoveryContextType {
    selectedLocation: Location | null;
    setDiscoveryLocation: (loc: Location | null) => void;
}

const DiscoveryContext = createContext<DiscoveryContextType | undefined>(undefined);

export const DiscoveryProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [selectedLocation, setSelectedLocation] = useState<Location | null>(() => {
        const saved = localStorage.getItem('@discovery_location');
        return saved ? JSON.parse(saved) : null;
    });

    const setDiscoveryLocation = (loc: Location | null) => {
        setSelectedLocation(loc);
        if (loc) {
            localStorage.setItem('@discovery_location', JSON.stringify(loc));
        } else {
            localStorage.removeItem('@discovery_location');
        }
    };

    return (
        <DiscoveryContext.Provider value={{ selectedLocation, setDiscoveryLocation }}>
            {children}
        </DiscoveryContext.Provider>
    );
};

export const useDiscovery = () => {
    const context = useContext(DiscoveryContext);
    if (context === undefined) {
        throw new Error('useDiscovery must be used within a DiscoveryProvider');
    }
    return context;
};

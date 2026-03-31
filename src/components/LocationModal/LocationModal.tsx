import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Navigation2, MapPin, Map as MapIcon, Layers } from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import './LocationModal.css';

// High-Fidelity Red Teardrop Selector
const customIcon = L.divIcon({
    html: `<div style="
        width: 34px; 
        height: 44px; 
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
    ">
        <svg width="24" height="34" viewBox="0 0 24 34" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path fill-rule="evenodd" clip-rule="evenodd" d="M12 0C5.37258 0 0 5.37258 0 12C0 19.5 12 34 12 34C12 34 24 19.5 24 12C24 5.37258 18.6274 0 12 0Z" fill="#FF4B4B" />
            <circle cx="12" cy="12" r="4" fill="white" />
        </svg>
    </div>`,
    className: 'custom-red-pin',
    iconSize: [24, 34],
    iconAnchor: [12, 34]
});

interface LocationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (location: any) => void;
}

const GHANA_CENTER: [number, number] = [5.6037, -0.1870];
const GOOGLE_HYBRID = "http://mt0.google.com/vt/lyrs=y&hl=en&x={x}&y={y}&z={z}";
const ROAD_LAYER = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

const MapUpdater = ({ center }: { center: [number, number] }) => {
    const map = useMap();
    useEffect(() => {
        // Only set the view if the center has actually changed
        // Use current zoom to prevent "zooming out"
        map.setView(center, Math.max(map.getZoom(), 15));
    }, [center, map]);
    return null;
};

const LocationEvents = ({ onLocationSelect }: { onLocationSelect: (latlng: L.LatLng) => void }) => {
    useMapEvents({
        click(e) {
            onLocationSelect(e.latlng);
        },
    });
    return null;
};

const LocationModal: React.FC<LocationModalProps> = ({ isOpen, onClose, onSelect }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedPos, setSelectedPos] = useState<[number, number]>(GHANA_CENTER);
    const [isSatellite, setIsSatellite] = useState(true);
    const [address, setAddress] = useState('Accra, Ghana');
    const [hierarchy, setHierarchy] = useState<string[]>(['All', 'Ghana', 'Accra']);
    const [isLoading, setIsLoading] = useState(false);

    // Debounced Search Suggestions
    useEffect(() => {
        const timeout = setTimeout(async () => {
            if (searchQuery.length > 2) {
                try {
                    const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5`);
                    const data = await resp.json();
                    setSuggestions(data);
                    setShowSuggestions(true);
                } catch (err) {
                    console.error('Suggestion fetch error:', err);
                }
            } else {
                setSuggestions([]);
                setShowSuggestions(false);
            }
        }, 500);
        return () => clearTimeout(timeout);
    }, [searchQuery]);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        setShowSuggestions(false);
        if (!searchQuery) return;
        setIsLoading(true);
        try {
            const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`);
            const data = await resp.json();
            if (data && data[0]) {
                const newPos: [number, number] = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
                setSelectedPos(newPos);
                
                const addr = data[0].address || {};
                const parts = ['All'];
                if (addr.country) parts.push(addr.country);
                if (addr.city || addr.town || addr.village) parts.push(addr.city || addr.town || addr.village);
                if (addr.suburb || addr.neighbourhood) parts.push(addr.suburb || addr.neighbourhood);
                if (addr.road) parts.push(addr.road);
                
                setHierarchy([...new Set(parts)]);
                setAddress(data[0].display_name);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const reverseGeocode = async (pos: [number, number]) => {
        try {
            const resp = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos[0]}&lon=${pos[1]}&addressdetails=1`);
            const data = await resp.json();
            if (data) {
                const addr = data.address || {};
                const parts = ['All'];
                if (addr.country) parts.push(addr.country);
                if (addr.region || addr.state) parts.push(addr.region || addr.state);
                if (addr.city || addr.town || addr.village) parts.push(addr.city || addr.town || addr.village);
                if (addr.suburb || addr.neighbourhood) parts.push(addr.suburb || addr.neighbourhood);
                
                setHierarchy([...new Set(parts)]);
                setAddress(data.display_name || 'Selected Location');
            }
        } catch (err) { console.error(err); }
    };

    const handleSuggestionClick = (s: any) => {
        const newPos: [number, number] = [parseFloat(s.lat), parseFloat(s.lon)];
        setSelectedPos(newPos);
        setAddress(s.display_name);
        setSearchQuery(s.display_name);
        setShowSuggestions(false);
    };

    const handleMapClick = (latlng: L.LatLng) => {
        const newPos: [number, number] = [latlng.lat, latlng.lng];
        setSelectedPos(newPos);
        reverseGeocode(newPos);
    };

    const handleConfirm = () => {
        onSelect({
            name: address.split(',')[0],
            address,
            latitude: selectedPos[0],
            longitude: selectedPos[1]
        });
        onClose();
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="loc-modal-root">
                    <motion.div 
                        className="loc-modal-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                    />
                    <motion.div 
                        className="loc-modal-sheet"
                        initial={{ translateY: "100%" }}
                        animate={{ translateY: "0%" }}
                        exit={{ translateY: "100%" }}
                        transition={{ type: "spring", damping: 25, stiffness: 200 }}
                    >
                        <div className="loc-modal-inner">
                            {/* Sidebar */}
                            <div className="loc-sidebar">
                                <header className="loc-sidebar-header">
                                    <div className="loc-header-top">
                                        <h2>Select Location</h2>
                                        <button className="loc-close-btn" onClick={onClose}><X size={20} /></button>
                                    </div>
                                    <form className="loc-search-form" onSubmit={handleSearch}>
                                        <div className="loc-search-input-wrap">
                                            <Search size={18} />
                                            <input 
                                                type="text" 
                                                placeholder="Search building, street, or area..." 
                                                value={searchQuery}
                                                onChange={e => setSearchQuery(e.target.value)}
                                                onFocus={() => searchQuery.length > 2 && setShowSuggestions(true)}
                                            />
                                            {showSuggestions && suggestions.length > 0 && (
                                                <div className="loc-search-suggestions">
                                                    {suggestions.map((s, i) => (
                                                        <button 
                                                            key={`${s.place_id}-${i}`} 
                                                            className="loc-suggestion-item"
                                                            onClick={() => handleSuggestionClick(s)}
                                                        >
                                                            <Search size={14} />
                                                            <span className="loc-suggestion-text">{s.display_name}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </form>
                                </header>

                                <div className="loc-sidebar-body">
                                    <div className="loc-current-selection">
                                        <div className="loc-pin-icon-circle">
                                            <MapPin size={20} color="#0057FF" />
                                        </div>
                                        <div className="loc-selection-text">
                                            <label>Currently Selected</label>
                                            <p>{address}</p>
                                        </div>
                                    </div>

                                    <div className="loc-suggested-list">
                                        <span className="section-label">Show products from:</span>
                                        {hierarchy.map(area => (
                                            <button key={area} className="loc-suggested-item" onClick={() => {
                                                setAddress(area);
                                                // If it's a hierarchy click, we might want to search it again to center map
                                                if (area !== 'All') setSearchQuery(area);
                                            }}>
                                                <Navigation2 size={16} />
                                                <span>{area}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <footer className="loc-sidebar-footer">
                                    <button className="loc-confirm-btn" onClick={handleConfirm}>
                                        Confirm Location
                                    </button>
                                </footer>
                            </div>

                            {/* Map View */}
                            <div className="loc-map-view">
                                <div className="map-layer-toggle" onClick={() => setIsSatellite(!isSatellite)}>
                                    <Layers size={20} />
                                    <span>{isSatellite ? 'Road Map' : 'Satellite'}</span>
                                </div>
                                <MapContainer 
                                    center={GHANA_CENTER} 
                                    zoom={15} 
                                    style={{ height: '100%', width: '100%' }}
                                    zoomControl={false}
                                >
                                    <TileLayer url={isSatellite ? GOOGLE_HYBRID : ROAD_LAYER} />
                                    <Marker position={selectedPos} icon={customIcon} />
                                    <MapUpdater center={selectedPos} />
                                    <LocationEvents onLocationSelect={handleMapClick} />
                                </MapContainer>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default LocationModal;

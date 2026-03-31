/**
 * SearchWithHistory.tsx
 * A drop-in search bar with a history dropdown.
 * Reads recent queries from Supabase `search_history` and shows them
 * as suggestions when the input is focused and empty (or partially typed).
 */
import { supabase } from '@/lib/supabase';
import { saveSearchQuery, getCombinedSearchHistory } from '@/lib/tracking';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Animated,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    TextInputProps,
    TouchableOpacity,
    View,
} from 'react-native';

const BLUE = '#0057FF';
const MAX_HISTORY = 8;
const DEFAULT_VISIBLE = 3;

interface Props {
    value: string;
    onChangeText: (v: string) => void;
    onSubmit: (query: string) => void;
    placeholder?: string;
    /** Called when user taps a history item so the parent can navigate */
    onSelectHistory?: (query: string) => void;
    inputProps?: TextInputProps;
    containerStyle?: object;
}

export default function SearchWithHistory({
    value,
    onChangeText,
    onSubmit,
    placeholder = 'Search...',
    onSelectHistory,
    containerStyle,
}: Props) {
    const [isFocused, setIsFocused] = useState(false);
    const [history, setHistory] = useState<string[]>([]);
    const [showAll, setShowAll] = useState(false);
    const dropAnim = useRef(new Animated.Value(0)).current;
    const inputRef = useRef<TextInput>(null);
    // Prevents onBlur from collapsing the dropdown while a row tap is in progress
    const isSelecting = useRef(false);

    // ----- Load history when focused -----
    const loadHistory = useCallback(async () => {
        const data = await getCombinedSearchHistory();
        setHistory(data);
    }, []);

    useEffect(() => {
        if (isFocused) {
            loadHistory();
            setShowAll(false); // reset to collapsed each focus
            Animated.spring(dropAnim, { toValue: 1, useNativeDriver: true, damping: 18, stiffness: 200 }).start();
        } else {
            Animated.timing(dropAnim, { toValue: 0, duration: 160, useNativeDriver: true }).start();
        }
    }, [isFocused]);

    // ----- Filter history to match current text, then slice for display -----
    const filtered = value.trim()
        ? history.filter(h => h.toLowerCase().includes(value.toLowerCase()))
        : history;
    const visible = showAll ? filtered : filtered.slice(0, DEFAULT_VISIBLE);
    const hasMore = filtered.length > DEFAULT_VISIBLE;

    const showDropdown = isFocused && filtered.length > 0;

    // ----- Delete a single history entry -----
    const deleteEntry = async (query: string) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            await supabase
                .from('search_history')
                .delete()
                .eq('user_id', user.id)
                .eq('query', query);
            setHistory(prev => prev.filter(h => h !== query));
        } catch (_) { /* silent */ }
    };

    const clearAll = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            await supabase.from('search_history').delete().eq('user_id', user.id);
            setHistory([]);
        } catch (_) { /* silent */ }
    };

    // ----- Handle submitting the search -----
    const handleSubmit = () => {
        const q = value.trim();
        if (!q) return;
        saveSearchQuery(q);
        setIsFocused(false);
        inputRef.current?.blur();
        onSubmit(q);
    };

    // ----- Select from history -----
    const handleSelect = (query: string) => {
        onChangeText(query);
        saveSearchQuery(query);
        setIsFocused(false);
        inputRef.current?.blur();
        if (onSelectHistory) {
            onSelectHistory(query);
        } else {
            onSubmit(query);
        }
    };

    return (
        <View style={[styles.wrapper, containerStyle]}>
            {/* Full-screen backdrop: closes dropdown when tapping outside */}
            {showDropdown && (
                <Pressable
                    style={styles.backdrop}
                    onPress={() => {
                        setIsFocused(false);
                        inputRef.current?.blur();
                    }}
                />
            )}

            {/* Search Bar */}
            <Pressable
                onPress={() => inputRef.current?.focus()}
                style={[styles.searchBar, isFocused && styles.searchBarFocused]}
            >
                <Ionicons name="search-outline" size={18} color={isFocused ? BLUE : '#ABABAB'} />
                <TextInput
                    ref={inputRef}
                    style={styles.input}
                    placeholder={placeholder}
                    placeholderTextColor="#BABABA"
                    value={value}
                    onChangeText={onChangeText}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => {
                        // If the user is tapping a history row, don't close yet
                        if (isSelecting.current) return;
                        setTimeout(() => setIsFocused(false), 100);
                    }}
                    onSubmitEditing={handleSubmit}
                    returnKeyType="search"
                />
                {value.length > 0 && (
                    <TouchableOpacity onPress={() => { onChangeText(''); }}>
                        <Ionicons name="close-circle" size={18} color="#ABABAB" />
                    </TouchableOpacity>
                )}
            </Pressable>

            {/* Dropdown */}
            {showDropdown && (
                <Animated.View style={[
                    styles.dropdown,
                    {
                        opacity: dropAnim,
                        transform: [{ translateY: dropAnim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }],
                    }
                ]}>
                    {/* Header */}
                    <View style={styles.dropHeader}>
                        <Text style={styles.dropTitle}>Recent Searches</Text>
                        <TouchableOpacity onPress={clearAll}>
                            <Text style={styles.clearAll}>Clear all</Text>
                        </TouchableOpacity>
                    </View>

                    {visible.map((item, idx) => (
                        <View key={item} style={[styles.histRow, idx === visible.length - 1 && !hasMore && { borderBottomWidth: 0 }]}>
                            <TouchableOpacity
                                style={styles.histLeft}
                                activeOpacity={0.7}
                                onPressIn={() => {
                                    isSelecting.current = true;
                                    handleSelect(item);
                                }}
                                onPressOut={() => { isSelecting.current = false; }}
                            >
                                <Ionicons name="time-outline" size={16} color="#ABABAB" style={{ marginRight: 10 }} />
                                <Text style={styles.histText} numberOfLines={1}>{item}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPressIn={() => {
                                    isSelecting.current = true;
                                    deleteEntry(item);
                                }}
                                onPressOut={() => { isSelecting.current = false; }}
                                style={styles.deleteBtn}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                                <Ionicons name="close" size={14} color="#BABABA" />
                            </TouchableOpacity>
                        </View>
                    ))}

                    {/* See more / Show less */}
                    {hasMore && (
                        <TouchableOpacity
                            style={styles.seeMoreRow}
                            onPressIn={() => {
                                isSelecting.current = true;
                                setShowAll(prev => !prev);
                            }}
                            onPressOut={() => { isSelecting.current = false; }}
                        >
                            <Ionicons
                                name={showAll ? 'chevron-up' : 'chevron-down'}
                                size={14}
                                color={BLUE}
                            />
                            <Text style={styles.seeMoreText}>
                                {showAll ? 'Show less' : `See ${filtered.length - DEFAULT_VISIBLE} more`}
                            </Text>
                        </TouchableOpacity>
                    )}
                </Animated.View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: { position: 'relative', zIndex: 100 },
    backdrop: {
        position: 'absolute',
        top: -2000,
        left: -2000,
        right: -2000,
        bottom: -2000,
        zIndex: 99,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F5F5F5',
        height: 48,
        borderRadius: 14,
        paddingHorizontal: 16,
        borderWidth: 1.5,
        borderColor: '#EBEBEB',
        gap: 10,
    },
    searchBarFocused: {
        borderColor: BLUE,
        backgroundColor: '#FAFCFF',
    },
    input: {
        flex: 1,
        fontSize: 14,
        color: '#111111',
        fontFamily: 'Inter_500Medium',
    },
    dropdown: {
        position: 'absolute',
        top: 54,
        left: 0,
        right: 0,
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        borderWidth: 1.5,
        borderColor: '#EBEBEB',
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 6 },
        elevation: 8,
        overflow: 'hidden',
        zIndex: 200,
    },
    seeMoreRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: '#F5F5F5',
    },
    seeMoreText: {
        fontSize: 13,
        fontWeight: '600',
        color: BLUE,
    },
    dropHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F5F5F5',
    },
    dropTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: '#8A8A8A',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    clearAll: {
        fontSize: 12,
        color: BLUE,
        fontWeight: '600',
    },
    histRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 13,
        borderBottomWidth: 1,
        borderBottomColor: '#F9F9F9',
    },
    histLeft: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    histText: {
        fontSize: 14,
        color: '#222222',
        flex: 1,
    },
    deleteBtn: {
        paddingLeft: 12,
    },
});

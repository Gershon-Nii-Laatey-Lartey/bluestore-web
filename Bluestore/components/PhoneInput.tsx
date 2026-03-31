import React, { useState } from 'react';
import {
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import CountryPicker, {
    Country,
    CountryCode,
} from 'react-native-country-picker-modal';

interface PhoneInputProps {
    value: string;
    onChangeText: (text: string) => void;
    onChangeCountry?: (callingCode: string, countryCode: CountryCode) => void;
    focused?: boolean;
    onFocus?: () => void;
    onBlur?: () => void;
    returnKeyType?: 'done' | 'next' | 'go' | 'search' | 'send';
    autoFocus?: boolean;
}

export default function PhoneInput({
    value,
    onChangeText,
    onChangeCountry,
    focused = false,
    onFocus,
    onBlur,
    returnKeyType = 'done',
    autoFocus = false,
}: PhoneInputProps) {
    const [countryCode, setCountryCode] = useState<CountryCode>('GH');
    const [callingCode, setCallingCode] = useState('+233');
    const [pickerVisible, setPickerVisible] = useState(false);

    const handleSelect = (country: Country) => {
        const code = country.callingCode?.[0] ? `+${country.callingCode[0]}` : '';
        setCountryCode(country.cca2);
        setCallingCode(code);
        setPickerVisible(false);
        onChangeCountry?.(code, country.cca2);
    };

    return (
        <View style={[styles.container, focused && styles.containerFocused]}>
            {/* Country picker trigger */}
            <TouchableOpacity
                style={styles.dialBtn}
                onPress={() => setPickerVisible(true)}
                activeOpacity={0.7}
            >
                <CountryPicker
                    countryCode={countryCode}
                    withFlag
                    withCallingCode
                    withFilter
                    withAlphaFilter
                    withEmoji
                    onSelect={handleSelect}
                    visible={pickerVisible}
                    onClose={() => setPickerVisible(false)}
                    containerButtonStyle={styles.pickerContainer}
                    theme={{
                        backgroundColor: '#FFFFFF',
                        onBackgroundTextColor: '#111111',
                        fontSize: 15,
                        fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
                        filterPlaceholderTextColor: '#ABABAB',
                        activeOpacity: 0.7,
                        itemHeight: 52,
                    }}
                />
                <Text style={styles.dialCode}>{callingCode}</Text>
                <Text style={styles.chevron}>›</Text>
                <View style={styles.divider} />
            </TouchableOpacity>

            {/* Number input */}
            <TextInput
                style={styles.input}
                value={value}
                onChangeText={onChangeText}
                onFocus={onFocus}
                onBlur={onBlur}
                placeholder="000 000 0000"
                placeholderTextColor="#BABABA"
                keyboardType="phone-pad"
                returnKeyType={returnKeyType}
                autoFocus={autoFocus}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F5F5F5',
        borderWidth: 1.5,
        borderColor: '#EBEBEB',
        borderRadius: 16,
        paddingRight: 4,
        minHeight: 56,
    },
    containerFocused: {
        borderColor: '#ABABAB',
        backgroundColor: '#FFFFFF',
    },
    dialBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingLeft: 14,
        paddingRight: 4,
        gap: 4,
    },
    pickerContainer: {
        width: 28,
        height: 28,
    },
    dialCode: {
        fontSize: 15,
        fontWeight: '600',
        color: '#111111',
        letterSpacing: 0.2,
    },
    chevron: {
        fontSize: 18,
        color: '#ABABAB',
        marginTop: -1,
        transform: [{ rotate: '90deg' }],
    },
    divider: {
        width: 1,
        height: 22,
        backgroundColor: '#E0E0E0',
        marginLeft: 6,
    },
    input: {
        flex: 1,
        paddingVertical: 16,
        paddingHorizontal: 12,
        fontSize: 16,
        color: '#111111',
        fontWeight: '400',
    },
});

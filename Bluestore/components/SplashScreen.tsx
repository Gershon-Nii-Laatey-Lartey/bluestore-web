import React, { useEffect, useState } from 'react';
import { Animated, Dimensions, StatusBar, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

const { width, height } = Dimensions.get('window');
const TILES_PER_ROW = 4;
const CELL_SIZE = width / TILES_PER_ROW;

const BLUE_PALETTE = [
    '#1E3A8A', // Darkest
    '#2563EB', // Blue 600
    '#3B82F6', // Blue 500
    '#60A5FA', // Blue 400
    '#93C5FD', // Blue 300
    '#DBEAFE', // Lightest
];

const Shape = ({ type, color, size, bgColor }: { type: number; color: string; size: number; bgColor: string }) => {
    const center = size / 2;
    const unit = size / 10;

    switch (type) {
        case 0: // Large Circle
            return <Circle cx={center} cy={center} r={size * 0.35} fill={color} />;
        case 1: // 4 Dots
            return (
                <G fill={color}>
                    <Circle cx={size * 0.3} cy={size * 0.3} r={unit * 0.8} />
                    <Circle cx={size * 0.7} cy={size * 0.3} r={unit * 0.8} />
                    <Circle cx={size * 0.3} cy={size * 0.7} r={unit * 0.8} />
                    <Circle cx={size * 0.7} cy={size * 0.7} r={unit * 0.8} />
                </G>
            );
        case 2: // Diamond
            return <Path d={`M${center} ${unit * 2} L${size - unit * 2} ${center} L${center} ${size - unit * 2} L${unit * 2} ${center} Z`} fill={color} />;
        case 3: // Quarter Circle
            return <Path d={`M${size} 0 A${size} ${size} 0 0 0 0 ${size} L0 0 Z`} fill={color} />;
        case 4: // Half Circle
            return <Path d={`M0 ${center} A${center} ${center} 0 0 1 ${size} ${center} Z`} fill={color} />;
        case 5: // Bars
            return (
                <G fill={color}>
                    <Rect x={unit * 2} y={unit * 3.5} width={unit * 6} height={unit * 1.2} rx={unit * 0.6} />
                    <Rect x={unit * 2} y={unit * 5.3} width={unit * 6} height={unit * 1.2} rx={unit * 0.6} />
                </G>
            );
        case 6: // Triangle
            return <Path d={`M${unit * 3} ${unit * 2.5} L${unit * 7.5} ${center} L${unit * 3} ${unit * 7.5} Z`} fill={color} />;
        case 7: // L shape
            return <Path d={`M${unit * 2.5} ${unit * 2.5} V${unit * 7.5} H${unit * 7.5} V${unit * 5.5} H${unit * 4.5} V${unit * 2.5} Z`} fill={color} />;
        case 8: // 9 Dots
            return (
                <G fill={color}>
                    {[0, 1, 2].map(r => [0, 1, 2].map(c => (
                        <Circle key={`${r}-${c}`} cx={unit * (2.8 + c * 2.2)} cy={unit * (2.8 + r * 2.2)} r={unit * 0.5} />
                    )))}
                </G>
            );
        case 9: // Cut circle
            return (
                <G>
                    <Circle cx={center} cy={center} r={size * 0.35} fill={color} />
                    <Circle cx={center} cy={center} r={size * 0.12} fill={bgColor} />
                </G>
            );
        case 10: // Arrow with line
            return (
                <G fill={color}>
                    <Path d={`M${unit * 2} ${center} H${unit * 8} M${unit * 6} ${unit * 3} L${unit * 8} ${center} L${unit * 6} ${unit * 7}`} stroke={color} strokeWidth={unit * 1.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </G>
            )
        case 11: // Solid Rounded Square
            return <Rect x={unit * 2.5} y={unit * 2.5} width={unit * 5} height={unit * 5} rx={unit} fill={color} />;
        default:
            return null;
    }
};

const PatternTile = ({ x, y, type, bgColorIndex, shapeColorIndex }: { x: number; y: number; type: number; bgColorIndex: number; shapeColorIndex: number }) => {
    const bgColor = BLUE_PALETTE[bgColorIndex % BLUE_PALETTE.length];
    const shapeColor = BLUE_PALETTE[shapeColorIndex % BLUE_PALETTE.length];

    return (
        <G transform={`translate(${x * CELL_SIZE}, ${y * CELL_SIZE})`}>
            <Rect width={CELL_SIZE} height={CELL_SIZE} fill={bgColor} />
            <Shape type={type} color={shapeColor} size={CELL_SIZE} bgColor={bgColor} />
        </G>
    );
};

export default function CustomSplashScreen({ onFinish }: { onFinish: () => void }) {
    const fadeAnim = useState(new Animated.Value(1))[0];
    const contentScale = useState(new Animated.Value(1))[0];
    const contentOpacity = useState(new Animated.Value(1))[0];
    const bgScale = useState(new Animated.Value(1))[0];

    useEffect(() => {
        // Logo scale in
        contentScale.setValue(0.9);
        Animated.spring(contentScale, {
            toValue: 1,
            friction: 8,
            tension: 40,
            useNativeDriver: true,
        }).start();

        const timer = setTimeout(() => {
            // Simplified, faster exit animation
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
            }).start(() => onFinish());
        }, 1800); // Slightly faster overall duration

        return () => clearTimeout(timer);
    }, []);

    const totalRows = Math.ceil(height / CELL_SIZE) + 1;
    const totalCols = TILES_PER_ROW;

    // Manually define a pattern that looks very similar to the reference image
    // Row structure: [ShapeType, BgColorIndex, ShapeColorIndex]
    const patternGrid = [
        [[0, 1, 0], [4, 0, 3], [2, 5, 2], [3, 2, 5]],
        [[1, 3, 1], [5, 2, 0], [11, 1, 3], [7, 4, 1]],
        [[6, 4, 0], [10, 5, 1], [8, 0, 4], [9, 3, 5]],
        [[2, 0, 2], [3, 1, 4], [0, 4, 0], [4, 5, 3]],
        [[11, 2, 5], [7, 3, 1], [1, 5, 2], [6, 1, 4]],
        [[9, 4, 0], [8, 0, 1], [5, 3, 5], [10, 2, 0]],
        [[3, 5, 2], [0, 1, 4], [4, 2, 0], [2, 4, 1]],
        [[7, 0, 3], [11, 3, 5], [6, 5, 1], [1, 2, 4]],
    ];

    return (
        <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
            <StatusBar hidden />
            <Animated.View style={[styles.patternContainer, { transform: [{ scale: bgScale }] }]}>
                <Svg width={width} height={height + CELL_SIZE}>
                    {Array.from({ length: totalRows }).map((_, row) =>
                        Array.from({ length: totalCols }).map((_, col) => {
                            const item = patternGrid[row % patternGrid.length][col % patternGrid[0].length];
                            return (
                                <PatternTile
                                    key={`${row}-${col}`}
                                    x={col}
                                    y={row}
                                    type={item[0]}
                                    bgColorIndex={item[1]}
                                    shapeColorIndex={item[2]}
                                />
                            );
                        })
                    )}
                </Svg>
            </Animated.View>

            <View style={styles.overlay}>
                <Animated.View style={[styles.brandContainer, {
                    transform: [{ scale: contentScale }],
                    opacity: contentOpacity
                }]}>
                    <Text style={styles.appName}>bluestore</Text>
                </Animated.View>

                <Animated.View style={[styles.footer, { opacity: contentOpacity }]}>
                    <Text style={styles.footerText}>AUTHENTIC • BOLD • MINIMAL</Text>
                </Animated.View>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#1E3A8A',
    },
    patternContainer: {
        ...StyleSheet.absoluteFillObject,
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(30, 58, 138, 0.4)', // Dark blue overlay to make text pop
    },
    brandContainer: {
        alignItems: 'center',
    },
    appName: {
        fontSize: 56,
        fontWeight: '900',
        color: '#FFFFFF',
        textTransform: 'lowercase',
        letterSpacing: -2,
    },
    footer: {
        position: 'absolute',
        bottom: 50,
    },
    footerText: {
        fontSize: 9,
        fontWeight: '700',
        color: 'white',
        letterSpacing: 4,
        opacity: 0.8,
    },
});

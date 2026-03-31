import React from 'react';

const BLUE_PALETTE = [
    '#1e3a8a', // Darkest blue 900
    '#1e40af', // Blue 800
    '#2563eb', // Blue 600 (Primary)
    '#3b82f6', // Blue 500
    '#60a5fa', // Blue 400
    '#93c5fd', // Blue 300
    '#dbeafe', // Lightest blue 100
    '#ffffff', // Pure white for high contrast accents
];

const Shape: React.FC<{ type: number; color: string; size: number; bgColor: string }> = ({ type, color, size, bgColor }) => {
    const center = size / 2;
    const unit = size / 10;

    switch (type) {
        case 0: // Large Circle
            return <circle cx={center} cy={center} r={size * 0.35} fill={color} />;
        case 1: // 4 Dots
            return (
                <g fill={color}>
                    <circle cx={size * 0.3} cy={size * 0.3} r={unit * 0.8} />
                    <circle cx={size * 0.7} cy={size * 0.3} r={unit * 0.8} />
                    <circle cx={size * 0.3} cy={size * 0.7} r={unit * 0.8} />
                    <circle cx={size * 0.7} cy={size * 0.7} r={unit * 0.8} />
                </g>
            );
        case 2: // Diamond
            return <path d={`M${center} ${unit * 2} L${size - unit * 2} ${center} L${center} ${size - unit * 2} L${unit * 2} ${center} Z`} fill={color} />;
        case 3: // Quarter Circle
            return <path d={`M${size} 0 A${size} ${size} 0 0 0 0 ${size} L0 0 Z`} fill={color} />;
        case 4: // Half Circle
            return <path d={`M0 ${center} A${center} ${center} 0 0 1 ${size} ${center} Z`} fill={color} />;
        case 5: // Bars
            return (
                <g fill={color}>
                    <rect x={unit * 2} y={unit * 3.5} width={unit * 6} height={unit * 1.2} rx={unit * 0.6} />
                    <rect x={unit * 2} y={unit * 5.3} width={unit * 6} height={unit * 1.2} rx={unit * 0.6} />
                </g>
            );
        case 6: // Triangle
            return <path d={`M${unit * 3} ${unit * 2.5} L${unit * 7.5} ${center} L${unit * 3} ${unit * 7.5} Z`} fill={color} />;
        case 7: // L shape
            return <path d={`M${unit * 2.5} ${unit * 2.5} V${unit * 7.5} H${unit * 7.5} V${unit * 5.5} H${unit * 4.5} V${unit * 2.5} Z`} fill={color} />;
        case 8: // 9 Dots
            return (
                <g fill={color}>
                    {[0, 1, 2].map(r => [0, 1, 2].map(c => (
                        <circle key={`${r}-${c}`} cx={unit * (2.8 + c * 2.2)} cy={unit * (2.8 + r * 2.2)} r={unit * 0.5} />
                    )))}
                </g>
            );
        case 9: // Cut circle
            return (
                <g>
                    <circle cx={center} cy={center} r={size * 0.35} fill={color} />
                    <circle cx={center} cy={center} r={size * 0.12} fill={bgColor} />
                </g>
            );
        case 10: // Arrow with line (Custom simplified)
            return (
                <g fill="none" stroke={color} strokeWidth={unit * 1.2} strokeLinecap="round" strokeLinejoin="round">
                    <path d={`M${unit * 3} ${center} H${unit * 7} M${unit * 5} ${unit * 3} L${unit * 7} ${center} L${unit * 5} ${unit * 7}`} />
                </g>
            )
        case 11: // Solid Rounded Square
            return <rect x={unit * 2.5} y={unit * 2.5} width={unit * 5} height={unit * 5} rx={unit} fill={color} />;
        default:
            return null;
    }
};

const Mosaic: React.FC = () => {
    const TILES_PER_ROW = 8;
    const CELL_SIZE = 100;
    
    const patternGrid = [
        [[0, 1, 0], [4, 0, 4], [2, 2, 2], [3, 2, 5], [1, 5, 1], [11, 0, 7], [8, 2, 3], [7, 4, 0]],
        [[1, 3, 1], [5, 2, 0], [11, 1, 3], [7, 4, 1], [3, 6, 4], [4, 5, 2], [9, 1, 5], [0, 3, 0]],
        [[6, 4, 0], [10, 2, 7], [8, 0, 4], [9, 3, 5], [2, 1, 3], [1, 4, 6], [11, 2, 4], [5, 5, 1]],
        [[2, 0, 2], [3, 1, 4], [0, 4, 0], [4, 5, 3], [10, 6, 2], [7, 3, 1], [6, 2, 5], [9, 7, 4]],
        [[11, 2, 5], [7, 3, 1], [1, 5, 2], [6, 1, 4], [0, 4, 3], [8, 6, 2], [10, 7, 5], [4, 2, 0]],
        [[9, 4, 0], [8, 0, 1], [5, 3, 5], [10, 6, 1], [3, 5, 1], [11, 7, 4], [7, 2, 3], [1, 0, 6]],
        [[3, 5, 2], [0, 1, 4], [4, 6, 0], [2, 4, 1], [8, 7, 0], [6, 5, 1], [10, 1, 4], [9, 2, 5]],
        [[7, 0, 3], [11, 3, 5], [6, 5, 1], [1, 2, 4], [4, 7, 2], [2, 1, 3], [0, 5, 4], [5, 3, 6]],
    ];

    return (
        <div style={{ width: '100%', height: '100%', overflow: 'hidden', background: '#1e3a8a' }}>
            <svg 
                viewBox={`0 0 ${TILES_PER_ROW * CELL_SIZE} ${TILES_PER_ROW * CELL_SIZE}`} 
                preserveAspectRatio="xMidYMid slice"
                style={{ width: '100%', height: '100%' }}
            >
                {patternGrid.map((row, rIdx) => 
                    row.map((item, cIdx) => {
                        const bgColor = BLUE_PALETTE[item[1] % BLUE_PALETTE.length];
                        const shapeColor = BLUE_PALETTE[item[2] % BLUE_PALETTE.length];
                        return (
                            <g key={`${rIdx}-${cIdx}`} transform={`translate(${cIdx * CELL_SIZE}, ${rIdx * CELL_SIZE})`}>
                                <rect width={CELL_SIZE} height={CELL_SIZE} fill={bgColor} />
                                <Shape type={item[0]} color={shapeColor} size={CELL_SIZE} bgColor={bgColor} />
                            </g>
                        );
                    })
                )}
            </svg>
        </div>
    );
};

export default Mosaic;

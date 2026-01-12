export const COLORS = {
    // Backgrounds
    bgDark: '#050505',
    bgCard: '#121212',
    bgSurface: '#1E1E1E',

    // Accents
    primary: '#6C5CE7', // Deep Purple
    secondary: '#FF0080', // Hot Pink
    success: '#00E676', // Neon Green
    error: '#FF2E63', // Neon Red
    warning: '#FFD700', // Gold

    // Text
    textMain: '#FFFFFF',
    textSec: 'rgba(255,255,255,0.7)',
    textMuted: 'rgba(255,255,255,0.4)',

    // UI Elements
    border: 'rgba(255,255,255,0.1)',
    overlay: 'rgba(0,0,0,0.8)',
};

export const GRADIENTS = {
    main: ['#0f0c29', '#302b63', '#24243e'], // Deep Night
    primaryBtn: ['#6C5CE7', '#a363d9'], // Purple Haze
    actionBtn: ['#FF512F', '#DD2476'], // Sunset
    card: ['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.01)'], // Glass
};

export const SPACING = {
    s: 8,
    m: 16,
    l: 24,
    xl: 32,
};

export const COMMON_STYLES = {
    glass: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        backdropFilter: 'blur(10px)', // Web support
    },
    shadow: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    }
};

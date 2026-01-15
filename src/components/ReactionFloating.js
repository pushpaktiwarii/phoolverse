import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Dimensions } from 'react-native';

const EMOJI_LIST = ['😂', '🔥', '❤️', '💀', '😮'];

export default function ReactionFloating({ onReact, reactionStream = [] }) {
    const [floaters, setFloaters] = useState([]);
    const nextId = useRef(0);

    // Handle incoming reactions from other users
    useEffect(() => {
        if (reactionStream.length > 0) {
            const latest = reactionStream[reactionStream.length - 1];
            addFloater(latest.emoji);
        }
    }, [reactionStream]);

    const addFloater = (emoji) => {
        const id = nextId.current++;
        const startX = Math.random() * (Dimensions.get('window').width * 0.8); // Random X position

        setFloaters(prev => [...prev, { id, emoji, startX }]);

        // Auto-remove after animation (approx 2s)
        setTimeout(() => {
            setFloaters(prev => prev.filter(f => f.id !== id));
        }, 2500);
    };

    const handleUserReact = (emoji) => {
        addFloater(emoji); // Show locally instantly
        if (onReact) onReact(emoji); // Send to room
    };

    return (
        <View style={styles.container} pointerEvents="box-none">
            {/* Floating Area */}
            <View style={styles.floatingArea} pointerEvents="none">
                {floaters.map(item => (
                    <FloatingEmoji key={item.id} emoji={item.emoji} startX={item.startX} />
                ))}
            </View>
        </View>
    );
}

const FloatingEmoji = ({ emoji, startX }) => {
    const anim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(anim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
        }).start();
    }, []);

    const translateY = anim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -400], // Float up higher
    });

    const translateX = anim.interpolate({
        inputRange: [0, 0.25, 0.5, 0.75, 1],
        outputRange: [0, 15, -15, 15, 0], // Wobble effect
    });

    const opacity = anim.interpolate({
        inputRange: [0, 0.8, 1],
        outputRange: [1, 1, 0], // Fade out at end
    });

    const scale = anim.interpolate({
        inputRange: [0, 0.2, 1],
        outputRange: [0.5, 1.5, 1], // Pop effect
    });

    return (
        <Animated.Text
            style={[
                styles.floater,
                {
                    left: startX,
                    transform: [{ translateY }, { translateX }, { scale }],
                    opacity
                }
            ]}
        >
            {emoji}
        </Animated.Text>
    );
};

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject, // Cover the parent (video container)
        justifyContent: 'flex-end',
        zIndex: 20, // Ensure it floats above video but below controls if needed
    },
    floatingArea: {
        flex: 1,
        width: '100%',
    },
    floater: {
        position: 'absolute',
        bottom: 100, // Starts above the 80px Footer
        fontSize: 30, // Balanced size
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 3,
    },
    controls: {
        flexDirection: 'row',
        justifyContent: 'center',
        paddingBottom: 10,
        paddingTop: 10,
        // Background gradient or clear? Clear for now to sit over video controls if needed, 
        // but usually this sits separate. Let's make it sit at bottom of video.
    },
    emojiButton: {
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderRadius: 30,
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
        marginHorizontal: 5,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    emojiText: {
        fontSize: 20,
    }
});

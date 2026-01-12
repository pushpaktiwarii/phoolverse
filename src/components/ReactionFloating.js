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
        outputRange: [0, -300], // Float up 300px
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
                    transform: [{ translateY }, { scale }],
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
    },
    floatingArea: {
        flex: 1,
        width: '100%',
    },
    floater: {
        position: 'absolute',
        bottom: 0,
        fontSize: 24,
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

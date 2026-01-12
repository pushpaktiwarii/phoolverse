import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';

export default function RoomChat({ messages = [], onSendMessage, username, overlayMode = false }) {
    const [text, setText] = useState('');
    const flatListRef = useRef(null);

    useEffect(() => {
        if (messages.length > 0) {
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        }
    }, [messages]);

    const handleSend = () => {
        if (!text.trim()) return;
        onSendMessage(text.trim());
        setText('');
    };

    const renderItem = ({ item }) => {
        if (item.system) {
            return (
                <View style={styles.systemMessageContainer}>
                    <Text style={styles.systemMessageText}>{item.text}</Text>
                </View>
            );
        }

        const isMe = item.sender === username;
        return (
            <View style={[styles.messageRow, isMe ? styles.myMessageRow : styles.peerMessageRow]}>
                {!isMe && <Text style={[styles.senderLabel, overlayMode && { color: '#ddd' }]}>{item.sender}</Text>}
                <View style={[
                    styles.bubble,
                    isMe ? styles.myBubble : styles.peerBubble,
                    overlayMode && styles.overlayBubble // Extra transparency in overlay
                ]}>
                    <Text style={styles.messageText}>{item.text}</Text>
                </View>
            </View>
        );
    };

    return (
        <View style={[styles.container, overlayMode && styles.containerOverlay]}>
            <FlatList
                ref={flatListRef}
                data={messages}
                renderItem={renderItem}
                keyExtractor={item => item.id ? item.id.toString() : Math.random().toString()}
                contentContainerStyle={styles.listContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            />

            <View style={[styles.inputContainer, overlayMode && styles.inputContainerOverlay]}>
                <TextInput
                    style={[styles.input, overlayMode && styles.inputOverlay]}
                    value={text}
                    onChangeText={setText}
                    placeholder="Chat..."
                    placeholderTextColor="#ccc"
                    returnKeyType="send"
                    onSubmitEditing={handleSend}
                />
                <TouchableOpacity onPress={handleSend} style={styles.sendButton}>
                    <Text style={styles.sendButtonText}>→</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#121212',
    },
    containerOverlay: {
        backgroundColor: 'rgba(0,0,0,0.6)', // Semi-transparent black
    },
    listContent: {
        padding: 10,
        paddingBottom: 10,
    },
    systemMessageContainer: {
        alignItems: 'center',
        marginVertical: 5,
    },
    systemMessageText: {
        color: '#aaa',
        fontSize: 11,
        fontStyle: 'italic',
        textShadowColor: 'black',
        textShadowRadius: 2,
    },
    messageRow: {
        marginBottom: 6,
        maxWidth: '85%',
    },
    myMessageRow: {
        alignSelf: 'flex-end',
        alignItems: 'flex-end',
    },
    peerMessageRow: {
        alignSelf: 'flex-start',
        alignItems: 'flex-start',
    },
    senderLabel: {
        fontSize: 10,
        color: '#888',
        marginBottom: 2,
        marginLeft: 4,
        fontWeight: 'bold',
    },
    bubble: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 16,
    },
    overlayBubble: {
        backgroundColor: 'rgba(50,50,50,0.8)', // Blur effect simulation
    },
    myBubble: {
        backgroundColor: '#6C5CE7',
        borderBottomRightRadius: 2,
    },
    peerBubble: {
        backgroundColor: '#333',
        borderBottomLeftRadius: 2,
    },
    messageText: {
        color: '#fff',
        fontSize: 14,
    },
    inputContainer: {
        flexDirection: 'row',
        padding: 8,
        borderTopWidth: 1,
        borderTopColor: '#333',
        backgroundColor: '#1E1E1E',
        alignItems: 'center',
    },
    inputContainerOverlay: {
        backgroundColor: 'transparent',
        borderTopColor: 'rgba(255,255,255,0.1)',
    },
    input: {
        flex: 1,
        backgroundColor: '#2C2C2C',
        color: '#fff',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        marginRight: 8,
        fontSize: 14,
    },
    inputOverlay: {
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    sendButton: {
        paddingHorizontal: 10,
    },
    sendButtonText: {
        color: '#6C5CE7',
        fontSize: 20,
        fontWeight: 'bold',
    },
});

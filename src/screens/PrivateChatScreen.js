import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, Image, ActivityIndicator, Alert, Keyboard, AppState } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av'; // Voice Support
import { rtdb, storage } from '../services/firebase';
import { ref, push, onValue, query, limitToLast, serverTimestamp, remove, update, get } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { COLORS, SPACING, COMMON_STYLES } from '../constants/theme';
import { sendPushNotification } from '../services/notificationService';
import { LayoutAnimation, UIManager } from 'react-native';

if (Platform.OS === 'android') {
    if (UIManager.setLayoutAnimationEnabledExperimental) {
        UIManager.setLayoutAnimationEnabledExperimental(true);
    }
}

export default function PrivateChatScreen({ route, navigation }) {
    const { username, recipient } = route.params;
    const [recipientName, setRecipientName] = useState(recipient);
    const [recipientAvatar, setRecipientAvatar] = useState(null); // Added Avatar State
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true); // Track initial load
    const [input, setInput] = useState('');
    const [uploading, setUploading] = useState(false);
    const [recording, setRecording] = useState(null);
    const [isRecording, setIsRecording] = useState(false);
    const [playingSound, setPlayingSound] = useState(null);
    const [replyingTo, setReplyingTo] = useState(null); // New: Reply State

    const flatListRef = useRef(null);
    const chatId = [username, recipient].sort().join('_').replace(/[.#$[\]]/g, '_');
    const [isOnline, setIsOnline] = useState(false);

    const [keyboardHeight, setKeyboardHeight] = useState(0);

    useEffect(() => {
        // Keyboard Handlers
        const showSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (e) => {
            setKeyboardHeight(e.endCoordinates.height);
        });
        const hideSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => {
            setKeyboardHeight(0);
        });

        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, []);

    const [isTyping, setIsTyping] = useState(false);
    const typingTimeoutRef = useRef(null);

    const [recipientLastSeen, setRecipientLastSeen] = useState(0);

    // --- Aggressive Mark Read Strategy ---
    const markRead = useCallback(async () => {
        try {
            // console.log("Marking Read for:", username);
            const ts = serverTimestamp();
            update(ref(rtdb, `chats/${chatId}/meta/${username}`), { lastSeen: ts });
            await AsyncStorage.setItem(`lastSeen_${chatId}`, Date.now().toString());
        } catch (e) { console.log("MarkRead Error", e) }
    }, [chatId, username]);

    // 1. Mark read on Focus (Screen visible)
    useFocusEffect(
        useCallback(() => {
            markRead();

            // 2. Mark read on App Resume
            const sub = AppState.addEventListener('change', nextAppState => {
                if (nextAppState === 'active') markRead();
            });
            return () => sub.remove();
        }, [markRead])
    );

    useEffect(() => {
        // 3. Mark read on Mount (Initial)
        markRead();

        // Listen for Recipient's Last Seen
        const lastSeenRef = ref(rtdb, `chats/${chatId}/meta/${recipient}/lastSeen`);
        const unsubscribeLastSeen = onValue(lastSeenRef, (snapshot) => {
            setRecipientLastSeen(snapshot.val() || 0);
        });

        // Listen for Messages
        const messagesRef = query(ref(rtdb, `chats/${chatId}/messages`), limitToLast(20));
        const unsubscribeMsg = onValue(messagesRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const msgList = Object.entries(data).map(([key, val]) => ({ id: key, ...val }))
                    .sort((a, b) => b.timestamp - a.timestamp);

                // Play Sound/Haptic if new message arrived and not from me
                if (msgList.length > messages.length && msgList[0]?.sender !== username) {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Light);
                }

                setMessages(msgList);
                markRead();
            } else {
                setMessages([]);
            }
            setLoading(false);
        });

        // Listen for Recipient Status & Profile
        const statusRef = ref(rtdb, `users/${recipient}`);
        const unsubscribeStatus = onValue(statusRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                setIsOnline(data.online === true);
                if (data.displayName) setRecipientName(data.displayName);
                if (data.avatarUrl) setRecipientAvatar(data.avatarUrl);
            }
        });

        // Listen for Typing Status
        const typingRef = ref(rtdb, `chats/${chatId}/typing/${recipient}`);
        const unsubscribeTyping = onValue(typingRef, (snapshot) => {
            setIsTyping(snapshot.val() === true);
        });

        Audio.requestPermissionsAsync();

        return () => {
            unsubscribeMsg();
            unsubscribeStatus();
            unsubscribeTyping();
            unsubscribeLastSeen();
            if (playingSound) playingSound.unloadAsync();
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        };
    }, [chatId, recipient, messages.length]); // Added messages.length dependency

    // --- Helpers ---
    const isSameDay = (d1, d2) => {
        const date1 = new Date(d1);
        const date2 = new Date(d2);
        return date1.getDate() === date2.getDate() &&
            date1.getMonth() === date2.getMonth() &&
            date1.getFullYear() === date2.getFullYear();
    };

    const formatDateHeader = (timestamp) => {
        const date = new Date(timestamp);
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        if (isSameDay(date, today)) return "Today";
        if (isSameDay(date, yesterday)) return "Yesterday";
        return date.toLocaleDateString();
    };

    const formatLastSeen = (timestamp) => {
        if (!timestamp) return "Offline";
        const diff = Date.now() - timestamp;
        if (diff < 60000) return "Just now";
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return new Date(timestamp).toLocaleDateString();
    };

    const handleLongPress = (msg) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        Alert.alert("Message Options", "", [
            {
                text: "Reply", onPress: () => {
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    setReplyingTo(msg);
                }
            },
            (msg.sender === username) ? {
                text: "Delete", style: 'destructive', onPress: async () => {
                    await remove(ref(rtdb, `chats/${chatId}/messages/${msg.id}`));
                }
            } : null,
            { text: "Cancel", style: "cancel" }
        ].filter(Boolean));
    };

    const handleTyping = (text) => {
        setInput(text);

        // Update Typing Status
        update(ref(rtdb, `chats/${chatId}/typing`), { [username]: true });

        // Debounce clearing status
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            update(ref(rtdb, `chats/${chatId}/typing`), { [username]: false });
        }, 2000);
    };

    // --- Media & Send Logic (Unchanged but ensuring implementation consistency) ---
    const pickImage = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, items: 1, quality: 0.7 });
        if (!result.canceled) uploadMedia(result.assets[0].uri, 'image');
    };
    const startRecording = async () => {
        try {
            await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
            const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
            setRecording(recording); setIsRecording(true);
        } catch (err) { console.error('Failed to start recording', err); }
    };
    const stopRecording = async () => {
        if (!recording) return;
        setIsRecording(false);
        await recording.stopAndUnloadAsync();
        const uri = recording.getURI();
        setRecording(null);
        uploadMedia(uri, 'audio');
    };
    // Helper to send notification
    const notifyRecipient = async (messageBody) => {
        try {
            console.log(`[DEBUG] Notifying recipient: ${recipient}`);
            const tokenRef = ref(rtdb, `users/${recipient}/pushToken`);
            const snapshot = await get(tokenRef);
            if (snapshot.exists()) {
                const token = snapshot.val();
                console.log(`[DEBUG] Found token for ${recipient}: ${token}`);
                // Fire and forget
                await sendPushNotification(token, username, messageBody, { chatId: chatId });
                console.log(`[DEBUG] Push notification sent request fired.`);
            } else {
                console.log(`[DEBUG] No push token found for user: ${recipient}`);
            }
        } catch (e) {
            console.log("Failed to notify", e);
        }
    };

    // Helper to send notification

    const uploadMedia = async (uri, type) => {
        if (!storage) { Alert.alert("Error", "Storage not ready"); return; }
        setUploading(true);
        try {
            const response = await fetch(uri);
            const blob = await response.blob();
            const ext = type === 'image' ? 'jpg' : 'm4a';
            const filename = `chats/${chatId}/${Date.now()}.${ext}`;
            const fileRef = storageRef(storage, filename);
            await uploadBytes(fileRef, blob);
            const downloadUrl = await getDownloadURL(fileRef);
            const msgRef = ref(rtdb, `chats/${chatId}/messages`);

            // Update sort key for Chat List
            update(ref(rtdb, `chats/${chatId}`), { lastMessageTimestamp: serverTimestamp() });

            await push(msgRef, { mediaUrl: downloadUrl, type: type, sender: username, timestamp: serverTimestamp() });

            // Notify
            notifyRecipient(type === 'image' ? 'Sent an image 📷' : 'Sent a voice note 🎤');

        } catch (e) { Alert.alert("Failed", "Could not send media."); } finally { setUploading(false); }
    };
    const handleSendText = async () => {
        if (!input.trim()) return;
        const text = input.trim();
        const replyContext = replyingTo ? { id: replyingTo.id, text: replyingTo.text, sender: replyingTo.sender } : null;

        setInput('');
        setReplyingTo(null); // Clear Reply
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

        update(ref(rtdb, `chats/${chatId}/typing`), { [username]: false }); // Stop typing immediately

        // Update sort key for Chat List
        update(ref(rtdb, `chats/${chatId}`), { lastMessageTimestamp: serverTimestamp() });

        const msgRef = ref(rtdb, `chats/${chatId}/messages`);
        await push(msgRef, {
            text,
            type: 'text',
            sender: username,
            timestamp: serverTimestamp(),
            replyTo: replyContext
        });

        // Notify
        notifyRecipient(text);
    };
    const playAudio = async (url) => {
        try {
            if (playingSound) { await playingSound.unloadAsync(); setPlayingSound(null); }
            const { sound } = await Audio.Sound.createAsync({ uri: url });
            setPlayingSound(sound);
            await sound.playAsync();
        } catch (e) { console.log("Play error", e); }
    };
    const handleHangout = () => {
        navigation.navigate('Room', { roomId: chatId, isHost: true, username, isPublic: false });
    };

    // --- Render Logic ---
    const INVITE_EXPIRY_MS = 15 * 60 * 1000; // 15 Minutes

    const renderItem = ({ item, index }) => {
        const isMe = item.sender === username;
        // Inverted Logic: Next item in list is OLDER.
        const prevItem = messages[index + 1];
        const showDateHeader = !prevItem || !isSameDay(item.timestamp, prevItem.timestamp);

        const isExpired = item.type === 'invite' && (item.status === 'expired' || (Date.now() - item.timestamp > INVITE_EXPIRY_MS));

        return (
            <View>
                {showDateHeader && (
                    <View style={styles.dateHeader}>
                        <Text style={styles.dateHeaderText}>{formatDateHeader(item.timestamp)}</Text>
                    </View>
                )}

                <TouchableOpacity onLongPress={() => handleLongPress(item)} activeOpacity={0.8}>
                    <View style={[styles.msgBubble, isMe ? styles.msgMe : styles.msgOther]}>

                        {/* Reply Citation */}
                        {item.replyTo && (
                            <View style={[styles.replyCitation, isMe ? { borderLeftColor: 'rgba(255,255,255,0.5)' } : { borderLeftColor: COLORS.primary }]}>
                                <Text style={styles.replySender}>{item.replyTo.sender === username ? "You" : item.replyTo.sender}</Text>
                                <Text style={styles.replyText} numberOfLines={1}>{item.replyTo.text || "Media Attachment"}</Text>
                            </View>
                        )}
                        {/* Image */}
                        {item.type === 'image' && <Image source={{ uri: item.mediaUrl }} style={styles.imageMsg} resizeMode="cover" />}

                        {/* Audio */}
                        {item.type === 'audio' && (
                            <View style={styles.audioContainer}>
                                <TouchableOpacity onPress={() => playAudio(item.mediaUrl)}>
                                    <Ionicons name="play-circle" size={32} color={isMe ? "#fff" : "#6C5CE7"} />
                                </TouchableOpacity>
                                <Text style={{ color: isMe ? '#ddd' : '#444', marginLeft: 8 }}>Voice Note</Text>
                            </View>
                        )}

                        {/* Invite */}
                        {item.type === 'invite' && (
                            <View style={styles.inviteCard}>
                                <Ionicons name="film" size={24} color="#fff" style={{ marginBottom: 5 }} />
                                <Text style={styles.inviteTitle}>Watch Party Invite</Text>
                                <Text style={styles.inviteText}>{item.text}</Text>

                                {isExpired ? (
                                    <Text style={{ color: '#666', fontStyle: 'italic', marginTop: 5 }}>Link Expired (Declined or Timeout)</Text>
                                ) : (
                                    !isMe && (
                                        <View style={styles.inviteActions}>
                                            <TouchableOpacity
                                                style={[styles.inviteBtn, { backgroundColor: '#FF4B4B', marginRight: 10 }]}
                                                onPress={() => {
                                                    Alert.alert("Decline", "Expire this invite?", [
                                                        { text: "Cancel", style: "cancel" },
                                                        { text: "Decline", style: 'destructive', onPress: async () => await update(ref(rtdb, `chats/${chatId}/messages/${item.id}`), { status: 'expired' }) }
                                                    ]);
                                                }}
                                            >
                                                <Text style={styles.btnText}>Decline</Text>
                                            </TouchableOpacity>

                                            <TouchableOpacity
                                                style={[styles.inviteBtn, { backgroundColor: '#4CD964' }]}
                                                onPress={() => navigation.navigate('Room', { roomId: item.roomId, isHost: false, username: username, isPublic: true })}
                                            >
                                                <Text style={styles.btnText}>Accept & Join</Text>
                                            </TouchableOpacity>
                                        </View>
                                    )
                                )}
                                {!isExpired && isMe && <Text style={{ color: '#aaa', marginTop: 5, fontSize: 12 }}>Invite Sent (Expires in 15m)</Text>}
                            </View>
                        )}

                        {/* Text */}
                        {item.type === 'text' && <Text style={styles.msgText}>{item.text}</Text>}

                        <View style={styles.metaRow}>
                            <Text style={[styles.msgTime, isMe ? { color: '#ccc' } : { color: '#888' }]}>
                                {item.timestamp ? new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'}
                            </Text>
                            {isMe && (
                                <Ionicons
                                    name={item.timestamp && item.timestamp <= recipientLastSeen ? "checkmark-done" : "checkmark"}
                                    size={16}
                                    color={item.timestamp && item.timestamp <= recipientLastSeen ? '#4CD964' : 'rgba(255,255,255,0.5)'}
                                    style={{ marginLeft: 4 }}
                                />
                            )}
                        </View>
                    </View>
                </TouchableOpacity>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>

                {/* Profile Image */}
                <View style={[styles.avatarContainer, { borderColor: isOnline ? COLORS.success : COLORS.border }]}>
                    {recipientAvatar ? (
                        <Image source={{ uri: recipientAvatar }} style={styles.headerAvatar} />
                    ) : (
                        <Text style={styles.avatarText}>{recipientName[0]?.toUpperCase()}</Text>
                    )}
                </View>

                <View style={styles.headerInfo}>
                    <Text style={styles.headerTitle}>{recipientName}</Text>
                    <Text style={[styles.subTitle, { color: isTyping ? COLORS.primary : (isOnline ? '#4CD964' : '#888') }]}>
                        {isTyping ? "Typing..." : (isOnline ? "Active Now" : `Last seen ${formatLastSeen(recipientLastSeen)}`)}
                    </Text>
                </View>
                <TouchableOpacity onPress={handleHangout} style={styles.hangoutBtn}>
                    <Ionicons name="film-outline" size={20} color="#fff" />
                </TouchableOpacity>
            </View>

            <View style={{ flex: 1 }}>
                {loading ? (
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                        <ActivityIndicator size="large" color={COLORS.primary} />
                    </View>
                ) : (
                    <FlatList
                        ref={flatListRef}
                        data={messages}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={styles.listContent}
                        renderItem={renderItem}
                        inverted
                        initialNumToRender={15}
                        maxToRenderPerBatch={10}
                        windowSize={10}
                        removeClippedSubviews={Platform.OS === 'android'} // Memory improvement for Android
                        ListEmptyComponent={
                            <View style={{ alignItems: 'center', marginTop: 50, opacity: 0.5, transform: [{ scaleY: -1 }] }}>
                                <Ionicons name="chatbubbles-outline" size={50} color="#ccc" />
                                <Text style={{ color: '#ccc', marginTop: 10 }}>No messages yet</Text>
                            </View>
                        }
                    />
                )}
            </View>

            <View style={[styles.inputContainer, { marginBottom: keyboardHeight + (Platform.OS === 'ios' ? 0 : 10) }]}>
                {/* Reply Preview */}
                {replyingTo && (
                    <View style={styles.replyPreview}>
                        <View style={styles.replyIndication}>
                            <Text style={styles.replyPreviewSender}>Replying to {replyingTo.sender === username ? "Yourself" : replyingTo.sender}</Text>
                            <Text style={styles.replyPreviewText} numberOfLines={1}>{replyingTo.text || "Media"}</Text>
                        </View>
                        <TouchableOpacity onPress={() => {
                            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                            setReplyingTo(null);
                        }}>
                            <Ionicons name="close-circle" size={20} color="#ccc" />
                        </TouchableOpacity>
                    </View>
                )}

                <View style={styles.inputInner}>
                    <TouchableOpacity onPress={pickImage} style={styles.iconBtn} disabled={uploading}>
                        <Ionicons name="images-outline" size={24} color="#999" />
                    </TouchableOpacity>
                    <TouchableOpacity onPressIn={startRecording} onPressOut={stopRecording} style={[styles.iconBtn, isRecording && styles.recordingBtn]} disabled={uploading}>
                        <Ionicons name={isRecording ? "mic" : "mic-outline"} size={24} color={isRecording ? "#fff" : "#999"} />
                    </TouchableOpacity>
                    <TextInput
                        style={[styles.input, { maxHeight: 100 }]}
                        placeholder={isRecording ? "Recording..." : "Message..."}
                        placeholderTextColor="#777"
                        value={input}
                        onChangeText={handleTyping}
                        onFocus={markRead} // 4. Mark read on touching input
                        multiline
                        editable={!isRecording}
                    />
                    <TouchableOpacity style={[styles.sendBtn, (input.trim() || uploading) ? styles.sendBtnActive : null]} onPress={handleSendText} disabled={uploading}>
                        {uploading ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="send" size={20} color={input.trim() ? "#fff" : "#555"} />}
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.bgDark },
    header: {
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.m, paddingVertical: SPACING.s,
        backgroundColor: COLORS.bgSurface, borderBottomWidth: 1, borderBottomColor: COLORS.border,
        paddingTop: Platform.OS === 'android' ? 40 : SPACING.s,
    },
    backBtn: { padding: 4, marginRight: 8 },
    avatarContainer: {
        width: 40, height: 40, borderRadius: 20, borderWidth: 2, marginRight: 10,
        justifyContent: 'center', alignItems: 'center', backgroundColor: '#333', overflow: 'hidden'
    },
    headerAvatar: { width: '100%', height: '100%' },
    avatarText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
    headerInfo: { flex: 1 },
    headerTitle: { color: COLORS.textMain, fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
    subTitle: { fontSize: 11, fontWeight: '600' },
    hangoutBtn: {
        padding: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 20,
        borderWidth: 1, borderColor: COLORS.border
    },
    listContent: { padding: SPACING.m, paddingBottom: 20 },

    // Message Bubbles
    msgBubble: {
        paddingVertical: 10, paddingHorizontal: 14, borderRadius: 18, marginBottom: 2, maxWidth: '75%',
        ...COMMON_STYLES.shadow
    },
    msgMe: { alignSelf: 'flex-end', backgroundColor: COLORS.primary, borderBottomRightRadius: 4 },
    msgOther: { alignSelf: 'flex-start', backgroundColor: COLORS.bgSurface, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: COLORS.border },
    msgText: { color: COLORS.textMain, fontSize: 16 },
    metaRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 4 },
    msgTime: { fontSize: 10, opacity: 0.8 },
    imageMsg: { width: 220, height: 220, borderRadius: 10, backgroundColor: '#000' },
    audioContainer: { flexDirection: 'row', alignItems: 'center', width: 150 },

    // Date Header
    dateHeader: { alignItems: 'center', marginVertical: 15 },
    dateHeaderText: { color: COLORS.textMuted, fontSize: 12, fontWeight: 'bold', backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },

    // Input
    inputContainer: {
        flexDirection: 'column', padding: 0, margin: SPACING.s, borderRadius: 20,
        backgroundColor: COLORS.bgSurface, borderWidth: 1, borderColor: COLORS.border,
        marginBottom: Platform.OS === 'ios' ? 0 : SPACING.s, overflow: 'hidden'
    },
    inputInner: { flexDirection: 'row', alignItems: 'center', padding: SPACING.s },

    // Reply Styles
    replyCitation: {
        borderLeftWidth: 4, paddingLeft: 8, marginBottom: 8, opacity: 0.8,
        backgroundColor: 'rgba(0,0,0,0.1)', paddingVertical: 4, borderRadius: 4
    },
    replySender: { fontSize: 10, fontWeight: 'bold', color: '#fff', opacity: 0.9 },
    replyText: { fontSize: 12, color: '#fff' },

    replyPreview: {
        flexDirection: 'row', alignItems: 'center', padding: 10, backgroundColor: 'rgba(255,255,255,0.05)',
        borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)'
    },
    replyIndication: { flex: 1, borderLeftWidth: 3, borderLeftColor: COLORS.primary, paddingLeft: 8 },
    replyPreviewSender: { color: COLORS.primary, fontWeight: 'bold', fontSize: 12 },
    replyPreviewText: { color: '#ccc', fontSize: 12 },

    iconBtn: { padding: 8, marginRight: 2 },
    recordingBtn: { backgroundColor: COLORS.error, borderRadius: 20 },
    input: { flex: 1, color: COLORS.textMain, paddingHorizontal: 10, fontSize: 16 },
    sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.bgCard, justifyContent: 'center', alignItems: 'center', marginLeft: 4 },
    sendBtnActive: { backgroundColor: COLORS.primary },

    // Invite (Kept simpler in styles block here)
    inviteCard: { backgroundColor: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 12, alignItems: 'center', minWidth: 200, borderWidth: 1, borderColor: COLORS.border },
    inviteTitle: { color: COLORS.warning, fontWeight: 'bold', fontSize: 16, marginBottom: 4 },
    inviteText: { color: COLORS.textSec, fontSize: 14, marginBottom: 12, textAlign: 'center' },
    inviteActions: { flexDirection: 'row', marginTop: 5 },
    inviteBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16 },
    btnText: { color: '#fff', fontWeight: 'bold', fontSize: 12 }
});

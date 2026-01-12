import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, Image, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av'; // Voice Support
import { rtdb, storage } from '../services/firebase';
import { ref, push, onValue, query, limitToLast, serverTimestamp, remove, update } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { COLORS, SPACING, COMMON_STYLES } from '../constants/theme';

export default function PrivateChatScreen({ route, navigation }) {
    const { username, recipient } = route.params;
    const [recipientName, setRecipientName] = useState(recipient);
    const [recipientAvatar, setRecipientAvatar] = useState(null); // Added Avatar State
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [uploading, setUploading] = useState(false);
    const [recording, setRecording] = useState(null);
    const [isRecording, setIsRecording] = useState(false);
    const [playingSound, setPlayingSound] = useState(null);

    const flatListRef = useRef(null);
    const chatId = [username, recipient].sort().join('_').replace(/[.#$[\]]/g, '_');
    const [isOnline, setIsOnline] = useState(false);

    useEffect(() => {
        const markRead = async () => {
            try { await AsyncStorage.setItem(`lastSeen_${chatId}`, Date.now().toString()); } catch (e) { }
        };
        markRead();

        // Listen for Messages
        const messagesRef = query(ref(rtdb, `chats/${chatId}/messages`), limitToLast(50));
        const unsubscribeMsg = onValue(messagesRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                // Convert to array and preserve Keys for deletion
                const msgList = Object.entries(data).map(([key, val]) => ({ id: key, ...val }))
                    .sort((a, b) => b.timestamp - a.timestamp);
                setMessages(msgList);
                markRead();
            } else {
                setMessages([]);
            }
        });

        // Listen for Recipient Status & Profile
        const statusRef = ref(rtdb, `users/${recipient}`);
        const unsubscribeStatus = onValue(statusRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                setIsOnline(data.online === true);
                if (data.displayName) setRecipientName(data.displayName);
                if (data.avatarUrl) setRecipientAvatar(data.avatarUrl); // Set Avatar
            }
        });

        Audio.requestPermissionsAsync();

        return () => {
            unsubscribeMsg();
            unsubscribeStatus();
            if (playingSound) playingSound.unloadAsync();
        };
    }, [chatId, recipient]);

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

    const handleLongPress = (msg) => {
        if (msg.sender !== username) return; // Only delete own messages
        Alert.alert("Delete Message?", "This will remove it for everyone.", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete", style: 'destructive', onPress: async () => {
                    await remove(ref(rtdb, `chats/${chatId}/messages/${msg.id}`));
                }
            }
        ]);
    };

    // --- Media & Send Logic (Unchanged but ensuring implementation consistency) ---
    // (Collapsed for brevity in tool call, ensuring core logic remains)
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
            await push(msgRef, { mediaUrl: downloadUrl, type: type, sender: username, timestamp: serverTimestamp() });
        } catch (e) { Alert.alert("Failed", "Could not send media."); } finally { setUploading(false); }
    };
    const handleSendText = async () => {
        if (!input.trim()) return;
        const text = input.trim();
        setInput('');
        const msgRef = ref(rtdb, `chats/${chatId}/messages`);
        await push(msgRef, { text, type: 'text', sender: username, timestamp: serverTimestamp() });
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
                <TouchableOpacity onLongPress={() => handleLongPress(item)} activeOpacity={0.8}>
                    <View style={[styles.msgBubble, isMe ? styles.msgMe : styles.msgOther]}>
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

                        <Text style={[styles.msgTime, isMe ? { color: '#ccc' } : { color: '#888' }]}>
                            {item.timestamp ? new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'}
                        </Text>
                    </View>
                </TouchableOpacity>

                {showDateHeader && (
                    <View style={styles.dateHeader}>
                        <Text style={styles.dateHeaderText}>{formatDateHeader(item.timestamp)}</Text>
                    </View>
                )}
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
                    <Text style={[styles.subTitle, { color: isOnline ? '#4CD964' : '#888' }]}>
                        {isOnline ? "Active Now" : "Offline"}
                    </Text>
                </View>
                <TouchableOpacity onPress={handleHangout} style={styles.hangoutBtn}>
                    <Ionicons name="film-outline" size={20} color="#fff" />
                </TouchableOpacity>
            </View>

            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}>
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    renderItem={renderItem}
                    inverted
                />

                <View style={styles.inputContainer}>
                    <TouchableOpacity onPress={pickImage} style={styles.iconBtn} disabled={uploading}>
                        <Ionicons name="images-outline" size={24} color="#999" />
                    </TouchableOpacity>
                    <TouchableOpacity onPressIn={startRecording} onPressOut={stopRecording} style={[styles.iconBtn, isRecording && styles.recordingBtn]} disabled={uploading}>
                        <Ionicons name={isRecording ? "mic" : "mic-outline"} size={24} color={isRecording ? "#fff" : "#999"} />
                    </TouchableOpacity>
                    <TextInput style={styles.input} placeholder={isRecording ? "Recording..." : "Message..."} placeholderTextColor="#777" value={input} onChangeText={setInput} onSubmitEditing={handleSendText} editable={!isRecording} />
                    <TouchableOpacity style={[styles.sendBtn, (input.trim() || uploading) ? styles.sendBtnActive : null]} onPress={handleSendText} disabled={uploading}>
                        {uploading ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="send" size={20} color={input.trim() ? "#fff" : "#555"} />}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
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
    msgTime: { fontSize: 10, alignSelf: 'flex-end', marginTop: 4, opacity: 0.8 },
    imageMsg: { width: 220, height: 220, borderRadius: 10, backgroundColor: '#000' },
    audioContainer: { flexDirection: 'row', alignItems: 'center', width: 150 },

    // Date Header
    dateHeader: { alignItems: 'center', marginVertical: 15 },
    dateHeaderText: { color: COLORS.textMuted, fontSize: 12, fontWeight: 'bold', backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },

    // Input
    inputContainer: {
        flexDirection: 'row', padding: SPACING.s, margin: SPACING.s, borderRadius: 30, alignItems: 'center',
        backgroundColor: COLORS.bgSurface, borderWidth: 1, borderColor: COLORS.border,
        marginBottom: Platform.OS === 'ios' ? 0 : SPACING.s
    },
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

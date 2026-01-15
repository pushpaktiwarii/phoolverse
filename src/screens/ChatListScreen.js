import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Image, Alert, StatusBar, InteractionManager, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { rtdb } from '../services/firebase';
import { ref, onValue, query, limitToLast, update, serverTimestamp, get } from 'firebase/database';
import { COLORS, SPACING, COMMON_STYLES } from '../constants/theme';

// ------------------------------------------------------------------
// Sub-Component: ChatListItem
// ------------------------------------------------------------------
const ChatListItem = React.memo(({ currentUser, friend, onPress, lastSeen }) => {
    const [lastMsg, setLastMsg] = useState(null);
    const [unreadCount, setUnreadCount] = useState(0);
    const [recipientLastSeen, setRecipientLastSeen] = useState(0); // State for ticks
    const [loading, setLoading] = useState(true);
    const latestRef = React.useRef(null); // Ref to access latest msg inside other listeners

    const chatId = [currentUser, friend.username].sort().join('_').replace(/[.#$[\]]/g, '_');

    useEffect(() => {
        // Optimised: Fetch last 1 message
        const msgsRef = query(ref(rtdb, `chats/${chatId}/messages`), limitToLast(1));
        const unsubscribe = onValue(msgsRef, (snapshot) => {
            const data = snapshot.val();
            if (data && typeof data === 'object') {
                const values = Object.values(data);
                if (values.length > 0) {
                    const latest = values[0];
                    setLastMsg(latest);
                    latestRef.current = latest; // Store ref for logic check

                    // Check unread against "lastSeen" prop (Initial) OR wait for live listener
                    // We'll let the live listener handle future updates, but set initial here?
                    // Better to just store latest and let the myLastSeen listener do the comparison?
                    // No, myLastSeen listener might fire first.
                    // We need to fetch myLastSeen here inside onValue? No, that's nesting listeners.

                    // We will rely on the separate listener for myLastSeen to trigger the check.
                    // BUT we also need to trigger it here incase message arrives AFTER lastSeen update.

                    get(ref(rtdb, `chats/${chatId}/meta/${currentUser}/lastSeen`)).then(snap => {
                        const mySeen = snap.val() || 0;
                        if (latest.sender !== currentUser && latest.timestamp > mySeen) {
                            setUnreadCount(1);
                        } else {
                            setUnreadCount(0);
                        }
                    });
                } else {
                    setLastMsg(null);
                    setUnreadCount(0);
                }
            } else {
                setLastMsg(null);
                setUnreadCount(0);
            }
            setLoading(false);
        });

        // Listen for Recipient's Last Seen (For Ticks)
        const recipientLastSeenRef = ref(rtdb, `chats/${chatId}/meta/${friend.username}/lastSeen`);
        const subRecipient = onValue(recipientLastSeenRef, (snap) => setRecipientLastSeen(snap.val() || 0));

        // Listen for MY Last Seen (For Unread Count) - Realtime Update
        const myLastSeenRef = ref(rtdb, `chats/${chatId}/meta/${currentUser}/lastSeen`);
        const subMyLastSeen = onValue(myLastSeenRef, (snap) => {
            const mySeen = snap.val() || 0;

            // Re-eval unread when my 'seen' time changes
            if (latestRef.current && latestRef.current.sender !== currentUser && latestRef.current.timestamp > mySeen) {
                setUnreadCount(1);
            } else {
                setUnreadCount(0);
            }
        });

        return () => {
            unsubscribe();
            subRecipient();
            subMyLastSeen();
        };
    }, [chatId, friend.username, currentUser]); // Removed 'lastSeen' prop dependency as we fetch it live

    const formatTime = (timestamp) => {
        if (!timestamp) return '';
        const now = new Date();
        const date = new Date(timestamp);
        if (now.toDateString() === date.toDateString()) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        return date.toLocaleDateString();
    };

    return (
        <TouchableOpacity style={styles.cardContainer} onPress={onPress} activeOpacity={0.9}>
            <LinearGradient
                colors={['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.02)']}
                style={styles.cardGradient}
            >
                <View style={[styles.avatar, friend.online ? styles.avatarOnline : styles.avatarOffline]}>
                    <Text style={styles.avatarText}>
                        {((friend.displayName || friend.username) && (friend.displayName || friend.username)[0])
                            ? (friend.displayName || friend.username)[0].toUpperCase()
                            : '?'}
                    </Text>
                </View>
                <View style={styles.userInfo}>
                    <View style={styles.topRow}>
                        <Text style={styles.username}>{friend.displayName || friend.username}</Text>
                        {lastMsg && <Text style={[styles.time, unreadCount > 0 && styles.timeUnread]}>{formatTime(lastMsg.timestamp)}</Text>}
                    </View>
                    <View style={styles.bottomRow}>
                        {loading ? (
                            <View style={{ height: 14, width: '60%', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 4, marginTop: 4 }} />
                        ) : (
                            <>
                                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                    {lastMsg && lastMsg.sender === currentUser && (
                                        <Ionicons
                                            name={(lastMsg.timestamp && lastMsg.timestamp <= recipientLastSeen) || friend.online ? "checkmark-done" : "checkmark"}
                                            size={16}
                                            color={lastMsg.timestamp && lastMsg.timestamp <= recipientLastSeen ? '#4CD964' : '#888'}
                                            style={{ marginRight: 4 }}
                                        />
                                    )}
                                    <Text style={[styles.lastMessage, unreadCount > 0 && styles.msgUnreadText]} numberOfLines={1}>
                                        {lastMsg ? (
                                            lastMsg.type === 'invite' ? '🎫 Invited you to a Room' :
                                                lastMsg.type === 'image' ? '📷 Sent an image' :
                                                    lastMsg.type === 'audio' ? '🎤 Sent a voice note' :
                                                        (lastMsg.sender === currentUser ? 'You: ' : '') + lastMsg.text
                                        ) : (
                                            <Text style={styles.emptyMsg}>Start a conversation</Text>
                                        )}
                                    </Text>
                                </View>
                                {unreadCount > 0 && (
                                    <View style={styles.unreadBadge}>
                                        <Text style={styles.unreadText}>
                                            {unreadCount > 9 ? '9+' : unreadCount}
                                        </Text>
                                    </View>
                                )}
                            </>
                        )}
                    </View>
                </View>
            </LinearGradient>
        </TouchableOpacity>
    );
}, (prevProps, nextProps) => {
    // Only re-render if key props change
    return (
        prevProps.friend.username === nextProps.friend.username &&
        prevProps.friend.online === nextProps.friend.online &&
        prevProps.friend.displayName === nextProps.friend.displayName &&
        prevProps.lastSeen === nextProps.lastSeen
    );
});

// ------------------------------------------------------------------
// Main Screen: ChatListScreen
// ------------------------------------------------------------------
export default function ChatListScreen({ navigation, route }) {
    const username = route.params?.username;
    const [users, setUsers] = useState([]);
    const [lastSeenMap, setLastSeenMap] = useState({});
    const [lastMsgMap, setLastMsgMap] = useState({}); // New Map for Sorting
    const [isListLoading, setIsListLoading] = useState(true);

    // ... useFocusEffect (unchanged) ...

    useEffect(() => {
        if (!username) return;

        // 1. Cache-First Strategy
        const loadCache = async () => {
            try {
                const cached = await AsyncStorage.getItem('cached_users');
                if (cached) {
                    const parsed = JSON.parse(cached);
                    if (parsed && parsed.length > 0) setUsers(parsed);
                }
            } catch (e) { }
        };
        loadCache();

        // 2. Listen for Chat Sort Keys (Timestamp) for ALL chats
        // Since we don't have a "My Chats" list, we simulate it by listening to 'chats' root 
        // effectively or simpler: just fetch sorting keys.
        // Better Optimization: Listen to `chats` but that's heavy. 
        // Given small user base: Listen to 'users', then for each user, listen to their specific chat pair.
        // Actually, listing to 'chats' root is the only way to get updates without N listeners.
        // But 'chats' root has MESSAGES too. That is too heavy.
        // Correction: We only updated `chats/{chatId}/lastMessageTimestamp`, which is light.
        // But `onValue(ref(rtdb, 'chats'))` will download everything including messages. BAD.

        // Strategy: Iterate users (Client Side Join)
        // We do this INSIDE the users listener below.

        const usersRef = ref(rtdb, 'users');
        const unsubscribe = onValue(usersRef, (snapshot) => {
            const data = snapshot.val();
            if (data && typeof data === 'object') {
                const rawList = Object.values(data).filter(u => u && u.username && u.username !== username);

                // Now we need to attach Last Msg Timestamps
                // We'll create listeners for each chat pair ID
                rawList.forEach(u => {
                    const cId = [username, u.username].sort().join('_').replace(/[.#$[\]]/g, '_');
                    const tsRef = ref(rtdb, `chats/${cId}/lastMessageTimestamp`);

                    // Using 'onValue' here might be leak-prone if list changes. 
                    // Ideally we keep a map of unsubscribes. For now, simple strict callback.
                    onValue(tsRef, (snap) => {
                        const ts = snap.val() || 0;
                        setLastMsgMap(prev => ({ ...prev, [u.username]: ts }));
                    });
                });

                // Sorting happens in Render or Effect dependency? 
                // Since `lastMsgMap` updates async, we sort whenever `lastMsgMap` or `users` changes.
                // We'll store raw list here and sort in a separate Effect/Memo?
                // Simpler: Just set them, and handle sorting in the 2nd Effect below.
                setUsers(rawList);

                AsyncStorage.setItem('cached_users', JSON.stringify(rawList)).catch(e => { });
            } else {
                setUsers([]);
            }
            setIsListLoading(false);
        });
        return () => unsubscribe();
    }, [username]);

    // 3. Sorting Effect: Triggered when Users OR Timestamps change
    const sortedUsers = React.useMemo(() => {
        return [...users].sort((a, b) => {
            const timeA = lastMsgMap[a.username] || 0;
            const timeB = lastMsgMap[b.username] || 0;

            if (timeA !== timeB) return timeB - timeA; // Newest First (WhatsApp Style)

            // Tie-breaker 2: Alphabetical
            return (a.displayName || a.username).localeCompare(b.displayName || b.username);
        });
    }, [users, lastMsgMap]);

    const handleOpenChat = (recipient) => {
        navigation.navigate('PrivateChat', { username, recipient: recipient.username });
    };

    const handleLogout = async () => {
        Alert.alert(
            "Logout",
            "Are you sure you want to exit the Verse?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Logout",
                    style: 'destructive',
                    onPress: async () => {
                        // Set Offline
                        const userRef = ref(rtdb, `users/${username}`);
                        await update(userRef, { online: false, lastSeen: serverTimestamp() });

                        // Clear Local Storage
                        await AsyncStorage.clear(); // Clears everything including chat history pointers

                        navigation.reset({
                            index: 0,
                            routes: [{ name: 'Login' }],
                        });
                    }
                }
            ]
        );
    };

    return (
        <View style={styles.container}>

            <SafeAreaView style={styles.safeArea}>
                <View style={styles.header}>
                    <View>
                        <Text style={styles.headerTitle}>PHOOLVERSE</Text>
                        <Text style={styles.subTitle}>@{username} • Online</Text>
                    </View>
                    <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
                        <Ionicons name="power-outline" size={24} color="#ff4b4b" />
                    </TouchableOpacity>
                </View>

                <FlatList
                    data={sortedUsers}
                    keyExtractor={(item) => item.username}
                    ListEmptyComponent={
                        isListLoading ? (
                            <View style={{ marginTop: 100, alignItems: 'center' }}>
                                <ActivityIndicator size="large" color={COLORS.primary} />
                                <Text style={{ marginTop: 15, color: COLORS.textMuted, fontSize: 12, letterSpacing: 1 }}>
                                    INITIALIZING VERSE...
                                </Text>
                            </View>
                        ) : (
                            <View style={styles.emptyContainer}>
                                <Ionicons name="planet-outline" size={64} color="rgba(255,255,255,0.2)" />
                                <Text style={styles.emptyText}>The Verse is Empty</Text>
                                <Text style={styles.subEmptyText}>Wait for others to join.</Text>
                            </View>
                        )
                    }
                    renderItem={({ item }) => {
                        const chatId = [username, item.username].sort().join('_').replace(/[.#$[\]]/g, '_');
                        return (
                            <ChatListItem
                                currentUser={username}
                                friend={item}
                                onPress={() => handleOpenChat(item)}
                                lastSeen={lastSeenMap[chatId] || 0}
                            />
                        );
                    }}
                    contentContainerStyle={{ paddingBottom: 20, paddingTop: 10 }}
                    initialNumToRender={10}
                    maxToRenderPerBatch={5}
                    windowSize={5}
                    removeClippedSubviews={Platform.OS === 'android'}
                />
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1, backgroundColor: COLORS.bgDark
    },
    safeArea: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: SPACING.l,
        paddingBottom: SPACING.m,
        paddingTop: SPACING.s,
    },
    headerTitle: {
        color: COLORS.textMain,
        fontSize: 24,
        fontWeight: '800',
        letterSpacing: 2,
    },
    subTitle: {
        color: COLORS.textSec,
        fontSize: 12,
        fontWeight: '600',
        marginTop: 4,
    },
    logoutBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,46,99,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.error,
    },
    cardContainer: {
        marginHorizontal: SPACING.m,
        marginBottom: SPACING.s,
        borderRadius: 16,
        overflow: 'hidden',
        ...COMMON_STYLES.glass,
        ...COMMON_STYLES.shadow,
    },
    cardGradient: {
        flexDirection: 'row',
        padding: SPACING.m,
        alignItems: 'center',
    },
    emptyContainer: {
        padding: 50,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 80,
    },
    emptyText: {
        color: COLORS.textMain,
        fontSize: 20,
        fontWeight: 'bold',
        marginTop: 20,
    },
    subEmptyText: {
        color: COLORS.textMuted,
        fontSize: 14,
        marginTop: 8,
    },
    avatar: {
        width: 54,
        height: 54,
        borderRadius: 27,
        backgroundColor: COLORS.bgSurface,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: SPACING.m,
        borderWidth: 2,
    },
    avatarOnline: {
        borderColor: COLORS.success,
    },
    avatarOffline: {
        borderColor: COLORS.border,
    },
    avatarText: {
        color: COLORS.textMain,
        fontSize: 22,
        fontWeight: '700',
    },
    userInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    topRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    bottomRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    username: {
        color: COLORS.textMain,
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    time: {
        color: COLORS.textMuted,
        fontSize: 11,
        fontWeight: '500',
    },
    timeUnread: {
        color: COLORS.success,
        fontWeight: '700',
    },
    lastMessage: {
        color: COLORS.textSec,
        fontSize: 14,
        flex: 1,
        marginRight: 10,
    },
    msgUnreadText: {
        color: COLORS.textMain,
        fontWeight: '600',
    },
    emptyMsg: {
        fontStyle: 'italic',
        color: COLORS.textMuted,
        fontSize: 12,
    },
    loadingText: {
        color: COLORS.textMuted,
    },
    unreadBadge: {
        backgroundColor: COLORS.success,
        borderRadius: 10,
        paddingHorizontal: 6,
        paddingVertical: 2,
        minWidth: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 8,
    },
    unreadText: {
        color: '#000',
        fontSize: 10,
        fontWeight: 'bold',
    },
});

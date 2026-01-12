import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Image, Alert, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { rtdb } from '../services/firebase';
import { ref, onValue, query, limitToLast, update, serverTimestamp } from 'firebase/database';
import { COLORS, SPACING, COMMON_STYLES } from '../constants/theme';

// ------------------------------------------------------------------
// Sub-Component: ChatListItem
// ------------------------------------------------------------------
const ChatListItem = ({ currentUser, friend, onPress, lastSeenMap }) => {
    const [lastMsg, setLastMsg] = useState(null);
    const [loading, setLoading] = useState(true);

    const chatId = [currentUser, friend.username].sort().join('_');
    const lastSeen = lastSeenMap[chatId] || 0;

    useEffect(() => {
        const msgsRef = query(ref(rtdb, `chats/${chatId}/messages`), limitToLast(1));
        const unsubscribe = onValue(msgsRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                setLastMsg(Object.values(data)[0]);
            } else {
                setLastMsg(null);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [chatId]);

    const formatTime = (timestamp) => {
        if (!timestamp) return '';
        const now = new Date();
        const date = new Date(timestamp);
        if (now.toDateString() === date.toDateString()) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        return date.toLocaleDateString();
    };

    const isUnread = lastMsg && lastMsg.sender !== currentUser && lastMsg.timestamp > lastSeen;

    return (
        <TouchableOpacity style={styles.cardContainer} onPress={onPress} activeOpacity={0.9}>
            <LinearGradient
                colors={['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.02)']}
                style={styles.cardGradient}
            >
                <View style={[styles.avatar, friend.online ? styles.avatarOnline : styles.avatarOffline]}>
                    <Text style={styles.avatarText}>{(friend.displayName || friend.username)[0].toUpperCase()}</Text>
                </View>
                <View style={styles.userInfo}>
                    <View style={styles.topRow}>
                        <Text style={styles.username}>{friend.displayName || friend.username}</Text>
                        {lastMsg && <Text style={[styles.time, isUnread && styles.timeUnread]}>{formatTime(lastMsg.timestamp)}</Text>}
                    </View>
                    <View style={styles.bottomRow}>
                        {loading ? (
                            <Text style={styles.loadingText}>...</Text>
                        ) : (
                            <>
                                <Text style={[styles.lastMessage, isUnread && styles.msgUnreadText]} numberOfLines={1}>
                                    {lastMsg ? (
                                        lastMsg.type === 'invite' ? '🎫 Invited you to a Room' :
                                            lastMsg.type === 'image' ? '📷 Sent an image' :
                                                lastMsg.type === 'audio' ? '🎤 Sent a voice note' :
                                                    (lastMsg.sender === currentUser ? 'You: ' : '') + lastMsg.text
                                    ) : (
                                        <Text style={styles.emptyMsg}>Start a conversation</Text>
                                    )}
                                </Text>
                                {isUnread && <View style={styles.unreadDot} />}
                            </>
                        )}
                    </View>
                </View>
            </LinearGradient>
        </TouchableOpacity>
    );
};

// ------------------------------------------------------------------
// Main Screen: ChatListScreen
// ------------------------------------------------------------------
export default function ChatListScreen({ navigation, route }) {
    const username = route.params?.username;
    const [users, setUsers] = useState([]);
    const [lastSeenMap, setLastSeenMap] = useState({});

    useFocusEffect(
        useCallback(() => {
            const loadReadStatus = async () => {
                try {
                    const keys = await AsyncStorage.getAllKeys();
                    const chatKeys = keys.filter(k => k.startsWith('lastSeen_'));
                    const stores = await AsyncStorage.multiGet(chatKeys);
                    const newMap = {};
                    stores.forEach(([key, val]) => {
                        const realKey = key.replace('lastSeen_', '');
                        newMap[realKey] = parseInt(val) || 0;
                    });
                    setLastSeenMap(newMap);
                } catch (e) {
                    console.log("Read status load error", e);
                }
            };
            loadReadStatus();
        }, [])
    );

    useEffect(() => {
        if (!username) return;
        const usersRef = ref(rtdb, 'users');
        const unsubscribe = onValue(usersRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const userList = Object.values(data).filter(u => u.username !== username);
                setUsers(userList);
            } else {
                setUsers([]);
            }
        });
        return () => unsubscribe();
    }, [username]);

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
                    data={users}
                    keyExtractor={(item) => item.username}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Ionicons name="planet-outline" size={64} color="rgba(255,255,255,0.2)" />
                            <Text style={styles.emptyText}>The Verse is Empty</Text>
                            <Text style={styles.subEmptyText}>Wait for others to join.</Text>
                        </View>
                    }
                    renderItem={({ item }) => (
                        <ChatListItem
                            currentUser={username}
                            friend={item}
                            onPress={() => handleOpenChat(item)}
                            lastSeenMap={lastSeenMap}
                        />
                    )}
                    contentContainerStyle={{ paddingBottom: 20, paddingTop: 10 }}
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
    unreadDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: COLORS.success,
        shadowColor: COLORS.success,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 5,
    },
});

import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { rtdb } from '../services/firebase';
import { ref, onValue } from 'firebase/database';
import { COLORS, COMMON_STYLES, SPACING } from '../constants/theme';

export default function LobbyScreen({ route, navigation }) {
    const { username } = route.params;
    const [publicRooms, setPublicRooms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [avatarUrl, setAvatarUrl] = useState(null);
    const [displayName, setDisplayName] = useState(username);

    useEffect(() => {
        // Fetch Profile
        const userRef = ref(rtdb, `users/${username}`);
        onValue(userRef, (snap) => {
            const data = snap.val();
            if (data) {
                setAvatarUrl(data.avatarUrl);
                setDisplayName(data.displayName || username);
            }
        });

        const publicRef = ref(rtdb, 'public_rooms');
        const unsubscribe = onValue(publicRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const list = Object.values(data)
                    .map(room => ({
                        ...room,
                        realUserCount: room.active_users ? Object.keys(room.active_users).length : 0
                    }))
                    .filter(room => room.realUserCount > 0) // Robust Filter
                    .sort((a, b) => b.realUserCount - a.realUserCount);
                setPublicRooms(list);
            } else {
                setPublicRooms([]);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleCreatePublic = () => {
        const newRoomId = Math.random().toString(36).substring(7).toUpperCase();
        navigation.navigate('Room', { roomId: newRoomId, isHost: true, username, isPublic: true });
    };



    const handleJoinRoom = (room) => {
        navigation.navigate('Room', { roomId: room.id, isHost: false, username, isPublic: true });
    };

    const renderRoomItem = ({ item }) => (
        <TouchableOpacity style={styles.roomCard} onPress={() => handleJoinRoom(item)}>
            <LinearGradient
                colors={['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.02)']}
                style={styles.cardGradient}
            >
                <View style={styles.roomInfo}>
                    <Text style={styles.roomName}>Party #{item.id}</Text>
                    <View style={styles.liveTag}>
                        <View style={styles.dot} />
                        <Text style={styles.liveText}>LIVE</Text>
                    </View>
                </View>
                <View style={styles.roomMeta}>
                    <Ionicons name="people" size={16} color="#aaa" />
                    <Text style={styles.countText}>{item.realUserCount || 0} watching</Text>
                    <Ionicons name="chevron-forward" size={16} color="#666" style={{ marginLeft: 10 }} />
                </View>
            </LinearGradient>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.header}>
                    <Text style={styles.welcome}>Hangout Zone</Text>
                </View>

                {/* Main Action Button */}
                <View style={styles.actionContainer}>
                    <TouchableOpacity style={styles.actionBtn} onPress={handleCreatePublic}>
                        <LinearGradient colors={COLORS.primary ? ['#6C5CE7', '#a363d9'] : ['#666', '#999']} style={styles.btnGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                            <View style={styles.actionIconCircle}>
                                <Ionicons name="people" size={28} color="#fff" />
                            </View>
                            <View>
                                <Text style={styles.actionTitle}>Start Group Watch</Text>
                                <Text style={styles.actionDesc}>Host a public party instantly</Text>
                            </View>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>

                {publicRooms.length > 0 && (
                    <View style={styles.listContainer}>
                        <Text style={styles.sectionHeader}>LIVE NOW 🔴</Text>
                        <FlatList
                            data={publicRooms}
                            keyExtractor={item => item.id}
                            renderItem={renderRoomItem}
                            contentContainerStyle={{ paddingBottom: 20 }}
                        />
                    </View>
                )}

            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.bgDark },
    safeArea: { flex: 1, padding: SPACING.l },

    // Header
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.xl },
    welcome: { fontSize: 32, color: COLORS.textMain, fontWeight: '800', letterSpacing: 0.5 },

    // Action Section
    actionContainer: { marginBottom: SPACING.xl },
    actionBtn: { height: 110, borderRadius: 24, overflow: 'hidden', ...COMMON_STYLES.shadow },
    btnGradient: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.l },
    actionIconCircle: { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginRight: SPACING.m },
    actionTitle: { color: COLORS.textMain, fontSize: 18, fontWeight: 'bold' },
    actionDesc: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },

    // Lists
    listContainer: { flex: 1 },
    sectionHeader: { color: COLORS.textSec, fontSize: 12, fontWeight: '700', marginBottom: SPACING.m, textTransform: 'uppercase', letterSpacing: 2 },

    // Room Card
    roomCard: { marginBottom: SPACING.m, borderRadius: 20, overflow: 'hidden', ...COMMON_STYLES.glass },
    cardGradient: { padding: SPACING.m, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    roomName: { color: COLORS.textMain, fontSize: 16, fontWeight: '600', marginBottom: 4 },
    roomMeta: { flexDirection: 'row', alignItems: 'center' },
    countText: { color: COLORS.textMuted, marginLeft: 6, fontSize: 12, fontWeight: '600' },

    liveTag: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,75,75,0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.error, marginRight: 6 },
    liveText: { color: COLORS.error, fontSize: 10, fontWeight: 'bold' },

    emptyView: { alignItems: 'center', marginTop: 60, opacity: 0.5 },
    emptyText: { color: COLORS.textMain, fontSize: 16, fontWeight: 'bold' },
    subEmptyText: { color: COLORS.textMuted, fontSize: 12, marginTop: 5 },
});

import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Platform, Dimensions, KeyboardAvoidingView, Modal, FlatList, Alert, StatusBar, Image, BackHandler, ToastAndroid } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import VideoPlayer from '../components/VideoPlayer';
import TicTacToeGame from '../components/TicTacToeGame';

// ... imports remain same

export default function RoomScreen({ route, navigation }) {
    console.log("RoomScreen Mounted. Params:", route.params);
    const { roomId, isHost, username, isPublic = false } = route.params;
    const { messages, sendMessage, videoState, updateVideoState, sendReaction, reactionStream, roomState, gameState, updateGameState } = useRoomSocket(roomId, username);

    const [inputUrl, setInputUrl] = useState('');
    const [chatVisible, setChatVisible] = useState(false);

    // Web Navigation State
    const playerRef = useRef(null);
    const [canWebGoBack, setCanWebGoBack] = useState(false);

    // Invite System States
    const [inviteModalVisible, setInviteModalVisible] = useState(false);
    const [viewersModalVisible, setViewersModalVisible] = useState(false);
    const [invitableUsers, setInvitableUsers] = useState([]);

    // Floating Chat State
    const [floatingMessages, setFloatingMessages] = useState([]);

    const amIController = videoState.controller === username;
    const hasVideo = !!videoState.url;
    const hasGame = !!gameState.type;
    const hasContent = hasVideo || hasGame;

    // ...

    const handleStopContent = () => {
        // Strict Host Lock
        if (hasVideo && videoState.controller && videoState.controller !== username) return;

        // For Games, anyone can technically "leave", but to kill the game room?
        // Let's say if you are a player you can quit, which clears it if empty?
        // For simplicity, let "Stop" button clear everything if you are the one who started or just a global reset.

        if (hasVideo) {
            updateVideoState({
                url: null,
                isPlaying: false,
                controller: null // Release control
            });
        }

        if (hasGame) {
            updateGameState({
                type: null,
                players: null,
                board: null,
                winner: null,
                turn: null
            });
        }
    };

    // ...

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <StatusBar barStyle="light-content" backgroundColor="#000" />

            {/* --- HEADER: Phoolverse Controls --- */}
            <View style={styles.header}>
                <TouchableOpacity onPress={handleBackPress} style={styles.iconBtn}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>

                <View style={styles.roomMeta}>
                    <Text style={styles.roomTitle}>Party Room</Text>
                    <View style={styles.statusRow}>
                        <View style={[styles.dot, hasContent && { backgroundColor: '#00E676' }]} />
                        {hasVideo && videoState.controller ? (
                            <Text style={styles.statusText}>{videoState.controller} is watching</Text>
                        ) : hasGame ? (
                            <Text style={styles.statusText}>Gaming Time</Text>
                        ) : (
                            <Text style={styles.statusText}>Idle</Text>
                        )}
                    </View>
                </View>

                {/* View Count Badge */}
                <View style={styles.viewCountBadge}>
                    <Ionicons name="eye" size={14} color="#ccc" style={{ marginRight: 4 }} />
                    <Text style={styles.viewCountText}>{roomState?.users?.length || 1}</Text>
                </View>

                {hasContent ? (
                    <TouchableOpacity style={styles.stopBtn} onPress={handleHeaderExit}>
                        <Ionicons name="close-circle" size={24} color="#FF4B4B" />
                    </TouchableOpacity>
                ) : (
                    <View style={{ width: 24 }} /> /* Spacer/Placeholder */
                )}

                {isPublic && (
                    <TouchableOpacity style={styles.inviteBtn} onPress={() => setInviteModalVisible(true)}>
                        <Ionicons name="person-add" size={20} color="#fff" />
                    </TouchableOpacity>
                )}
            </View>

            {/* --- BODY: Video / Picker (Reduced Height) --- */}
            <View style={styles.contentArea}>
                {hasGame ? (
                    <View style={styles.screenFrame}>
                        <TicTacToeGame
                            gameState={gameState}
                            onUpdateGame={updateGameState}
                            username={username}
                            roomUsers={roomState.users}
                        />
                        {/* Reactions still sit on top */}
                        <View pointerEvents="box-none" style={styles.reactionLayer}>
                            <ReactionFloating
                                onReact={sendReaction}
                                reactionStream={reactionStream}
                            />
                        </View>

                        {/* Floating Chat Overlay Layer */}
                        <View pointerEvents="none" style={styles.floatingChatLayer}>
                            {floatingMessages.map(msg => (
                                <View key={msg._lid} style={styles.floatingBubble}>
                                    <Text style={styles.floatingSender}>{msg.sender}</Text>
                                    <Text style={styles.floatingText}>{msg.text}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                ) : hasVideo ? (
                    <View style={styles.screenFrame}>
                        <VideoPlayer
                            ref={playerRef}
                            videoUrl={videoState.url}
                            canControl={amIController}
                            onUrlChanged={(newUrl) => {
                                if (amIController) {
                                    if (amIController) {
                                        // Direct Update (VideoPlayer already debounces)
                                        updateVideoState({ url: newUrl, isPlaying: true });
                                    }
                                }
                            }}
                            onNavigationStateChange={(navState) => {
                                setCanWebGoBack(navState.canGoBack);
                            }}
                        />
                        <View pointerEvents="box-none" style={styles.reactionLayer}>
                            <ReactionFloating
                                onReact={sendReaction}
                                reactionStream={reactionStream}
                            />
                        </View>

                        {/* Floating Chat Overlay Layer */}
                        <View pointerEvents="none" style={styles.floatingChatLayer}>
                            {floatingMessages.map(msg => (
                                <View key={msg._lid} style={styles.floatingBubble}>
                                    <Text style={styles.floatingSender}>{msg.sender}</Text>
                                    <Text style={styles.floatingText}>{msg.text}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                ) : (
                    <View style={styles.pickerContainer}>
                        <Text style={styles.pickerTitle}>Select Content</Text>
                        <View style={styles.grid}>
                            {/* First Row of Apps */}
                            <View style={{ flexDirection: 'row', gap: 30 }}>
                                <TouchableOpacity style={styles.appIcon} onPress={() => handleOpenApp('instagram')}>
                                    <LinearGradient colors={['#833ab4', '#fd1d1d', '#fcb045']} style={styles.iconGradient}>
                                        <Ionicons name="logo-instagram" size={30} color="#fff" />
                                    </LinearGradient>
                                    <Text style={styles.appName}>Insta</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.appIcon} onPress={() => handleOpenApp('youtube')}>
                                    <LinearGradient colors={['#e52d27', '#b31217']} style={styles.iconGradient}>
                                        <Ionicons name="logo-youtube" size={30} color="#fff" />
                                    </LinearGradient>
                                    <Text style={styles.appName}>YouTube</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.appIcon} onPress={() => updateGameState({ type: 'tictactoe' })}>
                                    <LinearGradient colors={['#00c6ff', '#0072ff']} style={styles.iconGradient}>
                                        <Ionicons name="game-controller" size={30} color="#fff" />
                                    </LinearGradient>
                                    <Text style={styles.appName}>Games</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                        <Text style={styles.orText}>OR LINK</Text>
                        <TextInput
                            style={styles.urlInput}
                            placeholder="Paste URL..."
                            placeholderTextColor="#999"
                            value={inputUrl}
                            onChangeText={setInputUrl}
                            onSubmitEditing={handlePlayUrl}
                        />
                    </View>
                )}
            </View>

            {/* --- FOOTER: Chat & Reactions --- */}
            <View style={styles.footer}>
                <TouchableOpacity style={styles.chatBtn} onPress={() => setChatVisible(true)}>
                    <Ionicons name="chatbubbles-outline" size={24} color="#fff" />
                    <Text style={styles.chatBtnText}>Chat Room</Text>
                </TouchableOpacity>

                {hasContent && (
                    <View style={styles.emojiRow}>
                        {QUICK_EMOJIS.map((emoji, index) => (
                            <TouchableOpacity
                                key={index}
                                style={styles.emojiButton}
                                onPress={() => {
                                    sendReaction(emoji);
                                    // Optional: Trigger local animation directly if needed, 
                                    // but reactionStream update should handle it.
                                }}
                            >
                                <Text style={styles.emojiText}>{emoji}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
            </View>

            {/* Chat Overlay Sheet */}
            {chatVisible && (
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.chatOverlayWrapper}
                >
                    <TouchableOpacity style={styles.backdrop} onPress={() => setChatVisible(false)} />
                    <View style={styles.chatSheet}>
                        <View style={styles.sheetHeader}>
                            <Text style={styles.sheetTitle}>Chat</Text>
                            <TouchableOpacity onPress={() => setChatVisible(false)}>
                                <Ionicons name="close" size={24} color="#ccc" />
                            </TouchableOpacity>
                        </View>
                        <RoomChat
                            messages={messages}
                            onSendMessage={sendMessage}
                            username={username}
                            overlayMode={true}
                        />
                    </View>
                </KeyboardAvoidingView>
            )}

            {/* Invite Modal */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={inviteModalVisible}
                onRequestClose={() => setInviteModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Invite Friends</Text>
                        <FlatList
                            data={invitableUsers}
                            keyExtractor={item => item.username}
                            ListEmptyComponent={<Text style={styles.emptyText}>No users found.</Text>}
                            renderItem={({ item }) => (
                                <TouchableOpacity style={styles.userRow} onPress={() => sendInvite(item)}>
                                    <View style={[styles.avatar, !item.online && { opacity: 0.5 }]}><Text style={styles.avatarText}>{item.username[0]}</Text></View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.usernameText}>{item.username}</Text>
                                        {!item.online && <Text style={{ fontSize: 10, color: '#666' }}>Offline</Text>}
                                    </View>
                                    <Ionicons name="send" size={20} color="#6C5CE7" />
                                </TouchableOpacity>
                            )}
                        />
                        <TouchableOpacity style={styles.closeBtn} onPress={() => setInviteModalVisible(false)}>
                            <Text style={styles.closeText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#050505' },

    // Header
    header: { height: 60, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, borderBottomWidth: 1, borderBottomColor: '#222', backgroundColor: '#111' },
    iconBtn: { padding: 8 },
    roomMeta: { flex: 1, marginLeft: 15 },
    roomTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#555', marginRight: 5 },
    statusText: { color: '#888', fontSize: 10 },
    viewCountBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, marginRight: 10 },
    viewCountText: { color: '#ccc', fontSize: 12, fontWeight: 'bold' },
    stopBtn: { marginRight: 15 },
    inviteBtn: { padding: 8, backgroundColor: '#6C5CE7', borderRadius: 20 },

    // Body
    contentArea: { flex: 1, backgroundColor: '#050505', paddingVertical: 10 },
    screenFrame: { flex: 1, marginHorizontal: 0, borderRadius: 0, overflow: 'hidden', backgroundColor: '#111' },

    // Footer
    footer: { height: 80, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, borderTopWidth: 1, borderTopColor: '#222', backgroundColor: '#111', justifyContent: 'space-between' },
    chatBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#6C5CE7', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 25 },
    chatBtnText: { color: '#fff', marginLeft: 8, fontWeight: '600' },

    emojiRow: { flexDirection: 'row', alignItems: 'center' },
    emojiButton: {
        backgroundColor: 'rgba(255,255,255,0.1)', // Glass effect
        borderRadius: 30,
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 4, // Reduced from 8 to 4 to bring icons closer
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    emojiText: { fontSize: 20 },

    // Picker
    pickerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    pickerTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginBottom: 30 },
    grid: { flexDirection: 'row', gap: 30, marginBottom: 40 },
    appIcon: { alignItems: 'center' },
    iconGradient: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
    appName: { color: '#ccc', fontSize: 12 },
    orText: { color: '#888', marginBottom: 15, fontSize: 10, letterSpacing: 1 },
    urlInput: { width: '80%', backgroundColor: '#222', padding: 15, borderRadius: 12, color: '#fff', textAlign: 'center' },

    // Layers
    reactionLayer: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', paddingBottom: 80, paddingRight: 10, zIndex: 20 },

    // Floating Chat
    floatingChatLayer: {
        position: 'absolute',
        bottom: 20, // Sit above controls
        left: 20,
        maxWidth: '60%',
        zIndex: 15,
    },
    floatingBubble: {
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderRadius: 20,
        paddingHorizontal: 15,
        paddingVertical: 8,
        marginBottom: 8,
        alignSelf: 'flex-start',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    floatingSender: {
        color: '#ffdd59', // Different color for sender
        fontSize: 11,
        fontWeight: 'bold',
        marginBottom: 2
    },
    floatingText: {
        color: '#fff',
        fontSize: 13,
    },

    // Chat Overlay
    chatOverlayWrapper: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 },
    backdrop: { flex: 1 }, // Transparent touch to close
    chatSheet: { height: '60%', backgroundColor: '#1a1a1a', borderTopLeftRadius: 20, borderTopRightRadius: 20, shadowColor: '#000', shadowOffset: { height: -5 }, shadowOpacity: 0.5, elevation: 20 },
    sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: '#333' },
    sheetTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { width: '80%', backgroundColor: '#222', borderRadius: 15, padding: 20 },
    modalTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
    userRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#333' },
    avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#444', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
    avatarText: { color: '#fff', fontWeight: 'bold' },
    usernameText: { color: '#fff', fontSize: 14, flex: 1 },
    closeBtn: { marginTop: 15, alignItems: 'center', padding: 10 },
    closeText: { color: '#666' }
});

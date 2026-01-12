import { useState, useEffect } from 'react';
import { rtdb, USE_MOCK } from './firebase';
import { ref, onValue, set, push, onDisconnect, update, serverTimestamp, query, limitToLast, remove } from 'firebase/database';

export function useRoom(roomId, username, isPublic = false) {
    const [roomState, setRoomState] = useState(null);
    const [messages, setMessages] = useState([]);
    const [videoState, setVideoState] = useState({ isPlaying: false, position: 0, url: null });
    const [reactionStream, setReactionStream] = useState([]);

    // 1. Join/Create Room Logic (Effect)
    useEffect(() => {
        if (!roomId || !username) return;

        if (USE_MOCK) {
            setRoomState({ id: roomId, users: [username] });
            return;
        }

        // --- Realtime Database Refs ---
        const roomRef = ref(rtdb, `rooms/${roomId}`);
        const userRef = ref(rtdb, `rooms/${roomId}/users/${username}`);
        const messagesRef = query(ref(rtdb, `rooms/${roomId}/messages`), limitToLast(50));
        const videoRef = ref(rtdb, `rooms/${roomId}/videoState`);
        const reactionsRef = query(ref(rtdb, `rooms/${roomId}/reactions`), limitToLast(10));

        // A. Presence System (Join/Leave)
        set(userRef, {
            username,
            joinedAt: serverTimestamp(),
            online: true
        });
        onDisconnect(userRef).remove();

        // **Public Room Sync**: Robust Presence
        if (isPublic) {
            // 1. Mark Room Metadata
            update(ref(rtdb, `public_rooms/${roomId}`), {
                id: roomId,
                lastActive: serverTimestamp()
            });

            // 2. Add Self to Active List with OnDisconnect
            const publicUserRef = ref(rtdb, `public_rooms/${roomId}/active_users/${username}`);
            set(publicUserRef, true);
            onDisconnect(publicUserRef).remove();
        }

        // Listen for active users (Internal Room Logic)
        const unsubscribeUsers = onValue(ref(rtdb, `rooms/${roomId}/users`), (snapshot) => {
            const usersData = snapshot.val();
            const userList = usersData ? Object.values(usersData).map(u => u.username) : [];
            setRoomState({ id: roomId, users: userList });
        });

        // B. Listen for Messages
        const unsubscribeMessages = onValue(messagesRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const msgList = Object.values(data).sort((a, b) => a.timestamp - b.timestamp);
                setMessages(msgList);
            } else {
                setMessages([]);
            }
        });

        // C. Listen for Video State
        const unsubscribeVideo = onValue(videoRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                setVideoState(prev => ({
                    ...prev,
                    isPlaying: data.isPlaying,
                    position: data.position,
                    url: data.url, // REMOVED '|| prev.url' to allow clearing content
                    controller: data.controller
                }));
            }
        });

        // D. Listen for Reactions
        const unsubscribeReactions = onValue(reactionsRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                setReactionStream(Object.values(data));
            }
        });

        // Cleanup on Unmount
        return () => {
            unsubscribeUsers();
            unsubscribeMessages();
            unsubscribeVideo();
            unsubscribeReactions();
            remove(userRef);
            if (isPublic) {
                remove(ref(rtdb, `public_rooms/${roomId}/active_users/${username}`));
            }

            // Note: We don't delete the room here immediately, the 'users' listener will handle empty check if needed
            // or perform a delayed check.
        };

    }, [roomId, username, isPublic]);

    // 2. Chat Logic
    const sendMessage = async (text) => {
        const msg = {
            sender: username,
            text,
            timestamp: Date.now() // Use client time for display sort, server time for order if strict
        };

        if (USE_MOCK) {
            setMessages(prev => [...prev, { ...msg, id: Date.now() }]);
        } else {
            const msgsRef = ref(rtdb, `rooms/${roomId}/messages`);
            await push(msgsRef, msg);
        }
    };

    const sendReaction = async (emoji) => {
        if (USE_MOCK) {
            setReactionStream(prev => [...prev, { emoji, sender: username, id: Date.now() }]);
        } else {
            const reactionsRef = ref(rtdb, `rooms/${roomId}/reactions`);
            const newReaction = { emoji, sender: username, timestamp: Date.now() };
            // Push returns a ref with a unique key
            const newRef = await push(reactionsRef, newReaction);

            // Auto-remove reaction from DB after 2 seconds to keep it clean (Ephemeral)
            setTimeout(() => {
                // remove(newRef).catch(() => {}); 
                // Commented out: Let's keep history for now, but in prod we clean up
            }, 5000);
        }
    };

    // 3. Video Sync Logic
    const updateVideoState = async (newState) => {
        // newState: { isPlaying: boolean, position: number }
        if (USE_MOCK) {
            setVideoState(prev => ({ ...prev, ...newState }));
        } else {
            const videoRef = ref(rtdb, `rooms/${roomId}/videoState`);
            await update(videoRef, {
                ...newState,
                lastUpdated: serverTimestamp(),
                updatedBy: username
            });
        }
    };

    return {
        roomState,
        messages,
        videoState,
        reactionStream,
        sendMessage,
        sendReaction,
        updateVideoState
    };
}

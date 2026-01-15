import { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { SOCKET_URL } from '../config';

export function useRoomSocket(roomId, username) {
    const [roomState, setRoomState] = useState({ users: [] });
    const [messages, setMessages] = useState([]);
    const [videoState, setVideoState] = useState({ isPlaying: false, position: 0, url: null, controller: null });
    const [reactionStream, setReactionStream] = useState([]);

    const socketRef = useRef(null);

    useEffect(() => {
        // Connect to Socket Server
        socketRef.current = io(SOCKET_URL, {
            transports: ['websocket'], // Force websocket for speed
            reconnection: true,
        });

        const socket = socketRef.current;

        socket.on('connect', () => {
            console.log("✅ Custom Socket Connected to", SOCKET_URL);
            // Join Room
            socket.emit('join_room', { roomId, username });
        });

        socket.on('connect_error', (err) => {
            console.log("❌ Socket Connection Error:", err.message);
        });

        // --- Listeners ---

        socket.on('sync_state', (state) => {
            // Initial Sync
            setVideoState(state.videoState);
            setRoomState({ users: state.users });
            setMessages(state.messages);
        });

        socket.on('user_joined', ({ username, users }) => {
            setRoomState({ users });
            // Optional: System message
        });

        socket.on('user_left', ({ username, users }) => {
            setRoomState({ users });
        });

        socket.on('video_update', (newState) => {
            setVideoState(prev => ({ ...prev, ...newState }));
        });

        socket.on('new_message', (msg) => {
            setMessages(prev => [...prev, msg]);
        });

        socket.on('new_reaction', (reaction) => {
            setReactionStream(prev => [...prev, reaction]);
        });

        return () => {
            socket.emit('leave_room', { roomId, username });
            socket.disconnect();
        };
    }, [roomId, username]);

    // --- Actions ---

    const sendMessage = (text) => {
        if (!socketRef.current) return;
        socketRef.current.emit('send_message', {
            roomId,
            message: { sender: username, text }
        });
    };

    const sendReaction = (emoji) => {
        if (!socketRef.current) return;
        const reaction = { emoji, sender: username, id: Date.now() };
        // Optimistic UI update (optional, but socket is fast enough to wait)
        // setReactionStream(prev => [...prev, reaction]); 

        socketRef.current.emit('send_reaction', {
            roomId,
            reaction
        });
    };

    const updateVideoState = (newState) => {
        if (!socketRef.current) return;
        // Optimistic Update
        setVideoState(prev => ({ ...prev, ...newState }));

        socketRef.current.emit('update_video', {
            roomId,
            videoState: { ...newState, updatedBy: username }
        });
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

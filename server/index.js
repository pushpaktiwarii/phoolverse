const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// In-memory state (Non-persistent for speed)
const rooms = {};
const socketMap = {}; // Maps socket.id -> { roomId, username } for cleanup
// Structure: { [roomId]: { users: Set<username>, videoState: {...}, messages: [], reactions: [] } }

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join_room', ({ roomId, username }) => {
        socket.join(roomId);

        // Init Room if not exists
        if (!rooms[roomId]) {
            rooms[roomId] = {
                users: new Set(),
                videoState: { url: null, isPlaying: false, position: 0, controller: null },
                messages: [] // Keep last ~50 in memory
            };
        }

        // Add User
        rooms[roomId].users.add(username);

        // Send Sync Data (Current State)
        socket.emit('sync_state', {
            videoState: rooms[roomId].videoState,
            users: Array.from(rooms[roomId].users),
            messages: rooms[roomId].messages
        });

        // Notify others
        io.to(roomId).emit('user_joined', { username, users: Array.from(rooms[roomId].users) });
        console.log(`${username} joined ${roomId}`);
    });

    socket.on('update_video', ({ roomId, videoState }) => {
        if (!rooms[roomId]) return;

        // Update State
        rooms[roomId].videoState = { ...rooms[roomId].videoState, ...videoState };

        // Broadcast to everyone else active in the room
        socket.to(roomId).emit('video_update', rooms[roomId].videoState);
    });

    socket.on('send_message', ({ roomId, message }) => {
        if (!rooms[roomId]) return;

        const msg = { ...message, timestamp: Date.now() };
        rooms[roomId].messages.push(msg);
        if (rooms[roomId].messages.length > 50) rooms[roomId].messages.shift(); // Limit history

        io.to(roomId).emit('new_message', msg);
    });

    socket.on('send_reaction', ({ roomId, reaction }) => {
        // Reactions are ephemeral, just relay them
        io.to(roomId).emit('new_reaction', reaction);
    });

    socket.on('leave_room', ({ roomId, username }) => {
        socket.leave(roomId);
        if (rooms[roomId]) {
            rooms[roomId].users.delete(username);
            io.to(roomId).emit('user_left', { username, users: Array.from(rooms[roomId].users) });
        }
    });

    socket.on('disconnect', () => {
        const data = socketMap[socket.id];
        if (data) {
            const { roomId, username } = data;
            if (rooms[roomId]) {
                rooms[roomId].users.delete(username);
                io.to(roomId).emit('user_left', { username, users: Array.from(rooms[roomId].users) });
                console.log(`Auto-removed ${username} from ${roomId}`);
            }
            delete socketMap[socket.id];
        }
        console.log('User disconnected:', socket.id);
    });
});

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Socket Server running on port ${PORT}`);
});

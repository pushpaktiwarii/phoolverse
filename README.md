# Phoolverse 🌺

**Phoolverse** is a premium, minimal social hangout application built with **React Native (Expo)**, **Socket.io**, and **Firebase**. It focuses on **hyper-speed synchronization** for watch parties, seamless swipe navigation, and rich social interactions.

## ✨ Features

### 🎥 Ultra-Low Latency Watch Party
-   **Socket.io Synchronized**: Replaced basic polling with event-driven Socket.io for **0ms latency** sync.
-   **Live Interactions**: Real-time play/pause/seek controls shared universally.
-   **Host Controls**: Only the assigned host can control the flow; viewers are locked for a focused experience.
-   **History API Override**: Custom WebView injection to detect `pushState` for instant video changes.

### 🧭 Swipe Navigation
-   **Modern UI**: Seamlessly swipe between **Chats**, **Hangout (Home)**, and **Profile** tabs.
-   **Material Top Tabs**: Smooth gestures and transitions with a clean, bottom-positioned tab bar.

### 💬 Rich Private Chat
-   **Reply System**: Swipe or long-press to reply to specific messages with context.
-   **Smart Status**: "Active Now", "Active 5m ago" status updates.
-   **Media & Invites**:
    -   Send Voice Notes 🎙️ and Images 📷.
    -   **Watch Party Invites**: Send direct invites that expire in 15 mins.
-   **Unread Indicators**: Smart unread bubbles that vanish instantly upon viewing.

### 👤 Social & Polish
-   **Live View Count**: Real-time "Eye Icon" showing active room participants.
-   **Floating Chat**: Instagram Live-style floating messages over the video player.
-   **Reactions**: Floating emoji reactions (😂, ❤️, 🔥) with physics-based animations.

## 🛠️ Tech Stack

-   **Frontend**: React Native, Expo, React Navigation (Material Top Tabs).
-   **Real-time Engine**: **Socket.io** (Custom Node.js Server) + Firebase Realtime Database (Backup/Meta).
-   **Backend**: Node.js, Express (for Socket server).
-   **Styling**: Custom "Clean Black" Theme (`#050505` Backgrounds, `#6C5CE7` Accents).

## 🚀 Deployment Guide

### 1. The Socket Server
> ⚠️ **Important**: The app relies on a custom Node.js Socket server. You cannot just deploy the APK; you must host the server first.

1.  Navigate to the `server/` folder.
2.  Deploy this folder to a service like **Render**, **Railway**, or **Heroku**.
3.  Once deployed, get your **Public URL** (e.g., `https://my-socket-server.onrender.com`).
4.  Update `src/config.js` in the React Native project:
    ```javascript
    export const SOCKET_URL = "https://your-deployed-server-url.com";
    ```

### 2. The Mobile App (APK)
1.  **Install EAS CLI**: `npm install -g eas-cli`
2.  **Configure**: `eas build:configure`
3.  **Build**:
    ```bash
    eas build -p android --profile preview
    ```

## ❤️ Credits

**Built by Pushpak**
*Minimal • Social • Real*

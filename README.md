# Phoolverse 🌺

**Phoolverse** is a premium, minimal social hangout application built with **React Native (Expo)** and **Firebase**. It focuses on real-time connections, allowing users to watch videos together, chat privately, and see who's online in a sleek, dark-themed environment.

## ✨ Features

### 🎥 Real-time Watch Party ("The Room")
-   **Synchronized Playback**: Watch reels/videos in perfect sync with friends.
-   **Live Interactions**: Real-time play/pause controls shared across all viewers.
-   **Public & Private Logic**: Invite-only private rooms or join the public lobby.

### 💬 Advanced Chat System
-   **WhatsApp-Style Interface**:
    -   Date-grouped messages (Today, Yesterday).
    -   Smart Tick system (Sent/Delivered).
-   **Media Support**: Send Voice Notes 🎙️ and Images 📷.
-   **Smart Invites**:
    -   Send "Watch Party" invites directly in chat.
    -   **Auto-Expiration**: Invites expire after 15 minutes.
    -   **Decline Logic**: Declining an invite marks it as "Expired" but keeps the history.
-   **Message Actions**: Long-press to delete your messages.

### 👤 Identity & Social
-   **Persistent Profiles**: Custom Avatars, Bios, and Status.
-   **Real-time Presence**: See who is "Active Now" or "Offline".
-   **Smart Lobby**: Live list of active public rooms.

## 🛠️ Tech Stack

-   **Frontend**: React Native, Expo, React Navigation.
-   **Backend (BaaS)**: Firebase Realtime Database (for sync), Firebase Storage (for media).
-   **Styling**: Custom "Clean Black" Theme (`#050505` Backgrounds, `#6C5CE7` Accents).
-   **Build**: EAS (Expo Application Services) for automated APK builds.

## 🚀 Getting Started

### Prerequisites
-   Node.js & npm
-   Expo Go App (on mobile)

### Installation

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/your-username/phoolverse.git
    cd phoolverse
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Firebase Setup**:
    -   Add your `firebaseConfig` in `src/services/firebase.js`.
    -   Ensure Realtime Database rules allow Read/Write.

4.  **Run the App**:
    ```bash
    npx expo start
    ```
    -   Scan the QR code with **Expo Go** (Android/iOS).

## 📱 Building APK (Android)

Using **EAS Build**:

1.  Install EAS CLI: `npm install -g eas-cli`
2.  Login: `eas login`
3.  Configure: `eas build:configure`
4.  Build:
    ```bash
    eas build -p android --profile preview
    ```

## ❤️ Credits

**Built by Pushpak**
*Minimal • Social • Real*

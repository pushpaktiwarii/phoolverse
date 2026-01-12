import React, { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { rtdb } from '../services/firebase';
import { ref, update, onDisconnect, serverTimestamp } from 'firebase/database';

export default function PresenceManager({ children }) {
    const appState = useRef(AppState.currentState);

    useEffect(() => {
        const subscription = AppState.addEventListener('change', async (nextAppState) => {
            // App comes to Foreground -> Set Online
            if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
                updateStatus(true);
            }
            // App goes to Background -> Set Offline
            if (appState.current === 'active' && nextAppState.match(/inactive|background/)) {
                updateStatus(false);
            }
            appState.current = nextAppState;
        });

        // Initial Check
        updateStatus(true);

        return () => {
            subscription.remove();
        };
    }, []);

    const updateStatus = async (isOnline) => {
        try {
            const username = await AsyncStorage.getItem('foolverse_username');
            if (username && rtdb) {
                const userRef = ref(rtdb, `users/${username}`);
                update(userRef, {
                    online: isOnline,
                    lastSeen: serverTimestamp()
                });

                if (isOnline) {
                    onDisconnect(userRef).update({ online: false, lastSeen: serverTimestamp() });
                }
            }
        } catch (e) {
            console.log("Presence Error", e);
        }
    };

    return children;
}

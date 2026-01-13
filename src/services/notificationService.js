import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform, Alert } from 'react-native';
import { ref, update } from 'firebase/database';
import { rtdb } from './firebase';

// 1. Configure how notifications appear when app is in FOREGROUND
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true, // Show the alert banner
        shouldPlaySound: true, // Play sound
        shouldSetBadge: true,
    }),
});

/**
 * Registers for Push Notifications:
 * - Checks Permissions
 * - Gets Expo Push Token
 * - Saves Token to Firebase under `users/{username}/pushToken`
 */
export async function registerForPushNotificationsAsync(username) {
    let token;

    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
        });
    }

    if (Device.isDevice) {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }
        if (finalStatus !== 'granted') {
            Alert.alert('Permission needed', 'Failed to get push token for push notification!');
            return;
        }

        // Get the token
        try {
            const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
            if (!projectId) {
                // Fallback or explicit ID if not using EAS
                // token = (await Notifications.getExpoPushTokenAsync()).data;
                // Actually for Expo Go usually no projectId is needed, but for builds it is.
                // We will try generic first.
            }
            token = (await Notifications.getExpoPushTokenAsync({
                projectId: projectId, // Define if using EAS
            })).data;

            console.log("Expo Push Token:", token);

            // Save to Firebase
            if (token && username) {
                const userRef = ref(rtdb, `users/${username}`);
                await update(userRef, { pushToken: token });
            }

        } catch (e) {
            console.error("Error fetching push token", e);
        }
    } else {
        // alert('Must use physical device for Push Notifications'); 
        console.log("Must use physical device for Push Notifications");
    }

    return token;
}

/**
 * Sends a Push Notification to a specific Expo Push Token
 * THIS IS A CLIENT-SIDE IMPLEMENTATION (Not secure for production, but fine for prototype)
 */
export async function sendPushNotification(expoPushToken, title, body, data = {}) {
    if (!expoPushToken) {
        console.log("Invalid Expo Push Token:", expoPushToken);
        return;
    }

    const message = {
        to: expoPushToken,
        sound: 'default',
        title: title,
        body: body,
        data: data,
    };

    try {
        await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Accept-encoding': 'gzip, deflate',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(message),
        });
    } catch (error) {
        console.error("Error sending push notification:", error);
    }
}

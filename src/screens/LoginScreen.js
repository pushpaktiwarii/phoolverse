import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Animated, Dimensions, Image, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons'; // Built-in Expo Icons
import { rtdb } from '../services/firebase';
import { ref, set, get, update, onDisconnect, serverTimestamp } from 'firebase/database';
import { COLORS, SPACING, COMMON_STYLES } from '../constants/theme';
import { registerForPushNotificationsAsync } from '../services/notificationService';

const { width } = Dimensions.get('window');

// Custom Animated View for Entry
const FadeInView = ({ delay, children }) => {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(20)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 400, // Faster
                delay: delay,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 400, // Faster
                delay: delay,
                useNativeDriver: true,
            })
        ]).start();
    }, [fadeAnim, slideAnim, delay]);

    return (
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
            {children}
        </Animated.View>
    );
};

export default function LoginScreen({ navigation }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(true);
    const [step, setStep] = useState('username'); // 'username' | 'password' | 'register'

    useEffect(() => {
        checkExistingUser();
    }, []);

    const checkExistingUser = async () => {
        try {
            const storedUsername = await AsyncStorage.getItem('foolverse_username');
            if (storedUsername) {
                // Parallelize presence & navigation, don't wait for independent tasks
                setPresence(storedUsername);
                registerForPushNotificationsAsync(storedUsername); // Background
                navigation.replace('Lobby', { username: storedUsername });
            }
        } catch (e) {
            console.error("Failed to load username", e);
        } finally {
            setLoading(false);
        }
    };

    const setPresence = async (user) => {
        if (!rtdb) return;
        const userRef = ref(rtdb, `users/${user}`);
        // Set online status
        update(userRef, { online: true, lastSeen: serverTimestamp() });
        // Schedule offline status on disconnect
        onDisconnect(userRef).update({ online: false, lastSeen: serverTimestamp() });
    };

    const checkUserExists = async () => {
        if (!username.trim()) return Alert.alert("Oops", "Username cannot be empty");

        setLoading(true);
        const userRef = ref(rtdb, `users/${username.trim()}`);
        try {
            const snapshot = await get(userRef);
            if (snapshot.exists() && snapshot.val().password) {
                setStep('password');
            } else {
                Alert.alert("Not Found", "Username not found. Please create an account.");
            }
        } catch (error) {
            Alert.alert("Error", error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleLogin = async () => {
        if (!password.trim()) return Alert.alert("Oops", "Enter your password");
        setLoading(true);

        try {
            const userRef = ref(rtdb, `users/${username.trim()}`);
            const snapshot = await get(userRef);

            if (snapshot.exists() && snapshot.val()) {
                const userData = snapshot.val();
                if (userData.password === password) {
                    await AsyncStorage.setItem('foolverse_username', username.trim());

                    // Fast Entry: Don't await these
                    setPresence(username.trim());
                    registerForPushNotificationsAsync(username.trim());

                    navigation.replace('Lobby', { username: username.trim() });
                } else {
                    Alert.alert("Access Denied", "Wrong password!");
                    setLoading(false);
                }
            } else {
                Alert.alert("Error", "User not found.");
                setLoading(false);
            }
        } catch (error) {
            console.error("Login Error:", error);
            Alert.alert("Login Failed", "Something went wrong. Please check your connection.");
            setLoading(false);
        }
    };

    const handleRegister = async () => {
        if (!password.trim()) return Alert.alert("Oops", "Set a password");
        setLoading(true);

        const userRef = ref(rtdb, `users/${username.trim()}`);
        await set(userRef, {
            username: username.trim(),
            password,
            online: true,
            lastSeen: serverTimestamp()
        });

        onDisconnect(userRef).update({ online: false, lastSeen: serverTimestamp() });

        await AsyncStorage.setItem('foolverse_username', username.trim());

        // Background reg
        registerForPushNotificationsAsync(username.trim());

        navigation.replace('Lobby', { username: username.trim() });
    };

    if (loading) {
        return (
            <View style={[styles.container, styles.center]}>
                <LinearGradient
                    colors={['#000000', '#1c1c1c']}
                    style={StyleSheet.absoluteFill}
                />
                <ActivityIndicator size="large" color="#00ffcc" />
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1, backgroundColor: COLORS.bgDark }}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
            <ScrollView
                contentContainerStyle={{ flexGrow: 1 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.container}>
                    <SafeAreaView style={styles.safeArea}>

                        {/* Header Section */}
                        <FadeInView delay={0}>
                            <View style={styles.headerContainer}>
                                {/* Logo */}
                                <Image
                                    source={require('../../assets/phoolverse.png')}
                                    style={{ width: 120, height: 120, marginBottom: 20, borderRadius: 20 }}
                                    resizeMode="contain"
                                />
                                <Text style={styles.title}>PHOOLVERSE</Text>
                                <Text style={styles.subtitle}>Minimal • Social • Real</Text>
                            </View>
                        </FadeInView>

                        {/* Form Card */}
                        <FadeInView delay={200}>
                            <View style={styles.card}>
                                <View style={styles.glassEffect} />

                                {step === 'username' && (
                                    <View>
                                        <Text style={styles.label}>Who are you?</Text>
                                        <View style={styles.inputRow}>
                                            <Ionicons name="person-outline" size={20} color={COLORS.primary} style={styles.icon} />
                                            <TextInput
                                                style={styles.input}
                                                placeholder="Username"
                                                placeholderTextColor="#999"
                                                value={username}
                                                onChangeText={setUsername}
                                                autoCapitalize="none"
                                            />
                                        </View>
                                        <TouchableOpacity style={styles.btn} onPress={checkUserExists}>
                                            <LinearGradient
                                                colors={['#00c6ff', '#0072ff']}
                                                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                                                style={styles.btnGradient}
                                            >
                                                <Text style={styles.btnText}>CONTINUE</Text>
                                                <Ionicons name="arrow-forward" size={20} color="#fff" />
                                            </LinearGradient>
                                        </TouchableOpacity>

                                        <TouchableOpacity onPress={() => setStep('register')} style={{ marginTop: 20 }}>
                                            <Text style={styles.linkText}>New here? <Text style={{ color: '#fff', fontWeight: 'bold' }}>Create Account</Text></Text>
                                        </TouchableOpacity>
                                    </View>
                                )}

                                {step === 'password' && (
                                    <View>
                                        <Text style={styles.label}>Welcome back,</Text>
                                        <Text style={styles.userDisplay}>@{username}</Text>

                                        <View style={styles.inputRow}>
                                            <Ionicons name="lock-closed-outline" size={20} color={COLORS.primary} style={styles.icon} />
                                            <TextInput
                                                style={styles.input}
                                                placeholder="Enter Password"
                                                placeholderTextColor="#999"
                                                value={password}
                                                onChangeText={setPassword}
                                                secureTextEntry
                                            />
                                        </View>

                                        <TouchableOpacity style={styles.btn} onPress={handleLogin}>
                                            <LinearGradient
                                                colors={['#11998e', '#38ef7d']} // Greenish for Login
                                                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                                                style={styles.btnGradient}
                                            >
                                                <Text style={styles.btnText}>LOGIN</Text>
                                            </LinearGradient>
                                        </TouchableOpacity>

                                        <TouchableOpacity onPress={() => setStep('username')}>
                                            <Text style={styles.linkText}>Switch Account</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}

                                {step === 'register' && (
                                    <View>
                                        <Text style={styles.label}>New Recruit,</Text>
                                        <Text style={styles.userDisplay}>@{username}</Text>

                                        <View style={[styles.inputRow, { marginTop: 20 }]}>
                                            <Ionicons name="key-outline" size={20} color="#ff00cc" style={styles.icon} />
                                            <TextInput
                                                style={styles.input}
                                                placeholder="Create Password"
                                                placeholderTextColor="#999"
                                                value={password}
                                                onChangeText={setPassword}
                                                secureTextEntry
                                            />
                                        </View>

                                        <TouchableOpacity style={styles.btn} onPress={handleRegister}>
                                            <LinearGradient
                                                colors={['#DA22FF', '#9733EE']} // Purple/Pink for Register
                                                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                                                style={styles.btnGradient}
                                            >
                                                <Text style={styles.btnText}>JOIN THE VERSE</Text>
                                            </LinearGradient>
                                        </TouchableOpacity>

                                        <TouchableOpacity onPress={() => setStep('username')}>
                                            <Text style={styles.linkText}>Go Back</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}

                            </View>
                        </FadeInView>

                        <View style={{ flex: 1 }} />
                        <View style={{ alignItems: 'center', marginBottom: 20 }}>
                            <Text style={styles.footer}>Foolverse v1.0 • Secure Connection</Text>
                            <Text style={[styles.footer, { marginTop: -15, color: '#6C5CE7', fontWeight: 'bold' }]}>Built by Pushpak ❤️</Text>
                        </View>
                    </SafeAreaView>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.bgDark },
    safeArea: { flex: 1, padding: SPACING.l },
    center: { alignItems: 'center', justifyContent: 'center' },
    headerContainer: { alignItems: 'center', marginTop: 80, marginBottom: 50 },
    title: { fontSize: 32, fontWeight: '800', color: COLORS.textMain, letterSpacing: 6 },
    subtitle: { fontSize: 12, color: COLORS.textMuted, letterSpacing: 3, marginTop: 8, textTransform: 'uppercase' },

    card: {
        borderRadius: 30, padding: 30, overflow: 'hidden',
        ...COMMON_STYLES.glass, ...COMMON_STYLES.shadow
    },
    glassEffect: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.01)' },

    label: { color: COLORS.textSec, fontSize: 12, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: '600' },
    userDisplay: { color: COLORS.textMain, fontSize: 28, fontWeight: '300', marginBottom: 8, letterSpacing: 1 },

    inputRow: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: COLORS.bgSurface, borderRadius: 16,
        paddingHorizontal: 16, height: 60, marginBottom: 24,
        borderWidth: 1, borderColor: COLORS.border
    },
    icon: { marginRight: 12, opacity: 0.7 },
    input: { flex: 1, fontSize: 16, color: COLORS.textMain, fontWeight: '400' },

    btn: { borderRadius: 16, overflow: 'hidden' },
    btnGradient: { flexDirection: 'row', paddingVertical: 18, justifyContent: 'center', alignItems: 'center' },
    btnText: { fontSize: 14, fontWeight: 'bold', letterSpacing: 2, marginRight: 8, color: '#fff' },

    linkText: { color: COLORS.textMuted, textAlign: 'center', marginTop: 24, fontSize: 12 },
    footer: { textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: 10, marginBottom: 20 }
});

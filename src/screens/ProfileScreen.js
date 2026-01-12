import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, StyleSheet, Alert, ActivityIndicator, Platform, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { rtdb, storage } from '../services/firebase';
import { ref, onValue, update } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { LinearGradient } from 'expo-linear-gradient';

export default function ProfileScreen({ route, navigation }) {
    const { username } = route.params;
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Profile Data
    const [displayName, setDisplayName] = useState(username);
    const [bio, setBio] = useState('');
    const [avatarUrl, setAvatarUrl] = useState(null);

    useEffect(() => {
        const userRef = ref(rtdb, `users/${username}`);
        const unsub = onValue(userRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                setDisplayName(data.displayName || username);
                setBio(data.bio || '');
                setAvatarUrl(data.avatarUrl || null);
            }
            setLoading(false);
        });
        return () => unsub();
    }, [username]);

    const pickImage = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5,
        });

        if (!result.canceled) {
            uploadAvatar(result.assets[0].uri);
        }
    };

    const uploadAvatar = async (uri) => {
        if (!storage) return;
        setSaving(true);
        try {
            const response = await fetch(uri);
            const blob = await response.blob();
            const filename = `avatars/${username}_${Date.now()}.jpg`;
            const fileRef = storageRef(storage, filename);

            await uploadBytes(fileRef, blob);
            const url = await getDownloadURL(fileRef);

            // Update immediately
            setAvatarUrl(url);
            await update(ref(rtdb, `users/${username}`), { avatarUrl: url });
        } catch (e) {
            Alert.alert("Error", "Failed to upload image");
        } finally {
            setSaving(false);
        }
    };

    const handleSave = async () => {
        if (!displayName.trim()) {
            Alert.alert("Error", "Name cannot be empty");
            return;
        }
        setSaving(true);
        try {
            await update(ref(rtdb, `users/${username}`), {
                displayName: displayName.trim(),
                bio: bio.trim()
            });
            Alert.alert("Success", "Profile Updated!");
            navigation.goBack();
        } catch (e) {
            Alert.alert("Error", "Could not save profile");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <View style={styles.center}><ActivityIndicator color="#fff" /></View>;

    return (
        <View style={styles.container}>
            <SafeAreaView style={{ flex: 1 }}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={24} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Edit Profile</Text>
                    <View style={{ width: 32 }} />
                </View>

                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.content}>

                    {/* Avatar Section */}
                    <View style={styles.avatarSection}>
                        <TouchableOpacity onPress={pickImage} style={styles.avatarWrapper}>
                            {avatarUrl ? (
                                <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
                            ) : (
                                <View style={[styles.avatarImage, { backgroundColor: '#6C5CE7', justifyContent: 'center', alignItems: 'center' }]}>
                                    <Text style={{ fontSize: 40, color: '#fff', fontWeight: 'bold' }}>{displayName[0]?.toUpperCase()}</Text>
                                </View>
                            )}
                            <View style={styles.cameraBadge}>
                                <Ionicons name="camera" size={16} color="#fff" />
                            </View>
                        </TouchableOpacity>
                        <Text style={styles.usernameLabel}>@{username}</Text>
                    </View>

                    {/* Form */}
                    <View style={styles.form}>
                        <Text style={styles.label}>Display Name</Text>
                        <TextInput
                            style={styles.input}
                            value={displayName}
                            onChangeText={setDisplayName}
                            placeholder="Your Name"
                            placeholderTextColor="#999"
                        />

                        <Text style={styles.label}>Bio</Text>
                        <TextInput
                            style={[styles.input, styles.textArea]}
                            value={bio}
                            onChangeText={setBio}
                            placeholder="Tell us about yourself..."
                            placeholderTextColor="#999"
                            multiline
                            numberOfLines={4}
                        />

                        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save Changes</Text>}
                        </TouchableOpacity>
                    </View>

                </KeyboardAvoidingView>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#050505' },
    center: { flex: 1, backgroundColor: '#121212', justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
    headerTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
    backBtn: { padding: 4 },
    content: { flex: 1, padding: 20 },
    avatarSection: { alignItems: 'center', marginBottom: 30 },
    avatarWrapper: { position: 'relative', marginBottom: 10 },
    avatarImage: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: '#fff' },
    cameraBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#6C5CE7', padding: 8, borderRadius: 20, borderWidth: 2, borderColor: '#121212' },
    usernameLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 14 },
    form: { flex: 1 },
    label: { color: '#6C5CE7', fontSize: 14, fontWeight: 'bold', marginBottom: 8, marginLeft: 4 },
    input: { backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff', borderRadius: 12, padding: 15, fontSize: 16, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    textArea: { height: 100, textAlignVertical: 'top' },
    saveBtn: { backgroundColor: '#6C5CE7', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 10 },
    saveText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});

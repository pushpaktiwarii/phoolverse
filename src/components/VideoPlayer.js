import React, { useRef, useState, useEffect, forwardRef, useImperativeHandle, useMemo } from 'react';
import { View, StyleSheet, Button, Text, Platform, ActivityIndicator } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { WebView } from 'react-native-webview';

const VideoPlayer = forwardRef(({
    videoUrl = "https://d23dyxeqlo5psv.cloudfront.net/big_buck_bunny.mp4",
    onPlaybackStatusUpdate,
    onUrlChanged,
    canControl, // Renamed from isHost to match RoomScreen usage
    onNavigationStateChange // New prop to pass nav config up
}, ref) => {
    const video = useRef(null);
    const webViewRef = useRef(null);
    const [status, setStatus] = useState({});

    // Expose methods to parent
    useImperativeHandle(ref, () => ({
        goBack: () => {
            if (webViewRef.current) {
                webViewRef.current.goBack();
                // More aggressive JS back
                webViewRef.current.injectJavaScript(`
                    if (window.history.length > 1) {
                        window.history.go(-1);
                    }
                    true;
                `);
            }
        }
    }));

    // Determine content type
    const isDirectVideo = videoUrl?.match(/\.(mp4|mov|mkv|webm)$/i);

    // Instagram/SPA Sync Script
    // Checks URL every 200ms (High Speed Sync)
    const INJECTED_JS = `
setInterval(function () {
    window.ReactNativeWebView.postMessage(window.location.href);
}, 200);

// Hide specific elements to clean UI on commonly used sites
if (window.location.href.includes('instagram.com')) {
    const style = document.createElement('style');
    style.innerHTML = 'header, footer, ._a3gq, ._aa56 { display: none !important; }';
    document.head.appendChild(style);
}
true;
`;

    // Track the last URL we reported to the parent to avoid self-reloads
    const lastReportedUrl = useRef(videoUrl);
    const [currentSource, setCurrentSource] = useState({ uri: videoUrl });

    // Update source ONLY if the new URL is materially different from what we are already at
    useEffect(() => {
        const normalize = (u) => u?.replace(/\/$/, '').toLowerCase() || '';

        if (normalize(videoUrl) !== normalize(lastReportedUrl.current)) {
            // It's a real external change (or initial load)
            setCurrentSource({ uri: videoUrl });
        }
    }, [videoUrl]);

    // Helper to ignore http/https diffs or trailing slashes for comparison
    function normalizeUrl(url) {
        if (!url) return '';
        return url.replace(/\/$/, '').replace(/^https?:\/\//, '');
    }

    if (!isDirectVideo) {
        // WEB FALLBACK: Use iframe because WebView isn't supported on Web
        if (Platform.OS === 'web') {
            let src = videoUrl;

            // Fix for Instagram on Web: Must use /embed endpoint to avoid X-Frame-Options block
            if (src.includes('instagram.com') && !src.includes('/embed')) {
                // Ensure trailing slash before adding embed
                src = src.endsWith('/') ? `${src}embed` : `${src}/embed`;
            }

            return (
                <View style={styles.container}>
                    <iframe
                        src={src}
                        style={{ width: '100%', height: '100%', border: 'none' }}
                        allow="autoplay; encrypted-media; fullscreen"
                    />
                </View>
            );
        }

        // MOBILE: Use Native WebView with Sync features
        return (
            <View style={styles.container}>
                <WebView
                    ref={webViewRef}
                    source={currentSource}
                    style={styles.webview}
                    javaScriptEnabled={true}
                    domStorageEnabled={true}
                    sharedCookiesEnabled={true} // Persist Login State
                    allowsInlineMediaPlayback={true}
                    allowsBackForwardNavigationGestures={true}
                    injectedJavaScript={INJECTED_JS}
                    onMessage={(event) => {
                        if (!canControl) return; // Only controller syncs BACK to the room

                        const currentUrl = normalizeUrl(event.nativeEvent.data);
                        const prevUrl = normalizeUrl(videoUrl);

                        // Sync any URL change detected by JS polling
                        if (currentUrl && currentUrl !== prevUrl) {
                            // Mark this as self-driven so we don't reload when it comes back
                            lastReportedUrl.current = event.nativeEvent.data;
                            if (onUrlChanged) onUrlChanged(event.nativeEvent.data);
                        }
                    }}
                    onNavigationStateChange={(navState) => {
                        // Pass canGoBack status up to parent
                        if (onNavigationStateChange) {
                            onNavigationStateChange(navState);
                        }

                        // Fallback for non-SPA navigation
                        if (!canControl) return;

                        const current = normalizeUrl(videoUrl);
                        const next = normalizeUrl(navState.url);

                        if (next && next !== current) {
                            if (onUrlChanged) onUrlChanged(navState.url);
                        }
                    }}
                />

                {/* Visual indicator for non-controllers */}
                {!canControl && (
                    <View style={styles.syncOverlay}>
                        <ActivityIndicator size="small" color="#00ffcc" style={{ marginRight: 5 }} />
                        <Text style={styles.syncText}>Live from Host</Text>
                    </View>
                )}
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Video
                ref={video}
                style={styles.video}
                source={{
                    uri: videoUrl,
                }}
                useNativeControls={true}
                resizeMode={ResizeMode.CONTAIN}
                isLooping
                onPlaybackStatusUpdate={status => {
                    setStatus(() => status);
                    if (onPlaybackStatusUpdate) onPlaybackStatusUpdate(status);
                }}
            />
            <View style={styles.debugInfo}>
                <Text style={styles.debugText}>
                    Status: {status.isPlaying ? 'Playing' : 'Paused'} | Pos: {Math.round(status.positionMillis / 1000)}s
                </Text>
            </View>
        </View>
    );
});

export default VideoPlayer;

const styles = StyleSheet.create({
    container: {
        width: '100%',
        height: '100%',
        backgroundColor: 'black',
        overflow: 'hidden',
        flex: 1,
    },
    video: {
        flex: 1,
        width: '100%',
        height: '100%',
    },
    webview: {
        flex: 1,
    },
    buttons: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    debugInfo: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        padding: 4,
    },
    debugText: {
        color: '#fff',
        fontSize: 10,
    },
    loading: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    syncOverlay: {
        position: 'absolute',
        top: 20,
        right: 20,
        backgroundColor: 'rgba(0,0,0,0.6)',
        padding: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#00ffcc',
        flexDirection: 'row',
        alignItems: 'center',
    },
    syncText: {
        color: '#00ffcc',
        fontSize: 10,
        fontWeight: 'bold',
    }
});

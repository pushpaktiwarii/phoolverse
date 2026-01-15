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
    // Controller should start ready. Viewers start hidden until load.
    const [isReady, setIsReady] = useState(canControl || isDirectVideo);

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
    // Instagram/SPA Sync Script
    // Checks Reel ID change instead of raw URL polling
    const INJECTED_JS = `
(function () {
  let lastReelId = null;
  let debounceTimer = null;

  function extractReelId(url) {
    const match = url.match(/\\/reel\\/([^\\/]+)/);
    return match ? match[1] : null;
  }

  function checkReelChange() {
    const reelId = extractReelId(window.location.href);
    if (!reelId || reelId === lastReelId) return;

    lastReelId = reelId;

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: "REEL_CHANGE",
        reelId,
        url: window.location.href
      }));
    }, 20); // Instant Debounce (20ms)
  }

  // 2. Override History API for Instant Detection (0ms Latency)
  (function() {
      if (window.historyOverridden) return;
      window.historyOverridden = true;
      const pushState = history.pushState;
      const replaceState = history.replaceState;
      const notify = () => {
         const rId = window.location.href.match(/\/reel\/([^\/]+)/)?.[1];
         if(rId) {
             window.ReactNativeWebView.postMessage(JSON.stringify({ type: "REEL_CHANGE", reelId: rId, url: window.location.href }));
         }
      };
      history.pushState = function() { pushState.apply(history, arguments); notify(); };
      history.replaceState = function() { replaceState.apply(history, arguments); notify(); };
      window.addEventListener('popstate', notify);
  })();

  setInterval(checkReelChange, 50); // Backup Polling

  if (location.href.includes("instagram.com")) {
    const style = document.createElement("style");
    style.innerHTML = \`
      /* Force Dark Mode Background */
      html, body { background-color: #000 !important; }
      
      /* Hide Header, Footer, and Distractions */
      header, footer, nav, ._a3gq, ._aa56, div[role="dialog"] { display: none !important; }
      
      /* Optimize Video Container for Performance */
      /* Use hardware acceleration for the main scrolling container */
      ._aa-0 { 
          transform: translateZ(0);
          backface-visibility: hidden;
          perspective: 1000px;
          will-change: transform, scroll-position;
      }

      /* Global Touch Optimization - Removes 300ms tap delay & locks horizontal scroll */
      * { 
          touch-action: pan-y manipulation !important; 
          -webkit-tap-highlight-color: transparent !important;
          overscroll-behavior-y: none !important; /* Prevents bounce effects */
      }
      
      /* Invert black icons to white if needed (Generic) */
      svg[color="#000"], svg[fill="#000"] { filter: invert(1); }
      
      /* Hide more potential lag inducers (Like buttons, comments overlay) if host wants pure focus */
      /* Note: We keep some controls if needed, but reducing DOM helps */
    \`;
    document.head.appendChild(style);
  }

  // Auto-Unmute Logic
  setInterval(() => {
     const videos = document.querySelectorAll('video');
     videos.forEach(v => {
         if (v.muted) {
             v.muted = false;
         }
     });
  }, 1000);

})();
true;
`;

    // Track the last URL we reported to the parent to avoid self-reloads
    const lastReportedUrl = useRef(videoUrl);
    const [currentSource, setCurrentSource] = useState({ uri: videoUrl });

    // Update source ONLY if the new URL is materially different from what we are already at
    // Update source ONLY if the new URL is materially different from what we are already at
    useEffect(() => {
        const normalize = (u) => u?.replace(/\/$/, '').toLowerCase() || '';

        if (normalize(videoUrl) !== normalize(lastReportedUrl.current)) {
            // It's a real external change (or initial load)

            // Only hide for Viewers (who receive the change). 
            // Controllers initiating the change shouldn't flash black.
            if (!canControl) setIsReady(false);

            setCurrentSource({ uri: videoUrl }); // LOAD in background
        }
    }, [videoUrl, canControl]);

    // Viewer INTERACTION LOCK (Scroll Block, Click Allow)
    // Runs when loading ends or role changes
    useEffect(() => {
        const IS_VIEWER = !canControl;

        // This script runs every time logic changes to enforce lock or unlock
        const JS_LOCK = `
            (function() {
                window.isViewer = ${IS_VIEWER};
                
                function enforceLock() {
                    const isV = window.isViewer;
                    const val = isV ? 'hidden' : 'auto';
                    const importantVal = isV ? 'hidden !important' : 'auto';

                    document.body.style.overflow = val;
                    // Instagram specific container
                    const scrollContainer = document.querySelector('._aa-0'); 
                    if (scrollContainer) scrollContainer.style.overflow = val;
                    
                    // Force CSS Injection
                    if (isV) {
                        const styleId = 'viewer-lock-style';
                        if (!document.getElementById(styleId)) {
                             const s = document.createElement('style');
                             s.id = styleId;
                             s.innerHTML = 'body, html, ._aa-0 { overflow: hidden !important; touch-action: none !important; }'; 
                             // touch-action: none blocks scroll but might block clicks too on some browsers, 
                             // so we try manipulation if clicks fail, but for now strict lock:
                             // Actually 'touch-action: none' kills everything. 
                             // Let's use specific rule for body scrolling: only blocking Y scroll
                        }
                    }
                }

                // Event Blocker
                if (!window.scrollLockHandler) {
                    window.scrollLockHandler = function(e) {
                       if (window.isViewer) {
                           // Allow clicks/taps (targetting buttons usually)
                           // Block swipes
                           e.preventDefault(); 
                           e.stopImmediatePropagation();
                       }
                    };
                    // Block move/wheel
                    window.addEventListener('touchmove', window.scrollLockHandler, { passive: false });
                    window.addEventListener('wheel', window.scrollLockHandler, { passive: false });
                }

                enforceLock();
                // Keep enforcing in case SPA navigates
                if (window.lockInterval) clearInterval(window.lockInterval);
                if (window.isViewer) {
                    window.lockInterval = setInterval(enforceLock, 500);
                }
            })();
            true;
        `;

        if (webViewRef.current) {
            webViewRef.current.injectJavaScript(JS_LOCK);
        }
    }, [canControl, isReady]); // Re-apply on load finish (isReady)

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
                    style={[styles.webview, { opacity: isReady ? 1 : 0 }]}
                    javaScriptEnabled={true}
                    domStorageEnabled={true}
                    sharedCookiesEnabled={true} // Persist Login State
                    allowsInlineMediaPlayback={true}
                    mediaPlaybackRequiresUserAction={false} // Allow Autoplay with Sound (iOS/Android)
                    allowsBackForwardNavigationGestures={true}
                    injectedJavaScript={INJECTED_JS}
                    onLoadEnd={() => {
                        setTimeout(() => setIsReady(true), 250);
                    }}
                    onMessage={(event) => {
                        if (!canControl) return; // Only controller syncs BACK to the room

                        try {
                            const data = JSON.parse(event.nativeEvent.data);
                            if (data.type === "REEL_CHANGE") {
                                lastReportedUrl.current = data.url;
                                if (onUrlChanged) onUrlChanged(data.url);
                            }
                        } catch (e) {
                            // ignore malformed messages or legacy string messages
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
                            // Host is navigating locally. Update this ref immediately 
                            // so when the prop comes back from RoomScreen, we don't reload.
                            lastReportedUrl.current = navState.url;

                            if (onUrlChanged) onUrlChanged(navState.url);
                        }
                    }}
                />

                {/* Sync Badge Removed per user request */}
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
        pointerEvents: 'none', // Ensure touches pass through purely visual badge
    },
    syncText: {
        color: '#00ffcc',
        fontSize: 10,
        fontWeight: 'bold',
    }
});

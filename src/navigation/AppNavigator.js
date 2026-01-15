import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { Text, View } from 'react-native';

import LoginScreen from '../screens/LoginScreen';
import LobbyScreen from '../screens/LobbyScreen';
import RoomScreen from '../screens/RoomScreen';
import ChatListScreen from '../screens/ChatListScreen';
import PrivateChatScreen from '../screens/PrivateChatScreen';
import ProfileScreen from '../screens/ProfileScreen';
import PresenceManager from '../components/PresenceManager';

const Stack = createNativeStackNavigator();
const Tab = createMaterialTopTabNavigator();

function MainTabNavigator({ route }) {
    // Safety check: specific route params might be missing during hot reload
    const username = route.params?.username || "Guest";

    return (
        <Tab.Navigator
            tabBarPosition="bottom"
            screenOptions={({ route }) => ({
                swipeEnabled: true,
                tabBarStyle: {
                    backgroundColor: '#050505',
                    borderTopWidth: 1,
                    borderTopColor: '#222',
                    height: 60,
                    elevation: 0, // Remove shadow
                },
                tabBarIndicatorStyle: { height: 0 }, // Hide indicator line for cleaner look
                tabBarPressColor: 'transparent',
                tabBarShowLabel: false,
                tabBarIcon: ({ focused, color }) => {
                    const isActive = focused;
                    let label = 'Tab';
                    if (route.name === 'Chats') label = 'CHATS';
                    else if (route.name === 'Hangout') label = 'HANGOUT';
                    else if (route.name === 'Profile') label = 'PROFILE';

                    return (
                        <View style={{
                            width: 100,
                            height: '100%',
                            justifyContent: 'center',
                            alignItems: 'center',
                            // paddingTop: 10
                        }}>
                            <Text
                                numberOfLines={1}
                                style={{
                                    color: isActive ? '#6C5CE7' : '#666',
                                    fontWeight: 'bold',
                                    fontSize: 11,
                                    letterSpacing: 0.5,
                                    textAlign: 'center'
                                }}>
                                {label}
                            </Text>
                        </View>
                    );
                },
            })}
        >
            <Tab.Screen
                name="Chats"
                component={ChatListScreen}
                initialParams={{ username }}
            />
            <Tab.Screen
                name="Hangout"
                component={LobbyScreen}
                initialParams={{ username }}
            />
            <Tab.Screen
                name="Profile"
                component={ProfileScreen}
                initialParams={{ username }}
            />
        </Tab.Navigator>
    );
}

export default function AppNavigator() {
    return (
        <PresenceManager>
            <NavigationContainer>
                <Stack.Navigator
                    initialRouteName="Login"
                    screenOptions={{
                        headerShown: false,
                        contentStyle: { backgroundColor: '#050505' },
                        animation: 'none', // Instant navigation (User Request)
                        gestureEnabled: true,
                        gestureDirection: 'horizontal',
                    }}
                >
                    {/* 1. Auth */}
                    <Stack.Screen
                        name="Login"
                        component={LoginScreen}
                    />

                    {/* 2. Main App (Tabs) */}
                    <Stack.Screen
                        name="Lobby"
                        component={MainTabNavigator}
                    />

                    {/* 3. Sub-screens (Full Screen) */}
                    <Stack.Screen name="Room" component={RoomScreen} />
                    <Stack.Screen name="PrivateChat" component={PrivateChatScreen} />
                    <Stack.Screen name="Profile" component={ProfileScreen} />
                </Stack.Navigator>
            </NavigationContainer>
        </PresenceManager>
    );
}

import { Feather } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { useAuthDrawer } from '@/context/AuthDrawerContext';

const BLUE = '#0057FF';

export default function TabLayout() {
  const { session } = useAuth();
  const { showAuthDrawer } = useAuthDrawer();

  const protectedListener = (e: any) => {
    if (!session) {
      e.preventDefault();
      showAuthDrawer();
    }
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: BLUE,
        tabBarInactiveTintColor: '#ABABAB',
        tabBarShowLabel: true,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#E8E8E8',
          paddingBottom: Platform.OS === 'ios' ? 34 : 15,
          paddingTop: 12,
          elevation: 0,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
          marginTop: 2,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => (
            <Feather name="home" size={20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color }) => (
            <Feather name="compass" size={20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="publish"
        options={{
          title: 'Publish',
          tabBarIcon: ({ focused }) => (
            <View style={[
              styles.publishBtn,
              { borderColor: focused ? BLUE : '#EBEBEB' }
            ]}>
              <Feather name="plus" size={18} color={focused ? BLUE : '#111111'} />
            </View>
          ),
        }}
        listeners={{
            tabPress: protectedListener,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarIcon: ({ color }) => (
            <Feather name="message-circle" size={20} color={color} />
          ),
        }}
        listeners={{
            tabPress: protectedListener,
        }}
      />
      <Tabs.Screen
        name="profile/index"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => (
            <Feather name="user" size={20} color={color} />
          ),
        }}
        listeners={{
            tabPress: protectedListener,
        }}
      />
      <Tabs.Screen
        name="product/[id]"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="category/[id]"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="search/[query]"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="analytics/index"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="analytics/product/[id]"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="profile/my-listings"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="profile/personal-info"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="profile/security"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="profile/verification"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="product/edit/[id]"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="profile/help-center"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="seller/[id]"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="brands"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  publishBtn: {
    width: 32, // Further resized to prevent any vertical overflow
    height: 32,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4, // Aligns perfectly with standard Feather icons
  }
});

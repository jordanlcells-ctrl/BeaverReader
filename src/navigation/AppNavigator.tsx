import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {useAuth} from '../contexts/AuthContext';
import {ActivityIndicator, View, StyleSheet} from 'react-native';
import type {RootStackParamList} from '../types';

// Import screens
import {LoginScreen} from '../screens/LoginScreen';
import {SignupScreen} from '../screens/SignupScreen';
import {ForgotPasswordScreen} from '../screens/ForgotPasswordScreen';
import {HomeScreen} from '../screens/HomeScreen';
import {EPUBReaderScreen} from '../screens/EPUBReaderScreen';
import {PDFReaderScreen} from '../screens/PDFReaderScreen';
import {SettingsScreen} from '../screens/SettingsScreen';
import DecksScreen from '../screens/DecksScreen';
import DeckDetailScreen from '../screens/DeckDetailScreen';
import ReviewSessionScreen from '../screens/ReviewSessionScreen';
import StudyModeScreen from '../screens/StudyModeScreen';
import HighlightsScreen from '../screens/HighlightsScreen';
import BookmarksScreen from '../screens/BookmarksScreen';
import TableOfContentsScreen from '../screens/TableOfContentsScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const AppNavigator = () => {
  const {user, loading} = useAuth();

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {user ? (
          // Authenticated stack
          <>
            <Stack.Screen
              name="Home"
              component={HomeScreen}
              options={{
                title: 'BeaverReader',
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="BookReader"
              component={EPUBReaderScreen}
              options={{
                headerShown: false,
                animation: 'slide_from_right',
              }}
            />
            <Stack.Screen
              name="PDFReader"
              component={PDFReaderScreen}
              options={{
                headerShown: false,
                animation: 'slide_from_right',
              }}
            />
            <Stack.Screen
              name="Settings"
              component={SettingsScreen}
              options={{
                title: 'Settings',
                headerShown: true,
                animation: 'slide_from_right',
              }}
            />
            <Stack.Screen
              name="DeckList"
              component={DecksScreen}
              options={{
                title: 'Decks',
                headerShown: false,
                animation: 'slide_from_right',
              }}
            />
            <Stack.Screen
              name="DeckDetail"
              component={DeckDetailScreen}
              options={{
                title: 'Deck Details',
                headerShown: false,
                animation: 'slide_from_right',
              }}
            />
            <Stack.Screen
              name="ReviewSession"
              component={ReviewSessionScreen}
              options={{
                title: 'Review',
                headerShown: false,
                animation: 'slide_from_bottom',
                presentation: 'modal',
              }}
            />
            <Stack.Screen
              name="StudyMode"
              component={StudyModeScreen}
              options={{
                title: 'Study',
                headerShown: false,
                animation: 'slide_from_bottom',
                presentation: 'modal',
              }}
            />
            <Stack.Screen
              name="Highlights"
              component={HighlightsScreen}
              options={{
                title: 'Highlights',
                headerShown: false,
                animation: 'slide_from_right',
              }}
            />
            <Stack.Screen
              name="Bookmarks"
              component={BookmarksScreen}
              options={{
                title: 'Bookmarks',
                headerShown: false,
                animation: 'slide_from_right',
              }}
            />
            <Stack.Screen
              name="TableOfContents"
              component={TableOfContentsScreen}
              options={{
                title: 'Table of Contents',
                headerShown: false,
                animation: 'slide_from_right',
              }}
            />
          </>
        ) : (
          // Auth stack
          <>
            <Stack.Screen
              name="Login"
              component={LoginScreen}
              options={{headerShown: false}}
            />
            <Stack.Screen
              name="Signup"
              component={SignupScreen}
              options={{headerShown: false}}
            />
            <Stack.Screen
              name="ForgotPassword"
              component={ForgotPasswordScreen}
              options={{headerShown: false}}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
});

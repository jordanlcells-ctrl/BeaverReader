import React from 'react';
import {View, StyleSheet} from 'react-native';
import {SettingsContent} from '../components/SettingsContent';
import {useTheme} from '../contexts/ThemeContext';

export const SettingsScreen = () => {
  const {colors} = useTheme();
  return (
    <View style={[styles.container, {backgroundColor: colors.background}]}>
      <SettingsContent />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default SettingsScreen;

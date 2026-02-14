import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Linking,
} from 'react-native';
import {apiKeyService} from '../services/apiKeyService';
import {grammarService} from '../services/grammarService';

export const SettingsScreen = () => {
  // Translation API key
  const [translateKey, setTranslateKey] = useState('');
  const [translateSaved, setTranslateSaved] = useState(false);

  // OpenAI API key
  const [openaiKey, setOpenaiKey] = useState('');
  const [openaiSaved, setOpenaiSaved] = useState(false);

  useEffect(() => {
    loadApiKeys();
  }, []);

  const loadApiKeys = async () => {
    try {
      const savedTranslateKey = await apiKeyService.getLibreTranslateKey();
      if (savedTranslateKey) {
        setTranslateKey(savedTranslateKey);
        setTranslateSaved(true);
      }

      const savedOpenaiKey = await grammarService.getApiKey();
      if (savedOpenaiKey) {
        setOpenaiKey(savedOpenaiKey);
        setOpenaiSaved(true);
      }
    } catch (error) {
      console.error('Error loading API keys:', error);
    }
  };

  const handleSaveTranslateKey = async () => {
    if (!translateKey.trim()) {
      Alert.alert('Error', 'Please enter an API key');
      return;
    }
    try {
      await apiKeyService.saveLibreTranslateKey(translateKey.trim());
      setTranslateSaved(true);
      Alert.alert('Saved!', 'Translation API key saved successfully.');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleRemoveTranslateKey = async () => {
    try {
      await apiKeyService.removeLibreTranslateKey();
      setTranslateKey('');
      setTranslateSaved(false);
      Alert.alert('Removed', 'Translation API key removed.');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleSaveOpenAIKey = async () => {
    if (!openaiKey.trim()) {
      Alert.alert('Error', 'Please enter an API key');
      return;
    }
    try {
      await grammarService.saveApiKey(openaiKey.trim());
      setOpenaiSaved(true);
      Alert.alert('Saved!', 'OpenAI API key saved successfully.');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleRemoveOpenAIKey = async () => {
    try {
      await grammarService.clearApiKey();
      setOpenaiKey('');
      setOpenaiSaved(false);
      Alert.alert('Removed', 'OpenAI API key removed.');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Translation API Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Translation API (Optional)</Text>
        <Text style={styles.sectionDescription}>
          Works without a key (1,000 words/day free). Add a key for 10,000 words/day.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Enter MyMemory API key"
          placeholderTextColor="#A3B5A7"
          value={translateKey}
          onChangeText={setTranslateKey}
          autoCapitalize="none"
          secureTextEntry={translateSaved}
        />

        <View style={styles.buttonRow}>
          {translateSaved ? (
            <TouchableOpacity style={styles.removeButton} onPress={handleRemoveTranslateKey}>
              <Text style={styles.removeButtonText}>Remove Key</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.saveButton} onPress={handleSaveTranslateKey}>
              <Text style={styles.saveButtonText}>Save Key</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          onPress={() => Linking.openURL('https://mymemory.translated.net/doc/keygen.php')}>
          <Text style={styles.link}>Get free API key (no credit card needed)</Text>
        </TouchableOpacity>
      </View>

      {/* OpenAI API Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>OpenAI API (Required for AI Features)</Text>
        <Text style={styles.sectionDescription}>
          Required for: Spanish word definitions & conjugations, English verb conjugations, "Ask AI" grammar explanations.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Enter OpenAI API key"
          placeholderTextColor="#A3B5A7"
          value={openaiKey}
          onChangeText={setOpenaiKey}
          autoCapitalize="none"
          secureTextEntry={openaiSaved}
        />

        <View style={styles.buttonRow}>
          {openaiSaved ? (
            <TouchableOpacity style={styles.removeButton} onPress={handleRemoveOpenAIKey}>
              <Text style={styles.removeButtonText}>Remove Key</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.saveButton} onPress={handleSaveOpenAIKey}>
              <Text style={styles.saveButtonText}>Save Key</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          onPress={() => Linking.openURL('https://platform.openai.com/api-keys')}>
          <Text style={styles.link}>Get OpenAI API key</Text>
        </TouchableOpacity>
      </View>

      {/* About Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <Text style={styles.aboutText}>BeaverReader v1.0</Text>
        <Text style={styles.aboutSubtext}>Language learning through reading</Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9F7F1',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  section: {
    backgroundColor: '#FAF8F3',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E8DDD0',
    shadowColor: '#8B7355',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4A5D3F',
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#8A8171',
    lineHeight: 20,
    marginBottom: 16,
  },
  input: {
    backgroundColor: '#FAF8F3',
    padding: 16,
    borderRadius: 12,
    fontSize: 16,
    color: '#3D5A46',
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#E8DDD0',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#6B8E73',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  removeButton: {
    flex: 1,
    backgroundColor: '#C48B6C',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  removeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  link: {
    fontSize: 14,
    color: '#6B8E73',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  aboutText: {
    fontSize: 16,
    color: '#3D5A46',
    fontWeight: '600',
    marginBottom: 4,
  },
  aboutSubtext: {
    fontSize: 14,
    color: '#8A8171',
  },
});

export default SettingsScreen;

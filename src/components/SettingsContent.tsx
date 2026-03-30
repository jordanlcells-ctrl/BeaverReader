import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import {useAuth} from '../contexts/AuthContext';
import {useTheme} from '../contexts/ThemeContext';
import {
  readingPreferencesService,
  type AppTheme,
  type EpubFontSize,
  type PdfReaderMode,
  type PdfTextFontSize,
} from '../services/readingPreferencesService';

export const SettingsContent: React.FC = () => {
  const {user, signOut, deleteAccount} = useAuth();
  const {theme, setTheme, colors} = useTheme();
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [epubFontSize, setEpubFontSize] = useState<EpubFontSize>('medium');
  const [pdfDefaultView, setPdfDefaultView] = useState<PdfReaderMode>('text');
  const [pdfTextFontSize, setPdfTextFontSize] = useState<PdfTextFontSize>('medium');

  const loadReadingPrefs = useCallback(async () => {
    try {
      const [epub, pdf, pdfText] = await Promise.all([
        readingPreferencesService.getEpubFontSize(),
        readingPreferencesService.getPdfDefaultView(),
        readingPreferencesService.getPdfTextFontSize(),
      ]);
      setEpubFontSize(epub);
      setPdfDefaultView(pdf);
      setPdfTextFontSize(pdfText);
    } catch (_) {}
  }, []);

  useEffect(() => {
    loadReadingPrefs();
  }, [loadReadingPrefs]);

  const handleSetEpubFontSize = async (size: EpubFontSize) => {
    setEpubFontSize(size);
    await readingPreferencesService.setEpubFontSize(size);
  };

  const handleSetPdfDefaultView = async (mode: PdfReaderMode) => {
    setPdfDefaultView(mode);
    await readingPreferencesService.setPdfDefaultView(mode);
  };

  const handleSetPdfTextFontSize = async (size: PdfTextFontSize) => {
    setPdfTextFontSize(size);
    await readingPreferencesService.setPdfTextFontSize(size);
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      {text: 'Cancel', style: 'cancel'},
      {text: 'Sign Out', style: 'destructive', onPress: signOut},
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all your data (books, highlights, flashcards). This cannot be undone.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete My Account',
          style: 'destructive',
          onPress: async () => {
            setDeletingAccount(true);
            try {
              await deleteAccount();
            } catch (error: any) {
              Alert.alert('Error', error.message ?? 'Failed to delete account. Please try again or contact support.');
            } finally {
              setDeletingAccount(false);
            }
          },
        },
      ],
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}>
      {/* Reading */}
      <View style={[styles.settingsCard, {backgroundColor: colors.cardBackground, borderColor: colors.cardBorder}]}>
        <Text style={[styles.settingsCardTitle, {color: colors.text}]}>Reading</Text>
        <Text style={[styles.settingsOptionLabel, {color: colors.textMuted}]}>EPUB text size</Text>
        <View style={styles.settingsOptionRow}>
          {(['small', 'medium', 'large'] as EpubFontSize[]).map((size) => (
            <TouchableOpacity
              key={size}
              style={[
                styles.settingsChip,
                {backgroundColor: epubFontSize === size ? colors.chipBgActive : colors.chipBg},
              ]}
              onPress={() => handleSetEpubFontSize(size)}
              activeOpacity={0.7}>
              <Text
                style={[
                  styles.settingsChipText,
                  {color: epubFontSize === size ? colors.textInverse : colors.text},
                ]}>
                {size.charAt(0).toUpperCase() + size.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={[styles.settingsOptionLabel, {marginTop: 14, color: colors.textMuted}]}>PDF text view size</Text>
        <View style={styles.settingsOptionRow}>
          {(['small', 'medium', 'large'] as PdfTextFontSize[]).map((size) => (
            <TouchableOpacity
              key={size}
              style={[
                styles.settingsChip,
                {backgroundColor: pdfTextFontSize === size ? colors.chipBgActive : colors.chipBg},
              ]}
              onPress={() => handleSetPdfTextFontSize(size)}
              activeOpacity={0.7}>
              <Text
                style={[
                  styles.settingsChipText,
                  {color: pdfTextFontSize === size ? colors.textInverse : colors.text},
                ]}>
                {size.charAt(0).toUpperCase() + size.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={[styles.settingsOptionLabel, {marginTop: 14, color: colors.textMuted}]}>PDF default view</Text>
        <View style={styles.settingsOptionRow}>
          <TouchableOpacity
            style={[styles.settingsChip, {backgroundColor: pdfDefaultView === 'text' ? colors.chipBgActive : colors.chipBg}]}
            onPress={() => handleSetPdfDefaultView('text')}
            activeOpacity={0.7}>
            <Text
              style={[styles.settingsChipText, {color: pdfDefaultView === 'text' ? colors.textInverse : colors.text}]}>
              Text view
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.settingsChip, {backgroundColor: pdfDefaultView === 'pdf' ? colors.chipBgActive : colors.chipBg}]}
            onPress={() => handleSetPdfDefaultView('pdf')}
            activeOpacity={0.7}>
            <Text
              style={[styles.settingsChipText, {color: pdfDefaultView === 'pdf' ? colors.textInverse : colors.text}]}>
              Page view
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      {/* Appearance */}
      <View style={[styles.settingsCard, {backgroundColor: colors.cardBackground, borderColor: colors.cardBorder}]}>
        <Text style={[styles.settingsCardTitle, {color: colors.text}]}>Appearance</Text>
        <Text style={[styles.settingsOptionLabel, {color: colors.textMuted}]}>Theme</Text>
        <View style={styles.settingsOptionRow}>
          {(['light', 'dark', 'system'] as AppTheme[]).map((t) => (
            <TouchableOpacity
              key={t}
              style={[
                styles.settingsChip,
                {backgroundColor: theme === t ? colors.chipBgActive : colors.chipBg},
              ]}
              onPress={() => setTheme(t)}
              activeOpacity={0.7}>
              <Text
                style={[
                  styles.settingsChipText,
                  {color: theme === t ? colors.textInverse : colors.text},
                ]}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <TouchableOpacity
        style={[styles.signOutButton, {backgroundColor: colors.signOutBg, borderColor: colors.signOutBorder}]}
        onPress={handleSignOut}
        activeOpacity={0.7}>
        <Text style={[styles.signOutText, {color: colors.signOutText}]}>Sign Out</Text>
      </TouchableOpacity>
      {user?.email && (
        <Text style={[styles.emailText, {color: colors.emailText}]}>{user.email}</Text>
      )}
      <TouchableOpacity
        style={[styles.deleteAccountButton, deletingAccount && styles.deleteAccountButtonDisabled]}
        onPress={handleDeleteAccount}
        activeOpacity={0.7}
        disabled={deletingAccount}>
        <Text style={styles.deleteAccountText}>
          {deletingAccount ? 'Deleting…' : 'Delete Account'}
        </Text>
      </TouchableOpacity>
      <Text style={[styles.deleteAccountHint, {color: colors.textMuted}]}>
        Permanently removes all your data
      </Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  settingsCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 14,
    borderWidth: 1,
    shadowColor: '#8B7355',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  settingsCardTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 6,
    letterSpacing: -0.2,
  },
  settingsOptionLabel: {
    fontSize: 14,
    marginBottom: 8,
    fontWeight: '600',
  },
  settingsOptionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  settingsChip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  settingsChipText: {
    fontSize: 15,
    fontWeight: '600',
  },
  signOutButton: {
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: 12,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '600',
  },
  emailText: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 20,
  },
  deleteAccountButton: {
    padding: 14,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#c0392b',
    backgroundColor: 'transparent',
    marginTop: 8,
    marginBottom: 4,
  },
  deleteAccountButtonDisabled: {
    opacity: 0.5,
  },
  deleteAccountText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#c0392b',
  },
  deleteAccountHint: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 32,
  },
});

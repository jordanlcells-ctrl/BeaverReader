import {NativeModules, Platform} from 'react-native';

const {FilePicker} = NativeModules;

export interface PickedFile {
  name: string;
  uri: string;
  type: 'epub' | 'pdf';
  path: string;
}

/**
 * Pick an EPUB or PDF file. Android uses native FilePicker.
 * iOS: File picker not yet implemented - use Android or add @react-native-documents/picker when building for iOS.
 */
export const pickFile = async (): Promise<PickedFile> => {
  if (Platform.OS === 'ios') {
    throw new Error('Adding books is not yet supported on iOS. Please use Android.');
  }
  return FilePicker.pickFile();
};

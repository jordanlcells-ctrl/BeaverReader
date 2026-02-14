import {NativeModules} from 'react-native';

const {FilePicker} = NativeModules;

export interface PickedFile {
  name: string;
  uri: string;
  type: 'epub' | 'pdf';
  path: string;
}

export const pickFile = (): Promise<PickedFile> => {
  return FilePicker.pickFile();
};

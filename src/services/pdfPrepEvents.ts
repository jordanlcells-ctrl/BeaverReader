import {DeviceEventEmitter} from 'react-native';

export const PDF_PREP_DONE = 'beaverreader:pdfPrepDone';

/** After background prep, first open should use reader (text) mode */
export function pdfFirstTextOpenKey(bookId: string) {
  return `pdf_first_text_${bookId}`;
}

export function emitPdfPrepDone(bookId: string) {
  DeviceEventEmitter.emit(PDF_PREP_DONE, bookId);
}

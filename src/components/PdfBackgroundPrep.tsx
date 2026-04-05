import React, {useCallback, useEffect, useRef, useState} from 'react';
import {View, StyleSheet} from 'react-native';
import {WebView} from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import {getPdfReaderHtml} from '../utils/pdfReaderHtml';
import {pdfTextCache} from '../services/pdfCache';
import {bookService} from '../services/bookService';
import {readingPreferencesService} from '../services/readingPreferencesService';
import {emitPdfPrepDone, pdfFirstTextOpenKey} from '../services/pdfPrepEvents';
import {useTheme} from '../contexts/ThemeContext';

const IDLE_HTML =
  '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body></body></html>';

export type PdfPrepTask = {bookId: string; filePath: string};

type Props = {
  task: PdfPrepTask | null;
  onFinished: () => void;
};

export function PdfBackgroundPrep({task, onFinished}: Props) {
  const {resolvedTheme} = useTheme();
  const darkMode = resolvedTheme === 'dark';
  const webRef = useRef<WebView>(null);
  const [webviewReady, setWebviewReady] = useState(false);
  const injectedRef = useRef(false);
  const finishedRef = useRef(false);
  const taskIdRef = useRef<string | null>(null);
  const finishRef = useRef<(bookId: string, readerTextOk: boolean) => void>(() => {});

  const finish = useCallback(
    (bookId: string, readerTextOk: boolean) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      if (readerTextOk) {
        AsyncStorage.setItem(pdfFirstTextOpenKey(bookId), '1').catch(() => {});
      }
      emitPdfPrepDone(bookId);
      injectedRef.current = false;
      setWebviewReady(false);
      taskIdRef.current = null;
      onFinished();
    },
    [onFinished],
  );

  finishRef.current = finish;

  useEffect(() => {
    finishedRef.current = false;
    injectedRef.current = false;
    setWebviewReady(false);
    taskIdRef.current = task?.bookId ?? null;
  }, [task?.bookId]);

  useEffect(() => {
    if (!task) return;
    const bookId = task.bookId;
    const t = setTimeout(() => finishRef.current(bookId, false), 180000);
    return () => clearTimeout(t);
  }, [task?.bookId]);

  useEffect(() => {
    if (!task || !webviewReady || injectedRef.current) return;
    injectedRef.current = true;

    (async () => {
      try {
        let filePath = task.filePath;
        if (filePath.startsWith('file://')) {
          filePath = filePath.substring(7);
        }
        const exists = await RNFS.exists(filePath);
        if (!exists) {
          finish(task.bookId, false);
          return;
        }
        const cachedText = pdfTextCache.get(task.bookId);
        const fontPx = await readingPreferencesService.getPdfTextFontSizePx();
        const fileUrl = `file://${filePath}`;
        const js = `
          window.__backgroundPrepOnly = true;
          window.pdfFileUrl = ${JSON.stringify(fileUrl)};
          window.cachedExtractedText = ${cachedText ? JSON.stringify(cachedText) : 'null'};
          window.__pdfTextFontSize = ${fontPx};
          if (window.initReaderWithData) window.initReaderWithData();
          else setTimeout(function(){ if (window.initReaderWithData) window.initReaderWithData(); }, 400);
          true;
        `;
        webRef.current?.injectJavaScript(js);
      } catch {
        finish(task.bookId, false);
      }
    })();
  }, [task, webviewReady, finish]);

  const onMessage = useCallback(
    (event: {nativeEvent: {data: string}}) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        const activeId = taskIdRef.current;
        if (!activeId || !task || task.bookId !== activeId) return;

        if (data.type === 'webviewReady') {
          setWebviewReady(true);
          return;
        }
        if (data.type === 'ready') {
          webRef.current?.injectJavaScript(
            'if (window.__runBackgroundTextPrep) window.__runBackgroundTextPrep(); true;',
          );
          return;
        }
        if (data.type === 'textExtracted' && typeof data.text === 'string') {
          pdfTextCache.set(task.bookId, data.text);
          bookService.updateBook(task.bookId, {extracted_text: data.text}).catch(() => {});
          return;
        }
        if (data.type === 'prepExtractDone') {
          finish(task.bookId, !!data.ok);
          return;
        }
        if (data.type === 'error') {
          finish(task.bookId, false);
        }
      } catch {
        /* ignore */
      }
    },
    [task, finish],
  );

  const filesBase = `file://${RNFS.DocumentDirectoryPath}/`;
  const source = task
    ? {html: getPdfReaderHtml(darkMode), baseUrl: filesBase}
    : {html: IDLE_HTML, baseUrl: filesBase};

  return (
    <View style={styles.hidden} pointerEvents="none" collapsable={false}>
      <WebView
        key={task?.bookId ?? '__idle__'}
        ref={webRef}
        source={source}
        onMessage={onMessage}
        style={styles.wv}
        javaScriptEnabled
        domStorageEnabled
        allowFileAccess
        allowUniversalAccessFromFileURLs
        mixedContentMode="always"
        scrollEnabled={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hidden: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
    overflow: 'hidden',
    left: -20,
    top: -20,
  },
  wv: {width: 1, height: 1},
});

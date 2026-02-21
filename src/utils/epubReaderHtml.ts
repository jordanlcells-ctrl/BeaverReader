/**
 * EPUB Reader – renderless (section HTML into div, no iframe).
 * Passes EPUB as ArrayBuffer to ePub() so all chapter content is read
 * from the in-memory JSZip archive (no XHR/fetch needed on Android).
 *
 * Load with source={{ html: getEpubReaderHtml(), baseUrl: 'https://localhost' }}.
 * Inject: window.epubBase64 = '<base64>'; window.savedCfi = null; window.startReader();
 */
export function getEpubReaderHtml(): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <title>EPUB Reader</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"><\/script>
  <script src="https://cdn.jsdelivr.net/npm/epubjs/dist/epub.min.js"><\/script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { height: 100%; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #fff; color: #000; }
    #viewer {
      position: absolute;
      left: 0; top: 0; right: 0; bottom: 0;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      padding: 20px;
      padding-top: calc(env(safe-area-inset-top, 0px) + 20px);
      padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 20px);
      -webkit-user-select: text;
      user-select: text;
    }
    #status { color: #666; font-size: 13px; padding: 8px 0; }
    #epub-content { font-size: 18px; line-height: 1.7; color: #1a1a1a; }
    #epub-content img { max-width: 100%; height: auto; display: block; margin: 8px 0; }
    #epub-content p { margin: 0 0 12px; }
    #epub-content h1,#epub-content h2,#epub-content h3 { margin: 16px 0 8px; }
  </style>
</head>
<body>
<div id="viewer">
  <div id="status">Loading…<\/div>
  <div id="epub-content"><\/div>
<\/div>
<script>
(function() {
  var book = null;
  var currentSectionIndex = 0;
  var spineItems = [];
  var highlightMap = {};

  function send(data) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(data));
  }
  function setStatus(msg) {
    var el = document.getElementById('status');
    if (el) el.textContent = msg;
  }

  function base64ToArrayBuffer(b64) {
    var binary = atob(b64);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  }

  function startReader() {
    if (!window.epubBase64) {
      send({ type: 'error', message: 'No EPUB data provided' });
      return;
    }
    if (typeof ePub === 'undefined') {
      send({ type: 'error', message: 'epub.js not loaded (CDN failed)' });
      return;
    }
    setStatus('Parsing EPUB…');
    var ab = base64ToArrayBuffer(window.epubBase64);
    init(ab, window.savedCfi || null);
  }

  function init(arrayBuffer, savedCfi) {
    try {
      book = ePub(arrayBuffer);

      book.ready.then(function() {
        setStatus('Building spine…');
        spineItems = [];
        book.spine.each(function(item) { spineItems.push(item); });
        if (spineItems.length === 0) {
          send({ type: 'error', message: 'Spine is empty' });
          return;
        }
        setStatus('');
        showSection(0);

        document.addEventListener('touchend', sendSelection);
        document.addEventListener('mouseup', sendSelection);
      }).catch(function(err) {
        var msg = (err && err.message) || 'book.ready failed';
        setStatus('Error: ' + msg);
        send({ type: 'error', message: msg });
      });
    } catch (err) {
      var msg = (err && err.message) || 'ePub() threw';
      setStatus('Error: ' + msg);
      send({ type: 'error', message: msg });
    }
  }

  function showSection(index) {
    if (index < 0 || index >= spineItems.length) return;
    currentSectionIndex = index;
    var section = spineItems[index];
    setStatus('Loading chapter ' + (index + 1) + '/' + spineItems.length + '…');
    section.load(book.load.bind(book)).then(function(contents) {
      var html = '';
      try {
        html = (new XMLSerializer()).serializeToString(contents);
      } catch(e) {
        html = contents && contents.outerHTML ? contents.outerHTML : String(contents);
      }
      var el = document.getElementById('epub-content');
      if (el) el.innerHTML = html;
      document.getElementById('viewer').scrollTop = 0;
      setStatus('');
      var pct = spineItems.length > 1 ? index / (spineItems.length - 1) : 1;
      var cfi = section.cfiBase || ('section-' + index);
      send({ type: 'locationChanged', cfi: cfi, percentage: pct });
    }).catch(function(err) {
      var msg = (err && err.message) || 'section.load failed';
      setStatus('Error: ' + msg);
      send({ type: 'error', message: msg });
    });
  }

  var pendingText = null;
  function sendSelection() {
    var sel = window.getSelection();
    var text = sel ? sel.toString().trim() : '';
    if (text && text !== pendingText) {
      pendingText = text;
      send({ type: 'textSelected', text: text, cfi: '' });
      setTimeout(function() { pendingText = null; }, 500);
    }
  }

  function addHighlight(cfi, color, text, dbId) {
    highlightMap[cfi] = { text: text || '', color: color || '#ffeb3b', dbId: dbId || null };
  }
  function removeHighlight(cfi) { delete highlightMap[cfi]; }
  function updateHighlightColor(cfi, color) {
    var d = highlightMap[cfi];
    if (d) { d.color = color; }
  }

  function handleCommand(msg) {
    var c = msg.command;
    if (c === 'next') showSection(currentSectionIndex + 1);
    else if (c === 'prev') showSection(currentSectionIndex - 1);
    else if (c === 'addHighlight') addHighlight(msg.cfi, msg.color, msg.text, msg.dbId);
    else if (c === 'removeHighlight') removeHighlight(msg.cfi);
    else if (c === 'updateHighlightColor') updateHighlightColor(msg.cfi, msg.color);
    else if (c === 'restoreHighlights' && Array.isArray(msg.highlights)) {
      msg.highlights.forEach(function(h) { addHighlight(h.cfi, h.color, h.text, h.dbId); });
    }
  }

  window.startReader = startReader;
  window.handleEpubCommand = handleCommand;
  window.addEventListener('message', function(e) { try { handleCommand(JSON.parse(e.data)); } catch(_) {} });
  document.addEventListener('message', function(e) { try { handleCommand(JSON.parse(e.data)); } catch(_) {} });

  function onReady() {
    if (typeof ePub !== 'undefined') { send({ type: 'ready' }); return; }
    setTimeout(onReady, 100);
  }
  if (document.readyState === 'complete') onReady();
  else window.addEventListener('load', onReady);
  setTimeout(function() { if (typeof ePub === 'undefined') setStatus('CDN load timeout – check internet'); send({ type: 'ready' }); }, 5000);
})();
<\/script>
</body>
</html>`;
}

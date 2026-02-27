/**
 * EPUB Reader – CSS multi-column paginator (no iframe, no scrolling).
 * The content div uses CSS columns (each = one page width) and navigation
 * slides between them with translateX. Font size changes just re-paginate.
 *
 * Load with: source={{ html: getEpubReaderHtml(), baseUrl: 'https://localhost' }}
 * Inject:    window.epubBase64 = '<base64>'; window.startReader();
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
    html, body { height: 100%; overflow: hidden; background: #fff; }
    #reader {
      position: fixed; inset: 0;
      padding: 16px 22px;
      padding-top: calc(env(safe-area-inset-top, 0px) + 16px);
      padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 16px);
      overflow: hidden;
      touch-action: none;
      -webkit-user-select: text; user-select: text;
    }
    #page-window { width: 100%; height: 100%; overflow: hidden; position: relative; }
    #epub-content { position: absolute; top: 0; left: 0; will-change: transform; }
    #status {
      position: fixed; bottom: 6px; left: 0; right: 0;
      text-align: center; font-family: -apple-system, sans-serif;
      font-size: 12px; color: #bbb; pointer-events: none;
    }
  <\/style>
</head>
<body>
<div id="reader">
  <div id="page-window">
    <div id="epub-content"><\/div>
  <\/div>
<\/div>
<div id="status">Waiting for epub.js…<\/div>
<script>
(function () {
  var book = null;
  var spineItems = [];
  var currentSectionIndex = 0;
  var currentPage = 0;
  var totalPages = 1;
  var highlightMap = {};
  var fontSize = 18;
  var lineHeight = 1.65;
  var PW = 0, PH = 0;

  function send(data) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(data));
  }
  function setStatus(msg) {
    var el = document.getElementById('status');
    if (el) el.textContent = msg;
  }

  function measurePage() {
    var win = document.getElementById('page-window');
    if (!win) return;
    PW = win.clientWidth;
    PH = win.clientHeight;
  }

  function applyOverrideSheet() {
    var s = document.getElementById('epub-override');
    if (!s) { s = document.createElement('style'); s.id = 'epub-override'; document.head.appendChild(s); }
    s.textContent =
      '#epub-content, #epub-content p, #epub-content div, #epub-content span,' +
      '#epub-content li, #epub-content td, #epub-content blockquote {' +
        'font-size:' + fontSize + 'px !important;' +
        'line-height:' + lineHeight + ' !important;' +
        'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif !important;' +
        'color:#1a1a1a !important; background:transparent !important; max-width:100% !important;' +
      '}' +
      '#epub-content h1,#epub-content h2,#epub-content h3,#epub-content h4 {' +
        'font-size:' + Math.round(fontSize * 1.25) + 'px !important;' +
        'line-height:1.3 !important; margin:0 0 10px 0 !important;' +
      '}' +
      '#epub-content img {' +
        'max-width:100% !important; max-height:' + Math.round(PH * 0.8) + 'px !important;' +
        'object-fit:contain !important; display:block !important;' +
        'break-inside:avoid !important; margin:6px auto !important;' +
      '}' +
      '#epub-content a { color:#007AFF !important; }' +
      '#epub-content em,#epub-content i { font-style:italic !important; }' +
      '#epub-content strong,#epub-content b { font-weight:bold !important; }';
  }

  function paginate(callback) {
    var el = document.getElementById('epub-content');
    if (!el) return;
    var maxCols = 500;
    el.style.width = (maxCols * PW) + 'px';
    el.style.height = PH + 'px';
    el.style.columnWidth = PW + 'px';
    el.style.webkitColumnWidth = PW + 'px';
    el.style.columnGap = '0px';
    el.style.webkitColumnGap = '0px';
    el.style.columnFill = 'auto';
    el.style.webkitColumnFill = 'auto';
    el.style.wordWrap = 'break-word';
    el.style.wordBreak = 'break-word';
    el.style.overflowX = 'visible';
    el.style.overflowY = 'visible';
    function measure() {
      var totalW = el.scrollWidth;
      totalPages = Math.max(1, Math.ceil(totalW / PW));
      if (callback) callback();
    }
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        measure();
        if (totalPages === 1 && el.scrollHeight > PH * 1.5) {
          setTimeout(function () { measure(); if (callback) callback(); }, 80);
        }
      });
    });
  }

  function showPage(idx) {
    if (idx < 0) idx = 0;
    if (idx >= totalPages) idx = totalPages - 1;
    currentPage = idx;
    var el = document.getElementById('epub-content');
    if (el) el.style.transform = 'translateX(-' + (idx * PW) + 'px)';
  }

  function goNext() {
    if (currentPage < totalPages - 1) showPage(currentPage + 1);
    else showSection(currentSectionIndex + 1, false);
  }
  function goPrev() {
    if (currentPage > 0) showPage(currentPage - 1);
    else showSection(currentSectionIndex - 1, true);
  }

  function stripEpubStyles(html) {
    html = html.replace(/<style[^>]*>[\\s\\S]*?<\\/style>/gi, '');
    html = html.replace(/<link[^>]+stylesheet[^>]*\\/?>\\s*/gi, '');
    html = html.replace(/\\sstyle="([^"]*)"/gi, function (match, styles) {
      var cleaned = styles
        .replace(/font-size\\s*:[^;]+;?/gi, '')
        .replace(/line-height\\s*:[^;]+;?/gi, '')
        .replace(/color\\s*:[^;]+;?/gi, '')
        .replace(/font-family\\s*:[^;]+;?/gi, '').trim();
      return cleaned ? ' style="' + cleaned + '"' : '';
    });
    return html;
  }

  function resolvePath(base, rel) {
    if (!rel) return '';
    var dir = base ? base.replace(/[^\\/]+$/, '') : '';
    var parts = (dir + rel).replace(/\\\\/g, '/').split('/');
    var out = [];
    for (var i = 0; i < parts.length; i++) {
      if (parts[i] === '..') out.pop();
      else if (parts[i] !== '.' && parts[i] !== '') out.push(parts[i]);
    }
    return out.join('/');
  }

  function loadImages(el, baseHref) {
    var zip = book.archive && book.archive.zip;
    var imgs = el.querySelectorAll('img');
    for (var i = 0; i < imgs.length; i++) {
      (function (img) {
        var src = img.getAttribute('src');
        if (!src || src.indexOf('data:') === 0 || src.indexOf('blob:') === 0) return;
        var decoded = src; try { decoded = decodeURIComponent(src); } catch (e) {}
        var resolved = resolvePath(baseHref, decoded);
        var ext = resolved.split('.').pop().toLowerCase().split('?')[0];
        var mime = { png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg', gif:'image/gif', svg:'image/svg+xml', webp:'image/webp' }[ext] || 'image/jpeg';

        function setBlob(blob) {
          img.onload = function () { paginate(function () { showPage(currentPage); }); };
          img.src = URL.createObjectURL(new Blob([blob], { type: mime }));
        }
        function tryZip() {
          if (!zip) return false;
          var entry = zip.file(resolved);
          if (!entry) { var d2=resolved; try{d2=decodeURIComponent(resolved);}catch(e){} entry=zip.file(d2); }
          if (!entry) { var name=resolved.split('/').pop(); zip.forEach(function(p,z){if(!entry&&p.split('/').pop()===name)entry=z;}); }
          if (!entry) return false;
          entry.async('blob').then(setBlob).catch(function(){});
          return true;
        }
        if (!tryZip()) {
          book.load(resolved).then(function(data){
            if (!data) return;
            if (data instanceof Blob) { setBlob(data); return; }
            if (data instanceof ArrayBuffer) { setBlob(new Blob([data],{type:mime})); return; }
            if (typeof data==='string') img.src = data.indexOf('data:')===0 ? data : 'data:'+mime+';base64,'+btoa(data);
          }).catch(function(){});
        }
      })(imgs[i]);
    }
  }

  function showSection(index, startAtEnd) {
    if (index < 0 || index >= spineItems.length) return;
    currentSectionIndex = index;
    var section = spineItems[index];
    setStatus('Loading…');
    section.load(book.load.bind(book)).then(function (contents) {
      var root = contents.nodeType === 1 ? contents : (contents.documentElement || contents);
      var baseHref = section.href || section.url || '';
      var html = '';
      try { html = (new XMLSerializer()).serializeToString(root); } catch (e) { html = root.outerHTML || ''; }
      html = stripEpubStyles(html);
      var el = document.getElementById('epub-content');
      el.style.transform = 'translateX(0)';
      el.innerHTML = html;
      applyOverrideSheet();
      measurePage();
      paginate(function () {
        if (startAtEnd) showPage(totalPages - 1); else showPage(0);
        setStatus('');
        var pct = spineItems.length > 1 ? index / (spineItems.length - 1) : 1;
        send({ type: 'locationChanged', cfi: 'section-' + index, percentage: pct });
      });
      loadImages(el, baseHref);
    }).catch(function (err) {
      var msg = (err && err.message) || 'Load failed';
      setStatus('Error: ' + msg);
      send({ type: 'error', message: msg });
    });
  }

  function startReader() {
    if (!window.epubBase64) { send({ type:'error', message:'No EPUB data' }); return; }
    if (typeof ePub === 'undefined') { send({ type:'error', message:'epub.js not loaded' }); return; }
    setStatus('Parsing…');
    var bytes = atob(window.epubBase64);
    var buf = new Uint8Array(bytes.length);
    for (var i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i);
    try {
      book = ePub(buf.buffer);
      book.ready.then(function () {
        spineItems = [];
        book.spine.each(function (item) { spineItems.push(item); });
        if (!spineItems.length) { send({ type:'error', message:'Empty spine' }); return; }
        measurePage();
        showSection(0, false);

        var sy = 0;
        document.addEventListener('touchstart', function (e) { sy = e.touches[0] ? e.touches[0].clientY : 0; }, { passive: true });
        document.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });
        document.addEventListener('touchend', function (e) {
          var ey = e.changedTouches[0] ? e.changedTouches[0].clientY : sy;
          var dy = sy - ey;
          if (Math.abs(dy) > 40) { if (dy > 0) goNext(); else goPrev(); }
        }, { passive: true });

        var lastSent = null;
        document.addEventListener('touchend', function () {
          setTimeout(function () {
            var sel = window.getSelection();
            var text = sel ? sel.toString().trim() : '';
            if (text && text !== lastSent) {
              lastSent = text;
              send({ type:'textSelected', text:text, cfi:'' });
              setTimeout(function(){ lastSent=null; }, 1000);
            }
          }, 100);
        });
      }).catch(function (err) {
        send({ type:'error', message:(err&&err.message)||'book.ready failed' });
      });
    } catch (err) {
      send({ type:'error', message:(err&&err.message)||'ePub() failed' });
    }
  }

  function handleCommand(msg) {
    var c = msg.command;
    if (c === 'next') goNext();
    else if (c === 'prev') goPrev();
    else if (c === 'setFontSize' && msg.size) {
      fontSize = msg.size; applyOverrideSheet();
      paginate(function () { showPage(currentPage); });
    }
    else if (c === 'addHighlight') highlightMap[msg.cfi] = msg;
    else if (c === 'removeHighlight') delete highlightMap[msg.cfi];
    else if (c === 'updateHighlightColor' && highlightMap[msg.cfi]) highlightMap[msg.cfi].color = msg.color;
    else if (c === 'restoreHighlights' && Array.isArray(msg.highlights))
      msg.highlights.forEach(function (h) { if (h.cfi) highlightMap[h.cfi] = h; });
  }

  window.startReader = startReader;
  window.handleEpubCommand = handleCommand;
  window.addEventListener('message', function (e) { try { handleCommand(JSON.parse(e.data)); } catch (_) {} });
  document.addEventListener('message', function (e) { try { handleCommand(JSON.parse(e.data)); } catch (_) {} });

  function onReady() {
    if (typeof ePub !== 'undefined') { setStatus('Ready…'); send({ type:'ready' }); return; }
    setTimeout(onReady, 200);
  }
  if (document.readyState === 'complete') onReady();
  else window.addEventListener('load', onReady);
  setTimeout(function () { if (typeof ePub==='undefined') setStatus('CDN timeout'); send({ type:'ready' }); }, 8000);
})();
<\/script>
</body>
</html>`;
}

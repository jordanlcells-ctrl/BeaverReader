/**
 * EPUB Reader – CSS multi-column paginator (no iframe, no scrolling).
 * The content div uses CSS columns (each = one page width) and navigation
 * slides between them with translateX. Font size changes just re-paginate.
 *
 * Load with: source={{ html: getEpubReaderHtml(darkMode), baseUrl: 'https://localhost' }}
 * Or with asset scripts: getEpubReaderHtml(darkMode, true), baseUrl: 'file:///android_asset/'
 * Inject:    window.epubBase64 = '<base64>'; window.startReader();
 */
export function getEpubReaderHtml(darkMode = false, loadLibsFromAsset = false): string {
  const bg = darkMode ? '#1a1a1a' : '#fff';
  const statusColor = darkMode ? '#6b7280' : '#bbb';
  const assetScripts = loadLibsFromAsset
    ? '  <script src="jszip.min.js"><\/script>\n  <script src="epub.min.js"><\/script>\n  '
    : '';
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <title>EPUB Reader</title>
  ${assetScripts}
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { height: 100%; overflow: hidden; background: ${bg}; }
    #reader {
      position: fixed; inset: 0;
      padding: 16px 22px;
      padding-top: calc(env(safe-area-inset-top, 0px) + 16px);
      padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 16px);
      overflow: hidden;
      touch-action: manipulation;
      -webkit-user-select: text; user-select: text;
    }
    #page-window { width: 100%; height: 100%; overflow: hidden; position: relative; }
    #epub-content { position: absolute; top: 0; left: 0; will-change: transform; transition: opacity 0.15s ease-out; }
    #status {
      position: fixed; bottom: 6px; left: 0; right: 0;
      text-align: center; font-family: -apple-system, sans-serif;
      font-size: 12px; color: ${statusColor}; pointer-events: none;
    }
  <\/style>
</head>
<body>
<div id="reader">
  <div id="page-window">
    <div id="epub-content"><\/div>
  <\/div>
<\/div>
<div id="status">Loading…<\/div>
<script>
window.onerror = function (msg, url, line, col, err) {
  var detail = msg + ' at ' + (url||'?') + ':' + line + ':' + col;
  if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'debug', msg: 'JS ERROR: ' + detail }));
  }
};
(function () {
  var book = null;
  var spineItems = [];
  var currentSectionIndex = 0;
  var currentPage = 0;
  var totalPages = 1;
  var highlightMap = {};
  var fontSize = 18;

  // PDF-style: simple id in onclick, payload in map (no escaping issues)
  window._epubHighlightById = {};
  window.handleEpubHighlightClick = function (id) {
    var p = window._epubHighlightById && window._epubHighlightById[id];
    if (p) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'highlightClicked',
          text: p.text || '',
          cfi: p.cfi || '',
          color: p.color || '',
          dbId: p.dbId != null ? p.dbId : null
        }));
      }
    }
  };

  function applyHighlightsInContent(contentEl) {
    if (!contentEl) return;
    try {
      window._epubHighlightById = {};
      var hlCounter = 0;
      var sectionPrefix = 'section-' + currentSectionIndex + '-';
      var entries = [];
      for (var cfi in highlightMap) {
        var matchesSection = cfi.indexOf(sectionPrefix) === 0;
        var isFallback = cfi.indexOf('epub-hl-') === 0;
        if (matchesSection || isFallback) entries.push({ cfi: cfi, data: highlightMap[cfi] });
      }
      if (entries.length === 0) return;
      entries.sort(function (a, b) {
        var at = (a.data && a.data.text) ? String(a.data.text).length : 0;
        var bt = (b.data && b.data.text) ? String(b.data.text).length : 0;
        return bt - at;
      });
      var html = contentEl.innerHTML;
      var applied = 0;
      for (var i = 0; i < entries.length; i++) {
        var cfi = entries[i].cfi;
        var d = entries[i].data;
        if (!d) continue;
        var rawText = (d.text != null) ? String(d.text) : '';
        if (!rawText || rawText.length < 2) continue;
        var color = d.color || '#ffeb3b';
        var dbId = d.dbId != null ? String(d.dbId) : '';
        var attrCfi = (cfi != null ? String(cfi) : '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
        var attrDbId = dbId.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
        var attrColor = (color || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
        try {
          var safeText = rawText.replace(new RegExp('[.*+?^\\$' + '{}()|\\[\\]\\\\]', 'g'), '\\$&');
          var reg = new RegExp(safeText.replace(/\s+/g, '\\s+'));
          var before = html;
          html = html.replace(reg, function (match) {
            applied++;
            var id = 'ehl' + (hlCounter++);
            window._epubHighlightById[id] = { text: rawText, cfi: cfi, color: color, dbId: dbId || null };
            return '<span class="epub-hl" data-cfi="' + attrCfi + '" data-dbid="' + attrDbId + '" data-color="' + attrColor + '" style="background-color:' + color + ' !important;cursor:pointer;position:relative;z-index:2" onclick="window.handleEpubHighlightClick(\'' + id + '\')">' + match + '</span>';
          });
          if (html === before) {
            send({ type: 'debug', msg: 'no match: ' + rawText.substring(0, 30) });
          }
        } catch (err) {
          send({ type: 'debug', msg: 'regex err: ' + String(err) });
        }
      }
      contentEl.innerHTML = html;
    } catch (err) {
      send({ type: 'debug', msg: 'applyHighlights err: ' + String(err) });
    }
  }
  var lineHeight = 1.65;
  var PW = 0, PH = 0;
  var darkMode = ${darkMode};
  var sectionRestorePage = null;
  var showContentTimer = null;

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
    var textClr = darkMode ? '#e8e8e8' : '#1a1a1a';
    var linkClr = darkMode ? '#7dd3fc' : '#007AFF';
    s.textContent =
      '#epub-content, #epub-content p, #epub-content div,' +
      '#epub-content li, #epub-content td, #epub-content blockquote {' +
        'font-size:' + fontSize + 'px !important;' +
        'line-height:' + lineHeight + ' !important;' +
        'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif !important;' +
        'color:' + textClr + ' !important; background:transparent !important; max-width:100% !important;' +
      '}' +
      '#epub-content span:not(.epub-hl) { background:transparent !important; }' +
      '#epub-content h1,#epub-content h2,#epub-content h3,#epub-content h4 {' +
        'font-size:' + Math.round(fontSize * 1.25) + 'px !important;' +
        'line-height:1.3 !important; margin:0 0 10px 0 !important;' +
      '}' +
      '#epub-content img {' +
        'max-width:100% !important; max-height:' + Math.round(PH * 0.8) + 'px !important;' +
        'object-fit:contain !important; display:block !important;' +
        'break-inside:avoid !important; margin:6px auto !important;' +
      '}' +
      '#epub-content a { color:' + linkClr + ' !important; }' +
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

  function sendLocation() {
    var pct = spineItems.length > 1 ? currentSectionIndex / (spineItems.length - 1) : 1;
    var cfi = 'section-' + currentSectionIndex + '-page-' + currentPage;
    send({ type: 'locationChanged', cfi: cfi, percentage: pct });
  }

  function showPage(idx) {
    if (idx < 0) idx = 0;
    if (idx >= totalPages) idx = totalPages - 1;
    currentPage = idx;
    var el = document.getElementById('epub-content');
    if (el) el.style.transform = 'translateX(-' + (idx * PW) + 'px)';
    sendLocation();
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

  var imageLoadPaginateTimer = null;
  function scheduleImageLoadPaginate() {
    if (imageLoadPaginateTimer) clearTimeout(imageLoadPaginateTimer);
    imageLoadPaginateTimer = setTimeout(function () {
      imageLoadPaginateTimer = null;
      paginate(function () {
        var el = document.getElementById('epub-content');
        if (el) el.style.transform = 'translateX(-' + (currentPage * PW) + 'px)';
      });
    }, 200);
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
          img.onload = function () { scheduleImageLoadPaginate(); };
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

  function showSection(index, startAtEnd, anchorId, titleForSearch) {
    if (index < 0 || index >= spineItems.length) return;
    if (showContentTimer) { clearTimeout(showContentTimer); showContentTimer = null; }
    currentSectionIndex = index;
    sectionRestorePage = window.savedPage;
    window.savedPage = null;
    var section = spineItems[index];
    setStatus('Loading…');
    var contentEl = document.getElementById('epub-content');
    if (contentEl) contentEl.style.opacity = '0';
    section.load(book.load.bind(book)).then(function (contents) {
      var root = contents.nodeType === 1 ? contents : (contents.documentElement || contents);
      var baseHref = section.href || section.url || '';
      var html = '';
      try { html = (new XMLSerializer()).serializeToString(root); } catch (e) { html = root.outerHTML || ''; }
      html = stripEpubStyles(html);
      var el = document.getElementById('epub-content');
      el.style.transform = 'translateX(0)';
      el.innerHTML = html;
      applyHighlightsInContent(el);
      applyOverrideSheet();
      measurePage();
      paginate(function () {
        var targetPage = startAtEnd ? totalPages - 1 : 0;
        if (sectionRestorePage != null && sectionRestorePage >= 0 && sectionRestorePage < totalPages) {
          targetPage = sectionRestorePage;
        } else if (anchorId) {
          var contentEl = document.getElementById('epub-content');
          var pageWin = document.getElementById('page-window');
          if (contentEl && pageWin) {
            var tryIds = [anchorId];
            try { tryIds.push(decodeURIComponent(anchorId)); } catch (e) {}
            var tryIds2 = tryIds.concat(anchorId.replace(/-/g, '_'), anchorId.replace(/_/g, '-'));
            var anchorEl = null;
            for (var ti = 0; ti < tryIds2.length && !anchorEl; ti++) {
              var aid = tryIds2[ti];
              if (!aid) continue;
              anchorEl = document.getElementById(aid) || (contentEl.querySelector ? contentEl.querySelector('[id="' + aid.replace(/"/g, '\\"') + '"]') : null);
            }
            if (!anchorEl && (titleForSearch || anchorId)) {
              var searchText = (titleForSearch || anchorId).replace(/[-_]/g, ' ').replace(/\\s+/g, ' ').trim().toLowerCase();
              if (searchText) {
                var headings = contentEl.querySelectorAll ? contentEl.querySelectorAll('h1, h2, h3, h4, h5, h6, [id]') : [];
                for (var hi = 0; hi < headings.length && !anchorEl; hi++) {
                  var h = headings[hi];
                  var txt = (h.textContent || '').trim().toLowerCase();
                  var idVal = (h.getAttribute && h.getAttribute('id')) || '';
                  if (txt.indexOf(searchText) >= 0 || (anchorId && idVal.toLowerCase().indexOf(anchorId.toLowerCase()) >= 0)) {
                    anchorEl = h;
                    break;
                  }
                }
              }
            }
            if (anchorEl) {
              var savedTransform = contentEl.style.transform;
              contentEl.style.transform = 'translateX(0)';
              pageWin.style.overflowX = 'auto';
              pageWin.scrollLeft = 0;
              anchorEl.scrollIntoView({ block: 'start', inline: 'start', behavior: 'instant' });
              var scrollLeft = pageWin.scrollLeft || 0;
              var col = Math.floor(scrollLeft / PW);
              if (col >= 0 && col < totalPages) targetPage = col;
              pageWin.style.overflowX = 'hidden';
              contentEl.style.transform = savedTransform;
            }
          }
        }
        currentPage = targetPage;
        var el = document.getElementById('epub-content');
        if (el) el.style.transform = 'translateX(-' + (targetPage * PW) + 'px)';
        setStatus('');
        sendLocation();
        if (showContentTimer) clearTimeout(showContentTimer);
        showContentTimer = setTimeout(function () {
          showContentTimer = null;
          sectionRestorePage = null;
          var el = document.getElementById('epub-content');
          if (el) el.style.opacity = '1';
        }, 280);
      });
      loadImages(el, baseHref);
    }).catch(function (err) {
      var msg = (err && err.message) || 'Load failed';
      setStatus('Error: ' + msg);
      var el = document.getElementById('epub-content');
      if (el) el.style.opacity = '1';
      send({ type: 'error', message: msg });
    });
  }

  function extractTOC() {
    try {
      var nav = book.navigation;
      if (!nav || !nav.toc || nav.toc.length === 0) {
        send({ type: 'tocExtracted', items: [] });
        return;
      }
      var tocItems = [];
      var orderIndex = 0;
      function parseHref(href) {
        if (!href) return { path: '', anchor: null };
        var idx = href.indexOf('#');
        var path = (idx >= 0 ? href.substring(0, idx) : href).trim();
        var anchor = (idx >= 0 && idx < href.length - 1) ? href.substring(idx + 1).trim() : null;
        return { path: path || '', anchor: anchor || null };
      }
      function resolveHrefToSectionIndex(href) {
        var path = parseHref(href).path;
        if (!path) return -1;
        var resolved = path;
        if (book.resolve) {
          try { resolved = book.resolve(path); } catch (e) {}
        }
        var section = book.spine.get(resolved);
        if (section != null && section.index != null) return section.index;
        section = book.spine.get(path);
        if (section != null && section.index != null) return section.index;
        var filename = path.split('/').pop() || path;
        for (var i = 0; i < spineItems.length; i++) {
          var it = spineItems[i];
          var sh = it.href || '';
          if (sh === path || sh === resolved || sh.endsWith(path) || (filename && sh.endsWith(filename))) {
            return i;
          }
        }
        return -1;
      }
      function flatten(items, level) {
        if (!items || !items.length) return;
        for (var i = 0; i < items.length; i++) {
          var it = items[i];
          var label = (it.label || it.title || '').trim();
          if (!label) label = 'Untitled';
          var parsed = parseHref(it.href);
          var sectionIndex = resolveHrefToSectionIndex(it.href);
          if (sectionIndex >= 0) {
            tocItems.push({
              title: label,
              page: sectionIndex + 1,
              level: level || 0,
              order_index: orderIndex++,
              anchor: parsed.anchor
            });
          }
          if (it.subitems && it.subitems.length) flatten(it.subitems, (level || 0) + 1);
        }
      }
      flatten(nav.toc, 0);
      send({ type: 'tocExtracted', items: tocItems });
    } catch (err) {
      console.error('EPUB TOC extraction error:', err);
      send({ type: 'tocExtracted', items: [] });
    }
  }

  function startReader() {
    if (!window.epubBase64) { send({ type:'error', message:'No EPUB data' }); return; }
    if (typeof ePub === 'undefined') { send({ type:'error', message:'epub.js not loaded' }); return; }
    if (window.initialFontSize != null) { fontSize = window.initialFontSize; applyOverrideSheet(); }
    setStatus('Parsing…');
    var bytes = atob(window.epubBase64);
    var buf = new Uint8Array(bytes.length);
    for (var i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i);
    try {
      book = ePub(buf.buffer);
      book.ready.then(function () {
        try {
          spineItems = [];
          book.spine.each(function (item) { spineItems.push(item); });
          if (!spineItems.length) { send({ type:'error', message:'Empty spine' }); return; }
          measurePage();
          extractTOC();
          var startIndex = 0;
          window.savedPage = null;
          if (window.savedCfi && typeof window.savedCfi === 'string') {
            var m1 = window.savedCfi.match(/^section-([0-9]+)-page-([0-9]+)$/);
            var m2 = window.savedCfi.match(/^section-([0-9]+)$/);
            if (m1) {
              startIndex = Math.min(parseInt(m1[1], 10), spineItems.length - 1);
              if (startIndex >= 0) window.savedPage = parseInt(m1[2], 10);
            } else if (m2) {
              startIndex = Math.min(parseInt(m2[1], 10), spineItems.length - 1);
              if (startIndex < 0) startIndex = 0;
            }
          }
          showSection(startIndex, false, window.startAnchor || null, window.startTitle || null);

        var touchSx = 0, touchSy = 0, touchStartTime = 0, didSwipe = false;
        var lastSentText = null;

        // Helper: get the nearest Element from a node (handles text nodes)
        function nearestEl(node) {
          if (!node) return null;
          return (node.nodeType === 1) ? node : node.parentElement;
        }

        // Find closest .epub-hl from a node or coordinate (returns null if not on a highlight)
        function findHighlightEl(node, x, y) {
          var el = nearestEl(node);
          var hl = (el && el.closest) ? el.closest('.epub-hl') : null;
          if (!hl && document.elementFromPoint) {
            var hit = document.elementFromPoint(x, y);
            hl = (hit && hit.closest) ? hit.closest('.epub-hl') : null;
          }
          return hl;
        }

        // Capture-phase click: backup when tap on .epub-hl (works even if inline onclick is blocked)
        document.addEventListener('click', function (e) {
          var t = e.target;
          var hl = (t && t.closest) ? t.closest('.epub-hl') : (t && t.nodeType === 3 && t.parentElement && t.parentElement.closest) ? t.parentElement.closest('.epub-hl') : null;
          if (hl) {
            e.preventDefault();
            e.stopPropagation();
            send({
              type: 'highlightClicked',
              text: (hl.textContent || '').trim(),
              cfi: hl.getAttribute('data-cfi') || '',
              color: hl.getAttribute('data-color') || '',
              dbId: hl.getAttribute('data-dbid') || null
            });
          }
        }, true);

        document.addEventListener('touchstart', function (e) {
          var t = e.touches[0];
          touchSx = t ? t.clientX : 0;
          touchSy = t ? t.clientY : 0;
          touchStartTime = Date.now();
          didSwipe = false;
        }, { passive: true });

        document.addEventListener('touchmove', function (e) {
          var dy = Math.abs((e.touches[0] ? e.touches[0].clientY : 0) - touchSy);
          var dx = Math.abs((e.touches[0] ? e.touches[0].clientX : 0) - touchSx);
          if (dx > 15 || dy > 15) didSwipe = true;
          // Do not preventDefault so that tap always fires 'click' (required for highlight menu on Android)
        }, { passive: true });

        document.addEventListener('touchend', function (e) {
          var ct = e.changedTouches[0];
          var ex = ct ? ct.clientX : touchSx;
          var ey = ct ? ct.clientY : touchSy;
          var dx = ex - touchSx;
          var dy = touchSy - ey; // positive = swipe up

          // Swipe navigation
          if (didSwipe && Math.abs(dx) > Math.abs(dy) * 0.5 && Math.abs(dx) > 30) {
            if (dx < 0) goNext(); else goPrev();
            return;
          }
          if (didSwipe && Math.abs(dy) > 40) { return; }

          // Tap: check if it's on a highlight (run in next frame so hit-test is stable)
          var releaseX = ex;
          var releaseY = ey;
          function trySendHighlightFromTap() {
            var node = (ct && ct.target) ? ct.target : null;
            var h = findHighlightEl(node, releaseX, releaseY);
            if (!h && document.elementFromPoint) {
              var hit = document.elementFromPoint(releaseX, releaseY);
              h = (hit && hit.closest) ? hit.closest('.epub-hl') : null;
            }
            if (h) {
              send({
                type: 'highlightClicked',
                text: (h.textContent || '').trim(),
                cfi: h.getAttribute('data-cfi') || '',
                color: h.getAttribute('data-color') || '',
                dbId: h.getAttribute('data-dbid') || null
              });
              return true;
            }
            return false;
          }
          var sent = trySendHighlightFromTap();
          if (sent) return;
          requestAnimationFrame(function () {
            if (trySendHighlightFromTap()) return;
            setTimeout(function () {
              if (trySendHighlightFromTap()) return;
              runSelectionOrToggle(releaseX, releaseY, dx, dy);
            }, 120);
          });

          function runSelectionOrToggle(rx, ry, ddx, ddy) {
            var sel = window.getSelection();
            var text = sel ? sel.toString().trim() : '';
            if (text && text.length > 2) {
              var sectionPrefix = 'section-' + currentSectionIndex + '-';
              for (var key in highlightMap) {
                var ent = highlightMap[key];
                var ht = (ent && ent.text) ? String(ent.text).trim() : '';
                if (ht && ht.length > 2 && (text === ht || text.indexOf(ht) >= 0 || ht.indexOf(text) >= 0)) {
                  lastSentText = text;
                  send({
                    type: 'highlightClicked',
                    text: text,
                    cfi: ent.cfi || '',
                    color: ent.color || '',
                    dbId: ent.dbId || null
                  });
                  setTimeout(function () { lastSentText = null; }, 1000);
                  return;
                }
              }
              if (text !== lastSentText) {
                lastSentText = text;
                var cfi = 'section-' + currentSectionIndex + '-page-' + currentPage;
                send({ type: 'textSelected', text: text, cfi: cfi });
                setTimeout(function () { lastSentText = null; }, 1000);
              } else if (!didSwipe) {
                var dt = Date.now() - touchStartTime;
                if (Math.abs(ddx) < 15 && Math.abs(ddy) < 15 && dt < 350) send({ type: 'toggleButtons' });
              }
            } else if (!didSwipe) {
              var dt = Date.now() - touchStartTime;
              if (Math.abs(ddx) < 15 && Math.abs(ddy) < 15 && dt < 350) send({ type: 'toggleButtons' });
            }
          }
        }, { passive: true });
        } catch (e) {
          send({ type:'error', message: (e&&e.message)||'Reader init failed' });
        }
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
    else if (c === 'goToSection' && typeof msg.sectionIndex === 'number') {
      var idx = msg.sectionIndex;
      var anc = (typeof msg.anchor === 'string' && msg.anchor) ? msg.anchor : null;
      var tit = (typeof msg.title === 'string' && msg.title) ? msg.title : null;
      if (idx >= 0 && idx < spineItems.length) showSection(idx, false, anc, tit);
    }
    else if (c === 'setFontSize' && msg.size) {
      fontSize = msg.size; applyOverrideSheet();
      paginate(function () { showPage(currentPage); });
    }
    else if (c === 'addHighlight') {
      highlightMap[msg.cfi] = msg;
      var contentEl = document.getElementById('epub-content');
      if (contentEl) {
        applyHighlightsInContent(contentEl);
        paginate(function () { showPage(currentPage); });
      }
    }
    else if (c === 'removeHighlight') delete highlightMap[msg.cfi];
    else if (c === 'updateHighlightColor' && highlightMap[msg.cfi]) highlightMap[msg.cfi].color = msg.color;
    else if (c === 'restoreHighlights' && Array.isArray(msg.highlights)) {
      msg.highlights.forEach(function (h) { if (h.cfi) highlightMap[h.cfi] = h; });
      var contentEl = document.getElementById('epub-content');
      if (contentEl) {
        applyHighlightsInContent(contentEl);
        paginate(function () { showPage(currentPage); });
      }
    }
  }

  window.startReader = startReader;
  window.handleEpubCommand = handleCommand;
  window.addEventListener('message', function (e) { try { handleCommand(JSON.parse(e.data)); } catch (_) {} });
  document.addEventListener('message', function (e) { try { handleCommand(JSON.parse(e.data)); } catch (_) {} });

  function sendReady() {
    setStatus('Ready…');
    send({ type: 'ready' });
  }
  if (typeof ePub !== 'undefined') {
    sendReady();
  } else if (${loadLibsFromAsset}) {
    var _poll = 0;
    var _tid = setInterval(function() {
      _poll++;
      if (typeof ePub !== 'undefined') {
        clearInterval(_tid);
        sendReady();
      } else if (_poll > 100) {
        clearInterval(_tid);
        setStatus('Error: epub.js not loaded');
        send({ type: 'error', message: 'epub.js failed to load from assets' });
      }
    }, 100);
  } else {
    sendReady();
  }
})();
<\/script>
</body>
</html>`;
}

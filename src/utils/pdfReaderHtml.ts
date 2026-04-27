/**
 * PDF Reader HTML template
 * Inline so that changes are picked up by Metro hot reload
 * (native assets require a full rebuild)
 */
export const getPdfReaderHtml = (darkMode = false) => {
  const bg = darkMode ? '#1a1a1a' : '#fafafa';
  const bgContainer = darkMode ? '#1a1a1a' : '#f5f5f5';
  const textColor = darkMode ? '#e8e8e8' : '#2c3e50';
  const canvasBg = darkMode ? '#2d2d2d' : 'white';
  const loadingBg = darkMode ? '#2d2d2d' : 'white';
  const loadingColor = darkMode ? '#9ca3af' : '#666';
  const pageIndicatorColor = darkMode ? '#6b7280' : '#aaa';
  return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
    <title>PDF Reader</title>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"><\/script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: ${bg};
            overflow: hidden;
            padding-top: 0;
            padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 0px);
            padding-left: env(safe-area-inset-left, 0px);
            padding-right: env(safe-area-inset-right, 0px);
            overscroll-behavior: none;
            -webkit-overflow-scrolling: auto;
        }
        html {
            background: ${bg};
            overscroll-behavior: none;
            overscroll-behavior-y: contain;
            overflow: hidden;
        }
        #pdf-container {
            width: 100%;
<<<<<<< HEAD
            height: 100vh;
            height: calc(var(--vvh, 1vh) * 100);
=======
            height: calc(100vh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 10px);
>>>>>>> parent of 95d794a (Almost last)
            display: flex;
            flex-direction: column;
            align-items: center;
            background: ${bgContainer};
            overflow-y: auto;
            overflow-x: hidden;
            -webkit-overflow-scrolling: touch;
        }
        #pdf-container.hidden {
            display: none !important;
        }
        #canvas {
            max-width: 100%;
            height: auto;
            display: block;
            margin: 0 auto;
            background: ${canvasBg};
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            ${darkMode ? 'filter: invert(1) hue-rotate(180deg);' : ''}
        }
        #text-container {
            display: none;
            width: 100%;
            height: 100vh;
<<<<<<< HEAD
            height: calc(var(--vvh, 1vh) * 100);
            overflow: hidden;
            background: ${bg};
            padding: 20px 24px;
            padding-top: calc(env(safe-area-inset-top, 20px) + 28px);
            /* Add dynamic bottom inset for Android nav bar (visual viewport occlusion). */
            padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 60px + var(--vvb, 0px));
=======
            overflow-y: auto;
            overflow-x: hidden;
            -webkit-overflow-scrolling: auto;
            overscroll-behavior: none;
            overscroll-behavior-y: contain;
            background: ${bg};
            padding: 20px;
            padding-top: calc(env(safe-area-inset-top, 20px) + 40px);
            padding-bottom: 120px;
>>>>>>> parent of 95d794a (Almost last)
            box-sizing: border-box;
            touch-action: pan-y;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
        }
        #text-container.visible {
            display: block !important;
        }
        .text-page {
            max-width: 600px;
            margin: 0 auto;
            font-size: 19px;
            line-height: 1.8;
            color: ${textColor};
            font-family: Georgia, 'Times New Roman', serif;
            white-space: pre-wrap;
            word-wrap: break-word;
            opacity: 1;
            transition: opacity 0.15s ease-in-out;
        }
        .text-page.fading {
            opacity: 0;
        }
        .text-page p {
            margin-bottom: 1.5em;
        }
        .page-indicator {
            text-align: center;
            padding: 20px 0 40px;
            font-size: 13px;
            color: ${pageIndicatorColor};
            font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        }
        #loading {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 16px;
            color: ${loadingColor};
            background: ${loadingBg};
            padding: 20px 30px;
            border-radius: 8px;
            box-shadow: 0 2px 12px rgba(0,0,0,0.15);
            z-index: 1000;
        }
        .hidden {
            display: none;
        }
    </style>
</head>
<body>
    <div id="loading">Loading PDF...</div>
    <div id="pdf-container" class="hidden">
        <canvas id="canvas"></canvas>
    </div>
    <div id="text-container" class="hidden">
        <div class="text-page" id="text-content"></div>
    </div>

    <script>
        // Configure pdf.js worker
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

        // Global state
        let pdfDoc = null;
        let currentPage = 1;
        let pageRendering = false;
        let pageNumPending = null;
        let readerMode = 'pdf';
        let textPages = [];
        let currentTextPage = 0;
        let extractedText = null;
        let allHighlights = [];
        
        const canvas = document.getElementById('canvas');
        const ctx = canvas.getContext('2d');
        const pdfContainer = document.getElementById('pdf-container');
        const textContainer = document.getElementById('text-container');
        const textContent = document.getElementById('text-content');
        const loading = document.getElementById('loading');

        // Send message to React Native
        function sendMessage(data) {
            if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify(data));
            }
        }

<<<<<<< HEAD
        // Android system UI (bottom nav bar) can shrink the visual viewport without changing 100vh.
        // Use visualViewport to keep layout and pagination aligned with what's actually visible.
        function updateVisualViewportHeightVar() {
            try {
                var vv = window.visualViewport;
                var h = (vv && vv.height) ? vv.height : window.innerHeight;
                // How much of the layout viewport is occluded (e.g. Android 3-button nav bar).
                var occluded = Math.max(0, window.innerHeight - h);
                document.documentElement.style.setProperty('--vvh', (h * 0.01) + 'px');
                document.documentElement.style.setProperty('--vvb', Math.round(occluded) + 'px');
            } catch (_) {}
        }
        updateVisualViewportHeightVar();
        try {
            if (window.visualViewport) {
                window.visualViewport.addEventListener('resize', updateVisualViewportHeightVar);
                window.visualViewport.addEventListener('scroll', updateVisualViewportHeightVar);
            }
        } catch (_) {}

        window.onerror = function(msg, url, line, col, err) {
            sendMessage({ type: 'error', message: 'JS: ' + msg + ' (line ' + line + ')' });
        };
        window.onunhandledrejection = function(ev) {
            sendMessage({ type: 'error', message: 'Promise: ' + (ev.reason && ev.reason.message ? ev.reason.message : String(ev.reason)) });
        };

=======
>>>>>>> parent of 95d794a (Almost last)
        // ========== TEXT EXTRACTION & PAGINATION ==========
        
        // Extract text from all PDF pages
        async function extractAllText() {
            console.log('extractAllText called - fresh extraction');
            
            if (extractedText && extractedText.length > 0) {
                return extractedText;
            }
            
            // Also check for cached text from RN
            if (window.cachedExtractedText && window.cachedExtractedText.length > 0) {
                extractedText = window.cachedExtractedText;
                window.cachedExtractedText = null;
                return extractedText;
            }
            
            console.log('Extracting text from', pdfDoc.numPages, 'pages...');
            
            const pageTexts = [];
            
            try {
                for (let i = 1; i <= pdfDoc.numPages; i++) {
                    const page = await pdfDoc.getPage(i);
                    const content = await page.getTextContent();
                    
                    // Use pdf.js items in their natural order
                    // Just handle spacing between items
                    let pageText = '';
                    let lastY = null;
                    let lastEndX = null;
                    
                    for (let j = 0; j < content.items.length; j++) {
                        const item = content.items[j];
                        const str = item.str;
                        
                        // Keep ALL items including spaces
                        if (str.length === 0) continue;
                        
                        const y = item.transform[5];
                        const x = item.transform[4];
                        
                        if (lastY !== null) {
                            const yDiff = Math.abs(lastY - y);
                            
                            if (yDiff > 14) {
                                // Large Y gap = paragraph break
                                pageText += '\\n\\n';
                            } else if (yDiff > 2) {
                                // Line break - join hyphenated words
                                if (pageText.endsWith('-')) {
                                    pageText = pageText.slice(0, -1);
                                } else {
                                    pageText += ' ';
                                }
                            } else {
                                // Same line
                                if (lastEndX !== null && str.trim().length > 0 && x > lastEndX + 3) {
                                    pageText += ' ';
                                }
                            }
                        }
                        
                        pageText += str;
                        lastY = y;
                        lastEndX = x + (item.width || 0);
                    }
                    
                    const trimmed = pageText.trim();
                    if (trimmed.length > 0) {
                        pageTexts.push(trimmed);
                    }
                }
                
                const fullText = pageTexts.join('\\n\\n');
                console.log('Text extracted:', fullText.length, 'chars from', pageTexts.length, 'pages');
                extractedText = fullText;
                
                sendMessage({
                    type: 'textExtracted',
                    text: fullText
                });
                
                return fullText;
                
            } catch (error) {
                console.error('Error extracting text:', error);
                sendMessage({
                    type: 'error',
                    message: 'Failed to extract text: ' + error.message
                });
                return '';
            } finally {
                loading.classList.add('hidden');
            }
        }
        
        // Paginate text into pages that fit the screen
        function paginateText(fullText) {
<<<<<<< HEAD
            var fontSizePx   = (typeof window.__pdfTextFontSize === 'number') ? window.__pdfTextFontSize : 19;
            var lineHeightPx = fontSizePx * 1.65;
            var paraMarginPx = fontSizePx * 0.9;
            var indicatorH   = 36;
            // Measure real visible space to prevent occasional bottom clipping.
            // Relying on window.innerHeight/visualViewport can still be off on some Android devices.
            var viewportH = window.innerHeight;
            var viewportW = window.innerWidth;
            try {
                var r = textContainer.getBoundingClientRect();
                if (r && isFinite(r.height) && r.height > 0) viewportH = r.height;
                if (r && isFinite(r.width)  && r.width  > 0) viewportW = r.width;
            } catch (_) {}
            // Keep padding in sync with CSS.
            var cs = window.getComputedStyle(textContainer);
            var padTop = parseFloat(cs.paddingTop || '0') || 0;
            var padBottom = parseFloat(cs.paddingBottom || '0') || 0;
            if (!isFinite(padTop) || padTop < 1) padTop = 28;
            if (!isFinite(padBottom) || padBottom < 1) padBottom = 60;
            // Normalize to whole pixels so our math matches what the DOM paints.
            // Medium font scales often produce fractional line metrics; over a page,
            // the fractions accumulate and the last line can get clipped.
            lineHeightPx = Math.ceil(lineHeightPx);
            paraMarginPx = Math.ceil(paraMarginPx);
            // Tiny safety buffer avoids 1px clipping from font hinting differences.
            var availH = viewportH - padTop - padBottom - indicatorH - 2;
            var availW = viewportW - 48;

            // ── canvas measurement ──────────────────────────────────────────────────
            var cnv = document.createElement('canvas');
            var ctx = cnv.getContext('2d');
            ctx.font = fontSizePx + 'px Georgia, "Times New Roman", serif';
            var wordCache = {};
            function ww(word) {
                if (!wordCache[word]) wordCache[word] = ctx.measureText(word).width;
                return wordCache[word];
            }
            var spW = ww(' ');

            function paraH(text) {
                var words = text.split(/\\s+/);
                var lines = 1, lineW = 0;
                for (var k = 0; k < words.length; k++) {
                    var w = ww(words[k]);
                    if (lineW === 0)                     { lineW = w; }
                    else if (lineW + spW + w > availW)   { lines++; lineW = w; }
                    else                                 { lineW += spW + w; }
                }
                return lines * lineHeightPx + paraMarginPx;
            }

            // Filter isolated PDF artefacts (standalone numbers / roman numerals)
            var paragraphs = fullText.split(/\\n\\n+/).filter(function(p) {
                var t = p.trim();
                return t.length > 0 && !/^[\\dIVXLCDMivxlcdm]{1,6}$/.test(t);
            });

            var sampleH  = paraH(paragraphs[0] || fullText.slice(0, 200));
            var diagMsg  = 'innerH=' + window.innerHeight + ' innerW=' + window.innerWidth +
                           ' availH=' + availH + ' availW=' + availW +
                           ' spW=' + spW.toFixed(2) + ' sampleParaH=' + sampleH.toFixed(1) +
                           ' paragraphs=' + paragraphs.length;

            // ── canvas-based pagination ────────────────────────────────────────────
            var pages = [];
            var i = 0;
            while (i < paragraphs.length) {
                var pageParas = [], pageHeight = 0;
                while (i < paragraphs.length) {
                    var ph = paraH(paragraphs[i]);
                    if (pageHeight + ph <= availH) {
                        pageParas.push(paragraphs[i]); pageHeight += ph; i++;
                    } else if (pageParas.length === 0) {
                        // Paragraph alone is taller than the screen — split by sentences
                        var sentences = paragraphs[i].match(
                            /[^.!?…]+[.!?…]+(?:\\s|$)|[^.!?…]+$/g) || [paragraphs[i]];
                        var sentBuf = [], sentH = 0;
                        for (var s = 0; s < sentences.length; s++) {
                            var sh = paraH(sentBuf.concat([sentences[s]]).join(' '));
                            if (sentBuf.length === 0 || sentH + sh <= availH) {
                                sentBuf.push(sentences[s]); sentH = paraH(sentBuf.join(' '));
                            } else {
                                pages.push([sentBuf.join(' ')]);
                                sentBuf = [sentences[s]]; sentH = paraH(sentences[s]);
                            }
                        }
                        if (sentBuf.length > 0) {
                            pageParas = [sentBuf.join(' ')]; pageHeight = paraH(pageParas[0]);
                        }
                        i++; break;
                    } else { break; }
                }
                if (pageParas.length > 0) pages.push(pageParas);
            }

            // ── sanity check / fallback ────────────────────────────────────────────
            // If canvas gave bad widths the page count will be absurdly high.
            // Char-count fallback: Georgia 19px ≈ 0.48em avg char width.
            var usedFallback = false;
            if (pages.length > 1200 || spW < 1) {
                usedFallback = true;
                pages = [];
                var avgCharW    = fontSizePx * 0.48;
                var charsPerLine = Math.max(20, Math.floor(availW / avgCharW));
                var linesPerPage = Math.max(5,  Math.floor(availH  / lineHeightPx));
                var charsPerPage = charsPerLine * linesPerPage;

                // Sentence-level fill avoids half-empty pages: paragraph-only pagination left
                // short pages when the next PDF "paragraph" was a chapter title or one line.
                function splitIntoSentences(block) {
                    var out = [];
                    var re = /[^.!?…]+[.!?…]+(?:\\s|$)|[^.!?…]+$/g;
                    var m;
                    while ((m = re.exec(block)) !== null) {
                        var s = m[0].trim();
                        if (s.length > 0) out.push(s);
=======
            console.log('Paginating text...');
            
            // Split into paragraphs
            const paragraphs = fullText.split(/\\n\\n+/).filter(function(p) { return p.trim().length > 0; });
            const pages = [];
            let currentPageParas = [];
            let wordCount = 0;
            var MAX_WORDS = 120; // conservative for mobile screens
            
            for (var i = 0; i < paragraphs.length; i++) {
                var para = paragraphs[i].trim();
                var paraWords = para.split(/\\s+/).length;
                
                // If this single paragraph is huge, split by sentences
                if (paraWords > 200) {
                    // Flush current
                    if (currentPageParas.length > 0) {
                        pages.push(currentPageParas.join('\\n\\n'));
                        currentPageParas = [];
                        wordCount = 0;
>>>>>>> parent of 95d794a (Almost last)
                    }
                    
                    var sentences = para.match(/[^.!?]+[.!?]+/g) || [para];
                    var sentBuf = [];
                    var sentWords = 0;
                    
                    for (var s = 0; s < sentences.length; s++) {
                        var sent = sentences[s].trim();
                        var sw = sent.split(/\\s+/).length;
                        
                        if (sentWords + sw > MAX_WORDS && sentBuf.length > 0) {
                            pages.push(sentBuf.join(' '));
                            sentBuf = [sent];
                            sentWords = sw;
                        } else {
                            sentBuf.push(sent);
                            sentWords += sw;
                        }
                    }
                    if (sentBuf.length > 0) {
                        pages.push(sentBuf.join(' '));
                    }
                    continue;
                }
                
                // Normal paragraph
                if (wordCount + paraWords > MAX_WORDS && currentPageParas.length > 0) {
                    pages.push(currentPageParas.join('\\n\\n'));
                    currentPageParas = [para];
                    wordCount = paraWords;
                } else {
                    currentPageParas.push(para);
                    wordCount += paraWords;
                }
            }
            
            // Remaining
            if (currentPageParas.length > 0) {
                pages.push(currentPageParas.join('\\n\\n'));
            }
            
            console.log('Created', pages.length, 'text pages from', paragraphs.length, 'paragraphs');
            return pages;
        }
        
        // Render text page
        function renderTextPage(pageIndex) {
            if (pageIndex < 0 || pageIndex >= textPages.length) return;
            
            var fontSizePx = (typeof window.__pdfTextFontSize === 'number') ? window.__pdfTextFontSize : 19;
            textContent.style.fontSize = fontSizePx + 'px';
            textContent.style.lineHeight = Math.ceil(fontSizePx * 1.65) + 'px';
            textContent.classList.add('fading');
            
            setTimeout(function() {
                currentTextPage = pageIndex;
                
                var pageText = textPages[pageIndex];
                
                // Apply highlights
                var htmlContent = pageText;
                var pageHighlights = allHighlights.filter(function(h) {
                    var normPage = pageText.replace(/\\s+/g, ' ').trim();
                    var normHL = h.text.replace(/\\s+/g, ' ').trim();
                    return normPage.indexOf(normHL) !== -1;
                });
                
                pageHighlights.forEach(function(highlight) {
                    var escapedText = highlight.text.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&');
                    var regex = new RegExp(escapedText, 'g');
                    htmlContent = htmlContent.replace(regex, function(match) {
                        return '<span class="highlight-marker" style="background-color: ' + highlight.color + '; cursor: pointer;" data-color="' + highlight.color + '" data-id="' + highlight.id + '" onclick="window.handleHighlightClick(\\'' + highlight.id + '\\')">' + match + '</span>';
                    });
                });
                
                // Add page indicator at bottom
                textContent.innerHTML = htmlContent + '<div class="page-indicator">' + (pageIndex + 1) + ' / ' + textPages.length + '</div>';
                
                // Scroll to top
                textContainer.scrollTop = 0;
                
                textContent.classList.remove('fading');
                
                var progress = textPages.length > 1 ? currentTextPage / (textPages.length - 1) : 0;
                sendMessage({
                    type: 'locationChanged',
                    page: currentTextPage + 1,
                    totalPages: textPages.length,
                    progress: progress,
                    mode: 'text'
                });
            }, 150);
        }
        
        // Switch between PDF and Text modes
        // targetPage: optional 1-based page number to restore to (for text mode)
        // targetProgress: 0.0-1.0 ratio (stable across repagination); takes priority over targetPage
        async function switchMode(mode, targetPage, targetProgress) {
            readerMode = mode;
            
            if (mode === 'text') {
                if (textPages.length === 0) {
                    var fullText = await extractAllText();
                    
                    if (!fullText || fullText.length < 100) {
                        sendMessage({
                            type: 'error',
                            message: 'Could not extract readable text from this PDF'
                        });
                        readerMode = 'pdf';
                        return;
                    }
                    
                    textPages = paginateText(fullText);
                }
                
                pdfContainer.classList.add('hidden');
                textContainer.classList.add('visible');
                
                var pageIndex;
                if (typeof targetProgress === 'number' && targetProgress >= 0 && targetProgress <= 1) {
                    // Progress ratio is stable across font-size / repagination changes
                    pageIndex = Math.round(targetProgress * (textPages.length - 1));
                } else if (targetPage && targetPage > 0 && targetPage <= textPages.length) {
                    pageIndex = targetPage - 1; // 1-based to 0-based (legacy fallback)
                } else {
                    var estimatedTextPage = Math.floor((currentPage / pdfDoc.numPages) * textPages.length);
                    pageIndex = Math.min(estimatedTextPage, textPages.length - 1);
                }
                renderTextPage(pageIndex);
                
            } else {
                textContainer.classList.remove('visible');
                pdfContainer.classList.remove('hidden');
                
                if (textPages.length > 0 && pdfDoc) {
                    var estimatedPdfPage = Math.ceil((currentTextPage / textPages.length) * pdfDoc.numPages);
                    currentPage = Math.max(1, Math.min(estimatedPdfPage, pdfDoc.numPages));
                }
                
                queueRenderPage(currentPage);
            }
            
            sendMessage({
                type: 'modeChanged',
                mode: mode
            });
        }

        // ========== PDF RENDERING ==========

<<<<<<< HEAD
        function doRenderPage(page, cx, cy, cw, ch, pageW, pageH) {
            // cx/cy = content origin in PDF coords (y-up), cw/ch = content size
            var screenW = window.innerWidth;
            var screenH = window.innerHeight;
            var scale = Math.min(screenW / cw, screenH / ch);
            var dpr = window.devicePixelRatio || 1;
            var rs = scale * dpr;
            // Viewport shifted so (cx, cy+ch) in PDF coords maps to canvas (0,0).
            // Transform: canvas_x = pdf_x*rs + offsetX, canvas_y = -pdf_y*rs + pageH*rs + offsetY
            // For (cx, cy+ch) → (0,0):  offsetX = -cx*rs,  offsetY = (cy+ch-pageH)*rs
            var vp = page.getViewport({ scale: rs, offsetX: -cx * rs, offsetY: (cy + ch - pageH) * rs });
            // Use ceil to avoid shaving off a pixel at some scale factors (can clip descenders).
            canvas.width  = Math.ceil(cw * rs);
            canvas.height = Math.ceil(ch * rs);
            canvas.style.width  = Math.ceil(cw * scale) + 'px';
            canvas.style.height = Math.ceil(ch * scale) + 'px';
            page.render({ canvasContext: ctx, viewport: vp }).promise.then(function() {
                pageRendering = false;
                if (pageNumPending !== null) { renderPage(pageNumPending); pageNumPending = null; }
                var n = pdfDoc.numPages;
                sendMessage({ type: 'locationChanged', page: currentPage, totalPages: n,
                    progress: n > 1 ? (currentPage - 1) / (n - 1) : 0 });
            }).catch(function(e) {
                pageRendering = false;
                sendMessage({ type: 'error', message: 'Error rendering page: ' + (e && e.message ? e.message : e) });
            });
        }

=======
>>>>>>> parent of 95d794a (Almost last)
        function renderPage(num) {
            pageRendering = true;
            
            pdfDoc.getPage(num).then(function(page) {
<<<<<<< HEAD
                var vp1 = page.getViewport({ scale: 1.0 });
                var pageW = vp1.width, pageH = vp1.height;
                // Slightly larger padding prevents occasional glyph clipping at certain device/UI scales.
                var pad = 24;
                page.getTextContent().then(function(tc) {
                    // Gather content bounding box from text items (PDF coords: y goes up)
                    var xs = [], lo = [], hi = [];
                    tc.items.forEach(function(item) {
                        if (!item.transform) return;
                        var tx = item.transform[4], ty = item.transform[5];
                        var w = Math.abs(item.width || 0);
                        var h = Math.abs(item.height || item.transform[3] || 10);
                        if (w > 0) { xs.push(tx, tx + w); lo.push(ty); hi.push(ty + h); }
                    });
                    var cx, cw, cy, ch;
                    if (xs.length === 0) {
                        cx = 0; cw = pageW; cy = 0; ch = pageH;
                    } else {
                        cx = Math.max(0, Math.min.apply(null, xs) - pad);
                        var cr = Math.min(pageW, Math.max.apply(null, xs) + pad);
                        cy = Math.max(0, Math.min.apply(null, lo) - pad);
                        var ct = Math.min(pageH, Math.max.apply(null, hi) + pad);
                        cw = cr - cx; ch = ct - cy;
=======
                var viewport = page.getViewport({ scale: 1.0 });
                var containerWidth = window.innerWidth - 40;
                var baseScale = containerWidth / viewport.width;
                var zoomMultiplier = 1.5;
                var scale = baseScale * zoomMultiplier;
                var devicePixelRatio = window.devicePixelRatio || 1;
                var scaledViewport = page.getViewport({ scale: scale * devicePixelRatio });

                canvas.height = scaledViewport.height;
                canvas.width = scaledViewport.width;
                canvas.style.width = (scaledViewport.width / devicePixelRatio) + 'px';
                canvas.style.height = (scaledViewport.height / devicePixelRatio) + 'px';

                var renderContext = {
                    canvasContext: ctx,
                    viewport: scaledViewport
                };

                page.render(renderContext).promise.then(function() {
                    pageRendering = false;
                    if (pageNumPending !== null) {
                        renderPage(pageNumPending);
                        pageNumPending = null;
>>>>>>> parent of 95d794a (Almost last)
                    }

                    var progress = (currentPage - 1) / (pdfDoc.numPages - 1);
                    sendMessage({
                        type: 'locationChanged',
                        page: currentPage,
                        totalPages: pdfDoc.numPages,
                        progress: progress
                    });
                });
            }).catch(function(error) {
                console.error('Error rendering page:', error);
                sendMessage({
                    type: 'error',
                    message: 'Error rendering page: ' + error.message
                });
            });
        }

        function queueRenderPage(num) {
            if (pageRendering) {
                pageNumPending = num;
            } else {
                renderPage(num);
            }
        }

        function prevPage() {
            if (readerMode === 'text') {
                if (currentTextPage > 0) renderTextPage(currentTextPage - 1);
            } else {
                if (currentPage <= 1) return;
                currentPage--;
                queueRenderPage(currentPage);
            }
        }

        function nextPage() {
            if (readerMode === 'text') {
                if (currentTextPage < textPages.length - 1) renderTextPage(currentTextPage + 1);
            } else {
                if (currentPage >= pdfDoc.numPages) return;
                currentPage++;
                queueRenderPage(currentPage);
            }
        }

        function goToPage(pageNum) {
            if (readerMode === 'text') {
                var textPageIndex = pageNum - 1;
                if (textPageIndex >= 0 && textPageIndex < textPages.length) {
                    renderTextPage(textPageIndex);
                }
            } else {
                if (pageNum < 1 || pageNum > pdfDoc.numPages) return;
                currentPage = pageNum;
                queueRenderPage(currentPage);
            }
        }

        function initReaderWithData() {
            if (!window.pdfFileUrl) {
                sendMessage({ type: 'error', message: 'No PDF file URL received' });
                return;
            }

            pdfjsLib.getDocument({ url: window.pdfFileUrl, rangeChunkSize: 65536 }).promise
                .then(function(pdf) {
                    pdfDoc = pdf;
                    loading.classList.add('hidden');
                    pdfContainer.classList.remove('hidden');
                    sendMessage({ type: 'ready', totalPages: pdf.numPages });
                    if (window.__backgroundPrepOnly) {
                        // Home-screen prep: RN injects __runBackgroundTextPrep (no render / no TOC here)
                    } else {
                        renderPage(currentPage);
                        extractTOC(pdf);
                    }
                })
                .catch(function(error) {
                    sendMessage({ type: 'error', message: 'Error loading PDF: ' + error.message });
                });
        }
        
        async function resolveOutlineDest(pdf, rawDest) {
            try {
                var dest = rawDest;
                if (dest && typeof dest.then === 'function') {
                    dest = await dest;
                }
                if (!dest) return null;
                if (typeof dest === 'string') {
                    dest = await pdf.getDestination(dest);
                }
                if (!dest || !Array.isArray(dest) || dest.length === 0) return null;
                var first = dest[0];
                if (typeof first === 'number') {
                    return Math.max(1, Math.min(first + 1, pdf.numPages));
                }
                var pageIndex = await pdf.getPageIndex(first);
                return pageIndex + 1;
            } catch (e) {
                return null;
            }
        }

        // Build a page-number list that React Native can save as a fallback TOC
        function buildPageFallback(numPages) {
            var items = [];
            var max = Math.min(numPages, 2000);
            for (var p = 1; p <= max; p++) {
                items.push({ title: 'Page ' + p, page: p, level: 0, order_index: p - 1 });
            }
            return items;
        }

        // Extract raw text from the first ~12 pages (or fewer) to send to AI
        async function extractEarlyPagesText(pdf) {
            var maxPages = Math.min(12, pdf.numPages);
            var combined = '';
            for (var p = 1; p <= maxPages; p++) {
                try {
                    var pg = await pdf.getPage(p);
                    var content = await pg.getTextContent();
                    var pageText = content.items.map(function(it) { return it.str; }).join(' ');
                    combined += '\\n--- Page ' + p + ' ---\\n' + pageText;
                } catch (e) {
                    console.warn('Could not extract text from page', p, e);
                }
            }
            // Trim to ~5000 chars so the AI prompt stays cheap
            return combined.slice(0, 5000);
        }

        // Extract TOC: try embedded outline first; if none, ask React Native to use AI on early pages text
        async function extractTOC(pdf) {
            try {
                var outline = await pdf.getOutline();
                if (outline && outline.length > 0) {
                    console.log('PDF has embedded outline, top-level items:', outline.length);

                    var tocItems = [];
                    var orderIndex = 0;

                    async function processItem(item, level) {
                        if (item.url) return;
                        var pageNum = await resolveOutlineDest(pdf, item.dest);
                        if (pageNum == null) pageNum = 1;
                        tocItems.push({
                            title: item.title || 'Untitled',
                            page: pageNum,
                            level: level,
                            order_index: orderIndex++
                        });
                        if (item.items && item.items.length > 0) {
                            for (var c = 0; c < item.items.length; c++) {
                                await processItem(item.items[c], level + 1);
                            }
                        }
                    }

                    for (var o = 0; o < outline.length; o++) {
                        await processItem(outline[o], 0);
                    }

                    if (tocItems.length > 0) {
                        sendMessage({ type: 'tocExtracted', items: tocItems, source: 'outline' });
                        console.log('TOC from embedded outline:', tocItems.length, 'items');
                        return;
                    }
                }

                // No usable embedded outline — extract early pages text for AI analysis
                console.log('No embedded outline; extracting early pages text for AI TOC');
                var earlyText = await extractEarlyPagesText(pdf);
                sendMessage({ type: 'earlyPagesText', text: earlyText, totalPages: pdf.numPages });

            } catch (error) {
                console.error('TOC extraction error:', error);
                // Send page fallback directly so the TOC screen is never empty
                sendMessage({ type: 'tocExtracted', items: buildPageFallback(pdf.numPages), source: 'pageFallback' });
            }
        }

        window.__runBackgroundTextPrep = function() {
            if (!pdfDoc) {
                sendMessage({ type: 'prepExtractDone', ok: false });
                return;
            }
            extractAllText()
                .then(function(full) {
                    sendMessage({ type: 'prepExtractDone', ok: !!(full && full.length >= 100) });
                })
                .catch(function() {
                    sendMessage({ type: 'prepExtractDone', ok: false });
                });
        };

        window.prevPage = prevPage;
        window.nextPage = nextPage;
        window.goToPage = goToPage;
        window.switchMode = switchMode;
        window.initReaderWithData = initReaderWithData;
        window.triggerTOCExtraction = function() {
            if (pdfDoc) {
                extractTOC(pdfDoc);
            } else {
                sendMessage({ type: 'tocExtractionError', message: 'PDF not loaded yet' });
            }
        };

        // Helper: check if text container is scrolled to the bottom
        function isAtBottom() {
            var threshold = 30;
            return textContainer.scrollTop + textContainer.clientHeight >= textContainer.scrollHeight - threshold;
        }
        
        // Helper: check if text container is scrolled to the top
        function isAtTop() {
            return textContainer.scrollTop <= 10;
        }

        function pdfScrollAtBottom() {
            var threshold = 30;
            return pdfContainer.scrollTop + pdfContainer.clientHeight >= pdfContainer.scrollHeight - threshold;
        }
        function pdfScrollAtTop() {
            return pdfContainer.scrollTop <= 10;
        }

        // PDF mode: gestures inside WebView (RN overlay View was blocking reliable page turns on Android)
        var pdfTsY = 0, pdfTsX = 0, pdfTsTime = 0, pdfStartedBottom = false, pdfStartedTop = false, pdfNav = false;
        pdfContainer.addEventListener('touchstart', function(e) {
            if (readerMode !== 'pdf') return;
            pdfTsY = e.touches[0].clientY;
            pdfTsX = e.touches[0].clientX;
            pdfTsTime = Date.now();
            pdfStartedBottom = pdfScrollAtBottom();
            pdfStartedTop = pdfScrollAtTop();
            pdfNav = false;
        }, { passive: true });
        pdfContainer.addEventListener('touchmove', function(e) {
            if (readerMode !== 'pdf') return;
            if (Math.abs(pdfTsY - e.touches[0].clientY) > 20) pdfNav = true;
        }, { passive: true });
        pdfContainer.addEventListener('touchend', function(e) {
            if (readerMode !== 'pdf') return;
            var endY = e.changedTouches[0].clientY;
            var endX = e.changedTouches[0].clientX;
            var dY = pdfTsY - endY;
            var dX = Math.abs(pdfTsX - endX);
            var dT = Date.now() - pdfTsTime;
            if (Math.abs(dY) < 10 && dX < 10 && dT < 300 && !pdfNav) {
                sendMessage({ type: 'toggleButtons' });
                pdfNav = false;
                return;
            }
            if (dX > 50 || dT > 600) {
                pdfNav = false;
                return;
            }
            if (dY > 50 && pdfNav && pdfStartedBottom) {
                nextPage();
            } else if (dY < -50 && pdfNav && pdfStartedTop) {
                prevPage();
            }
            pdfNav = false;
        }, { passive: false });
        
        // Swipe and tap detection for text container
        var touchStartY = 0;
        var touchStartX = 0;
        var touchStartTime = 0;
        var startedAtBottom = false;
        var startedAtTop = false;
        var isNavigating = false;
        
        textContainer.addEventListener('touchstart', function(e) {
            if (readerMode !== 'text') return;
            touchStartY = e.touches[0].clientY;
            touchStartX = e.touches[0].clientX;
            touchStartTime = Date.now();
            // Remember scroll position at start of touch
            startedAtBottom = isAtBottom();
            startedAtTop = isAtTop();
            isNavigating = false;
        }, { passive: true });
        
        textContainer.addEventListener('touchmove', function(e) {
            if (readerMode !== 'text') return;
            var deltaY = Math.abs(touchStartY - e.touches[0].clientY);
            if (deltaY > 20) isNavigating = true;
        }, { passive: true });
        
        textContainer.addEventListener('touchend', function(e) {
            if (readerMode !== 'text') return;
            
            var touchEndY = e.changedTouches[0].clientY;
            var touchEndX = e.changedTouches[0].clientX;
            var touchEndTime = Date.now();
            
            var deltaY = touchStartY - touchEndY;
            var deltaX = Math.abs(touchStartX - touchEndX);
            var deltaTime = touchEndTime - touchStartTime;
            
            // Tap detection
            if (Math.abs(deltaY) < 10 && deltaX < 10 && deltaTime < 300 && !isNavigating) {
                sendMessage({ type: 'toggleButtons' });
                return;
            }
            
            // Ignore horizontal swipes or very slow gestures
            if (deltaX > 50 || deltaTime > 600) {
                isNavigating = false;
                return;
            }
            
            // Swipe UP (deltaY > 0) = forward
            if (deltaY > 50 && isNavigating) {
                // If we were already at the bottom when the swipe started, go to next page
                if (startedAtBottom) {
                    nextPage();
                }
                // Otherwise the native scroll already moved the content down - do nothing
            }
            // Swipe DOWN (deltaY < 0) = backward
            else if (deltaY < -50 && isNavigating) {
                // If we were already at the top when the swipe started, go to prev page
                if (startedAtTop) {
                    prevPage();
                }
                // Otherwise the native scroll already moved the content up - do nothing
            }
            
            isNavigating = false;
        }, { passive: false });

        // Message listener
        window.addEventListener('message', function(event) {
            try {
                var data = JSON.parse(event.data);
                switch (data.command) {
                    case 'next': nextPage(); break;
                    case 'prev': prevPage(); break;
                    case 'goToPage': goToPage(data.page); break;
                    case 'setFontSize':
                        if (typeof data.size === 'number') {
                            window.__pdfTextFontSize = data.size;
                            if (readerMode === 'text' && textPages.length > 0) {
                                renderTextPage(currentTextPage);
                            }
                        }
                        break;
                }
            } catch (e) {}
        });

        // Window resize
        window.addEventListener('resize', function() {
            if (pdfDoc && currentPage) queueRenderPage(currentPage);
        });

        // Text selection
        var pendingSelection = null;
        var pendingPage = null;
        var storedRange = null;
        
        document.addEventListener('selectionchange', function() {
            var selection = window.getSelection();
            if (selection && selection.toString().trim().length > 0 && selection.rangeCount > 0) {
                pendingSelection = selection.toString().trim();
                pendingPage = readerMode === 'text' ? currentTextPage + 1 : currentPage;
                try { storedRange = selection.getRangeAt(0).cloneRange(); } catch (e) {}
            }
        });
        
        // Highlight click handler
        window.handleHighlightClick = function(highlightId) {
            var highlight = allHighlights.find(function(h) { return h.id === highlightId; });
            if (highlight) {
                sendMessage({
                    type: 'highlightClicked',
                    text: highlight.text,
                    color: highlight.color,
                    id: highlight.id,
                    dbId: highlight.dbId,
                });
            }
        };
        
        // Find which text page contains the given string (for auto-highlight after deck save)
        function findTextPageIndexContaining(snippet) {
            if (!textPages || textPages.length === 0 || !snippet) return currentTextPage;
            var search = snippet.replace(/\\s+/g, ' ').trim();
            if (!search) return currentTextPage;
            for (var i = 0; i < textPages.length; i++) {
                var raw = textPages[i];
                var flat = raw.replace(/\\s+/g, ' ');
                if (flat.indexOf(search) !== -1 || raw.indexOf(snippet.trim()) !== -1) {
                    return i;
                }
            }
            return currentTextPage;
        }

        // Apply highlight (works in reader/text mode; from PDF canvas mode switches to text first)
        window.applyHighlight = function(text, color, dbId) {
            if (!text) return;
            var highlightId = 'h-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
            allHighlights.push({
                id: highlightId,
                dbId: dbId,
                text: text,
                color: color,
                page: currentTextPage
            });

            function renderOnCorrectPage() {
                if (!textPages || textPages.length === 0) return;
                var idx = findTextPageIndexContaining(text);
                currentTextPage = idx;
                renderTextPage(currentTextPage);
            }

            if (readerMode === 'text' && textPages.length > 0) {
                renderOnCorrectPage();
                return;
            }

            if (readerMode === 'pdf' && pdfDoc) {
                extractAllText().then(function(fullText) {
                    // No exigir 100 chars aquí: PDFs muy cortos o una sola palabra extraíble deben poder resaltarse
                    if (!fullText || !String(fullText).trim()) return;
                    textPages = paginateText(fullText);
                    pdfContainer.classList.add('hidden');
                    textContainer.classList.add('visible');
                    readerMode = 'text';
                    renderOnCorrectPage();
                    sendMessage({ type: 'modeChanged', mode: 'text' });
                }).catch(function() {});
            }
        };
        
        // Send selection on touch/mouse up
        document.addEventListener('touchend', function() {
            if (pendingSelection) {
                sendMessage({ type: 'textSelected', text: pendingSelection, page: pendingPage });
                pendingSelection = null;
                pendingPage = null;
            }
        });
        
        document.addEventListener('mouseup', function() {
            if (pendingSelection) {
                sendMessage({ type: 'textSelected', text: pendingSelection, page: pendingPage });
                pendingSelection = null;
                pendingPage = null;
            }
        });

        // Restore highlights
        window.restoreHighlights = function(highlights) {
            highlights.forEach(function(highlight, index) {
                var highlightId = 'h-' + Date.now() + '-' + index + '-' + Math.random().toString(36).substr(2, 9);
                allHighlights.push({
                    id: highlightId,
                    dbId: highlight.dbId,
                    text: highlight.text,
                    color: highlight.color,
                    page: highlight.page || 0
                });
            });
            if (readerMode === 'text' && textPages.length > 0) {
                renderTextPage(currentTextPage);
            }
        };
        
        // Update highlight color
        window.updateHighlightColor = function(highlightId, newColor) {
            var highlight = allHighlights.find(function(h) { return h.id === highlightId; });
            if (highlight) {
                highlight.color = newColor;
                if (readerMode === 'text') renderTextPage(currentTextPage);
                return true;
            }
            return false;
        };
        
        // Delete highlight
        window.deleteHighlight = function(highlightId) {
            var index = allHighlights.findIndex(function(h) { return h.id === highlightId; });
            if (index !== -1) {
                allHighlights.splice(index, 1);
                if (readerMode === 'text') renderTextPage(currentTextPage);
                return true;
            }
            return false;
        };

        sendMessage({ type: 'webviewReady' });
    <\/script>
</body>
</html>`;
};

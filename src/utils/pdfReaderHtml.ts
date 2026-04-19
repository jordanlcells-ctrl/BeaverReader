export type PdfReaderHtmlOptions = {
  localPdfJs?: boolean;
  /** Raw source of pdf.min.js — embedded inline in a <script> tag (no CDN, no file://) */
  inlinePdfJs?: string;
  /** Raw source of pdf.worker.min.js — embedded in a hidden <script> and loaded as Blob URL */
  inlinePdfWorkerJs?: string;
};

/**
 * PDF Reader HTML template
 * Inline so that changes are picked up by Metro hot reload
 * (native assets require a full rebuild)
 */
export const getPdfReaderHtml = (darkMode = false, opts?: PdfReaderHtmlOptions) => {
  const hasInline = !!opts?.inlinePdfJs;
  const localPdfJs = hasInline || !!opts?.localPdfJs;
  const pdfScriptTag = localPdfJs
    ? ''
    : '<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"><\\/script>';
  const bg = darkMode ? '#1a1a1a' : '#fafafa';
  const bgContainer = darkMode ? '#1a1a1a' : '#f5f5f5';
  const textColor = darkMode ? '#e8e8e8' : '#2c3e50';
  const canvasBg = darkMode ? '#2d2d2d' : 'white';
  const loadingBg = darkMode ? '#2d2d2d' : 'white';
  const loadingColor = darkMode ? '#9ca3af' : '#666';
  const pageIndicatorColor = darkMode ? '#6b7280' : '#aaa';
  let html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
    <title>PDF Reader</title>
    <script>
    if (typeof globalThis === 'undefined') { window.globalThis = window; }
    /* Polyfills for older Android WebViews (Chrome < 92) */
    if (!Array.prototype.at) {
        Object.defineProperty(Array.prototype, 'at', { value: function(n) { n = Math.trunc(n) || 0; if (n < 0) n += this.length; return this[n]; }, configurable: true, writable: true });
        Object.defineProperty(String.prototype, 'at', { value: function(n) { n = Math.trunc(n) || 0; if (n < 0) n += this.length; return this[n]; }, configurable: true, writable: true });
        if (typeof Uint8Array !== 'undefined') { [Uint8Array, Int8Array, Uint16Array, Int16Array, Uint32Array, Int32Array, Float32Array, Float64Array].forEach(function(C) { if (C && !C.prototype.at) Object.defineProperty(C.prototype, 'at', { value: Array.prototype.at, configurable: true, writable: true }); }); }
    }
    if (!String.prototype.replaceAll) {
        String.prototype.replaceAll = function(search, replacement) { if (search instanceof RegExp) { if (!search.global) throw new TypeError('replaceAll must be called with a global RegExp'); return this.replace(search, replacement); } return this.split(search).join(replacement); };
    }
    if (typeof structuredClone === 'undefined') {
        window.structuredClone = function(obj) { return JSON.parse(JSON.stringify(obj)); };
    }
    if (!Promise.allSettled) {
        Promise.allSettled = function(promises) { return Promise.all(Array.from(promises).map(function(p) { return Promise.resolve(p).then(function(v) { return { status: 'fulfilled', value: v }; }, function(e) { return { status: 'rejected', reason: e }; }); })); };
    }
    if (typeof crypto !== 'undefined' && !crypto.randomUUID) {
        crypto.randomUUID = function() { return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, function(c) { return (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16); }); };
    }
    <\\/script>
    ${pdfScriptTag}
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
            height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background: ${bgContainer};
            overflow: hidden;
        }
        #pdf-container.hidden {
            display: none !important;
        }
        #canvas {
            display: block;
            background: ${canvasBg};
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            ${darkMode ? 'filter: invert(1) hue-rotate(180deg);' : ''}
        }
        #text-container {
            display: none;
            width: 100%;
            height: 100vh;
            overflow: hidden;
            background: ${bg};
            padding: 20px 24px;
            padding-top: calc(env(safe-area-inset-top, 20px) + 28px);
            padding-bottom: 60px;
            box-sizing: border-box;
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
            max-width: 640px;
            margin: 0 auto;
            font-size: 19px;
            line-height: 1.65;
            color: ${textColor};
            font-family: Georgia, 'Times New Roman', serif;
            word-wrap: break-word;
            opacity: 1;
            transition: opacity 0.15s ease-in-out;
        }
        .text-page.fading {
            opacity: 0;
        }
        .text-page p {
            margin: 0 0 0.9em 0;
            text-align: left;
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
        // Polyfill preamble for web workers (same as the page-level polyfills)
        var __workerPolyfills = [
            'if(typeof globalThis==="undefined"){self.globalThis=self;}',
            'if(!Array.prototype.at){Object.defineProperty(Array.prototype,"at",{value:function(n){n=Math.trunc(n)||0;if(n<0)n+=this.length;return this[n]},configurable:true,writable:true});Object.defineProperty(String.prototype,"at",{value:function(n){n=Math.trunc(n)||0;if(n<0)n+=this.length;return this[n]},configurable:true,writable:true});[Uint8Array,Int8Array,Uint16Array,Int16Array,Uint32Array,Int32Array,Float32Array,Float64Array].forEach(function(C){if(C&&!C.prototype.at)Object.defineProperty(C.prototype,"at",{value:Array.prototype.at,configurable:true,writable:true})});}',
            'if(!String.prototype.replaceAll){String.prototype.replaceAll=function(s,r){if(s instanceof RegExp){if(!s.global)throw new TypeError("replaceAll must be called with a global RegExp");return this.replace(s,r)}return this.split(s).join(r)};}',
            'if(typeof structuredClone==="undefined"){self.structuredClone=function(o){return JSON.parse(JSON.stringify(o))};}',
            'if(!Promise.allSettled){Promise.allSettled=function(ps){return Promise.all(Array.from(ps).map(function(p){return Promise.resolve(p).then(function(v){return{status:"fulfilled",value:v}},function(e){return{status:"rejected",reason:e}})}))}}',
            'if(typeof crypto!=="undefined"&&!crypto.randomUUID){crypto.randomUUID=function(){return([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g,function(c){return(c^(crypto.getRandomValues(new Uint8Array(1))[0]&(15>>(c/4)))).toString(16)})}}',
        ].join('\\n');

        // Configure pdf.js worker — inline Blob URL (embedded), CDN fallback, or skip
        if (typeof pdfjsLib !== 'undefined') {
            var workerEl = document.getElementById('pdf-worker-src');
            if (workerEl && workerEl.textContent) {
                try {
                    var workerCode = __workerPolyfills + '\\n' + workerEl.textContent;
                    var blob = new Blob([workerCode], {type: 'application/javascript'});
                    pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(blob);
                } catch(e) {
                    pdfjsLib.GlobalWorkerOptions.workerSrc = '';
                }
            } ${localPdfJs ? '' : `else {
                pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            }`}
        }

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

        window.onerror = function(msg, url, line, col, err) {
            sendMessage({ type: 'error', message: 'JS: ' + msg + ' (line ' + line + ')' });
        };
        window.onunhandledrejection = function(ev) {
            sendMessage({ type: 'error', message: 'Promise: ' + (ev.reason && ev.reason.message ? ev.reason.message : String(ev.reason)) });
        };

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
                    const items = content.items.filter(function(it) { return it.str && it.str.length > 0; });
                    if (items.length === 0) continue;

                    // --- Step 1: Compute the document's typical line height for this page ---
                    // Collect all unique y positions, sort descending (PDF y-axis is bottom-up)
                    var yPositions = [];
                    items.forEach(function(it) { yPositions.push(it.transform[5]); });
                    yPositions.sort(function(a, b) { return b - a; });
                    // Gaps between consecutive y values
                    var gaps = [];
                    for (var gi = 1; gi < yPositions.length; gi++) {
                        var g = yPositions[gi - 1] - yPositions[gi];
                        if (g > 0.5) gaps.push(g);
                    }
                    gaps.sort(function(a, b) { return a - b; });
                    // Median gap = typical line height; paragraph gap = 1.5× that
                    var medianGap = gaps.length > 0 ? gaps[Math.floor(gaps.length / 2)] : 12;
                    var paraThreshold = medianGap * 1.5;

                    // --- Step 2: Assemble text, using threshold for paragraph detection ---
                    var pageText = '';
                    var lastY = null;
                    var lastEndX = null;

                    for (var j = 0; j < items.length; j++) {
                        var item = items[j];
                        var str = item.str;
                        var y = item.transform[5];
                        var x = item.transform[4];

                        if (lastY !== null) {
                            var yDiff = lastY - y; // positive = moved down on page
                            if (Math.abs(yDiff) > paraThreshold) {
                                // Large gap → paragraph break
                                pageText += '\\n\\n';
                            } else if (Math.abs(yDiff) > 0.5) {
                                // New line in same paragraph — handle soft hyphens
                                if (pageText.endsWith('-') && /[a-z]/i.test(str[0])) {
                                    pageText = pageText.slice(0, -1); // dehyphenate
                                } else {
                                    pageText += ' ';
                                }
                            } else {
                                // Same line — add space if there's a gap between items
                                if (lastEndX !== null && str.trim().length > 0 && x > lastEndX + 1) {
                                    pageText += ' ';
                                }
                            }
                        }

                        pageText += str;
                        lastY = y;
                        lastEndX = x + (item.width || 0);
                    }

                    var trimmed = pageText.trim();
                    if (trimmed.length > 0) pageTexts.push(trimmed);
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
        
        // Paginate text.  Diagnostic values are forwarded via sendMessage so they appear
        // in the React Native Metro log (WebView console.log is not visible there).
        function paginateText(fullText) {
            var fontSizePx   = (typeof window.__pdfTextFontSize === 'number') ? window.__pdfTextFontSize : 19;
            var lineHeightPx = fontSizePx * 1.65;
            var paraMarginPx = fontSizePx * 0.9;
            var indicatorH   = 36;
            // padding-top = 28px (env override); padding-bottom = 60px — no extra -20 here.
            var availH = window.innerHeight - 28 - 60 - indicatorH;
            var availW = window.innerWidth  - 48;

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
                    }
                    return out.length > 0 ? out : [block.trim()];
                }

                var buf = '';
                for (var pi = 0; pi < paragraphs.length; pi++) {
                    var para = paragraphs[pi].trim();
                    if (!para) continue;
                    var sentences = splitIntoSentences(para);
                    for (var si = 0; si < sentences.length; si++) {
                        var sent = sentences[si];
                        var glue = '';
                        if (!buf) glue = '';
                        else if (si === 0) glue = '\\n\\n'; // new PDF paragraph → visual gap
                        else glue = ' ';                     // same paragraph → next sentence

                        var proposed = buf + glue + sent;
                        if (proposed.length <= charsPerPage || !buf) {
                            buf = proposed;
                        } else {
                            pages.push([buf]);
                            buf = sent;
                        }
                    }
                }
                if (buf) pages.push([buf]);
            }

            // Forward diagnostic data to React Native so it appears in Metro logs
            sendMessage({
                type: 'debug',
                msg: diagMsg + ' canvasPages=' + (usedFallback ? 'FALLBACK' : pages.length) +
                     ' finalPages=' + pages.length + ' usedFallback=' + usedFallback
            });

            return pages;
        }
        
        // Render text page
        function renderTextPage(pageIndex) {
            if (pageIndex < 0 || pageIndex >= textPages.length) return;
            
            var fontSizePx = (typeof window.__pdfTextFontSize === 'number') ? window.__pdfTextFontSize : 19;
            textContent.style.fontSize = fontSizePx + 'px';
            textContent.classList.add('fading');
            
            setTimeout(function() {
                currentTextPage = pageIndex;
                
                var pageParas = textPages[pageIndex]; // now an array of paragraph strings
                var flatText = Array.isArray(pageParas) ? pageParas.join('\\n\\n') : pageParas;

                // Build <p>-based HTML for proper reflow (no white-space: pre-wrap)
                var paras = Array.isArray(pageParas) ? pageParas : flatText.split(/\\n\\n+/);
                var htmlContent = paras.map(function(para) {
                    var escaped = para
                        .replace(/&/g, '&amp;')
                        .replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;');
                    return '<p>' + escaped + '</p>';
                }).join('');

                // Apply highlights
                var pageHighlights = allHighlights.filter(function(h) {
                    var normPage = flatText.replace(/\\s+/g, ' ').trim();
                    var normHL = h.text.replace(/\\s+/g, ' ').trim();
                    return normPage.indexOf(normHL) !== -1;
                });
                pageHighlights.forEach(function(highlight) {
                    var escapedText = highlight.text
                        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                        .replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&');
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
            canvas.width  = Math.round(cw * rs);
            canvas.height = Math.round(ch * rs);
            canvas.style.width  = Math.round(cw * scale) + 'px';
            canvas.style.height = Math.round(ch * scale) + 'px';
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

        function renderPage(num) {
            pageRendering = true;
            pdfDoc.getPage(num).then(function(page) {
                var vp1 = page.getViewport({ scale: 1.0 });
                var pageW = vp1.width, pageH = vp1.height;
                var pad = 10;
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
                    }
                    doRenderPage(page, cx, cy, cw, ch, pageW, pageH);
                }).catch(function() {
                    doRenderPage(page, 0, 0, pageW, pageH, pageW, pageH);
                });
            }).catch(function(error) {
                pageRendering = false;
                sendMessage({ type: 'error', message: 'Error rendering page: ' + (error && error.message ? error.message : error) });
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

        function openPdf(source) {
            pdfjsLib.getDocument(source).promise
                .then(function(pdf) {
                    pdfDoc = pdf;
                    loading.classList.add('hidden');
                    pdfContainer.classList.remove('hidden');
                    sendMessage({ type: 'ready', totalPages: pdf.numPages });
                    if (window.__backgroundPrepOnly) {
                    } else {
                        renderPage(currentPage);
                        extractTOC(pdf);
                    }
                })
                .catch(function(error) {
                    loading.classList.add('hidden');
                    var msg = (error && error.message) ? error.message : String(error);
                    sendMessage({ type: 'error', message: 'Error loading PDF: ' + msg });
                });
        }

        function initReaderWithData() {
            if (typeof pdfjsLib === 'undefined') {
                sendMessage({ type: 'error', message: 'PDF engine failed to load. Please update Android System WebView from the Play Store, then restart the app.' });
                loading.classList.add('hidden');
                return;
            }
            if (!window.pdfFileUrl) {
                sendMessage({ type: 'error', message: 'No PDF file URL received' });
                loading.classList.add('hidden');
                return;
            }
            openPdf({ url: window.pdfFileUrl, rangeChunkSize: 65536 });
        }

        function initReaderFromBase64(b64) {
            if (typeof pdfjsLib === 'undefined') {
                sendMessage({ type: 'error', message: 'PDF engine failed to load. Please update Android System WebView from the Play Store, then restart the app.' });
                loading.classList.add('hidden');
                return;
            }
            if (!b64 || b64.length < 100) {
                sendMessage({ type: 'error', message: 'No PDF data received.' });
                loading.classList.add('hidden');
                return;
            }
            try {
                var raw = atob(b64);
                var len = raw.length;
                var bytes = new Uint8Array(len);
                for (var i = 0; i < len; i++) bytes[i] = raw.charCodeAt(i);
                window.__pdfB64 = null;
                openPdf({ data: bytes.buffer });
            } catch (e) {
                loading.classList.add('hidden');
                sendMessage({ type: 'error', message: 'Failed to decode PDF: ' + (e.message || e) });
            }
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

        /**
         * Called by the RN host after injecting pdf.worker.min.js source
         * as a string. Creates a Blob URL so pdf.js can spawn a real Worker
         * without needing file:// access.
         */
        window.setupWorkerBlob = function(workerJsSource) {
            if (typeof pdfjsLib === 'undefined') return;
            try {
                var workerCode = __workerPolyfills + '\\n' + workerJsSource;
                var blob = new Blob([workerCode], { type: 'application/javascript' });
                pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(blob);
            } catch (e) {
                pdfjsLib.GlobalWorkerOptions.workerSrc = '';
            }
        };

        window.prevPage = prevPage;
        window.nextPage = nextPage;
        window.goToPage = goToPage;
        window.switchMode = switchMode;
        window.initReaderWithData = initReaderWithData;
        window.initReaderFromBase64 = initReaderFromBase64;
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
            
            // Text mode is fully paginated (overflow:hidden) — swipe always navigates directly.
            // No scroll-position check needed; every vertical swipe is a page turn.
            if (deltaY > 50 && isNavigating) {
                nextPage();
            } else if (deltaY < -50 && isNavigating) {
                prevPage();
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
        
        // Normalize one text-mode page entry (array of paragraph strings, or legacy single string).
        function joinPageText(entry) {
            try {
                if (entry == null || entry === '') return '';
                if (Array.isArray(entry)) {
                    return entry.map(function(p) {
                        return p == null ? '' : String(p);
                    }).join('\\n\\n');
                }
                return String(entry);
            } catch (e) {
                return '';
            }
        }

        // Find which text page contains the given string (for auto-highlight after deck save)
        function findTextPageIndexContaining(snippet) {
            if (!textPages || textPages.length === 0 || snippet == null) return currentTextPage;
            var search = String(snippet).replace(/\\s+/g, ' ').trim();
            if (!search) return currentTextPage;
            var snippetTrim = String(snippet).trim();
            for (var i = 0; i < textPages.length; i++) {
                var raw = String(joinPageText(textPages[i]));
                var flat = raw.replace(/\\s+/g, ' ');
                if (flat.indexOf(search) !== -1 || raw.indexOf(snippetTrim) !== -1) {
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

  // Post-process: embed inline pdf.js + worker if provided.
  // IMPORTANT: we use indexOf+slice instead of String.replace() because
  // pdf.min.js contains $ patterns ($&, $', ${) that .replace() interprets
  // as special replacement tokens, silently corrupting the output.
  if (opts?.inlinePdfJs) {
    const safeJs = opts.inlinePdfJs.replace(/<\/script/gi, '<\\/script');
    let insertion = '<script>' + safeJs + '</script>';
    if (opts.inlinePdfWorkerJs) {
      const safeWorker = opts.inlinePdfWorkerJs.replace(/<\/script/gi, '<\\/script');
      insertion +=
        '<script type="text/plain" id="pdf-worker-src">' + safeWorker + '</script>';
    }
    const marker = '<title>PDF Reader</title>';
    const idx = html.indexOf(marker);
    if (idx >= 0) {
      const end = idx + marker.length;
      html = html.slice(0, end) + insertion + html.slice(end);
    }
  }

  return html;
};

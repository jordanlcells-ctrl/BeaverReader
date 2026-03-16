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
            height: calc(100vh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 10px);
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
            overflow-y: auto;
            overflow-x: hidden;
            -webkit-overflow-scrolling: auto;
            overscroll-behavior: none;
            overscroll-behavior-y: contain;
            background: ${bg};
            padding: 20px;
            padding-top: calc(env(safe-area-inset-top, 20px) + 40px);
            padding-bottom: 120px;
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
        async function switchMode(mode, targetPage) {
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
                if (targetPage && targetPage > 0 && targetPage <= textPages.length) {
                    pageIndex = targetPage - 1; // 1-based to 0-based
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

        function renderPage(num) {
            pageRendering = true;
            
            pdfDoc.getPage(num).then(function(page) {
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
            if (!window.pdfBase64Data) {
                sendMessage({ type: 'error', message: 'No PDF data received' });
                return;
            }
            
            var base64Data = window.pdfBase64Data;
            
            try {
                var binaryString = atob(base64Data);
                var len = binaryString.length;
                var bytes = new Uint8Array(len);
                for (var i = 0; i < len; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                
                pdfjsLib.getDocument({data: bytes}).promise
                    .then(function(pdf) {
                        pdfDoc = pdf;
                        loading.classList.add('hidden');
                        pdfContainer.classList.remove('hidden');
                        sendMessage({ type: 'ready', totalPages: pdf.numPages });
                        renderPage(currentPage);
                        
                        // Extract Table of Contents from PDF outline
                        extractTOC(pdf);
                    })
                    .catch(function(error) {
                        sendMessage({ type: 'error', message: 'Error loading PDF: ' + error.message });
                    });
            } catch (error) {
                sendMessage({ type: 'error', message: 'Error converting PDF data: ' + error.message });
            }
        }
        
        // Extract Table of Contents from PDF outline/bookmarks
        async function extractTOC(pdf) {
            try {
                var outline = await pdf.getOutline();
                if (!outline || outline.length === 0) {
                    console.log('No TOC/outline found in PDF');
                    sendMessage({ type: 'tocExtracted', items: [] });
                    return;
                }
                
                console.log('Found TOC outline with', outline.length, 'top-level items');
                
                var tocItems = [];
                var orderIndex = 0;
                
                // Recursive function to process outline items
                async function processItems(items, level) {
                    for (var i = 0; i < items.length; i++) {
                        var item = items[i];
                        var page = 1;
                        
                        // Try to resolve the destination to a page number
                        try {
                            if (item.dest) {
                                var dest = item.dest;
                                // dest can be a string (named dest) or array
                                if (typeof dest === 'string') {
                                    dest = await pdf.getDestination(dest);
                                }
                                if (dest && dest[0]) {
                                    var pageRef = dest[0];
                                    var pageIndex = await pdf.getPageIndex(pageRef);
                                    page = pageIndex + 1; // 0-indexed to 1-indexed
                                }
                            }
                        } catch (e) {
                            console.log('Could not resolve page for:', item.title);
                        }
                        
                        tocItems.push({
                            title: item.title || 'Untitled',
                            page: page,
                            level: level,
                            order_index: orderIndex++
                        });
                        
                        // Process children (subsections)
                        if (item.items && item.items.length > 0) {
                            await processItems(item.items, level + 1);
                        }
                    }
                }
                
                await processItems(outline, 0);
                
                console.log('Extracted', tocItems.length, 'TOC items');
                sendMessage({ type: 'tocExtracted', items: tocItems });
                
            } catch (error) {
                console.error('Error extracting TOC:', error);
                sendMessage({ type: 'tocExtracted', items: [] });
            }
        }

        window.prevPage = prevPage;
        window.nextPage = nextPage;
        window.goToPage = goToPage;
        window.switchMode = switchMode;
        window.initReaderWithData = initReaderWithData;

        // Helper: check if text container is scrolled to the bottom
        function isAtBottom() {
            var threshold = 30;
            return textContainer.scrollTop + textContainer.clientHeight >= textContainer.scrollHeight - threshold;
        }
        
        // Helper: check if text container is scrolled to the top
        function isAtTop() {
            return textContainer.scrollTop <= 10;
        }
        
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
        
        // Apply highlight
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
            renderTextPage(currentTextPage);
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

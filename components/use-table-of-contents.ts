import { useCallback, useState } from "react";
import type { WebView } from "react-native-webview";
import type { ContentPage } from "./table-of-contents-bar";

export type TocMessage =
  | { type: "tocPages"; payload: { pages: ContentPage[]; currentPageIndex: number } }
  | { type: "tocPageChanged"; payload: { currentPageIndex: number } };

/**
 * JavaScript injected into the WebView to:
 * 1. Hide the HTML table of contents and navigation buttons
 * 2. Extract page data and send it to React Native
 * 3. Listen for navigation messages from React Native
 */
export const TOC_INJECTED_JS = `
(function() {
  // Hide the native TOC elements rendered by the Gumroad web app
  function hideHtmlToc() {
    var style = document.getElementById('mobile-app-toc-hide');
    if (!style) {
      style = document.createElement('style');
      style.id = 'mobile-app-toc-hide';
      style.textContent = [
        '.content-page-navigation { display: none !important; }',
        '.table-of-contents { display: none !important; }',
        '[data-component="TableOfContents"] { display: none !important; }',
        '.rich-content-toc { display: none !important; }',
      ].join('\\n');
      document.head.appendChild(style);
    }
  }

  // Extract page data from the DOM
  function extractPages() {
    var pages = [];
    var links = document.querySelectorAll('.table-of-contents a, [data-component="TableOfContents"] a, .content-page-navigation a');
    var seen = new Set();
    links.forEach(function(link) {
      var href = link.getAttribute('href') || '';
      var name = link.textContent.trim();
      if (name && !seen.has(href)) {
        seen.add(href);
        pages.push({ id: href, name: name });
      }
    });

    // Also try to extract from content page data attributes or script tags
    if (pages.length === 0) {
      var contentPages = document.querySelectorAll('[data-content-page]');
      contentPages.forEach(function(el, i) {
        pages.push({
          id: el.getAttribute('data-content-page') || String(i),
          name: el.getAttribute('data-content-page-name') || ('Page ' + (i + 1))
        });
      });
    }

    // Try extracting from React props in __NEXT_DATA__ or similar
    if (pages.length === 0) {
      try {
        var scripts = document.querySelectorAll('script');
        scripts.forEach(function(script) {
          var text = script.textContent || '';
          var match = text.match(/content_pages["\s]*:["\s]*(\[.*?\])/);
          if (match) {
            try {
              var parsed = JSON.parse(match[1]);
              parsed.forEach(function(p, i) {
                pages.push({ id: p.id || String(i), name: p.name || p.title || ('Page ' + (i + 1)) });
              });
            } catch(e) {}
          }
        });
      } catch(e) {}
    }

    return pages;
  }

  function getCurrentPageIndex(pages) {
    var path = window.location.pathname + window.location.search;
    for (var i = 0; i < pages.length; i++) {
      if (path.indexOf(pages[i].id) !== -1) return i;
    }
    return 0;
  }

  function sendTocData() {
    hideHtmlToc();
    var pages = extractPages();
    if (pages.length > 0) {
      var currentPageIndex = getCurrentPageIndex(pages);
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'tocPages',
        payload: { pages: pages, currentPageIndex: currentPageIndex }
      }));
    }
  }

  // Listen for navigation messages from React Native
  window.addEventListener('message', function(event) {
    try {
      var msg = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      if (msg.type === 'navigateToPage' && msg.payload && msg.payload.pageId) {
        // Navigate to the page
        var link = document.querySelector('a[href*="' + msg.payload.pageId + '"]');
        if (link) {
          link.click();
        } else {
          window.location.href = msg.payload.pageId;
        }
      }
    } catch(e) {}
  });

  // Run on load and on navigation
  if (document.readyState === 'complete') {
    setTimeout(sendTocData, 500);
  } else {
    window.addEventListener('load', function() { setTimeout(sendTocData, 500); });
  }

  // MutationObserver to detect page changes
  var observer = new MutationObserver(function() {
    hideHtmlToc();
  });
  observer.observe(document.body || document.documentElement, { childList: true, subtree: true });

  true;
})();
`;

export const useTableOfContents = (webViewRef: React.RefObject<WebView | null>) => {
  const [pages, setPages] = useState<ContentPage[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);

  const handleTocMessage = useCallback((data: string): boolean => {
    try {
      const message = JSON.parse(data) as TocMessage;
      if (message.type === "tocPages") {
        setPages(message.payload.pages);
        setCurrentPageIndex(message.payload.currentPageIndex);
        return true;
      }
      if (message.type === "tocPageChanged") {
        setCurrentPageIndex(message.payload.currentPageIndex);
        return true;
      }
    } catch {
      // Not a TOC message
    }
    return false;
  }, []);

  const navigateToPage = useCallback(
    (pageIndex: number) => {
      const page = pages[pageIndex];
      if (!page) return;
      setCurrentPageIndex(pageIndex);
      webViewRef.current?.postMessage(
        JSON.stringify({
          type: "navigateToPage",
          payload: { pageId: page.id },
        }),
      );
    },
    [pages, webViewRef],
  );

  return {
    pages,
    currentPageIndex,
    handleTocMessage,
    navigateToPage,
  };
};

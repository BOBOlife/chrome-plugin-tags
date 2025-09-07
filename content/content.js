// content.js - 内容脚本
class ContentScriptManager {
  constructor() {
    this.init();
  }

  init() {
    this.setupMessageListener();
    this.observePageChanges();
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      switch (message.action) {
        case 'getPageDescription':
          sendResponse({ description: this.getPageDescription() });
          break;
        
        case 'getPageMetadata':
          sendResponse({ metadata: this.getPageMetadata() });
          break;
          
        case 'highlightSearchResults':
          this.highlightSearchResults(message.query);
          sendResponse({ success: true });
          break;
          
        case 'removeHighlights':
          this.removeHighlights();
          sendResponse({ success: true });
          break;

        default:
          sendResponse({ success: false, error: '未知操作' });
      }
    });
  }

  getPageDescription() {
    // 尝试多种方式获取页面描述
    const selectors = [
      'meta[name="description"]',
      'meta[property="og:description"]',
      'meta[name="twitter:description"]',
      'meta[property="description"]'
    ];

    for (const selector of selectors) {
      const meta = document.querySelector(selector);
      if (meta && meta.content && meta.content.trim()) {
        return meta.content.trim();
      }
    }

    // 如果没有meta描述，尝试获取第一段文字
    const paragraphs = document.querySelectorAll('p');
    for (const p of paragraphs) {
      const text = p.textContent.trim();
      if (text.length > 50 && text.length < 300) {
        return text;
      }
    }

    // 最后尝试获取任何有意义的文本
    const article = document.querySelector('article, main, .content, .post, .entry');
    if (article) {
      const text = article.textContent.trim();
      if (text.length > 50) {
        return text.substring(0, 200) + (text.length > 200 ? '...' : '');
      }
    }

    return '';
  }

  getPageMetadata() {
    const metadata = {
      title: document.title,
      url: window.location.href,
      description: this.getPageDescription(),
      favicon: this.getFaviconUrl(),
      language: document.documentElement.lang || 'zh',
      author: this.getAuthor(),
      publishDate: this.getPublishDate(),
      keywords: this.getKeywords(),
      readingTime: this.estimateReadingTime()
    };

    return metadata;
  }

  getFaviconUrl() {
    // 尝试获取网站图标
    const selectors = [
      'link[rel="icon"]',
      'link[rel="shortcut icon"]',
      'link[rel="apple-touch-icon"]'
    ];

    for (const selector of selectors) {
      const link = document.querySelector(selector);
      if (link && link.href) {
        return link.href;
      }
    }

    // 默认favicon路径
    return `${window.location.origin}/favicon.ico`;
  }

  getAuthor() {
    const selectors = [
      'meta[name="author"]',
      'meta[property="article:author"]',
      'meta[name="twitter:creator"]',
      '[rel="author"]',
      '.author',
      '.byline'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        return element.content || element.textContent?.trim() || '';
      }
    }

    return '';
  }

  getPublishDate() {
    const selectors = [
      'meta[property="article:published_time"]',
      'meta[name="publish_date"]',
      'time[datetime]',
      '.publish-date',
      '.date'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        const date = element.content || element.getAttribute('datetime') || element.textContent;
        if (date) {
          const parsedDate = new Date(date);
          if (!isNaN(parsedDate.getTime())) {
            return parsedDate.toISOString();
          }
        }
      }
    }

    return '';
  }

  getKeywords() {
    const keywords = [];
    
    // 从meta标签获取关键词
    const metaKeywords = document.querySelector('meta[name="keywords"]');
    if (metaKeywords && metaKeywords.content) {
      keywords.push(...metaKeywords.content.split(',').map(k => k.trim()));
    }

    // 从标题和描述中提取关键词
    const text = (document.title + ' ' + this.getPageDescription()).toLowerCase();
    const commonWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', '的', '了', '在', '是', '和', '与', '或', '但', '不', '这', '那', '我', '你', '他', '她', '它'];
    
    const words = text.match(/\b\w{3,}\b/g) || [];
    const wordFreq = {};
    
    words.forEach(word => {
      if (!commonWords.includes(word) && word.length > 2) {
        wordFreq[word] = (wordFreq[word] || 0) + 1;
      }
    });

    const topWords = Object.entries(wordFreq)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([word]) => word);

    keywords.push(...topWords);

    return [...new Set(keywords)].slice(0, 15); // 去重并限制数量
  }

  estimateReadingTime() {
    const text = document.body.textContent || '';
    const wordsPerMinute = 200; // 平均阅读速度
    const wordCount = text.trim().split(/\s+/).length;
    const readingTime = Math.ceil(wordCount / wordsPerMinute);
    return readingTime;
  }

  highlightSearchResults(query) {
    if (!query || query.trim() === '') return;

    this.removeHighlights(); // 清除之前的高亮

    const searchTerms = query.toLowerCase().split(/\s+/);
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          // 跳过脚本和样式标签
          if (node.parentElement.tagName === 'SCRIPT' || 
              node.parentElement.tagName === 'STYLE' ||
              node.parentElement.tagName === 'NOSCRIPT') {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const textNodes = [];
    let node;
    while (node = walker.nextNode()) {
      textNodes.push(node);
    }

    textNodes.forEach(textNode => {
      const text = textNode.textContent;
      let highlightedText = text;
      let hasMatch = false;

      searchTerms.forEach((term, index) => {
        const regex = new RegExp(`(${this.escapeRegex(term)})`, 'gi');
        if (regex.test(text)) {
          hasMatch = true;
          highlightedText = highlightedText.replace(regex, 
            `<mark class="search-highlight search-highlight-${index % 3}" data-term="${term}">$1</mark>`
          );
        }
      });

      if (hasMatch) {
        const wrapper = document.createElement('span');
        wrapper.innerHTML = highlightedText;
        textNode.parentNode.replaceChild(wrapper, textNode);
      }
    });

    // 添加高亮样式
    this.addHighlightStyles();

    // 滚动到第一个匹配项
    const firstHighlight = document.querySelector('.search-highlight');
    if (firstHighlight) {
      firstHighlight.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  removeHighlights() {
    const highlights = document.querySelectorAll('.search-highlight');
    highlights.forEach(highlight => {
      const parent = highlight.parentNode;
      parent.replaceChild(document.createTextNode(highlight.textContent), highlight);
      parent.normalize(); // 合并相邻的文本节点
    });

    // 移除样式
    const styleElement = document.querySelector('#search-highlight-styles');
    if (styleElement) {
      styleElement.remove();
    }
  }

  addHighlightStyles() {
    if (document.querySelector('#search-highlight-styles')) return;

    const styles = `
      <style id="search-highlight-styles">
        .search-highlight {
          background-color: #ffeb3b !important;
          color: #000 !important;
          padding: 1px 2px !important;
          border-radius: 2px !important;
          font-weight: bold !important;
        }
        .search-highlight-0 {
          background-color: #ffeb3b !important;
        }
        .search-highlight-1 {
          background-color: #4caf50 !important;
          color: white !important;
        }
        .search-highlight-2 {
          background-color: #2196f3 !important;
          color: white !important;
        }
      </style>
    `;
    document.head.insertAdjacentHTML('beforeend', styles);
  }

  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  observePageChanges() {
    // 监听页面动态内容变化
    const observer = new MutationObserver((mutations) => {
      let shouldUpdate = false;
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          shouldUpdate = true;
        }
      });

      if (shouldUpdate) {
        // 页面内容发生变化，可以重新获取元数据
        this.debounce(() => {
          // 通知background script页面内容已更新
          chrome.runtime.sendMessage({
            action: 'pageContentUpdated',
            url: window.location.href
          });
        }, 1000)();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // 监听URL变化（SPA应用）
    let currentUrl = window.location.href;
    const checkUrlChange = () => {
      if (currentUrl !== window.location.href) {
        currentUrl = window.location.href;
        // URL发生变化，通知background script
        chrome.runtime.sendMessage({
          action: 'urlChanged',
          url: currentUrl
        });
      }
    };

    // 监听pushState和replaceState
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function() {
      originalPushState.apply(history, arguments);
      setTimeout(checkUrlChange, 0);
    };

    history.replaceState = function() {
      originalReplaceState.apply(history, arguments);
      setTimeout(checkUrlChange, 0);
    };

    window.addEventListener('popstate', checkUrlChange);
  }

  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // 检测是否为阅读模式
  isReadableContent() {
    const article = document.querySelector('article, main, .content, .post, .entry');
    const textLength = (document.body.textContent || '').length;
    const hasHeadings = document.querySelectorAll('h1, h2, h3').length > 0;
    const hasParagraphs = document.querySelectorAll('p').length > 3;
    
    return article && textLength > 500 && hasHeadings && hasParagraphs;
  }

  // 提取页面结构化数据
  extractStructuredData() {
    const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
    const structuredData = [];

    jsonLdScripts.forEach(script => {
      try {
        const data = JSON.parse(script.textContent);
        structuredData.push(data);
      } catch (e) {
        console.warn('解析结构化数据失败:', e);
      }
    });

    return structuredData;
  }
}

// 初始化内容脚本
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new ContentScriptManager();
  });
} else {
  new ContentScriptManager();
}

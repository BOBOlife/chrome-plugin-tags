// background.js - Service Worker 后台脚本
class BackgroundManager {
  constructor() {
    console.log('🚀 BackgroundManager 开始初始化...');
    this.init().catch(error => {
      console.error('❌ BackgroundManager 初始化失败:', error);
    });
  }

  async init() {
    try {
      console.log('📝 设置事件监听器...');
      this.setupEventListeners();
      
      console.log('🏷️ 初始化徽章...');
      await this.initializeBadge();
      
      console.log('✅ BackgroundManager 初始化完成');
    } catch (error) {
      console.error('❌ 初始化过程中出错:', error);
    }
  }

  setupEventListeners() {
    try {
      console.log('📝 设置基本事件监听器...');
      
      // 扩展安装时的初始化
      if (chrome.runtime && chrome.runtime.onInstalled) {
        chrome.runtime.onInstalled.addListener((details) => {
          this.handleInstall(details);
        });
        console.log('✅ 安装事件监听器已设置');
      }

      // 处理来自content script和popup的消息
      if (chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
          this.handleMessage(message, sender, sendResponse);
          return true; // 保持消息通道开放
        });
        console.log('✅ 消息事件监听器已设置');
      }

      // 跳过键盘快捷键 - 这个API可能不稳定
      console.log('⏭️ 跳过键盘快捷键设置');

      // 上下文菜单点击 - 添加更安全的检查
      if (chrome.contextMenus && chrome.contextMenus.onClicked) {
        try {
          chrome.contextMenus.onClicked.addListener((info, tab) => {
            this.handleContextMenu(info, tab);
          });
          console.log('✅ 上下文菜单事件监听器已设置');
        } catch (error) {
          console.log('⚠️ 上下文菜单事件监听器设置失败:', error);
        }
      }

      // 书签变化监听 - 添加更安全的检查
      if (chrome.bookmarks) {
        try {
          if (chrome.bookmarks.onCreated) {
            chrome.bookmarks.onCreated.addListener(() => {
              console.log('📚 检测到书签创建，触发同步...');
              this.syncWithBrowserBookmarks();
            });
            console.log('✅ 书签创建事件监听器已设置');
          }

          if (chrome.bookmarks.onRemoved) {
            chrome.bookmarks.onRemoved.addListener(() => {
              console.log('📚 检测到书签删除，触发同步...');
              this.syncWithBrowserBookmarks();
            });
            console.log('✅ 书签删除事件监听器已设置');
          }
        } catch (error) {
          console.log('⚠️ 书签事件监听器设置失败:', error);
        }
      } else {
        console.log('⚠️ chrome.bookmarks API 不可用');
      }
      
      console.log('✅ 事件监听器设置完成');
    } catch (error) {
      console.error('❌ 设置事件监听器失败:', error);
    }
  }

  async handleInstall(details) {
    try {
      console.log('📦 处理扩展安装/更新...');
      
      if (details.reason === 'install') {
        console.log('🎉 首次安装');
        // 首次安装
        await this.initializeDefaultData();
        
        // 创建上下文菜单
        setTimeout(() => {
          this.createContextMenus();
        }, 1000);
        
        // 延迟同步浏览器书签
        setTimeout(() => {
          this.syncWithBrowserBookmarks();
        }, 2000);
        
        // 打开欢迎页面
        setTimeout(() => {
          chrome.tabs.create({
            url: chrome.runtime.getURL('options/options.html?welcome=true')
          });
        }, 1500);
        
      } else if (details.reason === 'update') {
        console.log('🔄 扩展更新到版本:', chrome.runtime.getManifest().version);
        
        // 更新时也同步一次书签
        setTimeout(() => {
          this.syncWithBrowserBookmarks();
        }, 1000);
      }
    } catch (error) {
      console.error('❌ 处理安装失败:', error);
    }
  }

  async initializeDefaultData() {
    const defaultData = {
      bookmarks: [],
      folders: [
        { id: 'default', name: '默认', count: 0 },
        { id: 'work', name: '工作', count: 0 },
        { id: 'personal', name: '个人', count: 0 }
      ],
      settings: {
        theme: 'light',
        viewMode: 'card',
        itemsPerPage: 20,
        showDescriptions: true,
        autoBackup: true,
        syncEnabled: false
      },
      tags: [],
      lastBackup: null
    };

    await chrome.storage.local.set(defaultData);
    console.log('默认数据已初始化');
  }

  createContextMenus() {
    try {
      if (!chrome.contextMenus) {
        console.log('上下文菜单API不可用');
        return;
      }

      // 清除现有菜单
      chrome.contextMenus.removeAll(() => {
        try {
          // 创建右键菜单
          chrome.contextMenus.create({
            id: 'add-to-bookmarks',
            title: '添加到收藏夹',
            contexts: ['page', 'link'],
            documentUrlPatterns: ['http://*/*', 'https://*/*']
          });

          chrome.contextMenus.create({
            id: 'add-link-to-bookmarks',
            title: '收藏此链接',
            contexts: ['link'],
            documentUrlPatterns: ['http://*/*', 'https://*/*']
          });

          chrome.contextMenus.create({
            id: 'separator1',
            type: 'separator',
            contexts: ['page', 'link']
          });

          chrome.contextMenus.create({
            id: 'open-manager',
            title: '打开收藏管理器',
            contexts: ['page', 'link']
          });

          console.log('上下文菜单创建成功');
        } catch (error) {
          console.error('创建上下文菜单项失败:', error);
        }
      });
    } catch (error) {
      console.error('创建上下文菜单失败:', error);
    }
  }

  async handleMessage(message, sender, sendResponse) {
    try {
      switch (message.action) {
        case 'getBookmarks':
          const bookmarks = await this.getBookmarks(message.query);
          sendResponse({ success: true, data: bookmarks });
          break;

        case 'saveBookmark':
          await this.saveBookmark(message.bookmark);
          sendResponse({ success: true });
          break;

        case 'deleteBookmark':
          await this.deleteBookmark(message.id);
          sendResponse({ success: true });
          break;

        case 'updateBookmark':
          await this.updateBookmark(message.bookmark);
          sendResponse({ success: true });
          break;

        case 'getFolders':
          const folders = await this.getFolders();
          sendResponse({ success: true, data: folders });
          break;

        case 'saveFolder':
          await this.saveFolder(message.folder);
          sendResponse({ success: true });
          break;

        case 'deleteFolder':
          await this.deleteFolder(message.id);
          sendResponse({ success: true });
          break;

        case 'exportData':
          const exportData = await this.exportData();
          sendResponse({ success: true, data: exportData });
          break;

        case 'importData':
          await this.importData(message.data);
          sendResponse({ success: true });
          break;

        case 'getStats':
          const stats = await this.getStats();
          sendResponse({ success: true, data: stats });
          break;

        case 'syncBrowserBookmarks':
          await this.syncWithBrowserBookmarks();
          sendResponse({ success: true });
          break;

        case 'debugPermissions':
          const permissionInfo = await this.checkPermissions();
          sendResponse({ success: true, data: permissionInfo });
          break;

        default:
          sendResponse({ success: false, error: '未知操作' });
      }
    } catch (error) {
      console.error('处理消息失败:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async handleCommand(command) {
    // 键盘快捷键处理已禁用以避免兼容性问题
    console.log('⚠️ 键盘快捷键处理已禁用:', command);
  }

  async handleContextMenu(info, tab) {
    switch (info.menuItemId) {
      case 'add-to-bookmarks':
        // 添加当前页面到收藏
        chrome.action.openPopup();
        break;

      case 'add-link-to-bookmarks':
        // 添加链接到收藏
        await this.quickSaveLink(info.linkUrl, info.selectionText || info.linkUrl);
        break;

      case 'open-manager':
        // 打开管理器
        chrome.tabs.create({
          url: chrome.runtime.getURL('options/options.html')
        });
        break;
    }
  }

  async quickSaveLink(url, title) {
    const bookmark = {
      id: Date.now().toString(),
      title: title,
      url: url,
      description: '',
      folder: 'default',
      tags: [],
      dateAdded: new Date().toISOString(),
      favicon: this.getFaviconUrl(url)
    };

    try {
      await this.saveBookmark(bookmark);
      
      // 显示通知
      this.safeNotification({
        type: 'basic',
        title: '收藏已保存',
        message: `"${title}" 已添加到收藏夹`
      });
    } catch (error) {
      console.error('快速保存失败:', error);
    }
  }

  async getBookmarks(query = {}) {
    const result = await chrome.storage.local.get(['bookmarks']);
    let bookmarks = result.bookmarks || [];

    // 应用过滤条件
    if (query.folder) {
      bookmarks = bookmarks.filter(b => b.folder === query.folder);
    }

    if (query.tags && query.tags.length > 0) {
      bookmarks = bookmarks.filter(b => 
        query.tags.some(tag => b.tags.includes(tag))
      );
    }

    if (query.search) {
      const searchTerm = query.search.toLowerCase();
      bookmarks = bookmarks.filter(b => 
        b.title.toLowerCase().includes(searchTerm) ||
        b.description.toLowerCase().includes(searchTerm) ||
        b.url.toLowerCase().includes(searchTerm) ||
        b.tags.some(tag => tag.toLowerCase().includes(searchTerm))
      );
    }

    // 排序
    if (query.sortBy === 'title') {
      bookmarks.sort((a, b) => a.title.localeCompare(b.title));
    } else {
      // 默认按日期排序（最新在前）
      bookmarks.sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));
    }

    return bookmarks;
  }

  async saveBookmark(bookmark) {
    const result = await chrome.storage.local.get(['bookmarks', 'folders']);
    const bookmarks = result.bookmarks || [];
    const folders = result.folders || [];

    // 检查是否已存在相同URL
    const existingIndex = bookmarks.findIndex(b => b.url === bookmark.url);
    
    if (existingIndex !== -1) {
      // 更新现有书签
      bookmarks[existingIndex] = { ...bookmarks[existingIndex], ...bookmark };
    } else {
      // 添加新书签
      bookmarks.push(bookmark);
      
      // 更新文件夹计数
      const folderIndex = folders.findIndex(f => f.id === bookmark.folder);
      if (folderIndex !== -1) {
        folders[folderIndex].count++;
      }
    }

    await chrome.storage.local.set({ bookmarks, folders });
    await this.updateBadge();
  }

  async deleteBookmark(id) {
    const result = await chrome.storage.local.get(['bookmarks', 'folders']);
    const bookmarks = result.bookmarks || [];
    const folders = result.folders || [];

    const bookmarkIndex = bookmarks.findIndex(b => b.id === id);
    if (bookmarkIndex !== -1) {
      const bookmark = bookmarks[bookmarkIndex];
      
      // 更新文件夹计数
      const folderIndex = folders.findIndex(f => f.id === bookmark.folder);
      if (folderIndex !== -1) {
        folders[folderIndex].count = Math.max(0, folders[folderIndex].count - 1);
      }
      
      bookmarks.splice(bookmarkIndex, 1);
      await chrome.storage.local.set({ bookmarks, folders });
      await this.updateBadge();
    }
  }

  async updateBookmark(updatedBookmark) {
    const result = await chrome.storage.local.get(['bookmarks']);
    const bookmarks = result.bookmarks || [];

    const index = bookmarks.findIndex(b => b.id === updatedBookmark.id);
    if (index !== -1) {
      bookmarks[index] = updatedBookmark;
      await chrome.storage.local.set({ bookmarks });
    }
  }

  async getFolders() {
    const result = await chrome.storage.local.get(['folders']);
    return result.folders || [];
  }

  async saveFolder(folder) {
    const result = await chrome.storage.local.get(['folders']);
    const folders = result.folders || [];

    const existingIndex = folders.findIndex(f => f.id === folder.id);
    if (existingIndex !== -1) {
      folders[existingIndex] = folder;
    } else {
      folders.push(folder);
    }

    await chrome.storage.local.set({ folders });
  }

  async deleteFolder(folderId) {
    if (folderId === 'default') {
      throw new Error('不能删除默认文件夹');
    }

    const result = await chrome.storage.local.get(['folders', 'bookmarks']);
    const folders = result.folders || [];
    const bookmarks = result.bookmarks || [];

    // 移除文件夹
    const folderIndex = folders.findIndex(f => f.id === folderId);
    if (folderIndex !== -1) {
      folders.splice(folderIndex, 1);
    }

    // 将该文件夹下的书签移动到默认文件夹
    bookmarks.forEach(bookmark => {
      if (bookmark.folder === folderId) {
        bookmark.folder = 'default';
      }
    });

    // 更新默认文件夹计数
    const defaultFolder = folders.find(f => f.id === 'default');
    if (defaultFolder) {
      defaultFolder.count = bookmarks.filter(b => b.folder === 'default').length;
    }

    await chrome.storage.local.set({ folders, bookmarks });
  }

  async getStats() {
    const result = await chrome.storage.local.get(['bookmarks', 'folders']);
    const bookmarks = result.bookmarks || [];
    const folders = result.folders || [];

    // 计算标签统计
    const tagCounts = {};
    bookmarks.forEach(bookmark => {
      bookmark.tags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });

    const topTags = Object.entries(tagCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }));

    return {
      totalBookmarks: bookmarks.length,
      totalFolders: folders.length,
      totalTags: Object.keys(tagCounts).length,
      topTags,
      recentBookmarks: bookmarks
        .sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded))
        .slice(0, 10)
    };
  }

  async exportData() {
    const result = await chrome.storage.local.get(null);
    return {
      ...result,
      exportDate: new Date().toISOString(),
      version: chrome.runtime.getManifest().version
    };
  }

  async importData(data) {
    // 验证数据格式
    if (!data.bookmarks || !Array.isArray(data.bookmarks)) {
      throw new Error('无效的数据格式');
    }

    // 合并数据
    const currentResult = await chrome.storage.local.get(['bookmarks', 'folders']);
    const currentBookmarks = currentResult.bookmarks || [];
    const currentFolders = currentResult.folders || [];

    // 合并书签（避免重复）
    const mergedBookmarks = [...currentBookmarks];
    data.bookmarks.forEach(importedBookmark => {
      const exists = mergedBookmarks.find(b => b.url === importedBookmark.url);
      if (!exists) {
        mergedBookmarks.push({
          ...importedBookmark,
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9)
        });
      }
    });

    // 合并文件夹
    const mergedFolders = [...currentFolders];
    if (data.folders) {
      data.folders.forEach(importedFolder => {
        const exists = mergedFolders.find(f => f.name === importedFolder.name);
        if (!exists) {
          mergedFolders.push({
            ...importedFolder,
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9)
          });
        }
      });
    }

    await chrome.storage.local.set({
      bookmarks: mergedBookmarks,
      folders: mergedFolders
    });

    await this.updateBadge();
  }

  async syncWithBrowserBookmarks() {
    try {
      console.log('🔄 开始同步浏览器书签...');
      
      // 检查chrome.bookmarks API是否可用
      if (!chrome.bookmarks) {
        console.error('❌ chrome.bookmarks API 不可用');
        this.safeNotification({
          type: 'basic',
          title: '同步失败',
          message: 'chrome.bookmarks API 不可用'
        });
        return;
      }
      
      console.log('📋 检查扩展权限...');
      
      // 检查权限
      let hasBookmarksPermission = false;
      try {
        hasBookmarksPermission = await chrome.permissions.contains({
          permissions: ['bookmarks']
        });
      } catch (permError) {
        console.error('❌ 权限检查失败:', permError);
        hasBookmarksPermission = false;
      }
      
      if (!hasBookmarksPermission) {
        console.error('❌ 缺少书签权限');
        this.safeNotification({
          type: 'basic',
          title: '权限错误',
          message: '需要书签访问权限'
        });
        return;
      }
      
      console.log('✅ 权限检查通过');
      
      // 获取浏览器书签
      let bookmarkTree;
      try {
        bookmarkTree = await chrome.bookmarks.getTree();
      } catch (bookmarkError) {
        console.error('❌ 获取书签树失败:', bookmarkError);
        this.safeNotification({
          type: 'basic',
          title: '同步失败',
          message: '无法获取浏览器书签'
        });
        return;
      }
      
      console.log('📚 浏览器书签树:', bookmarkTree);
      console.log('📚 书签树根节点数量:', bookmarkTree.length);
      
      // 详细检查每个根节点
      bookmarkTree.forEach((rootNode, index) => {
        console.log(`📁 根节点 ${index}:`, {
          id: rootNode.id,
          title: rootNode.title,
          hasChildren: !!rootNode.children,
          childrenCount: rootNode.children ? rootNode.children.length : 0
        });
        
        if (rootNode.children) {
          rootNode.children.forEach((child, childIndex) => {
            console.log(`  📁 子节点 ${childIndex}:`, {
              id: child.id,
              title: child.title,
              hasChildren: !!child.children,
              childrenCount: child.children ? child.children.length : 0,
              isBookmark: !!child.url
            });
          });
        }
      });
      
      const browserBookmarks = this.extractBookmarksFromTree(bookmarkTree);
      console.log('📖 提取的书签数量:', browserBookmarks.length);
      console.log('📖 书签示例:', browserBookmarks.slice(0, 5));
      
      if (browserBookmarks.length === 0) {
        console.log('⚠️ 没有找到浏览器书签');
        this.safeNotification({
          type: 'basic',
          title: '同步完成',
          message: '浏览器中没有找到书签'
        });
        return;
      }
      
      // 获取当前插件书签
      const result = await chrome.storage.local.get(['bookmarks', 'folders']);
      const existingBookmarks = result.bookmarks || [];
      const existingFolders = result.folders || [];
      
      console.log('💾 现有书签数量:', existingBookmarks.length);
      console.log('💾 现有文件夹数量:', existingFolders.length);
      
      // 合并书签（避免重复）
      const mergedBookmarks = [...existingBookmarks];
      const mergedFolders = [...existingFolders];
      const folderMap = new Map();
      
      // 处理文件夹
      existingFolders.forEach(folder => {
        folderMap.set(folder.name, folder.id);
      });
      
      let newBookmarksCount = 0;
      let skippedCount = 0;
      
      browserBookmarks.forEach((browserBookmark, index) => {
        console.log(`🔍 处理书签 ${index + 1}/${browserBookmarks.length}:`, browserBookmark.title);
        
        // 检查是否已存在相同URL的书签
        const exists = existingBookmarks.find(b => b.url === browserBookmark.url);
        
        if (!exists) {
          // 处理文件夹
          let folderId = 'default';
          if (browserBookmark.folderName && 
              browserBookmark.folderName !== '其他书签' && 
              browserBookmark.folderName !== '书签栏' &&
              browserBookmark.folderName !== 'Bookmarks Bar' &&
              browserBookmark.folderName !== 'Other Bookmarks') {
            if (!folderMap.has(browserBookmark.folderName)) {
              // 创建新文件夹
              const newFolder = {
                id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                name: browserBookmark.folderName,
                count: 0
              };
              mergedFolders.push(newFolder);
              folderMap.set(browserBookmark.folderName, newFolder.id);
              console.log('📁 创建新文件夹:', browserBookmark.folderName);
            }
            folderId = folderMap.get(browserBookmark.folderName);
          }
          
          // 添加书签
          const newBookmark = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            title: browserBookmark.title || browserBookmark.url,
            url: browserBookmark.url,
            description: '',
            folder: folderId,
            tags: [],
            dateAdded: browserBookmark.dateAdded,
            favicon: this.getFaviconUrl(browserBookmark.url),
            isFromBrowser: true // 标记为来自浏览器
          };
          
          mergedBookmarks.push(newBookmark);
          newBookmarksCount++;
          console.log('✅ 添加新书签:', newBookmark.title);
        } else {
          skippedCount++;
          console.log('⏭️ 跳过已存在的书签:', browserBookmark.title);
        }
      });
      
      // 更新文件夹计数
      mergedFolders.forEach(folder => {
        folder.count = mergedBookmarks.filter(b => b.folder === folder.id).length;
        console.log(`📁 更新文件夹 "${folder.name}" 计数:`, folder.count);
      });
      
      // 保存合并后的数据
      console.log('💾 保存合并后的数据...');
      console.log('💾 总书签数:', mergedBookmarks.length);
      console.log('💾 总文件夹数:', mergedFolders.length);
      
      await chrome.storage.local.set({
        bookmarks: mergedBookmarks,
        folders: mergedFolders
      });
      
      console.log(`🎉 同步完成：导入了 ${newBookmarksCount} 个新书签，跳过了 ${skippedCount} 个重复书签，总共 ${mergedBookmarks.length} 个书签`);
      await this.updateBadge();
      
      // 显示通知
      this.safeNotification({
        type: 'basic',
        title: '书签同步完成',
        message: `导入 ${newBookmarksCount} 个新书签，跳过 ${skippedCount} 个重复书签`
      });
      
    } catch (error) {
      console.error('❌ 同步浏览器书签失败:', error);
      console.error('❌ 错误详情:', error.stack);
      this.safeNotification({
        type: 'basic',
        title: '书签同步失败',
        message: `错误: ${error.message}`
      });
    }
  }
  
  extractBookmarksFromTree(bookmarkTree, parentFolderName = '') {
    const bookmarks = [];
    console.log('🔍 开始解析书签树...');
    
    function traverse(nodes, folderName = '', depth = 0) {
      if (!nodes || !Array.isArray(nodes)) {
        console.log('⚠️ 无效的节点数组:', nodes);
        return;
      }
      
      const indent = '  '.repeat(depth);
      console.log(`${indent}📁 处理 ${nodes.length} 个节点 (文件夹: ${folderName})`);
      
      nodes.forEach((node, index) => {
        console.log(`${indent}📄 节点 ${index + 1}/${nodes.length}:`, {
          id: node.id,
          title: node.title,
          url: node.url,
          hasChildren: !!node.children,
          childrenCount: node.children ? node.children.length : 0,
          folderName: folderName,
          dateAdded: node.dateAdded
        });
        
        if (node.url) {
          // 这是一个书签
          const bookmark = {
            title: node.title,
            url: node.url,
            dateAdded: node.dateAdded ? new Date(node.dateAdded).toISOString() : new Date().toISOString(),
            folderName: folderName
          };
          bookmarks.push(bookmark);
          console.log(`${indent}✅ 添加书签:`, bookmark.title);
        } else if (node.children && node.children.length > 0) {
          // 这是一个文件夹，递归处理
          const currentFolderName = node.title || folderName;
          console.log(`${indent}📁 进入文件夹: "${currentFolderName}" (${node.children.length} 个子项)`);
          traverse(node.children, currentFolderName, depth + 1);
        } else {
          console.log(`${indent}📭 空文件夹或其他类型节点:`, node.title);
        }
      });
    }
    
    traverse(bookmarkTree);
    console.log(`🎯 总共提取了 ${bookmarks.length} 个书签`);
    
    if (bookmarks.length > 0) {
      console.log('📋 书签详情预览:');
      bookmarks.slice(0, 3).forEach((bookmark, index) => {
        console.log(`  ${index + 1}. ${bookmark.title} - ${bookmark.url} (文件夹: ${bookmark.folderName})`);
      });
    }
    
    return bookmarks;
  }

  getFaviconUrl(url) {
    try {
      const urlObj = new URL(url);
      return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`;
    } catch (error) {
      console.log('⚠️ 获取favicon失败，使用默认图标:', error);
      return 'icons/icon16.png';
    }
  }

  safeNotification(options) {
    // 临时禁用通知功能以避免API问题
    console.log('📢 [通知]', options.title + ':', options.message);
    
    // 如果需要重新启用通知，请取消注释以下代码:
    /*
    try {
      if (chrome.notifications && chrome.notifications.create) {
        const safeOptions = {
          type: 'basic',
          title: options.title || 'Chrome扩展通知',
          message: options.message || ''
        };
        
        chrome.notifications.create('', safeOptions, function(notificationId) {
          if (chrome.runtime.lastError) {
            console.log('⚠️ 通知创建失败:', chrome.runtime.lastError);
          } else {
            console.log('📢 通知已发送:', safeOptions.title);
          }
        });
      }
    } catch (error) {
      console.log('⚠️ 显示通知失败:', error);
    }
    */
  }

  async checkPermissions() {
    try {
      const manifest = chrome.runtime.getManifest();
      const permissions = manifest.permissions || [];
      
      let hasBookmarks = false;
      let hasStorage = false;
      
      try {
        hasBookmarks = await chrome.permissions.contains({
          permissions: ['bookmarks']
        });
      } catch (error) {
        console.error('检查书签权限失败:', error);
      }
      
      try {
        hasStorage = await chrome.permissions.contains({
          permissions: ['storage']
        });
      } catch (error) {
        console.error('检查存储权限失败:', error);
      }
      
      console.log('🔐 权限检查:', {
        manifestPermissions: permissions,
        hasBookmarks,
        hasStorage,
        bookmarksAPIAvailable: !!chrome.bookmarks,
        storageAPIAvailable: !!chrome.storage
      });
      
      return {
        manifestPermissions: permissions,
        hasBookmarks,
        hasStorage,
        bookmarksAPIAvailable: !!chrome.bookmarks,
        storageAPIAvailable: !!chrome.storage
      };
    } catch (error) {
      console.error('权限检查失败:', error);
      return { error: error.message };
    }
  }

  async initializeBadge() {
    await this.updateBadge();
  }

  async updateBadge() {
    const result = await chrome.storage.local.get(['bookmarks']);
    const bookmarks = result.bookmarks || [];
    const count = bookmarks.length;

    if (count > 0) {
      chrome.action.setBadgeText({
        text: count > 999 ? '999+' : count.toString()
      });
      chrome.action.setBadgeBackgroundColor({ color: '#1a73e8' });
    } else {
      chrome.action.setBadgeText({ text: '' });
    }
  }
}

// 安全初始化背景管理器
try {
  console.log('🔧 开始创建 BackgroundManager 实例...');
  new BackgroundManager();
} catch (error) {
  console.error('❌ 创建 BackgroundManager 失败:', error);
  
  // 尝试基本的错误恢复
  setTimeout(() => {
    try {
      console.log('🔄 尝试重新初始化...');
      new BackgroundManager();
    } catch (retryError) {
      console.error('❌ 重试初始化也失败:', retryError);
    }
  }, 1000);
}

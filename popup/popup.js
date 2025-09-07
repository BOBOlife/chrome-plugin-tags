// popup.js - 弹窗页面逻辑
class PopupManager {
  constructor() {
    this.currentTab = null;
    this.tags = [];
    this.folders = [];
    this.init();
  }

  async init() {
    await this.getCurrentTab();
    await this.loadFolders();
    this.setupEventListeners();
    this.populateForm();
  }

  async getCurrentTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    this.currentTab = tab;
  }

  async loadFolders() {
    try {
      const result = await chrome.storage.local.get(['folders']);
      this.folders = result.folders || [
        { id: 'default', name: '默认', count: 0 }
      ];
      this.populateFolderSelect();
    } catch (error) {
      console.error('加载文件夹失败:', error);
    }
  }

  populateFolderSelect() {
    const folderSelect = document.getElementById('folder');
    folderSelect.innerHTML = '<option value="">选择文件夹</option>';
    
    this.folders.forEach(folder => {
      const option = document.createElement('option');
      option.value = folder.id;
      option.textContent = `${folder.name} (${folder.count})`;
      folderSelect.appendChild(option);
    });
  }

  populateForm() {
    if (this.currentTab) {
      document.getElementById('title').value = this.currentTab.title || '';
      document.getElementById('url').value = this.currentTab.url || '';
      
      // 自动提取页面描述
      this.extractPageDescription();
    }
  }

  async extractPageDescription() {
    try {
      // 向content script发送消息获取页面描述
      const response = await chrome.tabs.sendMessage(this.currentTab.id, {
        action: 'getPageDescription'
      });
      
      if (response && response.description) {
        document.getElementById('description').value = response.description;
      }
    } catch (error) {
      console.log('无法获取页面描述:', error);
    }
  }

  setupEventListeners() {
    // 表单提交
    document.getElementById('addBookmarkForm').addEventListener('submit', (e) => {
      this.handleFormSubmit(e);
    });

    // 取消按钮
    document.getElementById('cancel').addEventListener('click', () => {
      window.close();
    });

    // 新建文件夹
    document.getElementById('newFolder').addEventListener('click', () => {
      this.showNewFolderModal();
    });

    // 打开管理器
    document.getElementById('openManager').addEventListener('click', () => {
      this.openManager();
    });

    // 标签输入
    document.getElementById('tags').addEventListener('keydown', (e) => {
      this.handleTagInput(e);
    });

    // 新建文件夹模态框
    document.getElementById('cancelNewFolder').addEventListener('click', () => {
      this.hideNewFolderModal();
    });

    document.getElementById('confirmNewFolder').addEventListener('click', () => {
      this.createNewFolder();
    });

    // 模态框背景点击关闭
    document.getElementById('newFolderModal').addEventListener('click', (e) => {
      if (e.target.id === 'newFolderModal') {
        this.hideNewFolderModal();
      }
    });
  }

  async handleFormSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const bookmark = {
      id: Date.now().toString(),
      title: formData.get('title'),
      url: formData.get('url'),
      description: formData.get('description'),
      folder: formData.get('folder') || 'default',
      tags: this.tags,
      dateAdded: new Date().toISOString(),
      favicon: this.currentTab.favIconUrl || ''
    };

    try {
      // 显示加载状态
      this.setLoading(true);
      
      // 保存书签
      await this.saveBookmark(bookmark);
      
      // 显示成功提示
      this.showToast('收藏已保存', 'success');
      
      // 延迟关闭窗口
      setTimeout(() => {
        window.close();
      }, 1000);
      
    } catch (error) {
      console.error('保存失败:', error);
      this.showToast('保存失败，请重试', 'error');
    } finally {
      this.setLoading(false);
    }
  }

  async saveBookmark(bookmark) {
    // 获取现有书签
    const result = await chrome.storage.local.get(['bookmarks', 'folders']);
    const bookmarks = result.bookmarks || [];
    const folders = result.folders || [];
    
    // 添加新书签
    bookmarks.push(bookmark);
    
    // 更新文件夹计数
    const folderIndex = folders.findIndex(f => f.id === bookmark.folder);
    if (folderIndex !== -1) {
      folders[folderIndex].count++;
    }
    
    // 保存到存储
    await chrome.storage.local.set({
      bookmarks: bookmarks,
      folders: folders
    });
    
    // 更新badge
    chrome.action.setBadgeText({
      text: bookmarks.length.toString()
    });
  }

  handleTagInput(e) {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      const input = e.target;
      const value = input.value.trim();
      
      if (value && !this.tags.includes(value)) {
        // 确保标签以#开头
        const tag = value.startsWith('#') ? value : `#${value}`;
        this.tags.push(tag);
        this.renderTags();
        input.value = '';
      }
    } else if (e.key === 'Backspace' && e.target.value === '' && this.tags.length > 0) {
      // 如果输入框为空且按下退格键，删除最后一个标签
      this.tags.pop();
      this.renderTags();
    }
  }

  renderTags() {
    const tagsList = document.getElementById('tagsList');
    tagsList.innerHTML = '';
    
    this.tags.forEach((tag, index) => {
      const tagElement = document.createElement('span');
      tagElement.className = 'tag-item';
      tagElement.innerHTML = `
        ${tag}
        <button type="button" class="tag-remove" data-index="${index}">×</button>
      `;
      tagsList.appendChild(tagElement);
    });

    // 添加删除标签事件
    tagsList.addEventListener('click', (e) => {
      if (e.target.classList.contains('tag-remove')) {
        const index = parseInt(e.target.dataset.index);
        this.tags.splice(index, 1);
        this.renderTags();
      }
    });
  }

  showNewFolderModal() {
    document.getElementById('newFolderModal').classList.remove('hidden');
    document.getElementById('newFolderName').focus();
  }

  hideNewFolderModal() {
    document.getElementById('newFolderModal').classList.add('hidden');
    document.getElementById('newFolderName').value = '';
  }

  async createNewFolder() {
    const name = document.getElementById('newFolderName').value.trim();
    if (!name) return;

    const folder = {
      id: Date.now().toString(),
      name: name,
      count: 0
    };

    try {
      // 保存新文件夹
      const result = await chrome.storage.local.get(['folders']);
      const folders = result.folders || [];
      folders.push(folder);
      
      await chrome.storage.local.set({ folders: folders });
      
      // 更新本地数据和UI
      this.folders = folders;
      this.populateFolderSelect();
      
      // 选中新建的文件夹
      document.getElementById('folder').value = folder.id;
      
      this.hideNewFolderModal();
      this.showToast('文件夹创建成功', 'success');
      
    } catch (error) {
      console.error('创建文件夹失败:', error);
      this.showToast('创建失败，请重试', 'error');
    }
  }

  openManager() {
    chrome.tabs.create({
      url: chrome.runtime.getURL('options/options.html')
    });
  }

  setLoading(loading) {
    const form = document.getElementById('addBookmarkForm');
    if (loading) {
      form.classList.add('loading');
    } else {
      form.classList.remove('loading');
    }
  }

  showToast(message, type = 'success') {
    // 移除现有toast
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
      existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    // 显示toast
    setTimeout(() => {
      toast.classList.add('show');
    }, 100);

    // 3秒后隐藏
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        toast.remove();
      }, 300);
    }, 3000);
  }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  new PopupManager();
});

// 键盘快捷键
document.addEventListener('keydown', (e) => {
  // Ctrl/Cmd + Enter 快速保存
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    document.getElementById('addBookmarkForm').dispatchEvent(new Event('submit'));
  }
  
  // Esc 关闭窗口
  if (e.key === 'Escape') {
    window.close();
  }
});

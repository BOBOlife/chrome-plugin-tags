// options.js - 主界面逻辑
class BookmarkManager {
  constructor() {
    this.bookmarks = [];
    this.folders = [];
    this.filteredBookmarks = [];
    this.currentView = 'all';
    this.currentFolder = null;
    this.searchQuery = '';
    this.sortBy = 'date';
    this.viewMode = 'card';
    this.currentPage = 1;
    this.itemsPerPage = 20;
    this.selectedBookmarks = new Set();
    this.settings = {};
    
    this.init();
  }

  async init() {
    await this.loadData();
    await this.loadSettings();
    this.setupEventListeners();
    this.renderSidebar();
    this.renderBookmarksAsync();
    this.checkWelcomeMode();
  }

  async loadData() {
    try {
      const result = await chrome.storage.local.get(['bookmarks', 'folders']);
      this.bookmarks = result.bookmarks || [];
      this.folders = result.folders || [];
      this.filteredBookmarks = [...this.bookmarks];
    } catch (error) {
      console.error('加载数据失败:', error);
      this.showToast('加载数据失败', 'error');
    }
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.local.get(['settings']);
      this.settings = result.settings || {
        theme: 'light',
        viewMode: 'card',
        itemsPerPage: 20,
        showDescriptions: true,
        autoBackup: true,
        syncEnabled: false
      };
      
      this.applySettings();
    } catch (error) {
      console.error('加载设置失败:', error);
    }
  }

  applySettings() {
    // 应用主题
    document.documentElement.setAttribute('data-theme', this.settings.theme);
    
    // 应用视图模式
    this.viewMode = this.settings.viewMode;
    document.getElementById('viewMode').value = this.viewMode;
    
    // 应用每页显示数量
    this.itemsPerPage = this.settings.itemsPerPage;
  }

  setupEventListeners() {
    // 搜索功能
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', this.debounce((e) => {
      this.searchQuery = e.target.value;
      this.filterBookmarksAsync();
    }, 300));

    // 清除搜索
    document.getElementById('clearSearch').addEventListener('click', () => {
      searchInput.value = '';
      this.searchQuery = '';
      this.filterBookmarksAsync();
    });

    // 排序和视图模式
    document.getElementById('sortBy').addEventListener('change', (e) => {
      this.sortBy = e.target.value;
      this.filterBookmarksAsync();
    });

    document.getElementById('viewMode').addEventListener('change', (e) => {
      this.viewMode = e.target.value;
      this.renderBookmarksAsync();
    });

    // 导航链接
    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const view = e.currentTarget.dataset.view;
        this.setCurrentView(view);
      });
    });

    // 工具栏按钮
    document.getElementById('selectAll').addEventListener('click', () => {
      this.toggleSelectAll();
    });

    document.getElementById('deleteSelected').addEventListener('click', () => {
      this.deleteSelectedBookmarksLater();
    });

    document.getElementById('exportSelected').addEventListener('click', () => {
      this.exportSelectedBookmarksLater();
    });

    // 侧边栏按钮
    document.getElementById('addFolder').addEventListener('click', () => {
      this.showNewFolderModal();
    });

    document.getElementById('syncBookmarks').addEventListener('click', () => {
      this.syncBrowserBookmarks();
    });

    document.getElementById('debugPermissions').addEventListener('click', () => {
      this.debugPermissions();
    });

    document.getElementById('importExport').addEventListener('click', () => {
      this.showImportExportModal();
    });

    document.getElementById('settings').addEventListener('click', () => {
      this.showSettingsModal();
    });

    // 分页
    document.getElementById('prevPage').addEventListener('click', () => {
      if (this.currentPage > 1) {
        this.currentPage--;
        this.renderBookmarksAsync();
      }
    });

    document.getElementById('nextPage').addEventListener('click', () => {
      const totalPages = Math.ceil(this.filteredBookmarks.length / this.itemsPerPage);
      if (this.currentPage < totalPages) {
        this.currentPage++;
        this.renderBookmarksAsync();
      }
    });

    // 模态框事件
    this.setupModalEvents();

    // 键盘快捷键
    document.addEventListener('keydown', (e) => {
      this.handleKeyboardShortcuts(e);
    });

    // 主题切换
    this.setupThemeToggle();
  }

  setupModalEvents() {
    // 关闭模态框
    document.querySelectorAll('.modal-close, .modal-cancel').forEach(btn => {
      btn.addEventListener('click', () => {
        this.hideAllModals();
      });
    });

    // 点击背景关闭模态框
    document.querySelectorAll('.modal').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          this.hideAllModals();
        }
      });
    });

    // 新建文件夹表单
    document.getElementById('newFolderForm').addEventListener('submit', (e) => {
      this.handleNewFolderSubmit(e);
    });

    // 编辑书签表单
    document.getElementById('editBookmarkForm').addEventListener('submit', (e) => {
      this.handleEditBookmarkSubmit(e);
    });

    // 导入导出
    this.setupImportExportEvents();

    // 设置
    this.setupSettingsEvents();
  }

  setupImportExportEvents() {
    // 标签页切换
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tabName = e.target.dataset.tab;
        this.switchTab(tabName);
      });
    });

    // 文件选择
    document.getElementById('selectFile').addEventListener('click', () => {
      document.getElementById('fileInput').click();
    });

    document.getElementById('fileInput').addEventListener('change', (e) => {
      this.handleFileSelect(e);
    });

    // 拖拽上传
    const dropZone = document.getElementById('fileDropZone');
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      this.handleFileDrop(e);
    });

    // 导出导入按钮
    document.getElementById('exportData').addEventListener('click', () => {
      this.exportDataLater();
    });

    document.getElementById('importData').addEventListener('click', () => {
      this.importDataLater();
    });
  }

  setupSettingsEvents() {
    // 设置保存
    document.getElementById('saveSettings').addEventListener('click', () => {
      this.saveSettingsLater();
    });

    // 清除所有数据
    document.getElementById('clearAllData').addEventListener('click', () => {
      this.clearAllDataLater();
    });
  }

  setupThemeToggle() {
    // 自动主题检测
    if (this.settings.theme === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
      this.updateTheme(prefersDark.matches ? 'dark' : 'light');
      
      prefersDark.addEventListener('change', (e) => {
        if (this.settings.theme === 'auto') {
          this.updateTheme(e.matches ? 'dark' : 'light');
        }
      });
    }
  }

  updateTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
  }

  checkWelcomeMode() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('welcome') === 'true') {
      this.showWelcomeMessage();
    }
  }

  showWelcomeMessage() {
    this.showToast('欢迎使用网页收藏夹升级版！', 'success');
  }

  setCurrentView(view) {
    this.currentView = view;
    this.currentFolder = null;
    this.currentPage = 1;
    
    // 更新导航状态
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.remove('active');
    });
    document.querySelector(`[data-view="${view}"]`).classList.add('active');
    
    // 清除文件夹选择
    document.querySelectorAll('.folder-item').forEach(item => {
      item.classList.remove('active');
    });
    
    this.filterBookmarksAsync();
  }

  setCurrentFolder(folderId) {
    this.currentFolder = folderId;
    this.currentView = 'folder';
    this.currentPage = 1;
    
    // 更新UI状态
    document.querySelectorAll('.nav-link, .folder-item').forEach(item => {
      item.classList.remove('active');
    });
    document.querySelector(`[data-folder="${folderId}"]`)?.classList.add('active');
    
    this.filterBookmarksAsync();
  }

  renderActiveFilters() {
    const container = document.getElementById('activeFilters');
    container.innerHTML = '';
    
    // 添加文件夹过滤器
    if (this.currentFolder) {
      const folder = this.folders.find(f => f.id === this.currentFolder);
      if (folder) {
        this.createFilterTag(container, `文件夹: ${folder.name}`, () => {
          this.currentFolder = null;
          this.filterBookmarksAsync();
        });
      }
    }
  }

  createFilterTag(container, text, onRemove) {
    const filterTag = document.createElement('span');
    filterTag.className = 'filter-tag';
    filterTag.innerHTML = `
      ${text}
      <button class="filter-remove">×</button>
    `;
    
    filterTag.querySelector('.filter-remove').addEventListener('click', onRemove);
    container.appendChild(filterTag);
  }

  async filterBookmarks() {
    let filtered = [...this.bookmarks];
    
    // 按视图过滤
    switch (this.currentView) {
      case 'recent':
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        filtered = filtered.filter(b => new Date(b.dateAdded) > weekAgo);
        break;
    }
    
    // 按文件夹过滤
    if (this.currentFolder) {
      filtered = filtered.filter(b => b.folder === this.currentFolder);
    }
    
    // 按标签过滤
    // 按搜索查询过滤
    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(b => 
        b.title.toLowerCase().includes(query) ||
        b.description.toLowerCase().includes(query) ||
        b.url.toLowerCase().includes(query)
      );
    }
    
    // 排序
    this.sortBookmarks(filtered);
    
    this.filteredBookmarks = filtered;
    this.renderBookmarksAsync();
    this.updateResultsCount();
    this.renderActiveFilters();
  }

  sortBookmarks(bookmarks) {
    switch (this.sortBy) {
      case 'title':
        bookmarks.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'url':
        bookmarks.sort((a, b) => a.url.localeCompare(b.url));
        break;
      case 'date':
      default:
        bookmarks.sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));
        break;
    }
  }

  updateResultsCount() {
    const count = this.filteredBookmarks.length;
    document.getElementById('resultsCount').textContent = `${count} 个结果`;
  }

  renderSidebar() {
    this.renderFoldersList();
  }

  renderFoldersList() {
    const container = document.getElementById('foldersList');
    container.innerHTML = '';
    
    this.folders.forEach(folder => {
      const folderItem = document.createElement('li');
      folderItem.className = 'folder-item';
      folderItem.setAttribute('data-folder', folder.id);
      folderItem.innerHTML = `
        <span class="folder-name">${folder.name}</span>
        <span class="folder-count">${folder.count}</span>
      `;
      
      folderItem.addEventListener('click', () => {
        this.setCurrentFolder(folder.id);
      });
      
      container.appendChild(folderItem);
    });
  }

  async renderBookmarksAsync() {
    // 显示加载状态
    this.showLoading();
    
    // 使用 setTimeout 来让UI有机会更新
    setTimeout(() => {
      this.renderBookmarks();
    }, 50);
  }

  renderBookmarks() {
    const container = document.getElementById('bookmarksList');
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    const pageBookmarks = this.filteredBookmarks.slice(startIndex, endIndex);
    
    if (pageBookmarks.length === 0 && this.filteredBookmarks.length === 0) {
      this.showEmptyState();
      return;
    }
    
    // 设置容器类名
    container.className = `bookmarks-container ${this.getViewModeClass()}`;
    container.innerHTML = '';
    
    pageBookmarks.forEach(bookmark => {
      const bookmarkElement = this.createBookmarkElement(bookmark);
      container.appendChild(bookmarkElement);
    });
    
    this.renderPagination();
    this.hideLoading();
    this.hideEmptyState();
  }

  getViewModeClass() {
    switch (this.viewMode) {
      case 'list': return 'bookmarks-list';
      case 'grid': return 'bookmarks-grid-view';
      case 'card':
      default: return 'bookmarks-grid';
    }
  }

  createBookmarkElement(bookmark) {
    const element = document.createElement('div');
    
    switch (this.viewMode) {
      case 'list':
        element.className = 'bookmark-list-item';
        element.innerHTML = this.getListItemHTML(bookmark);
        break;
      case 'grid':
        element.className = 'bookmark-grid-item';
        element.innerHTML = this.getGridItemHTML(bookmark);
        break;
      case 'card':
      default:
        element.className = 'bookmark-card';
        element.innerHTML = this.getCardHTML(bookmark);
        break;
    }
    
    this.setupBookmarkElementEvents(element, bookmark);
    return element;
  }

  getCardHTML(bookmark) {
    const description = this.settings.showDescriptions && bookmark.description 
      ? `<div class="bookmark-description">${bookmark.description}</div>` 
      : '';
    
    return `
      <div class="bookmark-header">
        <img src="${bookmark.favicon || '/icons/icon16.png'}" 
             alt="" class="bookmark-favicon" 
             onerror="this.src='/icons/icon16.png'">
        <div class="bookmark-info">
          <div class="bookmark-title">${bookmark.title}</div>
          <div class="bookmark-url">${bookmark.url}</div>
        </div>
        <div class="bookmark-actions">
          <button class="action-btn edit-btn" title="编辑" data-id="${bookmark.id}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button class="action-btn delete-btn danger" title="删除" data-id="${bookmark.id}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <polyline points="3,6 5,6 21,6"/>
              <path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2V6"/>
            </svg>
          </button>
        </div>
      </div>
      ${description}
      <div class="bookmark-meta">
        <span class="bookmark-date">${this.formatDate(bookmark.dateAdded)}</span>
      </div>
      <input type="checkbox" class="bookmark-checkbox" data-id="${bookmark.id}">
    `;
  }

  getListItemHTML(bookmark) {
    return `
      <input type="checkbox" class="bookmark-checkbox" data-id="${bookmark.id}">
      <img src="${bookmark.favicon || '/icons/icon16.png'}" 
           alt="" class="bookmark-favicon" 
           onerror="this.src='/icons/icon16.png'">
      <div class="bookmark-list-content">
        <div class="bookmark-list-title">${bookmark.title}</div>
        <div class="bookmark-list-meta">
          <span>${bookmark.url}</span>
          <span>${this.formatDate(bookmark.dateAdded)}</span>
        </div>
      </div>
      <div class="bookmark-actions">
        <button class="action-btn edit-btn" title="编辑" data-id="${bookmark.id}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button class="action-btn delete-btn danger" title="删除" data-id="${bookmark.id}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <polyline points="3,6 5,6 21,6"/>
            <path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2V6"/>
          </svg>
        </button>
      </div>
    `;
  }

  getGridItemHTML(bookmark) {
    return `
      <img src="${bookmark.favicon || '/icons/icon16.png'}" 
           alt="" class="bookmark-grid-favicon" 
           onerror="this.src='/icons/icon16.png'">
      <div class="bookmark-grid-title">${bookmark.title}</div>
      <input type="checkbox" class="bookmark-checkbox" data-id="${bookmark.id}">
    `;
  }

  setupBookmarkElementEvents(element, bookmark) {
    // 点击打开链接
    element.addEventListener('click', (e) => {
      if (e.target.type !== 'checkbox' && !e.target.closest('.bookmark-actions')) {
        chrome.tabs.create({ url: bookmark.url });
      }
    });
    
    // 复选框选择
    const checkbox = element.querySelector('.bookmark-checkbox');
    checkbox.addEventListener('change', (e) => {
      if (e.target.checked) {
        this.selectedBookmarks.add(bookmark.id);
        element.classList.add('selected');
      } else {
        this.selectedBookmarks.delete(bookmark.id);
        element.classList.remove('selected');
      }
      this.updateSelectionUI();
    });
    
    // 编辑按钮
    const editBtn = element.querySelector('.edit-btn');
    if (editBtn) {
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.showEditBookmarkModal(bookmark);
      });
    }
    
    // 删除按钮
    const deleteBtn = element.querySelector('.delete-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteBookmarkLater(bookmark.id);
      });
    }
    
    // 标签点击
    element.querySelectorAll('.bookmark-tag').forEach(tagEl => {
      tagEl.addEventListener('click', (e) => {
        e.stopPropagation();
        const tag = e.target.dataset.tag;
        this.toggleTag(tag);
      });
    });
  }

  renderPagination() {
    const totalPages = Math.ceil(this.filteredBookmarks.length / this.itemsPerPage);
    const pagination = document.getElementById('pagination');
    
    if (totalPages <= 1) {
      pagination.classList.add('hidden');
      return;
    }
    
    pagination.classList.remove('hidden');
    
    // 更新按钮状态
    document.getElementById('prevPage').disabled = this.currentPage === 1;
    document.getElementById('nextPage').disabled = this.currentPage === totalPages;
    
    // 渲染页码
    const pageNumbers = document.getElementById('pageNumbers');
    pageNumbers.innerHTML = '';
    
    const startPage = Math.max(1, this.currentPage - 2);
    const endPage = Math.min(totalPages, this.currentPage + 2);
    
    for (let i = startPage; i <= endPage; i++) {
      const pageBtn = document.createElement('button');
      pageBtn.className = `page-number ${i === this.currentPage ? 'active' : ''}`;
      pageBtn.textContent = i;
      pageBtn.addEventListener('click', () => {
        this.currentPage = i;
        this.renderBookmarksAsync();
      });
      pageNumbers.appendChild(pageBtn);
    }
  }

  updateSelectionUI() {
    const selectedCount = this.selectedBookmarks.size;
    const deleteBtn = document.getElementById('deleteSelected');
    const exportBtn = document.getElementById('exportSelected');
    
    deleteBtn.disabled = selectedCount === 0;
    exportBtn.disabled = selectedCount === 0;
    deleteBtn.textContent = selectedCount > 0 ? `删除选中 (${selectedCount})` : '删除选中';
    exportBtn.textContent = selectedCount > 0 ? `导出选中 (${selectedCount})` : '导出选中';
  }

  toggleSelectAll() {
    const pageBookmarks = this.getCurrentPageBookmarks();
    const allSelected = pageBookmarks.every(b => this.selectedBookmarks.has(b.id));
    
    if (allSelected) {
      // 取消全选
      pageBookmarks.forEach(b => this.selectedBookmarks.delete(b.id));
    } else {
      // 全选
      pageBookmarks.forEach(b => this.selectedBookmarks.add(b.id));
    }
    
    // 更新UI
    document.querySelectorAll('.bookmark-checkbox').forEach(checkbox => {
      const id = checkbox.dataset.id;
      checkbox.checked = this.selectedBookmarks.has(id);
      checkbox.closest('.bookmark-card, .bookmark-list-item, .bookmark-grid-item')
        .classList.toggle('selected', this.selectedBookmarks.has(id));
    });
    
    this.updateSelectionUI();
  }

  getCurrentPageBookmarks() {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    return this.filteredBookmarks.slice(startIndex, endIndex);
  }

  // 模态框相关方法
  showEditBookmarkModal(bookmark) {
    const modal = document.getElementById('editBookmarkModal');
    const form = document.getElementById('editBookmarkForm');
    
    // 填充表单数据
    document.getElementById('editTitle').value = bookmark.title;
    document.getElementById('editUrl').value = bookmark.url;
    document.getElementById('editDescription').value = bookmark.description || '';
    
    // 填充文件夹选项
    const folderSelect = document.getElementById('editFolder');
    folderSelect.innerHTML = '';
    this.folders.forEach(folder => {
      const option = document.createElement('option');
      option.value = folder.id;
      option.textContent = folder.name;
      option.selected = folder.id === bookmark.folder;
      folderSelect.appendChild(option);
    });
    
    // 存储当前编辑的书签ID
    form.dataset.bookmarkId = bookmark.id;
    
    this.showModal(modal);
  }

  async handleEditBookmarkSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const bookmarkId = form.dataset.bookmarkId;
    
    const updatedBookmark = {
      id: bookmarkId,
      title: document.getElementById('editTitle').value,
      url: document.getElementById('editUrl').value,
      description: document.getElementById('editDescription').value,
      folder: document.getElementById('editFolder').value,
      dateModified: new Date().toISOString()
    };
    
    try {
      await this.updateBookmarkLater(updatedBookmark);
      this.hideAllModals();
      this.showToast('收藏已更新', 'success');
    } catch (error) {
      console.error('更新收藏失败:', error);
      this.showToast('更新失败', 'error');
    }
  }

  showNewFolderModal() {
    const modal = document.getElementById('newFolderModal');
    document.getElementById('folderName').value = '';
    document.getElementById('folderDescription').value = '';
    this.showModal(modal);
  }

  async handleNewFolderSubmit(e) {
    e.preventDefault();
    
    const name = document.getElementById('folderName').value.trim();
    const description = document.getElementById('folderDescription').value.trim();
    
    if (!name) return;
    
    const folder = {
      id: Date.now().toString(),
      name: name,
      description: description,
      count: 0
    };
    
    try {
      await this.saveFolderLater(folder);
      this.hideAllModals();
      this.showToast('文件夹创建成功', 'success');
      this.renderSidebar();
    } catch (error) {
      console.error('创建文件夹失败:', error);
      this.showToast('创建失败', 'error');
    }
  }

  showImportExportModal() {
    const modal = document.getElementById('importExportModal');
    this.showModal(modal);
  }

  showSettingsModal() {
    const modal = document.getElementById('settingsModal');
    
    // 填充当前设置
    document.getElementById('themeSetting').value = this.settings.theme;
    document.getElementById('defaultViewMode').value = this.settings.viewMode;
    document.getElementById('itemsPerPage').value = this.settings.itemsPerPage;
    document.getElementById('showDescriptions').checked = this.settings.showDescriptions;
    document.getElementById('autoBackup').checked = this.settings.autoBackup;
    document.getElementById('syncEnabled').checked = this.settings.syncEnabled;
    
    this.showModal(modal);
  }

  switchTab(tabName) {
    // 更新标签按钮状态
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    
    // 更新标签内容
    document.querySelectorAll('.tab-pane').forEach(pane => {
      pane.classList.toggle('active', pane.id === `${tabName}Tab`);
    });
  }

  handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
      this.processImportFile(file);
    }
  }

  handleFileDrop(e) {
    const file = e.dataTransfer.files[0];
    if (file) {
      this.processImportFile(file);
    }
  }

  processImportFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        document.getElementById('importOptions').classList.remove('hidden');
        document.getElementById('importData').disabled = false;
        document.getElementById('importData').dataset.importData = JSON.stringify(data);
      } catch (error) {
        this.showToast('文件格式不正确', 'error');
      }
    };
    reader.readAsText(file);
  }

  // 数据操作方法
  async updateBookmarkLater(bookmark) {
    const index = this.bookmarks.findIndex(b => b.id === bookmark.id);
    if (index !== -1) {
      this.bookmarks[index] = { ...this.bookmarks[index], ...bookmark };
      await chrome.storage.local.set({ bookmarks: this.bookmarks });
      await this.loadData();
      this.filterBookmarksAsync();
    }
  }

  async deleteBookmarkLater(id) {
    if (!confirm('确定要删除这个收藏吗？')) return;
    
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'deleteBookmark',
        id: id
      });
      
      if (response.success) {
        await this.loadData();
        this.filterBookmarksAsync();
        this.renderSidebar();
        this.showToast('收藏已删除', 'success');
      }
    } catch (error) {
      console.error('删除收藏失败:', error);
      this.showToast('删除失败', 'error');
    }
  }

  async deleteSelectedBookmarksLater() {
    if (this.selectedBookmarks.size === 0) return;
    
    if (!confirm(`确定要删除选中的 ${this.selectedBookmarks.size} 个收藏吗？`)) return;
    
    try {
      for (const id of this.selectedBookmarks) {
        await chrome.runtime.sendMessage({
          action: 'deleteBookmark',
          id: id
        });
      }
      
      this.selectedBookmarks.clear();
      await this.loadData();
      this.filterBookmarksAsync();
      this.renderSidebar();
      this.updateSelectionUI();
      this.showToast('选中的收藏已删除', 'success');
    } catch (error) {
      console.error('批量删除失败:', error);
      this.showToast('删除失败', 'error');
    }
  }

  async saveFolderLater(folder) {
    this.folders.push(folder);
    await chrome.storage.local.set({ folders: this.folders });
  }

  async exportDataLater() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'exportData'
      });
      
      if (response.success) {
        const data = response.data;
        const format = document.querySelector('input[name="exportFormat"]:checked').value;
        
        this.downloadData(data, format);
        this.showToast('数据导出成功', 'success');
      }
    } catch (error) {
      console.error('导出失败:', error);
      this.showToast('导出失败', 'error');
    }
  }

  async exportSelectedBookmarksLater() {
    if (this.selectedBookmarks.size === 0) return;
    
    const selectedData = {
      bookmarks: this.bookmarks.filter(b => this.selectedBookmarks.has(b.id)),
      exportDate: new Date().toISOString(),
      version: chrome.runtime.getManifest().version
    };
    
    this.downloadData(selectedData, 'json');
    this.showToast('选中的收藏已导出', 'success');
  }

  downloadData(data, format) {
    let content, filename, mimeType;
    
    switch (format) {
      case 'json':
        content = JSON.stringify(data, null, 2);
        filename = `bookmarks-${this.formatDate(new Date(), 'YYYY-MM-DD')}.json`;
        mimeType = 'application/json';
        break;
      case 'html':
        content = this.convertToHTML(data);
        filename = `bookmarks-${this.formatDate(new Date(), 'YYYY-MM-DD')}.html`;
        mimeType = 'text/html';
        break;
      case 'csv':
        content = this.convertToCSV(data);
        filename = `bookmarks-${this.formatDate(new Date(), 'YYYY-MM-DD')}.csv`;
        mimeType = 'text/csv';
        break;
    }
    
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  convertToHTML(data) {
    let html = `
<!DOCTYPE html>
<html>
<head>
    <title>收藏夹导出</title>
    <meta charset="utf-8">
</head>
<body>
    <h1>收藏夹</h1>
`;
    
    const folderGroups = {};
    data.bookmarks.forEach(bookmark => {
      const folder = bookmark.folder || 'default';
      if (!folderGroups[folder]) {
        folderGroups[folder] = [];
      }
      folderGroups[folder].push(bookmark);
    });
    
    Object.entries(folderGroups).forEach(([folderId, bookmarks]) => {
      const folder = this.folders.find(f => f.id === folderId) || { name: '默认' };
      html += `<h2>${folder.name}</h2><ul>`;
      bookmarks.forEach(bookmark => {
        html += `<li><a href="${bookmark.url}">${bookmark.title}</a></li>`;
      });
      html += '</ul>';
    });
    
    html += '</body></html>';
    return html;
  }

  convertToCSV(data) {
    const headers = ['标题', '网址', '描述', '文件夹', '添加日期'];
    let csv = headers.join(',') + '\n';
    
    data.bookmarks.forEach(bookmark => {
      const folder = this.folders.find(f => f.id === bookmark.folder)?.name || '默认';
      const row = [
        `"${bookmark.title.replace(/"/g, '""')}"`,
        `"${bookmark.url}"`,
        `"${(bookmark.description || '').replace(/"/g, '""')}"`,
        `"${folder}"`,
        `"${this.formatDate(bookmark.dateAdded)}"`
      ];
      csv += row.join(',') + '\n';
    });
    
    return csv;
  }

  async importDataLater() {
    const importDataString = document.getElementById('importData').dataset.importData;
    if (!importDataString) return;
    
    try {
      const data = JSON.parse(importDataString);
      const mergeData = document.getElementById('mergeData').checked;
      
      const response = await chrome.runtime.sendMessage({
        action: 'importData',
        data: data,
        merge: mergeData
      });
      
      if (response.success) {
        await this.loadData();
        this.filterBookmarksAsync();
        this.renderSidebar();
        this.hideAllModals();
        this.showToast('数据导入成功', 'success');
      }
    } catch (error) {
      console.error('导入失败:', error);
      this.showToast('导入失败', 'error');
    }
  }

  async saveSettingsLater() {
    const newSettings = {
      theme: document.getElementById('themeSetting').value,
      viewMode: document.getElementById('defaultViewMode').value,
      itemsPerPage: parseInt(document.getElementById('itemsPerPage').value),
      showDescriptions: document.getElementById('showDescriptions').checked,
      autoBackup: document.getElementById('autoBackup').checked,
      syncEnabled: document.getElementById('syncEnabled').checked
    };
    
    try {
      await chrome.storage.local.set({ settings: newSettings });
      this.settings = newSettings;
      this.applySettings();
      this.hideAllModals();
      this.showToast('设置已保存', 'success');
    } catch (error) {
      console.error('保存设置失败:', error);
      this.showToast('保存失败', 'error');
    }
  }

  async clearAllDataLater() {
    if (!confirm('确定要清除所有数据吗？此操作无法撤销！')) return;
    
    try {
      await chrome.storage.local.clear();
      this.bookmarks = [];
      this.folders = [];
      this.filteredBookmarks = [];
      this.selectedBookmarks.clear();
      
      this.renderSidebar();
      this.renderBookmarksAsync();
      this.hideAllModals();
      this.showToast('所有数据已清除', 'success');
    } catch (error) {
      console.error('清除数据失败:', error);
      this.showToast('清除失败', 'error');
    }
  }

  // UI 帮助方法
  showModal(modal) {
    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.add('show'), 10);
  }

  hideAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
      modal.classList.remove('show');
      setTimeout(() => modal.classList.add('hidden'), 300);
    });
  }

  showLoading() {
    document.getElementById('loadingSpinner').classList.remove('hidden');
    document.getElementById('bookmarksList').style.opacity = '0.5';
  }

  hideLoading() {
    document.getElementById('loadingSpinner').classList.add('hidden');
    document.getElementById('bookmarksList').style.opacity = '1';
  }

  showEmptyState() {
    document.getElementById('emptyState').classList.remove('hidden');
    document.getElementById('bookmarksList').classList.add('hidden');
    document.getElementById('pagination').classList.add('hidden');
  }

  hideEmptyState() {
    document.getElementById('emptyState').classList.add('hidden');
    document.getElementById('bookmarksList').classList.remove('hidden');
  }

  showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span>${message}</span>
      <button class="toast-close">×</button>
    `;
    
    toast.querySelector('.toast-close').addEventListener('click', () => {
      this.removeToast(toast);
    });
    
    container.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 100);
    setTimeout(() => this.removeToast(toast), 3000);
  }

  removeToast(toast) {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }

  handleKeyboardShortcuts(e) {
    // Ctrl/Cmd + F: 聚焦搜索框
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault();
      document.getElementById('searchInput').focus();
    }
    
    // Ctrl/Cmd + A: 全选
    if ((e.ctrlKey || e.metaKey) && e.key === 'a' && e.target.tagName !== 'INPUT') {
      e.preventDefault();
      this.toggleSelectAll();
    }
    
    // Delete: 删除选中
    if (e.key === 'Delete' && this.selectedBookmarks.size > 0) {
      this.deleteSelectedBookmarksLater();
    }
    
    // Esc: 关闭模态框
    if (e.key === 'Escape') {
      this.hideAllModals();
    }
  }

  formatDate(dateString, format = 'YYYY-MM-DD HH:mm') {
    const date = new Date(dateString);
    
    if (format === 'YYYY-MM-DD') {
      return date.toISOString().split('T')[0];
    }
    
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);
    
    if (diffInHours < 1) {
      return '刚刚';
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)} 小时前`;
    } else if (diffInHours < 24 * 7) {
      return `${Math.floor(diffInHours / 24)} 天前`;
    } else {
      return date.toLocaleDateString('zh-CN');
    }
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

  // 延迟执行方法，避免阻塞UI
  filterBookmarksAsync() {
    setTimeout(() => this.filterBookmarks(), 0);
  }

  renderBookmarksAsync() {
    setTimeout(() => this.renderBookmarks(), 0);
  }

  // 同步浏览器书签
  async syncBrowserBookmarks() {
    try {
      this.showToast('开始同步浏览器书签...', 'warning');
      
      const response = await chrome.runtime.sendMessage({
        action: 'syncBrowserBookmarks'
      });
      
      if (response && response.success) {
        await this.loadData();
        this.filterBookmarksAsync();
        this.renderSidebar();
        this.showToast('浏览器书签同步成功！', 'success');
      } else {
        throw new Error('同步失败');
      }
    } catch (error) {
      console.error('同步浏览器书签失败:', error);
      this.showToast('同步失败，请检查权限设置', 'error');
    }
  }

  // 调试权限
  async debugPermissions() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'debugPermissions'
      });
      
      if (response && response.success) {
        const permInfo = response.data;
        console.log('权限信息:', permInfo);
        
        let message = `
Manifest 权限: ${permInfo.manifestPermissions ? permInfo.manifestPermissions.join(', ') : '无'}
书签权限: ${permInfo.hasBookmarks ? '✅' : '❌'}
存储权限: ${permInfo.hasStorage ? '✅' : '❌'}
        `;
        
        alert('权限检查结果:\n' + message);
        this.showToast('权限检查完成，请查看控制台', 'success');
      }
    } catch (error) {
      console.error('权限检查失败:', error);
      this.showToast('权限检查失败', 'error');
    }
  }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
  new BookmarkManager();
});

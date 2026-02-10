// 状态管理
let folders = [];
let bookmarks = [];
let settings = {};
let editingBookmarkId = null;
const DEBUG_PANEL = true;
function dlog(...args) {
  try {
    if (DEBUG_PANEL) {
      window.api.debugLog({ source: 'bookmark-panel', msg: args.map(String).join(' '), args });
    }
  } catch (e) {}
  try {
    console.log('[bookmark-panel]', ...args);
  } catch (e2) {}
}

// DOM元素
const bookmarkList = document.getElementById('bookmarkList');
const searchInput = document.getElementById('searchInput');
const btnImportBookmarks = document.getElementById('btnImportBookmarks');
const btnExportBookmarks = document.getElementById('btnExportBookmarks');
const btnAddBookmark = document.getElementById('btnAddBookmark');
const btnAddFolder = document.getElementById('btnAddFolder');

// 书签弹窗
const bookmarkModal = document.getElementById('bookmarkModal');
const modalTitle = document.getElementById('modalTitle');
const bookmarkName = document.getElementById('bookmarkName');
const bookmarkUrl = document.getElementById('bookmarkUrl');
const bookmarkFolder = document.getElementById('bookmarkFolder');
const btnCloseModal = document.getElementById('btnCloseModal');
const btnCancelModal = document.getElementById('btnCancelModal');
const btnSaveBookmark = document.getElementById('btnSaveBookmark');

// 文件夹弹窗
const folderModal = document.getElementById('folderModal');
const folderName = document.getElementById('folderName');
const btnCloseFolderModal = document.getElementById('btnCloseFolderModal');
const btnCancelFolderModal = document.getElementById('btnCancelFolderModal');
const btnSaveFolder = document.getElementById('btnSaveFolder');

// 初始化
async function init() {
  dlog('init()');
  await loadData();
  dlog('loaded data', { folders: folders.length, bookmarks: bookmarks.length });
  renderBookmarks();
  dlog('rendered');
  setupEventListeners();
  dlog('listeners ready');
}

// 加载数据
async function loadData() {
  dlog('loadData() call getAllData');
  const data = await window.api.getAllData();
  dlog('getAllData result', { folders: (data.folders||[]).length, bookmarks: (data.bookmarks||[]).length });
  folders = data.folders || [];
  bookmarks = data.bookmarks || [];
  settings = data.settings || {};
}

// 渲染书签列表
function renderBookmarks(filter = '') {
  dlog('renderBookmarks()', filter);
  const filterLower = filter.toLowerCase();
  
  let html = '';
  
  const expanded = Array.isArray(settings.expandedFolders) ? new Set(settings.expandedFolders) : new Set();
  const sortedFolders = folders.slice().sort((a, b) => a.order - b.order);
  sortedFolders.forEach(folder => {
    const folderBookmarks = bookmarks
      .filter(b => b.folderId === folder.id)
      .filter(b => !filter || 
        b.name.toLowerCase().includes(filterLower) || 
        b.url.toLowerCase().includes(filterLower))
      .sort((a, b) => a.order - b.order);
    
    // 如果有过滤条件且没有匹配的书签，跳过此文件夹
    if (filter && folderBookmarks.length === 0) return;
    const isExpanded = expanded.has(folder.id);
    html += `
      <div class="folder-item ${isExpanded ? '' : 'collapsed'}" data-folder-id="${folder.id}">
        <div class="folder-header">
          <svg class="folder-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
          </svg>
          <span class="folder-name">${escapeHtml(folder.name)}</span>
          <span class="folder-count">${folderBookmarks.length}</span>
          ${folder.id !== 'default' ? `
            <div class="folder-actions" onclick="event.stopPropagation()">
              <button onclick="deleteFolder('${folder.id}')" title="删除文件夹">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </div>
          ` : ''}
        </div>
        <div class="folder-content" id="folder-${folder.id}">
          ${folderBookmarks.map(bookmark => renderBookmarkItem(bookmark)).join('')}
        </div>
      </div>
    `;
  });
  
  if (!html) {
    html = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
        </svg>
        <p>${filter ? '没有找到匹配的收藏' : '还没有收藏，点击右上角添加'}</p>
      </div>
    `;
  }
  
  bookmarkList.innerHTML = html;
  dlog('bookmarkList.innerHTML set, length', html.length);
  
  // 初始化拖拽排序
  initSortable();
  dlog('initSortable done');
}

// 设置默认主页
async function setDefaultUrl(url) {
  // 如果点击的是当前默认主页，则取消默认
  const newUrl = settings.defaultUrl === url ? '' : url;
  await window.api.updateSettings({ defaultUrl: newUrl });
  settings.defaultUrl = newUrl;
  renderBookmarks(searchInput.value);
}

// 渲染单个书签项
function renderBookmarkItem(bookmark) {
  const faviconUrl = bookmark.icon || `https://www.google.com/s2/favicons?domain=${encodeURIComponent(bookmark.url)}&sz=32`;
  const isDefault = settings.defaultUrl === bookmark.url;
  
  return `
    <div class="bookmark-item" data-id="${bookmark.id}" data-url="${encodeURIComponent(bookmark.url)}">
      <div class="bookmark-icon">
        <img src="${faviconUrl}" onerror="this.style.display='none';this.nextElementSibling.style.display='block';">
        <svg style="display:none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="2" y1="12" x2="22" y2="12"></line>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1 4-10z"></path>
        </svg>
      </div>
      <div class="bookmark-info">
        <div class="bookmark-name">${escapeHtml(bookmark.name)}</div>
        <div class="bookmark-url">${escapeHtml(bookmark.url)}</div>
      </div>
      <div class="bookmark-actions">
        <button class="btn-default ${isDefault ? 'active' : ''}" data-url="${encodeURIComponent(bookmark.url)}" title="${isDefault ? '当前默认主页' : '设为默认主页'}">
          <svg viewBox="0 0 24 24" fill="${isDefault ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9 22 9 12 15 12 15 22"></polyline>
          </svg>
        </button>
        <button class="btn-edit" data-id="${bookmark.id}" title="编辑">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        </button>
        <button class="btn-delete" data-id="${bookmark.id}" title="删除">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    </div>
  `;
}

// 初始化拖拽排序
function initSortable() {
  dlog('initSortable()');
  // 检查 Sortable 是否可用
  if (typeof Sortable === 'undefined') {
    console.warn('Sortable.js not loaded, drag sort disabled');
    dlog('Sortable missing');
    return;
  }
  
  const list = document.getElementById('bookmarkList');
  if (list) {
    if (list._sortableFolders) {
      list._sortableFolders.destroy();
    }
    list._sortableFolders = new Sortable(list, {
      draggable: '.folder-item',
      handle: '.folder-header',
      animation: 150,
      onEnd: async () => {
        dlog('folders sort onEnd');
        const items = list.querySelectorAll('.folder-item');
        const updates = [];
        Array.from(items).forEach((item, index) => {
          const id = item.dataset.folderId;
          const folder = folders.find(f => f.id === id);
          if (folder) {
            folder.order = index;
            updates.push(window.api.updateFolder(id, { order: index }));
          }
        });
        if (updates.length > 0) {
          await Promise.all(updates);
          dlog('folders order saved');
        }
      }
    });
  }
  
  document.querySelectorAll('.folder-content').forEach(container => {
    if (container._sortable) {
      container._sortable.destroy();
    }
    
    container._sortable = new Sortable(container, {
      group: { name: 'bookmarks', pull: true, put: true },
      animation: 150,
      ghostClass: 'sortable-ghost',
      chosenClass: 'sortable-chosen',
      dragClass: 'sortable-drag',
      fallbackTolerance: 5,
      onEnd: async (evt) => {
        dlog('bookmarks sort onEnd');
        const toContainer = evt.to;
        const fromContainer = evt.from;
        const toFolderId = toContainer.id.replace('folder-', '');
        const fromFolderId = fromContainer.id.replace('folder-', '');
        
        const updates = [];
        
        // 目标容器：按当前位置重排并设置归属
        Array.from(toContainer.querySelectorAll('.bookmark-item')).forEach((item, index) => {
          const id = item.dataset.id;
          const bookmark = bookmarks.find(b => b.id === id);
          if (bookmark) {
            bookmark.folderId = toFolderId;
            bookmark.order = index;
            updates.push(window.api.updateBookmark(id, { folderId: toFolderId, order: index }));
          }
        });
        
        // 源容器：如果不同容器，也需要重排源容器剩余项
        if (fromContainer !== toContainer) {
          Array.from(fromContainer.querySelectorAll('.bookmark-item')).forEach((item, index) => {
            const id = item.dataset.id;
            const bookmark = bookmarks.find(b => b.id === id);
            if (bookmark) {
              bookmark.folderId = fromFolderId;
              bookmark.order = index;
              updates.push(window.api.updateBookmark(id, { folderId: fromFolderId, order: index }));
            }
          });
        }
        
        if (updates.length > 0) {
          await Promise.all(updates);
          dlog('bookmarks cross-sort saved');
        }
      }
    });
  });
}

// 切换文件夹展开/折叠
function toggleFolder(folderId) {
  dlog('toggleFolder', folderId);
  const folderItem = document.querySelector(`.folder-item[data-folder-id="${folderId}"]`);
  if (folderItem) {
    const willCollapse = !folderItem.classList.contains('collapsed') ? true : false;
    folderItem.classList.toggle('collapsed', willCollapse);
    // 更新设置中的展开列表
    const expanded = Array.isArray(settings.expandedFolders) ? new Set(settings.expandedFolders) : new Set();
    if (willCollapse) {
      expanded.delete(folderId);
    } else {
      expanded.add(folderId);
    }
    const expandedFolders = Array.from(expanded);
    window.api.updateSettings({ expandedFolders }).then((newSettings) => {
      dlog('expandedFolders saved', expandedFolders);
      settings = newSettings;
    });
  }
}

// 打开书签
function openBookmark(url) {
  window.api.openUrl(url);
}

// 编辑书签
function editBookmark(id) {
  const bookmark = bookmarks.find(b => b.id === id);
  if (!bookmark) return;
  
  editingBookmarkId = id;
  modalTitle.textContent = '编辑收藏';
  bookmarkName.value = bookmark.name;
  bookmarkUrl.value = bookmark.url;
  
  // 渲染文件夹选项
  renderFolderOptions(bookmark.folderId);
  
  bookmarkModal.classList.add('active');
  bookmarkName.focus();
}

// 删除书签
async function deleteBookmark(id) {
  await window.api.deleteBookmark(id);
  bookmarks = bookmarks.filter(b => b.id !== id);
  renderBookmarks(searchInput.value);
}

// 删除文件夹
async function deleteFolder(id) {
  if (id === 'default') return;
  
  await window.api.deleteFolder(id);
  
  // 将该文件夹的书签移到默认文件夹
  bookmarks.forEach(b => {
    if (b.folderId === id) {
      b.folderId = 'default';
    }
  });
  
  folders = folders.filter(f => f.id !== id);
  renderBookmarks(searchInput.value);
}

// 渲染文件夹选项
function renderFolderOptions(selectedId = 'default') {
  bookmarkFolder.innerHTML = folders.map(folder => `
    <option value="${folder.id}" ${folder.id === selectedId ? 'selected' : ''}>
      ${escapeHtml(folder.name)}
    </option>
  `).join('');
}

// 显示添加书签弹窗
function showAddBookmarkModal() {
  editingBookmarkId = null;
  modalTitle.textContent = '添加收藏';
  bookmarkName.value = '';
  bookmarkUrl.value = '';
  renderFolderOptions();
  bookmarkModal.classList.add('active');
  bookmarkName.focus();
}

// 保存书签
async function saveBookmark() {
  const name = bookmarkName.value.trim();
  const url = bookmarkUrl.value.trim();
  const folderId = bookmarkFolder.value;
  
  if (!name || !url) {
    return;
  }
  
  // 确保URL有协议
  let finalUrl = url;
  if (!url.match(/^https?:\/\//)) {
    finalUrl = 'https://' + url;
  }
  
  if (editingBookmarkId) {
    // 编辑模式
    const result = await window.api.updateBookmark(editingBookmarkId, {
      name,
      url: finalUrl,
      folderId
    });
    
    const index = bookmarks.findIndex(b => b.id === editingBookmarkId);
    if (index !== -1) {
      bookmarks[index] = { ...bookmarks[index], ...result };
    }
  } else {
    // 添加模式
    const result = await window.api.addBookmark({
      name,
      url: finalUrl,
      folderId
    });
    bookmarks.push(result);
  }
  
  closeBookmarkModal();
  renderBookmarks(searchInput.value);
}

// 关闭书签弹窗
function closeBookmarkModal() {
  bookmarkModal.classList.remove('active');
  editingBookmarkId = null;
}

// 显示添加文件夹弹窗
function showAddFolderModal() {
  folderName.value = '';
  folderModal.classList.add('active');
  folderName.focus();
}

// 保存文件夹
async function saveFolder() {
  const name = folderName.value.trim();
  if (!name) return;
  
  const result = await window.api.addFolder(name);
  folders.push(result);
  
  closeFolderModal();
  renderBookmarks(searchInput.value);
}

// 关闭文件夹弹窗
function closeFolderModal() {
  folderModal.classList.remove('active');
}

// HTML转义
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * 触发导入书签：支持 Chrome 导出 HTML 与应用备份 JSON
 */
async function handleImportBookmarks() {
  dlog('handleImportBookmarks()');
  try {
    const result = await window.api.importBookmarks();
    if (!result || result.canceled) return;
    await loadData();
    renderBookmarks(searchInput.value);
    alert(
      `导入完成（${result.format}）\n新增文件夹：${result.addedFolders}\n新增书签：${result.addedBookmarks}\n跳过重复：${result.skippedBookmarks}`
    );
  } catch (e) {
    alert(`导入失败：${e && e.message ? e.message : String(e)}`);
  }
}

/**
 * 触发导出书签：应用备份(JSON) 或 Chrome 书签(HTML)
 */
async function handleExportBookmarks() {
  dlog('handleExportBookmarks()');
  try {
    const result = await window.api.exportBookmarks();
    if (!result || result.canceled) return;
    alert(`导出完成（${result.format}）\n文件：${result.filePath}`);
  } catch (e) {
    alert(`导出失败：${e && e.message ? e.message : String(e)}`);
  }
}

// 设置事件监听
function setupEventListeners() {
  dlog('setupEventListeners() begin');
  // 搜索
  searchInput.addEventListener('input', (e) => {
    dlog('search input', e.target.value);
    renderBookmarks(e.target.value);
  });
  
  // 添加书签按钮
  btnAddBookmark.addEventListener('click', () => {
    dlog('btnAddBookmark click');
    showAddBookmarkModal();
  });

  // 导入/导出
  btnImportBookmarks.addEventListener('click', () => {
    dlog('btnImportBookmarks click');
    handleImportBookmarks();
  });
  btnExportBookmarks.addEventListener('click', () => {
    dlog('btnExportBookmarks click');
    handleExportBookmarks();
  });
  
  // 添加文件夹按钮
  btnAddFolder.addEventListener('click', () => {
    dlog('btnAddFolder click');
    showAddFolderModal();
  });
  
  // 书签弹窗
  btnCloseModal.addEventListener('click', closeBookmarkModal);
  btnCancelModal.addEventListener('click', closeBookmarkModal);
  btnSaveBookmark.addEventListener('click', saveBookmark);
  btnSaveBookmark.addEventListener('click', () => dlog('btnSaveBookmark click'));
  
  // 文件夹弹窗
  btnCloseFolderModal.addEventListener('click', closeFolderModal);
  btnCancelFolderModal.addEventListener('click', closeFolderModal);
  btnSaveFolder.addEventListener('click', saveFolder);
  btnSaveFolder.addEventListener('click', () => dlog('btnSaveFolder click'));
  
  // 按ESC关闭弹窗
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      dlog('ESC pressed');
      closeBookmarkModal();
      closeFolderModal();
    }
  });
  
  // 回车保存
  bookmarkUrl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      dlog('bookmarkUrl Enter');
      saveBookmark();
    }
  });
  
  folderName.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      dlog('folderName Enter');
      saveFolder();
    }
  });
  
  // 书签列表事件委托
  bookmarkList.addEventListener('click', (e) => {
    dlog('bookmarkList click');
    const target = e.target;
    
    // 文件夹头点击：展开/折叠
    const header = target.closest('.folder-header');
    if (header && !target.closest('.folder-actions')) {
      dlog('folder-header click');
      const folderItem = header.closest('.folder-item');
      if (folderItem) {
        const folderId = folderItem.dataset.folderId;
        toggleFolder(folderId);
      }
      return;
    }
    
    // 设为默认主页按钮
    const defaultBtn = target.closest('.btn-default');
    if (defaultBtn) {
      dlog('btn-default click');
      e.stopPropagation();
      const url = decodeURIComponent(defaultBtn.dataset.url);
      setDefaultUrl(url);
      return;
    }

    // 编辑按钮
    const editBtn = target.closest('.btn-edit');
    if (editBtn) {
      dlog('btn-edit click');
      e.stopPropagation();
      const id = editBtn.dataset.id;
      editBookmark(id);
      return;
    }
    
    // 删除按钮
    const deleteBtn = target.closest('.btn-delete');
    if (deleteBtn) {
      dlog('btn-delete click');
      e.stopPropagation();
      const id = deleteBtn.dataset.id;
      deleteBookmark(id);
      return;
    }
    
    // 书签项点击 - 打开网页
    const bookmarkItem = target.closest('.bookmark-item');
    if (bookmarkItem && !target.closest('.bookmark-actions')) {
      dlog('bookmark-item click');
      const url = decodeURIComponent(bookmarkItem.dataset.url);
      openBookmark(url);
      return;
    }
  });
  
  // 监听刷新事件
  window.api.onRefresh(async () => {
    dlog('onRefresh');
    await loadData();
    renderBookmarks(searchInput.value);
  });
  dlog('setupEventListeners() done');
}

// 暴露全局函数
window.toggleFolder = toggleFolder;
window.openBookmark = openBookmark;
window.editBookmark = editBookmark;
window.deleteBookmark = deleteBookmark;
window.deleteFolder = deleteFolder;

// 启动
init();

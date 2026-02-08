// 标签页管理
let tabs = [];
let activeTabId = null;
let tabIdCounter = 0;
let isPipMode = false;
let isPinned = true;
let isTabletMode = false;
let isMaximized = false;
const DEBUG_BROWSER = true;
function dlog(...args) {
  try {
    if (DEBUG_BROWSER) {
      window.api.debugLog({ source: 'browser-window', msg: args.map(String).join(' '), args });
    }
  } catch (e) {}
}

// 拖动状态
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;

// DOM元素
const tabBar = document.getElementById('tabBar');
const webviewContainer = document.getElementById('webviewContainer');
const loadingOverlay = document.getElementById('loadingOverlay');
const addressInput = document.getElementById('addressInput');
const btnBack = document.getElementById('btnBack');
const btnForward = document.getElementById('btnForward');
const btnRefresh = document.getElementById('btnRefresh');
const btnGo = document.getElementById('btnGo');
const btnNewTab = document.getElementById('btnNewTab');
const btnPip = document.getElementById('btnPip');
const btnPin = document.getElementById('btnPin');
const btnMinimize = document.getElementById('btnMinimize');
const btnMaximize = document.getElementById('btnMaximize');
const btnTablet = document.getElementById('btnTablet');
const btnClose = document.getElementById('btnClose');
const btnFavorite = document.getElementById('btnFavorite');
const opacitySlider = document.getElementById('opacitySlider');
const titleBar = document.querySelector('.title-bar');

// 收藏弹窗
const bookmarkModal = document.getElementById('bookmarkModal');
const modalTitle = document.getElementById('modalTitle');
const bookmarkName = document.getElementById('bookmarkName');
const bookmarkFolder = document.getElementById('bookmarkFolder');
const btnCancelBookmark = document.getElementById('btnCancelBookmark');
const btnSaveBookmark = document.getElementById('btnSaveBookmark');
let editingBookmarkId = null; // 暂时用不到，因为我们是根据URL判断

// 初始化
async function init() {
  dlog('browser init');
  setupEventListeners();
  
  // 获取当前透明度设置
  const opacity = await window.api.getOpacity();
  opacitySlider.value = Math.round(opacity * 100);
  
  // 监听URL加载事件
  window.api.onLoadUrl((url) => {
    dlog('onLoadUrl', url);
    createTab(url);
  });
}

// 创建新标签页
function createTab(url = '') {
  dlog('createTab', url);
  const tabId = ++tabIdCounter;
  
  // 创建webview
  const webview = document.createElement('webview');
  webview.id = `webview-${tabId}`;
  webview.setAttribute('partition', 'persist:main');
  webview.setAttribute('allowpopups', 'false');
  
  // 设置初始URL
  if (url) {
    webview.src = url;
  }
  
  webviewContainer.appendChild(webview);
  
  // 监听webview事件
  setupWebviewEvents(webview, tabId);
  
  // 添加标签数据
  const tab = {
    id: tabId,
    title: '新标签页',
    url: url || '',
    favicon: '',
    webview: webview
  };
  tabs.push(tab);
  
  // 渲染标签并激活
  renderTabs();
  activateTab(tabId);
  
  // 更新收藏状态
  if (url) {
    updateFavoriteStatus(url);
  }
  
  // 显示加载状态
  if (url) {
    showLoading();
  }
  
  return tabId;
}

// 设置webview事件监听
function setupWebviewEvents(webview, tabId) {
  dlog('setupWebviewEvents', tabId);
  // 开始加载
  webview.addEventListener('did-start-loading', () => {
    dlog('did-start-loading', tabId);
    if (activeTabId === tabId) {
      showLoading();
    }
  });
  
  // 加载完成
  webview.addEventListener('did-stop-loading', () => {
    dlog('did-stop-loading', tabId);
    if (activeTabId === tabId) {
      hideLoading();
      updateNavButtons();
    }
  });
  
  // 页面标题更新
  webview.addEventListener('page-title-updated', (e) => {
    dlog('page-title-updated', e.title);
    const tab = tabs.find(t => t.id === tabId);
    if (tab) {
      tab.title = e.title || '新标签页';
      renderTabs();
    }
  });
  
  // 页面图标更新
  webview.addEventListener('page-favicon-updated', (e) => {
    const tab = tabs.find(t => t.id === tabId);
    if (tab && e.favicons && e.favicons.length > 0) {
      tab.favicon = e.favicons[0];
      // 如果获取到了图标，更新标签
      renderTabs();
    }
  });
  
  // URL变化
  webview.addEventListener('did-navigate', (e) => {
    dlog('did-navigate', e.url);
    const tab = tabs.find(t => t.id === tabId);
    if (tab) {
      tab.url = e.url;
      // 每次导航后，尝试使用 DuckDuckGo Favicon 服务作为后备 (国内访问更稳定)
      if (!tab.favicon || tab.favicon.includes('google.com') || tab.favicon.includes('duckduckgo.com')) {
         tab.favicon = `https://icons.duckduckgo.com/ip3/${new URL(e.url).hostname}.ico`;
         renderTabs();
      }
      
      if (activeTabId === tabId) {
        addressInput.value = e.url;
        updateLockIcon(e.url);
        updateFavoriteStatus(e.url);
        dlog('favoriteStatus updated for', e.url);
      }
    }
  });
  
  // 内页导航
  webview.addEventListener('did-navigate-in-page', (e) => {
    dlog('did-navigate-in-page', e.url);
    if (e.isMainFrame) {
      const tab = tabs.find(t => t.id === tabId);
      if (tab) {
        tab.url = e.url;
        if (activeTabId === tabId) {
          addressInput.value = e.url;
          updateNavButtons();
          updateFavoriteStatus(e.url);
        }
      }
    }
  });
  
  // 加载失败
  webview.addEventListener('did-fail-load', (e) => {
    if (e.errorCode !== -3) { // -3是用户取消
      console.error('Load failed:', e.errorDescription);
    }
    hideLoading();
  });
  
  // 新窗口请求
  webview.addEventListener('new-window', (e) => {
    e.preventDefault();
    createTab(e.url);
  });
}

// 渲染标签栏
function renderTabs() {
  tabBar.innerHTML = tabs.map(tab => {
    // 优先使用获取到的favicon，如果没有则尝试从域名获取
    let faviconUrl = tab.favicon;
    if (!faviconUrl && tab.url) {
      try {
        const hostname = new URL(tab.url).hostname;
        faviconUrl = `https://icons.duckduckgo.com/ip3/${hostname}.ico`;
      } catch (e) {}
    }

    return `
    <div class="tab ${tab.id === activeTabId ? 'active' : ''}" data-tab-id="${tab.id}">
      <div class="tab-icon">
        <img src="${faviconUrl || ''}" 
             onerror="this.style.display='none';this.nextElementSibling.style.display='block'"
             style="${faviconUrl ? '' : 'display:none'}">
        <svg style="${faviconUrl ? 'display:none' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
        </svg>
      </div>
      <span class="tab-title">${escapeHtml(tab.title)}</span>
      <button class="tab-close" data-close-id="${tab.id}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
  `}).join('');
}

// 激活标签页
function activateTab(tabId) {
  dlog('activateTab', tabId);
  const tab = tabs.find(t => t.id === tabId);
  if (!tab) return;
  
  activeTabId = tabId;
  
  // 更新webview显示
  tabs.forEach(t => {
    t.webview.classList.toggle('active', t.id === tabId);
  });
  
  // 更新地址栏
  addressInput.value = tab.url;
  updateLockIcon(tab.url);
  updateFavoriteStatus(tab.url);
  
  // 更新导航按钮状态
  updateNavButtons();
  
  // 更新标签样式
  renderTabs();
}

// 关闭标签页
function closeTab(tabId) {
  dlog('closeTab', tabId);
  const index = tabs.findIndex(t => t.id === tabId);
  if (index === -1) return;
  
  const tab = tabs[index];
  
  // 移除webview
  tab.webview.remove();
  
  // 从数组中移除
  tabs.splice(index, 1);
  
  // 如果关闭的是当前标签，激活相邻标签
  if (activeTabId === tabId) {
    if (tabs.length > 0) {
      const newIndex = Math.min(index, tabs.length - 1);
      activateTab(tabs[newIndex].id);
    } else {
      activeTabId = null;
      addressInput.value = '';
    }
  }
  
  renderTabs();
  
  // 如果没有标签了，最小化窗口
  if (tabs.length === 0) {
    window.api.minimize();
  }
}

// 更新导航按钮状态
function updateNavButtons() {
  dlog('updateNavButtons');
  const tab = tabs.find(t => t.id === activeTabId);
  if (tab && tab.webview) {
    btnBack.disabled = !tab.webview.canGoBack();
    btnForward.disabled = !tab.webview.canGoForward();
  }
}

// 更新收藏状态
async function updateFavoriteStatus(url) {
  dlog('updateFavoriteStatus', url);
  if (!url || !url.startsWith('http')) {
    btnFavorite.classList.remove('active');
    btnFavorite.querySelector('svg').style.fill = 'none';
    return;
  }
  
  const isBookmarked = await window.api.isBookmarked(url);
  dlog('isBookmarked result', !!isBookmarked);
  if (isBookmarked) {
    btnFavorite.classList.add('active');
    btnFavorite.querySelector('svg').style.fill = 'currentColor';
  } else {
    btnFavorite.classList.remove('active');
    btnFavorite.querySelector('svg').style.fill = 'none';
  }
}

// 更新锁图标
function updateLockIcon(url) {
  const lockIcon = document.querySelector('.lock-icon');
  if (url && url.startsWith('https://')) {
    lockIcon.classList.remove('insecure');
  } else {
    lockIcon.classList.add('insecure');
  }
}

// 导航到URL
function navigateTo(url) {
  dlog('navigateTo', url);
  if (!url) return;
  
  // 处理URL
  let finalUrl = url.trim();
  // 支持本地文件：file:// 或 Windows 绝对路径（C:\...）
  const isFileScheme = /^file:\/\//i.test(finalUrl);
  const isWindowsAbs = /^[a-zA-Z]:\\/.test(finalUrl);
  const isUNC = /^\\\\/.test(finalUrl);
  if (isWindowsAbs) {
    // Windows 盘符路径 → file:///C:/path
    const normalized = finalUrl.replace(/\\/g, '/');
    finalUrl = encodeURI(`file:///${normalized}`);
  } else if (isUNC) {
    // UNC 路径 \\server\share\path → file://server/share/path
    const normalized = finalUrl.replace(/^\\\\/, '').replace(/\\/g, '/');
    finalUrl = encodeURI(`file://${normalized}`);
  } else if (!isFileScheme && !finalUrl.match(/^https?:\/\//)) {
    // 检查是否是域名格式
    if (finalUrl.match(/^[\w-]+(\.[\w-]+)+/)) {
      finalUrl = 'https://' + finalUrl;
    } else {
      // 作为搜索词处理
      finalUrl = `https://www.bing.com/search?q=${encodeURIComponent(finalUrl)}`;
    }
  }
  
  const tab = tabs.find(t => t.id === activeTabId);
  if (tab) {
    tab.webview.src = finalUrl;
    dlog('webview.src set', finalUrl);
    showLoading();
  } else {
    createTab(finalUrl);
  }
}

// 显示/隐藏加载状态
function showLoading() {
  loadingOverlay.classList.add('active');
}

function hideLoading() {
  loadingOverlay.classList.remove('active');
}

// HTML转义
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 设置事件监听
function setupEventListeners() {
  dlog('setupEventListeners');
  // 标签栏点击事件委托
  tabBar.addEventListener('click', (e) => {
    dlog('tabBar click');
    const target = e.target;
    
    // 处理关闭按钮点击
    const closeBtn = target.closest('.tab-close');
    if (closeBtn) {
      const tabId = parseInt(closeBtn.dataset.closeId);
      if (!isNaN(tabId)) {
        closeTab(tabId);
      }
      return;
    }
    
    // 处理标签点击（切换标签）
    const tabElement = target.closest('.tab');
    if (tabElement) {
      const tabId = parseInt(tabElement.dataset.tabId);
      if (!isNaN(tabId)) {
        activateTab(tabId);
      }
    }
  });
  
  // 地址栏回车
  addressInput.addEventListener('keydown', (e) => {
    dlog('addressInput keydown', e.key);
    if (e.key === 'Enter') {
      navigateTo(addressInput.value);
    }
  });
  
  // 前往按钮
  btnGo.addEventListener('click', () => {
    dlog('btnGo click');
    navigateTo(addressInput.value);
  });
  
  // 收藏按钮
    btnFavorite.addEventListener('click', async () => {
    dlog('btnFavorite click');
      const tab = tabs.find(t => t.id === activeTabId);
      if (!tab || !tab.url || !tab.url.startsWith('http')) return;
      
      const isBookmarked = await window.api.isBookmarked(tab.url);
      
      if (isBookmarked) {
        // 如果已收藏，直接取消收藏（或者也可以弹窗让用户修改，但根据需求，通常是再点一下取消，或者弹窗中提供删除）
        // 这里我们选择简单策略：点击已收藏的，询问是否删除或编辑？
        // 为了体验一致，我们弹出编辑窗口，用户可以选择修改文件夹或删除
        showBookmarkModal(tab.title, tab.url, true, isBookmarked.folderId);
      } else {
        // 未收藏，弹出添加窗口
        showBookmarkModal(tab.title, tab.url, false);
      }
    });

    // 弹窗按钮事件
    btnCancelBookmark.addEventListener('click', closeBookmarkModal);
    
    btnSaveBookmark.addEventListener('click', async () => {
      const tab = tabs.find(t => t.id === activeTabId);
      if (!tab) return;
      
      const title = bookmarkName.value.trim();
      const folderId = bookmarkFolder.value;
      
      if (!title) return;
      
      // 使用当前favicon或后备图标
      let favicon = tab.favicon;
      if (!favicon) {
        try {
          const hostname = new URL(tab.url).hostname;
          favicon = `https://icons.duckduckgo.com/ip3/${hostname}.ico`;
        } catch (e) {}
      }

      // 如果是已存在的，先删除旧的（为了简单起见，或者调用update）
      // 这里为了简单，我们先检查是否已存在
      const isBookmarked = await window.api.isBookmarked(tab.url);
      if (isBookmarked) {
        await window.api.deleteBookmark(isBookmarked.id);
      }
      
      await window.api.addBookmark({
        name: title,
        url: tab.url,
        icon: favicon,
        folderId: folderId
      });
      
      closeBookmarkModal();
      updateFavoriteStatus(tab.url);
    });

    // 后退
  btnBack.addEventListener('click', () => {
    dlog('btnBack click');
    const tab = tabs.find(t => t.id === activeTabId);
    if (tab && tab.webview.canGoBack()) {
      tab.webview.goBack();
    }
  });
  
  // 前进
  btnForward.addEventListener('click', () => {
    dlog('btnForward click');
    const tab = tabs.find(t => t.id === activeTabId);
    if (tab && tab.webview.canGoForward()) {
      tab.webview.goForward();
    }
  });
  
  // 刷新
  btnRefresh.addEventListener('click', () => {
    dlog('btnRefresh click');
    const tab = tabs.find(t => t.id === activeTabId);
    if (tab) {
      tab.webview.reload();
    }
  });
  
  // 新建标签页
  btnNewTab.addEventListener('click', () => {
    dlog('btnNewTab click');
    createTab();
  });
  
  // 画中画模式
  btnPip.addEventListener('click', () => {
    dlog('btnPip click');
    isPipMode = !isPipMode;
    btnPip.classList.toggle('active', isPipMode);
    window.api.setPictureInPicture(isPipMode);
  });
  
  // 置顶切换
  btnPin.addEventListener('click', async () => {
    dlog('btnPin click');
    isPinned = await window.api.toggleAlwaysOnTop();
    btnPin.classList.toggle('unpinned', !isPinned);
  });
  
  // 最小化
  btnMinimize.addEventListener('click', () => {
    dlog('btnMinimize click');
    window.api.minimize();
  });
  
  // 关闭
  btnClose.addEventListener('click', () => {
    dlog('btnClose click');
    window.api.close();
  });
  
  // 最大化
  btnMaximize.addEventListener('click', async () => {
    dlog('btnMaximize click');
    isMaximized = await window.api.toggleMaximize();
    btnMaximize.classList.toggle('maximized', isMaximized);
    btnMaximize.title = isMaximized ? '还原' : '最大化';
  });
  
  // 平板模式
  btnTablet.addEventListener('click', async () => {
    dlog('btnTablet click');
    isTabletMode = await window.api.toggleTabletMode();
    btnTablet.classList.toggle('active', isTabletMode);
  });
  
  // 标题栏拖动（JS控制）
  titleBar.addEventListener('mousedown', (e) => {
    if (e.target.closest('button') || e.target.closest('input') || e.target.closest('.tab')) {
      return;
    }
    if (e.button !== 0) return;
    window.api.lockSize();
    isDragging = true;
    dragStartX = e.screenX;
    dragStartY = e.screenY;
  });
  
  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    if (e.buttons === 0) {
      isDragging = false;
      window.api.unlockSize();
      return;
    }
    const deltaX = e.screenX - dragStartX;
    const deltaY = e.screenY - dragStartY;
    if (deltaX !== 0 || deltaY !== 0) {
      window.api.moveBy(deltaX, deltaY);
      dragStartX = e.screenX;
      dragStartY = e.screenY;
    }
  });
  
  window.addEventListener('mouseup', () => {
    isDragging = false;
    window.api.unlockSize();
  });
  
  // 透明度调节
  opacitySlider.addEventListener('input', (e) => {
    dlog('opacitySlider input', e.target.value);
    const value = parseInt(e.target.value) / 100;
    window.api.setOpacity(value);
  });
  
  // 地址栏获取焦点时全选
  addressInput.addEventListener('focus', () => {
    dlog('addressInput focus');
    addressInput.select();
  });
}

// 显示收藏弹窗
async function showBookmarkModal(title, url, isEdit, currentFolderId = 'default') {
  // 加载文件夹列表
  const folders = await window.api.getFolders();
  bookmarkFolder.innerHTML = folders.map(f => 
    `<option value="${f.id}" ${f.id === currentFolderId ? 'selected' : ''}>${escapeHtml(f.name)}</option>`
  ).join('');
  // 确保有默认选项
  if (folders.length === 0 || !folders.find(f => f.id === 'default')) {
      bookmarkFolder.insertAdjacentHTML('afterbegin', '<option value="default">默认文件夹</option>');
  }

  modalTitle.textContent = isEdit ? '编辑收藏' : '添加收藏';
  bookmarkName.value = title;
  
  bookmarkModal.classList.add('active');
  bookmarkName.focus();
}

// 关闭收藏弹窗
function closeBookmarkModal() {
  bookmarkModal.classList.remove('active');
}

// 启动
init();

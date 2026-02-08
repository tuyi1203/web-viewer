const Store = require('electron-store');
const { app } = require('electron');
const path = require('path');
const fs = require('fs');

/**
 * 读取应用配置文件 settings.json，支持相对或绝对 dataDir
 */
function readAppConfig() {
  try {
    const appRoot = app.getAppPath();
    const configPath = path.join(appRoot, 'settings.json');
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (e) {}
  return {};
}

/**
 * 解析并确保数据目录存在：
 * - 优先使用 settings.json 中的 dataDir
 * - 相对路径基于 userData 目录解析，避免中文路径和权限问题
 * - 若未配置则默认使用 userData/web-viewer-data 目录
 * - 若检测到旧的临时目录数据，自动迁移到新目录
 */
function resolveDataDir() {
  const config = readAppConfig();
  const appRoot = app.getAppPath();
  let targetDir;
  if (config.dataDir) {
    targetDir = path.isAbsolute(config.dataDir)
      ? config.dataDir
      : path.join(appRoot, config.dataDir);
  } else {
    targetDir = path.join(appRoot, 'web-viewer-data');
  }

  try {
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    console.log('Data directory:', targetDir);
  } catch (e) {
    console.error('Failed to create data directory:', targetDir, e);
    // 降级到应用根目录
    targetDir = appRoot;
  }

  try {
    // 兼容之前错误解析到父目录的情况，尝试迁移父目录数据
    const parentDirCandidate = path.join(path.dirname(appRoot), config.dataDir || 'web-viewer-data');
    const userDataDir = path.join(app.getPath('userData'), 'web-viewer-data');
    const tempDir = path.join(app.getPath('temp'), 'web-viewer-data');
    const candidates = [parentDirCandidate, userDataDir, tempDir];
    const newFile = path.join(targetDir, 'bookmarks.json');
    for (const c of candidates) {
      const oldFile = path.join(c, 'bookmarks.json');
      if (c !== targetDir && fs.existsSync(oldFile) && !fs.existsSync(newFile)) {
        fs.copyFileSync(oldFile, newFile);
        console.log('Migrated bookmarks.json from', c, 'to', targetDir);
        break;
      }
    }
  } catch (e) {}
  return targetDir;
}

const store = new Store({
  name: 'bookmarks',
  cwd: resolveDataDir(),
  fileExtension: 'json',
  defaults: {
    folders: [
      { id: 'default', name: '默认收藏', order: 0 }
    ],
    bookmarks: [],
    settings: {
      floatingBallPosition: { x: 100, y: 100 },
      defaultOpacity: 1.0,
      autoHidePanel: true,
      defaultUrl: '',
      debugLogs: true
    }
  }
});
console.log('Bookmarks store file:', path.join(store.path));

// 尝试从现有文件进行水合（electron-store若未加载到内容，则用文件内容填充）
try {
  const storeFile = store.path;
  if (fs.existsSync(storeFile)) {
    const raw = fs.readFileSync(storeFile, 'utf-8');
    const json = JSON.parse(raw);
    const hasContent =
      (Array.isArray(json.folders) && json.folders.length > 0) ||
      (Array.isArray(json.bookmarks) && json.bookmarks.length > 0);
    if (hasContent) {
      if (Array.isArray(json.folders)) {
        store.set('folders', json.folders);
      }
      if (Array.isArray(json.bookmarks)) {
        store.set('bookmarks', json.bookmarks);
      }
      if (json.settings && typeof json.settings === 'object') {
        const merged = { ...store.get('settings', {}), ...json.settings };
        store.set('settings', merged);
      }
    }
  }
} catch (e) {
  console.warn('Hydration from file skipped:', e);
}

// 生成唯一ID
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

const bookmarkStore = {
  // 获取所有文件夹
  getFolders() {
    let folders = store.get('folders', []);
    if (!Array.isArray(folders) || folders.length === 0) {
      try {
        const raw = fs.readFileSync(store.path, 'utf-8');
        const json = JSON.parse(raw);
        if (Array.isArray(json.folders)) {
          folders = json.folders;
          store.set('folders', folders);
        }
      } catch (e) {}
    }
    return folders;
  },

  // 添加文件夹
  addFolder(name) {
    const folders = this.getFolders();
    const newFolder = {
      id: generateId(),
      name,
      order: folders.length
    };
    folders.push(newFolder);
    store.set('folders', folders);
    return newFolder;
  },

  // 更新文件夹
  updateFolder(id, data) {
    const folders = this.getFolders();
    const index = folders.findIndex(f => f.id === id);
    if (index !== -1) {
      folders[index] = { ...folders[index], ...data };
      store.set('folders', folders);
      return folders[index];
    }
    return null;
  },

  // 删除文件夹
  deleteFolder(id) {
    if (id === 'default') return false; // 不能删除默认文件夹
    
    const folders = this.getFolders().filter(f => f.id !== id);
    store.set('folders', folders);
    
    // 将该文件夹下的书签移到默认文件夹
    const bookmarks = this.getAllBookmarks();
    bookmarks.forEach(b => {
      if (b.folderId === id) {
        b.folderId = 'default';
      }
    });
    store.set('bookmarks', bookmarks);
    
    return true;
  },

  // 获取所有书签
  getAllBookmarks() {
    let bookmarks = store.get('bookmarks', []);
    if (!Array.isArray(bookmarks) || bookmarks.length === 0) {
      try {
        const raw = fs.readFileSync(store.path, 'utf-8');
        const json = JSON.parse(raw);
        if (Array.isArray(json.bookmarks)) {
          bookmarks = json.bookmarks;
          store.set('bookmarks', bookmarks);
        }
      } catch (e) {}
    }
    return bookmarks;
  },

  // 获取指定文件夹的书签
  getBookmarks(folderId) {
    const bookmarks = this.getAllBookmarks();
    if (folderId) {
      return bookmarks.filter(b => b.folderId === folderId);
    }
    return bookmarks;
  },

  // 添加书签
  addBookmark(data) {
    const bookmarks = this.getAllBookmarks();
    const newBookmark = {
      id: generateId(),
      folderId: data.folderId || 'default',
      name: data.name,
      url: data.url,
      icon: data.icon || '',
      order: bookmarks.filter(b => b.folderId === (data.folderId || 'default')).length,
      createdAt: Date.now()
    };
    bookmarks.push(newBookmark);
    store.set('bookmarks', bookmarks);
    return newBookmark;
  },

  // 更新书签
  updateBookmark(id, data) {
    const bookmarks = this.getAllBookmarks();
    const index = bookmarks.findIndex(b => b.id === id);
    if (index !== -1) {
      bookmarks[index] = { ...bookmarks[index], ...data, updatedAt: Date.now() };
      store.set('bookmarks', bookmarks);
      return bookmarks[index];
    }
    return null;
  },

  // 删除书签
  deleteBookmark(id) {
    const bookmarks = this.getAllBookmarks().filter(b => b.id !== id);
    store.set('bookmarks', bookmarks);
    return true;
  },

  // 重新排序书签
  reorderBookmarks(orderedIds) {
    const bookmarks = this.getAllBookmarks();
    orderedIds.forEach((id, index) => {
      const bookmark = bookmarks.find(b => b.id === id);
      if (bookmark) {
        bookmark.order = index;
      }
    });
    store.set('bookmarks', bookmarks);
    return bookmarks;
  },

  // 获取设置
  getSettings() {
    return store.get('settings', {});
  },

  // 更新设置
  updateSettings(data) {
    const settings = this.getSettings();
    const newSettings = { ...settings, ...data };
    store.set('settings', newSettings);
    return newSettings;
  },

  // 获取所有数据（用于导出）
  getAllData() {
    let folders = this.getFolders();
    let bookmarks = this.getAllBookmarks();
    let settings = this.getSettings();
    if ((!Array.isArray(folders) || folders.length === 0) && (!Array.isArray(bookmarks) || bookmarks.length === 0)) {
      try {
        const raw = fs.readFileSync(store.path, 'utf-8');
        const json = JSON.parse(raw);
        if (Array.isArray(json.folders) && json.folders.length > 0) {
          folders = json.folders;
          store.set('folders', folders);
        }
        if (Array.isArray(json.bookmarks) && json.bookmarks.length > 0) {
          bookmarks = json.bookmarks;
          store.set('bookmarks', bookmarks);
        }
        if (json.settings && typeof json.settings === 'object') {
          settings = { ...settings, ...json.settings };
          store.set('settings', settings);
        }
      } catch (e) {}
    }
    return { folders, bookmarks, settings };
  }
};

module.exports = bookmarkStore;

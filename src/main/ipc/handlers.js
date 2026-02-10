const { ipcMain, dialog, app } = require('electron');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const {
  generateChromeBookmarksHtml,
  exportAppBackupJson,
  importBookmarksFromFile
} = require('../utils/bookmarkTransfer');

function registerIpcHandlers({ floatingBall, bookmarkPanel, browserWindow, bookmarkStore }) {
  logger.log('Registering IPC handlers');
  // 悬浮球位置更新（绝对位置）
  ipcMain.on('ball:updatePosition', (event, { x, y }) => {
    logger.log('ball:updatePosition', { x, y });
    floatingBall.updatePosition(x, y);
  });

  // 悬浮球增量移动
  ipcMain.on('ball:moveBy', (event, { deltaX, deltaY }) => {
    floatingBall.moveBy(deltaX, deltaY);
  });

  // 切换收藏夹面板
  ipcMain.on('panel:toggle', () => {
    logger.log('panel:toggle');
    const ballBounds = floatingBall.getBounds();
    bookmarkPanel.toggle(ballBounds);
  });

  // 隐藏收藏夹面板
  ipcMain.on('panel:hide', () => {
    logger.log('panel:hide');
    bookmarkPanel.hide();
  });

  // 获取所有数据（用于导出）
  ipcMain.handle('bookmark:getAll', () => {
    const data = bookmarkStore.getAllData();
    logger.log('bookmark:getAll ->', {
      folders: data.folders.length,
      bookmarks: data.bookmarks.length
    });
    return data;
  });

  /**
   * 导出书签到文件（支持：应用备份 JSON / Chrome 书签 HTML）
   */
  ipcMain.handle('bookmark:export', async () => {
    const choice = await dialog.showMessageBox({
      type: 'question',
      title: '导出书签',
      message: '选择导出格式',
      buttons: ['应用备份(JSON)', 'Chrome书签(HTML)', '取消'],
      defaultId: 0,
      cancelId: 2,
      noLink: true
    });
    if (choice.response === 2) {
      return { canceled: true };
    }

    const format = choice.response === 1 ? 'chrome-html' : 'app-json';
    const now = new Date();
    const ts = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(
      now.getHours()
    ).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    const ext = format === 'chrome-html' ? 'html' : 'json';
    const defaultPath = path.join(app.getPath('documents'), `web-viewer-bookmarks_${ts}.${ext}`);

    const save = await dialog.showSaveDialog({
      title: '保存导出文件',
      defaultPath,
      filters:
        format === 'chrome-html'
          ? [{ name: 'HTML', extensions: ['html', 'htm'] }]
          : [{ name: 'JSON', extensions: ['json'] }]
    });
    if (save.canceled || !save.filePath) {
      return { canceled: true };
    }

    const data = bookmarkStore.getAllData();
    const content =
      format === 'chrome-html'
        ? generateChromeBookmarksHtml({ folders: data.folders, bookmarks: data.bookmarks, title: 'Nimbus Web Viewer Bookmarks' })
        : exportAppBackupJson(data);
    fs.writeFileSync(save.filePath, content, 'utf-8');
    logger.log('bookmark:export ->', { format, filePath: save.filePath });
    return { canceled: false, format, filePath: save.filePath };
  });

  /**
   * 从文件导入书签（支持：Chrome 导出的 HTML、应用导出的 JSON）
   */
  ipcMain.handle('bookmark:import', async () => {
    const open = await dialog.showOpenDialog({
      title: '导入书签',
      properties: ['openFile'],
      filters: [
        { name: '书签文件', extensions: ['html', 'htm', 'json'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    });
    if (open.canceled || !open.filePaths || open.filePaths.length === 0) {
      return { canceled: true };
    }

    const filePath = open.filePaths[0];
    const raw = fs.readFileSync(filePath, 'utf-8');
    const result = importBookmarksFromFile({ filePath, fileContent: raw, bookmarkStore });
    logger.log('bookmark:import ->', { filePath, ...result });
    bookmarkPanel.refresh();
    return { canceled: false, filePath, ...result };
  });

  // 检查是否收藏
  ipcMain.handle('bookmark:isBookmarked', (event, url) => {
    logger.log('bookmark:isBookmarked?', url);
    const bookmarks = bookmarkStore.getAllBookmarks();
    // 返回收藏对象或 null
    return bookmarks.find(b => b.url === url) || null;
  });

  // 获取文件夹列表
  ipcMain.handle('bookmark:getFolders', () => {
    const folders = bookmarkStore.getFolders();
    logger.log('bookmark:getFolders ->', folders.length);
    return folders;
  });

  // 添加文件夹
  ipcMain.handle('bookmark:addFolder', (event, name) => {
    logger.log('bookmark:addFolder', name);
    return bookmarkStore.addFolder(name);
  });

  // 更新文件夹
  ipcMain.handle('bookmark:updateFolder', (event, { id, data }) => {
    logger.log('bookmark:updateFolder', id, data);
    return bookmarkStore.updateFolder(id, data);
  });

  // 删除文件夹
  ipcMain.handle('bookmark:deleteFolder', (event, id) => {
    logger.log('bookmark:deleteFolder', id);
    return bookmarkStore.deleteFolder(id);
  });

  // 获取书签列表
  ipcMain.handle('bookmark:getBookmarks', (event, folderId) => {
    const list = bookmarkStore.getBookmarks(folderId);
    logger.log('bookmark:getBookmarks', folderId, '->', list.length);
    return list;
  });

  // 添加书签
  ipcMain.handle('bookmark:add', (event, data) => {
    logger.log('bookmark:add', data);
    const result = bookmarkStore.addBookmark(data);
    bookmarkPanel.refresh();
    return result;
  });

  // 更新书签
  ipcMain.handle('bookmark:update', (event, { id, data }) => {
    logger.log('bookmark:update', id, data);
    const result = bookmarkStore.updateBookmark(id, data);
    bookmarkPanel.refresh();
    return result;
  });

  // 删除书签
  ipcMain.handle('bookmark:delete', (event, id) => {
    logger.log('bookmark:delete', id);
    const result = bookmarkStore.deleteBookmark(id);
    bookmarkPanel.refresh();
    return result;
  });

  // 重新排序书签
  ipcMain.handle('bookmark:reorder', (event, orderedIds) => {
    logger.log('bookmark:reorder', orderedIds);
    return bookmarkStore.reorderBookmarks(orderedIds);
  });

  // 打开浏览器窗口
  ipcMain.on('browser:open', (event, url) => {
    logger.log('browser:open', url);
    browserWindow.openUrl(url);
    bookmarkPanel.hide();
  });

  // 打开默认浏览器
  ipcMain.on('browser:openDefault', () => {
    logger.log('browser:openDefault');
    // 若当前已打开，则隐藏；否则打开默认网址
    if (browserWindow.isVisible()) {
      browserWindow.hide();
    } else {
      const settings = bookmarkStore.getSettings();
      const url = settings.defaultUrl || 'https://www.bing.com';
      browserWindow.openUrl(url);
      bookmarkPanel.hide();
    }
  });

  // 设置浏览器透明度
  ipcMain.on('browser:setOpacity', (event, value) => {
    logger.log('browser:setOpacity', value);
    browserWindow.setOpacity(value);
  });

  // 获取浏览器透明度
  ipcMain.handle('browser:getOpacity', () => {
    const value = browserWindow.getOpacity();
    logger.log('browser:getOpacity ->', value);
    return value;
  });

  // 切换置顶状态
  ipcMain.handle('browser:toggleAlwaysOnTop', () => {
    const flag = browserWindow.toggleAlwaysOnTop();
    logger.log('browser:toggleAlwaysOnTop ->', flag);
    return flag;
  });

  // 最小化浏览器窗口
  ipcMain.on('browser:minimize', () => {
    logger.log('browser:minimize');
    browserWindow.minimize();
  });

  // 关闭浏览器窗口
  ipcMain.on('browser:close', () => {
    logger.log('browser:close');
    browserWindow.hide();
  });

  // 画中画模式
  ipcMain.on('browser:pip', (event, enabled) => {
    logger.log('browser:pip', enabled);
    if (enabled) {
      browserWindow.enablePictureInPicture();
    } else {
      browserWindow.disablePictureInPicture();
    }
  });

  // 最大化/还原
  ipcMain.handle('browser:toggleMaximize', () => {
    const flag = browserWindow.toggleMaximize();
    logger.log('browser:toggleMaximize ->', flag);
    return flag;
  });

  // 检查是否最大化
  ipcMain.handle('browser:isMaximized', () => {
    const flag = browserWindow.isMaximized();
    logger.log('browser:isMaximized ->', flag);
    return flag;
  });

  // 平板模式
  ipcMain.handle('browser:toggleTabletMode', () => {
    const flag = browserWindow.toggleTabletMode();
    logger.log('browser:toggleTabletMode ->', flag);
    return flag;
  });

  // 浏览器窗口拖动
  ipcMain.on('browser:moveBy', (event, deltaX, deltaY) => {
    logger.log('browser:moveBy', { deltaX, deltaY });
    browserWindow.moveBy(deltaX, deltaY);
  });
  ipcMain.on('browser:lockSize', () => {
    browserWindow.lockSize();
  });
  ipcMain.on('browser:unlockSize', () => {
    browserWindow.unlockSize();
  });
  

  // 获取设置
  ipcMain.handle('settings:get', () => {
    const s = bookmarkStore.getSettings();
    logger.log('settings:get ->', s);
    return s;
  });

  // 更新设置
  ipcMain.handle('settings:update', (event, data) => {
    logger.log('settings:update', data);
    return bookmarkStore.updateSettings(data);
  });
  
  // 渲染层调试日志
  ipcMain.on('log:debug', (event, payload) => {
    logger.log('renderer:', payload);
  });
}

module.exports = { registerIpcHandlers };

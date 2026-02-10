const { app, BrowserWindow, screen, ipcMain, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const userDataPath = path.join(app.getPath('home'), '.web-viewer-data');
try {
  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
  }
  app.setPath('userData', userDataPath);
} catch (e) {}
try {
  const cachePath = path.join(userDataPath, 'cache');
  if (!fs.existsSync(cachePath)) {
    fs.mkdirSync(cachePath, { recursive: true });
  }
  app.setPath('cache', cachePath);
  app.commandLine.appendSwitch('disk-cache-dir', cachePath);
  const mediaCachePath = path.join(userDataPath, 'media-cache');
  if (!fs.existsSync(mediaCachePath)) {
    fs.mkdirSync(mediaCachePath, { recursive: true });
  }
  app.commandLine.appendSwitch('media-cache-dir', mediaCachePath);
  app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
} catch (e) {}
const FloatingBall = require('./windows/FloatingBall');
const BookmarkPanel = require('./windows/BookmarkPanel');
const BrowserWindowManager = require('./windows/BrowserWindow');
const bookmarkStore = require('./store/bookmarkStore');
const { registerIpcHandlers } = require('./ipc/handlers');
const logger = require('./utils/logger');

// 窗口实例
let floatingBall = null;
let bookmarkPanel = null;
let browserWindow = null;

// 右键菜单
let contextMenu = null;

// 禁用硬件加速以避免透明窗口问题
app.disableHardwareAcceleration();

// 初始化日志开关
try {
  const settings = bookmarkStore.getSettings();
  logger.setEnabled(settings.debugLogs !== false);
  const logsDir = path.join(app.getAppPath(), 'logs');
  logger.setFileDir(logsDir);
} catch (e) {}

function createContextMenu() {
  contextMenu = Menu.buildFromTemplate([
    {
      label: '重启',
      click: () => {
        app.relaunch();
        app.exit(0);
      }
    },
    {
      label: '退出',
      click: () => {
        app.quit();
      }
    }
  ]);
}

function createWindows() {
  logger.log('Creating windows...');
  
  try {
    // 创建右键菜单
    createContextMenu();
    
    // 创建悬浮球
    floatingBall = new FloatingBall();
    logger.log('FloatingBall created');
    
    // 创建收藏夹面板
    bookmarkPanel = new BookmarkPanel();
    logger.log('BookmarkPanel created');
    
    // 创建浏览器窗口（初始隐藏）
    browserWindow = new BrowserWindowManager({ floatingBall });
    logger.log('BrowserWindow created');
    
    // 注册IPC处理器
    registerIpcHandlers({
      floatingBall,
      bookmarkPanel,
      browserWindow,
      bookmarkStore
    });
    logger.log('IPC handlers registered');
    
    // 注册右键菜单IPC
    ipcMain.on('app:showContextMenu', () => {
      if (contextMenu) {
        contextMenu.popup();
      }
    });
  } catch (error) {
    logger.log('Error creating windows:', error);
  }
}

app.whenReady().then(() => {
  logger.log('App ready');
  createWindows();
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindows();
    }
  });
});

// 不要在所有窗口关闭时退出应用
app.on('window-all-closed', () => {
  // 保持应用运行
});

// 导出窗口实例供其他模块使用
module.exports = {
  getFloatingBall: () => floatingBall,
  getBookmarkPanel: () => bookmarkPanel,
  getBrowserWindow: () => browserWindow
};

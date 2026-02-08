const { BrowserWindow, screen } = require('electron');
const path = require('path');
const logger = require('../utils/logger');

class BookmarkPanel {
  constructor() {
    this.window = null;
    this.isVisible = false;
    this.createWindow();
  }

  createWindow() {
    this.window = new BrowserWindow({
      width: 380,
      height: 520,
      transparent: true,
      frame: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      show: false,
      hasShadow: true,
      webPreferences: {
        preload: path.join(__dirname, '../../preload/bookmark-panel.js'),
        contextIsolation: true,
        nodeIntegration: false
      }
    });

    this.window.loadFile(path.join(__dirname, '../../renderer/bookmark-panel/index.html'));
    this.window.webContents.on('did-finish-load', () => {
      logger.log('bookmark-panel did-finish-load');
    });
    this.window.webContents.on('dom-ready', () => {
      logger.log('bookmark-panel dom-ready');
    });
    this.window.webContents.on('console-message', (event, level, message, line, sourceId) => {
      logger.log('bookmark-panel console', { level, message, sourceId, line });
    });

    // 失焦时隐藏
    this.window.on('blur', () => {
      // 延迟隐藏，避免点击收藏夹内元素时立即关闭
      setTimeout(() => {
        if (this.isVisible && !this.window.isFocused()) {
          this.hide();
        }
      }, 100);
    });

    this.window.on('closed', () => {
      this.window = null;
    });

    // 阻止窗口真正关闭
    this.window.on('close', (event) => {
      event.preventDefault();
      this.hide();
    });
  }

  // 根据悬浮球位置显示面板
  showNearBall(ballBounds) {
    if (!this.window) return;

    const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
    const panelWidth = 380;
    const panelHeight = 520;
    const gap = 10;

    let x, y;

    // 计算最佳显示位置
    // 优先显示在悬浮球右侧
    if (ballBounds.x + ballBounds.width + gap + panelWidth < screenWidth) {
      x = ballBounds.x + ballBounds.width + gap;
    } else {
      // 否则显示在左侧
      x = ballBounds.x - panelWidth - gap;
    }

    // 垂直居中于悬浮球
    y = ballBounds.y + ballBounds.height / 2 - panelHeight / 2;
    
    // 确保不超出屏幕边界
    y = Math.max(10, Math.min(y, screenHeight - panelHeight - 10));
    x = Math.max(10, Math.min(x, screenWidth - panelWidth - 10));

    this.window.setPosition(Math.round(x), Math.round(y));
    this.window.show();
    this.window.focus();
    this.isVisible = true;
  }

  toggle(ballBounds) {
    if (this.isVisible) {
      this.hide();
    } else {
      this.showNearBall(ballBounds);
    }
  }

  show() {
    if (this.window) {
      this.window.show();
      this.window.focus();
      this.isVisible = true;
    }
  }

  hide() {
    if (this.window) {
      this.window.hide();
      this.isVisible = false;
    }
  }

  // 刷新书签列表
  refresh() {
    if (this.window) {
      this.window.webContents.send('bookmarks:refresh');
    }
  }
}

module.exports = BookmarkPanel;

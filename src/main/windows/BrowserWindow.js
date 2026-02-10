const { BrowserWindow } = require('electron');
const path = require('path');
const bookmarkStore = require('../store/bookmarkStore');

class BrowserWindowManager {
  constructor(options = {}) {
    this.window = null;
    this.isAlwaysOnTop = true;
    this.isTabletMode = false;
    this.floatingBall = options.floatingBall || null;
    this.createWindow();
  }

  /**
   * 确保悬浮球窗口可见（用于浏览器窗口关闭/隐藏后仍保留入口）
   */
  _ensureFloatingBallVisible() {
    if (this.floatingBall && typeof this.floatingBall.show === 'function') {
      try {
        this.floatingBall.show();
      } catch (e) {}
      if (typeof this.floatingBall.applyTopMostPolicy === 'function') {
        try {
          this.floatingBall.applyTopMostPolicy({ bumpZOrder: true });
        } catch (e) {}
      }
    }
  }

  createWindow() {
    const settings = bookmarkStore.getSettings();
    
    this.window = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 400,
      minHeight: 300,
      frame: false,
      resizable: false,
      alwaysOnTop: this.isAlwaysOnTop,
      show: false,
      transparent: false,
      opacity: settings.defaultOpacity || 1.0,
      webPreferences: {
        preload: path.join(__dirname, '../../preload/browser-window.js'),
        contextIsolation: true,
        nodeIntegration: false,
        webviewTag: true
      }
    });

    // 拦截新窗口创建
    this.window.webContents.setWindowOpenHandler(({ url }) => {
      // 在当前窗口中加载
      this.window.webContents.send('browser:loadUrl', url);
      return { action: 'deny' };
    });

    this.window.loadFile(path.join(__dirname, '../../renderer/browser-window/index.html'));

    this.window.on('closed', () => {
      this.window = null;
    });

    // 阻止窗口关闭，改为隐藏
    this.window.on('close', (event) => {
      if (this.window) {
        event.preventDefault();
        this.window.hide();
        this._ensureFloatingBallVisible();
      }
    });
  }

  // 打开URL
  openUrl(url) {
    if (!this.window) {
      this.createWindow();
    }
    
    this.window.webContents.send('browser:loadUrl', url);
    this.window.show();
    this.window.focus();
  }

  // 设置透明度
  setOpacity(value) {
    if (this.window) {
      const opacity = Math.max(0.3, Math.min(1.0, value));
      this.window.setOpacity(opacity);
      bookmarkStore.updateSettings({ defaultOpacity: opacity });
    }
  }

  // 获取当前透明度
  getOpacity() {
    if (this.window) {
      return this.window.getOpacity();
    }
    return 1.0;
  }

  // 切换置顶状态
  toggleAlwaysOnTop() {
    if (this.window) {
      this.isAlwaysOnTop = !this.isAlwaysOnTop;
      this.window.setAlwaysOnTop(this.isAlwaysOnTop);
      return this.isAlwaysOnTop;
    }
    return false;
  }

  // 设置置顶状态
  setAlwaysOnTop(flag) {
    if (this.window) {
      this.isAlwaysOnTop = flag;
      this.window.setAlwaysOnTop(flag);
    }
  }

  // 最小化到悬浮球
  minimize() {
    if (this.window) {
      this.window.hide();
      this._ensureFloatingBallVisible();
    }
  }

  show() {
    if (this.window) {
      this.window.show();
      this.window.focus();
    }
  }

  hide() {
    if (this.window) {
      this.window.hide();
      this._ensureFloatingBallVisible();
    }
  }
 
  // 是否可见
  isVisible() {
    return this.window ? this.window.isVisible() : false;
  }

  // 画中画模式
  enablePictureInPicture() {
    if (this.window) {
      this.window.setSize(500, 350);
      this.window.setOpacity(0.85);
      this.window.setAlwaysOnTop(true);
      this.isAlwaysOnTop = true;
    }
  }

  // 恢复正常模式
  disablePictureInPicture() {
    if (this.window) {
      this.window.setSize(1200, 800);
      this.window.setOpacity(1.0);
    }
  }

  // 最大化/还原
  toggleMaximize() {
    if (this.window) {
      if (this.window.isMaximized()) {
        this.window.setResizable(false);
        this.window.unmaximize();
        return false;
      } else {
        this.window.setResizable(true);
        this.window.maximize();
        return true;
      }
    }
    return false;
  }

  // 检查是否最大化
  isMaximized() {
    return this.window ? this.window.isMaximized() : false;
  }

  // 平板模式 (竖屏模式)
  toggleTabletMode() {
    if (this.window) {
      this.isTabletMode = !this.isTabletMode;
      if (this.isTabletMode) {
        // 平板模式：竖屏比例
        this.window.unmaximize();
        this.window.setSize(450, 800);
        this.window.center();
      } else {
        // 正常模式：横屏比例
        this.window.setSize(1200, 800);
        this.window.center();
      }
      return this.isTabletMode;
    }
    return false;
  }

  // 移动窗口
  moveBy(deltaX, deltaY) {
    if (this.window) {
      const b = this.window.getBounds();
      const w = this._lockedSize ? this._lockedSize.width : b.width;
      const h = this._lockedSize ? this._lockedSize.height : b.height;
      this.window.setBounds({ x: b.x + deltaX, y: b.y + deltaY, width: w, height: h }, true);
    }
  }
  
  lockSize() {
    if (this.window) {
      const b = this.window.getBounds();
      this._lockedSize = { width: b.width, height: b.height };
      this.window.setResizable(false);
      this.window.setBounds({ x: b.x, y: b.y, width: b.width, height: b.height }, true);
    }
  }
  
  unlockSize() {
    if (this.window) {
      this.window.setResizable(false);
      this._lockedSize = null;
    }
  }
 
}
 
module.exports = BrowserWindowManager;


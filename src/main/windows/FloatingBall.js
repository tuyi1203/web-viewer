const { BrowserWindow, screen, app } = require('electron');
const path = require('path');
const bookmarkStore = require('../store/bookmarkStore');

class FloatingBall {
  constructor() {
    this.window = null;
    this._topMostGuardTimer = null;
    this._lastBumpAt = 0;
    this.createWindow();
  }

  /**
   * 应用“始终置顶”的策略，尽量确保悬浮球不会被应用内浏览器窗口遮挡
   */
  applyTopMostPolicy({ bumpZOrder = false } = {}) {
    if (!this.window) return;
    if (this.window.isDestroyed && this.window.isDestroyed()) return;
    try {
      this.window.setAlwaysOnTop(true, 'screen-saver', 1);
    } catch (e) {
      try {
        this.window.setAlwaysOnTop(true);
      } catch (e2) {}
    }
    try {
      this.window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    } catch (e) {}
    try {
      this.window.setFullScreenable(false);
    } catch (e) {}
    if (bumpZOrder) {
      const now = Date.now();
      if (now - this._lastBumpAt >= 800) {
        this._lastBumpAt = now;
        try {
          this.window.setAlwaysOnTop(false);
        } catch (e) {}
        try {
          this.window.setAlwaysOnTop(true, 'screen-saver', 1);
        } catch (e) {}
        try {
          this.window.moveTop();
        } catch (e) {}
      }
    }
  }

  _startTopMostGuard() {
    if (this._topMostGuardTimer) return;
    this._topMostGuardTimer = setInterval(() => {
      if (!this.window) return;
      if (this.window.isDestroyed && this.window.isDestroyed()) return;
      this.applyTopMostPolicy();
      if (this.window.isVisible && this.window.isVisible()) {
        this.applyTopMostPolicy({ bumpZOrder: true });
      }
    }, 700);
  }

  _stopTopMostGuard() {
    if (!this._topMostGuardTimer) return;
    clearInterval(this._topMostGuardTimer);
    this._topMostGuardTimer = null;
  }

  createWindow() {
    // 获取保存的位置
    const savedPosition = bookmarkStore.getSettings().floatingBallPosition || { x: 100, y: 100 };
    
    // 获取屏幕尺寸
    const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
    
    // 确保位置在屏幕范围内
    const x = Math.min(Math.max(0, savedPosition.x), screenWidth - 80);
    const y = Math.min(Math.max(0, savedPosition.y), screenHeight - 80);

    this.window = new BrowserWindow({
      width: 80,
      height: 80,
      x,
      y,
      title: '\u200B',
      transparent: true,
      frame: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      hasShadow: false,
      focusable: true,
      show: true,
      webPreferences: {
        preload: path.join(__dirname, '../../preload/floating-ball.js'),
        contextIsolation: true,
        nodeIntegration: false
      }
    });

    this.window.loadFile(path.join(__dirname, '../../renderer/floating-ball/index.html'));
    
    // 设置窗口为工具窗口（不显示在任务栏）
    this.window.setSkipTaskbar(true);
    this.applyTopMostPolicy();
    this._startTopMostGuard();

    this.window.on('show', () => {
      this.applyTopMostPolicy({ bumpZOrder: true });
    });

    this.window.on('focus', () => {
      this.applyTopMostPolicy({ bumpZOrder: true });
    });

    this.window.on('blur', () => {
      this.applyTopMostPolicy({ bumpZOrder: true });
    });
    
    // 监听窗口关闭 - 不要让窗口真正关闭
    this.window.on('close', (event) => {
      if (app.isQuitting) return;
      event.preventDefault();
      this.window.hide();
    });

    this.window.on('closed', () => {
      this._stopTopMostGuard();
      this.window = null;
    });
  }

  // 更新位置并保存
  updatePosition(x, y) {
    if (this.window) {
      // 获取屏幕尺寸进行边界检测
      const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
      
      // 限制在屏幕范围内
      const boundedX = Math.min(Math.max(0, x), screenWidth - 80);
      const boundedY = Math.min(Math.max(0, y), screenHeight - 80);
      
      this.window.setPosition(boundedX, boundedY);
      
      // 保存位置
      bookmarkStore.updateSettings({ floatingBallPosition: { x: boundedX, y: boundedY } });
    }
  }

  // 增量移动
  moveBy(deltaX, deltaY) {
    if (this.window) {
      const [currentX, currentY] = this.window.getPosition();
      const newX = currentX + deltaX;
      const newY = currentY + deltaY;
      
      // 获取屏幕尺寸进行边界检测
      const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
      
      // 限制在屏幕范围内
      const boundedX = Math.min(Math.max(0, newX), screenWidth - 80);
      const boundedY = Math.min(Math.max(0, newY), screenHeight - 80);
      
      this.window.setPosition(boundedX, boundedY);
      
      // 保存位置
      bookmarkStore.updateSettings({ floatingBallPosition: { x: boundedX, y: boundedY } });
    }
  }

  // 获取当前位置
  getPosition() {
    if (this.window) {
      return this.window.getPosition();
    }
    return [0, 0];
  }

  // 获取窗口边界
  getBounds() {
    if (this.window) {
      return this.window.getBounds();
    }
    return { x: 0, y: 0, width: 80, height: 80 };
  }

  show() {
    if (this.window) {
      this.applyTopMostPolicy({ bumpZOrder: true });
      try {
        this.window.showInactive();
      } catch (e) {
        this.window.show();
      }
    }
  }

  hide() {
    if (this.window) {
      this.window.hide();
    }
  }
}

module.exports = FloatingBall;

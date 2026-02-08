# 悬浮网页收藏夹（Web Viewer）

一个精美的 Windows 桌面应用，基于 Electron 实现悬浮球 + 收藏面板 + 内置浏览器窗口的高效网页访问体验。

## 特性
- 悬浮球随处拖动、右键快速退出
- 收藏面板按文件夹分组、搜索、拖拽排序（SortableJS）
- 内置浏览器窗口：标签页、地址栏、前进后退、刷新
- 透明度调节、窗口置顶切换
- 平板模式（竖屏尺寸）与画中画模式（小窗置顶）
- 本地持久化：书签与设置通过 electron-store 保存

## 环境要求
- Windows 11
- Node.js 16+（建议安装最新版 LTS）

## 快速开始

```bash
# 安装依赖（国内网络已配置 mirror，加速 Electron 依赖下载）
npm install

# 开发运行
npm run start
# 或带调试端口运行
npm run dev
```

## 构建发布

```bash
# 构建安装包（NSIS）
npm run build

# 构建便携版（Portable）
npm run build:portable

# 构建全部
npm run build:all
```

构建配置详见 electron-builder.json，产物输出到 `dist/` 目录。

## 使用说明
- 悬浮球
  - 左键拖动移动位置，点击打开/关闭收藏面板
  - 右键打开应用菜单（包含退出）
- 收藏面板
  - 支持新建文件夹与书签，搜索过滤，拖拽排序
  - 点击书签在浏览器窗口中打开，并自动隐藏面板
- 浏览器窗口
  - 标题栏包含标签页、窗口控制（最小化/最大化/关闭）、模式切换（平板/画中画）
  - 工具栏包含地址栏、前进/后退/刷新、透明度滑块与置顶开关
  - 支持通过标题栏拖动移动整个窗口

## 目录结构
```
src/
  main/                 # 主进程：入口、窗口与 IPC
    windows/            # 悬浮球 / 收藏面板 / 浏览器窗口
    store/              # electron-store 存储模块
    ipc/                # 所有 IPC 事件注册
  preload/              # 预加载脚本，暴露安全的 window.api
  renderer/             # 三个渲染页面的 UI 与逻辑
    floating-ball/
    bookmark-panel/
    browser-window/
```

## 关键技术
- Electron（主进程 + 渲染进程 + preload）
- electron-store（数据持久化）
- SortableJS（书签拖拽排序）

## 配置说明
- `.npmrc` 已配置国内镜像源（npmmirror），加速 Electron 与 builder 相关依赖下载
- `package.json` 中提供 `start / dev / build` 等脚本，主进程入口为 `src/main/index.js`

## 许可协议
本项目遵循 MIT 许可协议，详见 LICENSE。

## 贡献
- 提交 PR 或 Issue 时，请尽量描述清楚问题/改动范围与复现步骤
- 欢迎完善 UI、交互与更多效率工具（如书签导入、快捷键等）


# 🎵 NetEase Playlist AI Organizer

> **智能歌单分类助手** - 让 AI 帮你整理杂乱的网易云音乐歌单。

![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)
![React](https://img.shields.io/badge/React-18-61DAFB.svg?logo=react&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC.svg?logo=tailwind-css&logoColor=white)

## ✨ 功能亮点

### 🤖 AI 智能分类
告别手动整理！利用先进的 AI 模型，自动分析歌单中的每一首歌，将其按**情绪、曲风、语种或场景**进行多维度分类。

### 🚀 多种导入方式
- **扫码/手机号登录**：直接获取你的网易云歌单列表。
- **Cookie 导入**：支持手动输入 Cookie，解决海外或网络限制问题。
- **链接解析**：直接粘贴歌单链接即可开始分析。

### 📋 零门槛导出 (无需登录)
担心账号安全或网络问题？没关系！
- **一键复制文本**：AI 分类完成后，点击复制图标，即可获得标准格式的歌曲列表。
- **网易云文本导入**：直接在网易云音乐 App/电脑端使用“导入外部歌单” -> “文本导入”功能，秒变新歌单。
- **跨平台迁移**：复制的文本可配合 TuneMyMusic 等工具，轻松迁移至 Spotify 或 Apple Music。

### 💾 本地备份
- **CSV 导出**：支持将分类结果下载为 CSV 表格，方便在 Excel 中查看或进行二次整理。

## 🛠️ 技术栈

- **Frontend**: React, TypeScript, Vite
- **Styling**: Tailwind CSS, Framer Motion (Animations)
- **Icons**: Lucide React
- **AI**: Google Gemini API

## 📖 使用指南

1. **输入歌单**：登录账号选择歌单，或直接粘贴网易云歌单链接。
2. **AI 分析**：点击“开始 AI 分类”，稍等片刻，AI 将自动完成整理。
3. **导出结果**：
    - **方式 A (推荐)**：点击卡片右侧的“复制”图标，去网易云使用“文本导入”。
    - **方式 B**：点击“导出到网易云”按钮（需登录）。
    - **方式 C**：下载 CSV 文件保存到本地。

---

*Made with ❤️ for music lovers.*

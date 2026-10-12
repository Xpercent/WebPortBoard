# WebPortBoard · 本地项目运行看板

把常跑的本地 Web 项目收成一块看板：每个项目一张卡片，点开就在看板里直接跑起来。

## 功能

- **卡片看板**：应用名称、备注、启动命令首行 + 剩余行数，标识色首字母头像，明暗主题一键切换
- **卡片预览**：可选「不显示」「实时页面」「自定义图」（上传本地图片，自动压成 ≤720px 的 WebP data URL）
- **增删改**：弹窗表单配置应用，删除有二次确认
- **点开即跑**：填了访问地址的应用在看板内以内嵌页面运行，支持重新加载、新窗口打开；打开过的应用保持挂载，返回看板不会重新加载
- **实时页面卡片**：卡片里直接加载应用页面，缩略和全屏共用同一个页面实例，点开只是把它放大，不重新加载（需要应用允许被内嵌，被 `X-Frame-Options` / CSP 拦住的站点请用「自定义图」）
- **启动命令**：未配置访问地址时展示命令，一键复制到剪贴板
- **随面板自动启动**：记住哪些应用需要跟着面板一起启动，并在看板上标注

> 看板本身不执行命令，也不会替你拉起进程 —— 它负责记录、展示和内嵌访问，命令请复制到自己的终端里跑。

## 快速开始

```bash
npm install
npm run dev
```

打开 <http://localhost:5180>（`strictPort`，端口被占用时不会自动换端口）。

首次使用看板是空的，点「添加应用」填第一个项目即可。

## 脚本

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动开发服务器（5180），带配置读写接口 |
| `npm run build` | 类型检查 + 产出静态包 |
| `npm run typecheck` | 仅类型检查 |
| `npm run preview` | 预览构建产物 |

## 配置存储

应用列表存在项目根目录的 `config.json`，而不是浏览器 localStorage —— 换浏览器、换机器打开的都是同一块看板。

读写走 `vite.config.ts` 里 `configStore` 插件挂的 `/__config` 接口（GET 读、PUT 写），因此**只有在 `npm run dev` 下才会落盘**。静态部署没有这个接口时，看板自动退回浏览器本地缓存，顶栏会显示当前存储来源。

该文件含本机绝对路径，已在 `.gitignore` 中，不会进版本库。字段结构：

```jsonc
{
  "apps": [
    {
      "id": "b2b6ef69-...",        // crypto.randomUUID()
      "name": "Conversation Starter",
      "command": "cd /d E:\\path\nnpm run dev",
      "url": "http://localhost:5173", // 可留空，留空则只展示启动命令
      "description": "纯前端，依赖已装。",
      "autoStart": true,
      "accent": "violet",          // indigo | violet | sky | emerald | amber | rose
      "preview": "image",          // none | live | image
      "previewImage": "data:image/webp;base64,...",
      "createdAt": 1791725442896
    }
  ]
}
```

读取时会逐字段校验，缺字段或值不合法会回落到默认值，手写这个文件也不会把看板搞崩。

## 技术栈

Vite 6 · React 18 · TypeScript 5 · Tailwind CSS 4（`@tailwindcss/vite`）· Radix UI（Dialog / Label / Switch）· lucide-react

## 目录结构

```
src/
├── App.tsx                  看板与运行视图切换、顶栏操作
├── types.ts                 AppEntry / 标识色 / 预览模式
├── components/
│   ├── app-card.tsx         看板卡片
│   ├── app-form-dialog.tsx  新增与编辑表单
│   ├── app-runner.tsx       点开应用后的运行视图（含共用 iframe）
│   ├── app-live-preview.tsx 实时预览：卡片缩略与全屏共用一个页面实例
│   ├── app-avatar.tsx       标识色首字母头像
│   └── ui/                  button / card / dialog / field / pill
└── lib/
    ├── use-apps.ts          配置读写与字段校验
    ├── preview-image.ts     预览图压缩
    ├── use-theme.ts         明暗主题
    └── utils.ts             className 合并
```

## 已知限制

- 内嵌页面能否显示取决于目标站点自己的 `X-Frame-Options` / CSP；本地 dev server 一般允许，外部站点常被拦成空白。
- 预览图以 data URL 存在配置里，`localStorage` 有容量上限，图太大时缓存可能写不进去（文件仍是权威来源）。
- 主题和看板数据分开存：主题在 `localStorage`，应用列表优先在配置文件。

# WebPortBoard · 本地项目运行看板

把常跑的本地 Web 项目收成一块看板：每个项目一张卡片，点开就在看板里直接跑起来。

## 功能

- **卡片看板**：应用名称、备注与进程状态，标识色首字母头像，明暗主题一键切换
- **卡片预览**：可选「不显示」「实时页面」「自定义图」（上传本地图片，自动压成 ≤720px 的 WebP data URL）
- **增删改**：弹窗表单配置应用，删除有二次确认
- **点开即跑**：填了访问地址的应用在看板内以内嵌页面运行，支持重新加载、新窗口打开；打开过的应用保持挂载，返回看板不会重新加载
- **实时页面卡片**：卡片里直接加载应用页面，缩略和全屏共用同一个页面实例，点开只是把它放大，不重新加载（需要应用允许被内嵌，被 `X-Frame-Options` / CSP 拦住的站点请用「自定义图」）
- **启动命令**：未配置访问地址时展示命令，一键复制到剪贴板
- **随面板自动启动**：勾上这项的应用，面板起来时直接用它的启动命令拉起进程，卡片实时显示启动中 / 运行中 / 已在运行 / 启动失败，面板退出时一并收掉

> 自动启动只在 `npm run dev` 下生效：进程由 dev server 那侧的 Node 执行（见下方「自动启动」）。静态部署没有这个进程，看板退回记录、展示和内嵌访问，命令照样可以复制到终端里跑。

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
| `npm run dev` | 启动开发服务器（5180），带配置读写与自动启动接口 |
| `npm run build` | 类型检查 + 产出静态包 |
| `npm run typecheck` | 仅类型检查 |
| `npm run preview` | 预览构建产物 |

## 配置存储

应用列表存在项目根目录的 `config.json`，而不是浏览器 localStorage —— 换浏览器、换机器打开的都是同一块看板。

读写走 `vite.config.ts` 里 `configStore` 插件挂的 `/__config` 接口（GET 读、PUT 写），因此**只有在 `npm run dev` 下才会落盘**。静态部署没有这个接口时，看板自动退回浏览器本地缓存。

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
      "autoStart": true,           // 面板启动时用 command 拉起进程
      "accent": "violet",          // indigo | violet | sky | emerald | amber | rose
      "preview": "image",          // none | live | image
      "previewImage": "data:image/webp;base64,...",
      "createdAt": 1791725442896
    }
  ]
}
```

读取时会逐字段校验，缺字段或值不合法会回落到默认值，手写这个文件也不会把看板搞崩。

## 自动启动

`autoStart` 的应用由根目录的 `auto-start.ts` 在 Node 侧执行，面板这边只有一个只读接口：

- **什么时候启动**：dev server 监听成功后按 `config.json` 拉起第一批；之后每次保存配置都重新对齐一次——新勾选的立即启动，取消勾选或被删除的立即收掉，改了启动命令的换新命令重开。
- **命令怎么执行**：交给系统 shell（Windows 是 `cmd.exe`）。多行命令按顺序串成一条，前一步失败就不会带着错误的目录继续跑，所以 `cd /d 路径` + `npm run dev` 这种写法可以放心用。
- **状态怎么判定**：填了访问地址的先探测这个地址——已经有服务在听就认作「已在运行」，不再重复拉一个去撞端口；自己拉起的则等地址通了才报「运行中」，探测间隔 1.5 秒。没填地址的应用进程起来就算「运行中」。
- **失败原因**：标准输出与错误输出的末尾 12 行会随状态一起返回，鼠标停在卡片的「启动失败 / 已退出」徽标上就能看到（Windows 下 cmd 的 GBK 报错也能正常显示）。
- **什么时候收掉**：`cmd.exe`/`sh` 下面挂的 `npm`、`node` 都是子进程，退出面板时按整棵进程树结束（Windows 用 `taskkill /T /F`，其他系统按进程组发信号）。

## 技术栈

Vite 6 · React 18 · TypeScript 5 · Tailwind CSS 4（`@tailwindcss/vite`）· Radix UI（Dialog / Label / Switch）· lucide-react

## 目录结构

```
auto-start.ts                自动启动运行器：拉起/收掉子进程、探测地址、状态接口
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
    ├── use-auto-start.ts    轮询进程状态
    ├── preview-image.ts     预览图压缩
    ├── use-theme.ts         明暗主题
    └── utils.ts             className 合并
```

## 已知限制

- 内嵌页面能否显示取决于目标站点自己的 `X-Frame-Options` / CSP；本地 dev server 一般允许，外部站点常被拦成空白。
- 预览图以 data URL 存在配置里，`localStorage` 有容量上限，图太大时缓存可能写不进去（文件仍是权威来源）。
- 主题和看板数据分开存：主题在 `localStorage`，应用列表优先在配置文件。
- 自动启动的应用退出后不会自己重试（改一下启动命令再保存才会重开），面板被强制结束、来不及走退出流程时，它拉起的进程可能留在后台——下次面板起来会把这个端口认成「已在运行」。

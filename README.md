# 监视者日志 / OVERSEER.LOG

Astro 7 + TypeScript 的 Homelab 技术博客。文章使用 Markdown，构建为静态文件。

## 本地开发

```bash
npm ci
npm run dev -- --background
npm run check
npm run build
npm run check-links
```

开发服务器默认在 `http://localhost:4321`。

## 文章

文章放在 `src/content/posts/*.md`，frontmatter 示例：

```yaml
---
title: 文章标题
description: 列表和 SEO 描述
pubDate: 2026-10-28
tags: [Cloudflare, Tunnel]
minutes: 8
draft: false
summary: 文章开头摘要
---
```

- `draft: true` 不会生成页面，也不会出现在归档、标签、RSS 和 sitemap。
- 删除 Markdown 文件即可删除文章。
- 首页、归档、标签、RSS、sitemap 和上一篇/下一篇都自动生成。

## 构建与发布

```text
push main
  -> GitHub Actions：npm ci / astro check / build / link check
  -> 更新 GitHub release 资产：site.tar.gz + sha.txt
  -> Alpine 每 2 分钟拉取 release 资产
  -> /var/www/blog/releases/<sha>/
  -> 切换 /var/www/blog/current 软链
  -> nginx 立即生效
```

- 仓库：`git@github.com:zycbhb/blog.git`（public）
- Actions：`.github/workflows/deploy.yml`
- release 标签：`deploy`
- Alpine 拉取脚本：`/home/deploy/bin/deploy-blog.sh`
- 服务器 release 目录：`/var/www/blog/releases/`
- 当前版本软链：`/var/www/blog/current`
- 旧静态站备份：`/var/www/blog.zycbhb.top/`
- EdgeOne / Cloudflare Tunnel / 证书不在这个仓库里管理

## 回滚

保留最近 5 个 release。把软链切回上一个 release 即可：

```sh
ssh root@ssh.zycbhb.top
ln -sfn releases/<旧版本> /var/www/blog/current
```

如果需要回到最初的静态站，把 nginx 的 blog root 改回
`/var/www/blog.zycbhb.top` 并 reload。

## 注意

- HTML 使用 `Cache-Control: no-cache`，文章内容更新后无需刷新 EdgeOne。
- CSS/JS 使用 Astro 的哈希文件名；旧文件可以保留在 release 里。
- 源站鉴权仍由 nginx 的 `X-Origin-Token` 负责，和本仓库无关。

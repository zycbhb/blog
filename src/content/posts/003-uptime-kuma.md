---
title: Uptime Kuma + QQ 邮件：一套够用的自托管告警
description: 监控不一定要买服务。一个 Docker 容器、几个 HTTP/TCP 检查、一个能发信的邮箱， 再加上一条只在需要时打开的 SSH 隧道，就足够看住两台小服务器。
pubDate: 2026-10-21
tags:
  - 监控
  - Docker
  - 自托管
minutes: 7
draft: false
summary: 监控不一定要买服务。一个 Docker 容器、几个 HTTP/TCP 检查、一个能发信的邮箱， 再加上一条只在需要时打开的 SSH 隧道，就足够看住两台小服务器。
---

## 00 / 为什么自己跑

外部监控服务的好处是「不在同一台机器上」，坏处是要把内部地址暴露给它，或者依赖它的网络。 对我来说，更合适的组合是：监控机放在旧服务器上，离服务足够近；面板只监听回环， 需要看的时候再用 SSH 隧道进去。

这样做的代价是：如果旧服务器整个挂了，监控也会一起消失。所以它适合看「服务是否还活着」， 不适合当作唯一的异地可用性证明。

## 01 / 起一个只监听回环的容器

用 Docker 跑 Uptime Kuma，把端口绑在 `127.0.0.1`，数据放在命名卷里：

```shell title="SHELL / DOCKER"
docker run -d \
  --name uptime-kuma \
  --restart unless-stopped \
  -p 127.0.0.1:3001:3001 \
  -v uptime-kuma:/app/data \
  louislam/uptime-kuma:1
```

注意 `-p 127.0.0.1:3001:3001`，不要写成 `-p 3001:3001`。 前者只允许本机访问，后者会监听所有网卡，等于把管理后台暴露到局域网甚至公网。

## 02 / 监控项怎么选

第一版不需要太多指标，覆盖「入口、源站、内网服务」三类就够：

-   **HTTP：**网站首页，检查状态码和证书剩余天数；
-   **TCP：**SSH 端口、隧道端口、内网服务端口；
-   **Push：**给无法被主动访问的服务留一个心跳入口。

检查间隔不用太激进。30 到 60 秒一次已经能覆盖大多数故障，频率太高只会让日志和告警更吵。

## 03 / 邮件通知

Uptime Kuma 支持 SMTP。以 QQ 邮箱为例，需要先在邮箱设置里开启 SMTP 服务并生成授权码， 然后在通知里填写：

-   SMTP 主机：`smtp.qq.com`
-   端口：`465`，启用 SSL
-   用户名：完整邮箱地址
-   密码：邮箱授权码，不是登录密码

<div class="callout"><b>不要把授权码写进文章或仓库。</b><br>它只应该保存在 Uptime Kuma 的数据库里。如果曾经出现在聊天记录或截图中， 去邮箱后台重新生成一个，旧的会立即失效。</div>

建好通知后，点一次「测试」确认能收到信，再把通知绑定到具体监控项。 否则很容易出现「监控显示正常，但从来没收到过告警」的假安全感。

## 04 / 面板只走 SSH 隧道

管理后台不需要公网域名。需要查看时，在本机开一条本地转发：

```powershell title="POWERSHELL / WINDOWS"
ssh -N -L 3001:127.0.0.1:3001 -p 9321 user@monitor.example.com
```

然后浏览器访问 `http://127.0.0.1:3001`。关掉终端，入口就消失了。

## 05 / 备份与升级

数据都在 Docker 卷里。升级前先备份，迁移时整卷带走：

```shell title="SHELL / DOCKER"
docker stop uptime-kuma
docker run --rm -v uptime-kuma:/data -v "$PWD":/backup \
  alpine tar czf /backup/uptime-kuma-backup.tar.gz -C /data .

docker start uptime-kuma
```

不要删除这个卷，也不要随手执行会清理未使用卷的 `docker volume prune`。 监控历史、通知配置和管理员密码都在里面。

## 06 / 它的局限

监控机看不见另一台服务器的 `127.0.0.1`，也不能监控自己所在机器之外的本地回环服务。 如果一定要覆盖，需要让服务监听内网地址、加一个 push 心跳，或者在目标机器上再放一个探针。

这套方案不追求大而全，只追求「出事时手机能响」。对一个人的 Homelab 来说，够用了。

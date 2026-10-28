---
title: 从零搭建 Cloudflare Tunnel：把家里的小服务器安全地挂上网
description: 没有公网 IP、没有开放入站 443，也可以让一台 2GB 的 Alpine 小机器拥有稳定的 HTTPS 站点。 这条链路的关键不是端口映射，而是一条从内网主动向外建立的隧道。
pubDate: 2026-10-27
tags:
  - Cloudflare
  - Tunnel
  - nginx
minutes: 12
draft: false
summary: 没有公网 IP、没有开放入站 443，也可以让一台 2GB 的 Alpine 小机器拥有稳定的 HTTPS 站点。 这条链路的关键不是端口映射，而是一条从内网主动向外建立的隧道。
---

## 00 / 为什么不直接端口映射

最直觉的做法是：路由器上把 443 转发到服务器，DNS 指向公网 IP。 但家用宽带通常没有固定 IPv4，部分运营商还会封掉 80/443 入站； 而 IPv6 前缀又会周期性变化。每次地址一变，DNS、证书、防火墙都要跟着修。

Cloudflare Tunnel 把方向反了过来：由服务器主动向 Cloudflare 边缘建立长连接， 外部请求先到 Cloudflare，再顺着这条连接回到源站。 源站不需要监听公网端口，也不需要知道自己的公网地址。

## 01 / 准备的东西

-   一个托管在 Cloudflare 的域名，NS 已经生效；
-   一台能出网的 Linux 服务器，这里用 Alpine；
-   本机已经安装 `cloudflared`；
-   源站有一个可用的本地 HTTP 服务，例如 nginx。

先确认域名确实由 Cloudflare 解析。如果 `dig NS` 还返回旧服务商， 后面的授权和 CNAME 都会出问题。

## 02 / 创建隧道

在服务器上登录 Cloudflare 账号，创建一条命名隧道，并让 Cloudflare 自动写入 DNS：

```shell title="SHELL / ALPINE"
cloudflared tunnel login
cloudflared tunnel create blog-alpine
cloudflared tunnel route dns blog-alpine blog.example.com

# 记下输出里的 Tunnel ID，稍后写进配置
cloudflared tunnel list
```

登录会生成 `cert.pem`，创建隧道会生成同名的凭据 JSON。 两者都放在 `~/.cloudflared/` 下，权限应当只有 root 可读。

## 03 / 写 ingress 配置

新建 `/etc/cloudflared/config.yml`。ingress 的顺序很重要： 匹配到的 hostname 走对应服务，最后一条兜底返回 404。

```yaml title="YAML / /etc/cloudflared/config.yml"
tunnel: <TUNNEL_ID>
credentials-file: /root/.cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: blog.example.com
    service: https://127.0.0.1:8443
    originRequest:
      noTLSVerify: true
  - service: http_status:404
```

<div class="callout"><b>为什么要 noTLSVerify？</b><br>这里回源仍然走 HTTPS，但证书是源站自签或 Let's Encrypt 的域名证书。 cloudflared 到源站是本机回环，开启 <code>noTLSVerify</code> 可以避免证书链校验失败。 如果你回源用 <code>http://127.0.0.1:8080</code>，就不需要这一项。</div>

## 04 / 让 nginx 接住流量

源站 nginx 只监听回环的 8443，公网 443 依然关闭。 这样即使有人扫到服务器 IP，也进不来。

```nginx title="NGINX / /etc/nginx/http.d/blog.conf"
server {
    listen 127.0.0.1:8443 ssl;
    server_name blog.example.com;

    ssl_certificate     /etc/nginx/ssl/blog.example.com.crt;
    ssl_certificate_key /etc/nginx/ssl/blog.example.com.key;

    root /var/www/blog;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }
}
```

改完配置先 `nginx -t`，再 `rc-service nginx reload`。 不要直接 restart，避免把正在服务的连接全部掐断。

## 05 / 把它变成服务

OpenRC 下用 `supervise-daemon` 守护 cloudflared， 进程退出后会自动拉起，服务器重启也能自己回来。

```shell title="SHELL / OPENRC"
rc-service cloudflared start
rc-update add cloudflared default

# 看状态和日志
rc-service cloudflared status
tail -f /var/log/cloudflared.err
```

## 06 / 验证链路

从外部机器依次验证 DNS、边缘和源站，出问题时能快速定位是哪一段断了：

```powershell title="POWERSHELL / WINDOWS"
Resolve-DnsName blog.example.com -Server 1.1.1.1
Test-NetConnection blog.example.com -Port 443
curl.exe --noproxy "*" -I https://blog.example.com/
```

在服务器本地则可以直接绕过 Cloudflare，单独确认 nginx：

```shell title="SHELL / ALPINE"
curl -k -I https://127.0.0.1:8443/
rc-service cloudflared status
cloudflared tunnel info blog-alpine
```

## 07 / 踩过的坑

-   **DNS 还是旧的：**本地缓存可能还指向迁移前的记录，换 `1.1.1.1` 再查一次；
-   **Tunnel 显示活跃但 502：**基本都是源站端口写错，或者 nginx 只监听了 443；
-   **证书续期失败：**如果用了 DNS-01，检查 acme.sh 配置里的 API Token 是否还有效；
-   **把监控页也挂上去：**不要。管理面板应该留在 SSH 隧道里，公网只放该公开的东西。

> 隧道解决的是「怎么让外部访问到」，不解决「该不该公开」。 每加一条 ingress，都先问一遍：这个页面真的需要公网吗？

到这一步，网站已经可以通过 Cloudflare 的 443 访问，源站入站端口保持关闭。 后面要做的，是把证书续期、日志轮转和监控告警补齐，让它能安静地跑很久。

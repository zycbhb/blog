---
title: Alpine 2GB 小机器上的服务编排
description: 2GB 内存不算宽裕，但也足够跑一个静态站、一个 Java 进程、一条隧道和一个小代理。 关键不是把服务都塞进去，而是知道每个进程能拿多少内存，以及挂了之后谁来把它拉起来。
pubDate: 2026-10-24
tags:
  - Alpine
  - nginx
  - mihomo
minutes: 9
draft: false
summary: 2GB 内存不算宽裕，但也足够跑一个静态站、一个 Java 进程、一条隧道和一个小代理。 关键不是把服务都塞进去，而是知道每个进程能拿多少内存，以及挂了之后谁来把它拉起来。
---

## 00 / 先把资源看清楚

在加任何服务之前，先记录一次空闲状态。后面每加一个进程，都拿它和这张基线对比：

```shell title="SHELL / ALPINE"
free -m
df -h /
rc-status
ss -tlnp
```

Alpine 本身很轻，真正吃内存的通常是 JVM、数据库和容器运行时。 如果机器只有 2GB，最好只保留一个 JVM，并且给它明确的内存上限。

## 01 / 用 OpenRC 看住进程

Alpine 默认使用 OpenRC。比起写一个长长的启动脚本，更省事的做法是让 `supervise-daemon` 负责拉起进程：进程退出后自动重启，服务器重启也会自己回来。

```shell title="OPENRC / /etc/init.d/notes-api"
#!/sbin/openrc-run
name="notes-api"
command="/usr/bin/java"
command_args="-Xmx256m -jar /opt/notes/notes.jar"
command_user="notes"
supervisor="supervise-daemon"
respawn_delay=5
output_log="/var/log/notes/app.log"
error_log="/var/log/notes/err.log"
```

```shell title="SHELL / ALPINE"
chmod +x /etc/init.d/notes-api
rc-service notes-api start
rc-update add notes-api default
```

注意 `command_user`：除了 nginx 和系统级网络工具，业务进程不应该以 root 运行。 单独建一个用户，把应用目录和日志目录的权限收紧，能省掉很多后患。

## 02 / nginx 只监听回环

源站不需要对公网开放 443。让 nginx 只监听 `127.0.0.1:8443`， 外部流量通过 Cloudflare Tunnel 进来，端口扫描就看不到它。

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

改完先 `nginx -t`，再 `rc-service nginx reload`。 直接 restart 会把正在传输的请求掐断，reload 更稳。

## 03 / 给 JVM 一个明确的天花板

JVM 默认会按机器内存推算堆大小，在 2GB 的机器上很容易把系统逼到 OOM。 把它限制在 256MB 左右，再观察一段时间的实际占用：

```shell title="SHELL / ALPINE"
java -Xmx256m -Xss512k -jar /opt/notes/notes.jar
ps -o pid,rss,comm -C java
dmesg | grep -i oom
```

<div class="callout"><b>经验值：</b>2GB 机器上，JVM 堆不要超过 512MB。给 nginx、mihomo、cloudflared 和系统缓存留出空间，比让单个服务跑得更快重要。</div>

## 04 / mihomo 与隧道共存

如果机器同时跑 mihomo 的 TUN 和 Cloudflare Tunnel，最容易出问题的是路由： TUN 可能接管所有流量，把隧道自己的出站连接也带进去。 两个直接规则可以避免绕路：

```yaml title="YAML / mihomo"
ipv6: false

rules:
  - DOMAIN-SUFFIX,argotunnel.com,DIRECT
  - DOMAIN-SUFFIX,trycloudflare.com,DIRECT
```

关闭 `ipv6` 是为了保护服务器的公网 IPv6 SSH：TUN 一旦接管 IPv6 默认路由， 远程连接可能直接断掉，而且不会再给你一次改配置的机会。

## 05 / 巡检与日志

把所有关键服务放在一条命令里检查，比出事之后逐个猜要快得多：

```shell title="SHELL / ALPINE"
rc-service nginx status
rc-service cloudflared status
rc-service mihomo status
rc-service notes-api status

tail -50 /var/log/cloudflared.err
tail -50 /var/log/notes/err.log
ss -tlnp | grep -E ':(8443|18080|7890|9090)\b'
```

## 06 / 小结

小机器的核心原则是「每个进程都有边界」：内存有上限、端口只开必要的、日志有地方落、 挂了有人拉起。做到这四点，2GB 也能安静地跑很久。

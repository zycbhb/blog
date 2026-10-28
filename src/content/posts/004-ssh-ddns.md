---
title: 动态 IPv6 下的 SSH DDNS 实践
description: 运营商给的是会变的前缀，而 SSH 需要一个稳定的名字。 用一个一分钟一次的 cron、一条最小的 DNS 权限和一个只改 AAAA 的脚本， 就能把入口钉在域名上。
pubDate: 2026-10-18
tags:
  - DNS
  - IPv6
  - Cloudflare
minutes: 6
draft: false
summary: 运营商给的是会变的前缀，而 SSH 需要一个稳定的名字。 用一个一分钟一次的 cron、一条最小的 DNS 权限和一个只改 AAAA 的脚本， 就能把入口钉在域名上。
---

## 00 / 问题在哪

家用宽带的 IPv4 通常不是固定的，IPv6 前缀也会在一段时间后变化。 如果直接把地址写进 SSH 客户端配置，前缀一变就得去路由器或 VPS 控制台查新地址。 更麻烦的是：你往往是在连不上的时候才发现它变了。

目标很简单：让 `ssh.example.com` 始终指向当前机器的全局 IPv6， 客户端只记域名，不记地址。

## 01 / 记录类型与代理状态

SSH 不是 HTTP，不能走 Cloudflare 的七层代理。因此这条记录必须是 **AAAA + DNS only（灰云）**，让客户端直接连到源站地址。

-   类型：AAAA
-   名称：`ssh.example.com`
-   TTL：60 秒
-   代理：关闭（DNS only）

如果开了橙云，Cloudflare 只会代理特定端口，SSH 连接会直接失败； 而且 DNS 返回的也不是你的服务器地址。

## 02 / 准备一个最小权限的 Token

在 Cloudflare 后台创建一个 API Token，权限只给 **Zone → DNS → Edit**，范围只限这个域名。不要用全局 API Key。

Token 和 Zone ID 放在一个只有 root 可读的环境文件里：

```shell title="SHELL / /etc/cloudflare/ssh-dns.env"
CF_API_TOKEN=your-scoped-token
CF_ZONE_ID=your-zone-id
SSH_HOST=ssh.example.com
IFACE=eth0
```

```shell title="SHELL / ALPINE"
chmod 600 /etc/cloudflare/ssh-dns.env
chown root:root /etc/cloudflare/ssh-dns.env
```

## 03 / 更新脚本

脚本只做三件事：读当前 IPv6、读 DNS 里的旧值、不同才更新。 这样既能避免无意义的 API 调用，也不会因为日志刷屏而掩盖真正的问题。

```shell title="SH / /usr/local/sbin/cf-aaaa-update.sh"
#!/bin/sh
set -eu

. /etc/cloudflare/ssh-dns.env

IP=$(ip -6 addr show dev "$IFACE" scope global \
  | awk '/inet6/ {print $2}' | cut -d/ -f1 | head -n1)

[ -n "$IP" ] || exit 1

API="https://api.cloudflare.com/client/v4"
AUTH="Authorization: Bearer $CF_API_TOKEN"

RECORD=$(curl -sS -H "$AUTH" \
  "$API/zones/$CF_ZONE_ID/dns_records?type=AAAA&name=$SSH_HOST" \
  | jq -r '.result[0] // empty')

CURRENT=$(printf '%s' "$RECORD" | jq -r '.content // empty')
ID=$(printf '%s' "$RECORD" | jq -r '.id // empty')

[ "$CURRENT" = "$IP" ] && exit 0
[ -n "$ID" ] || exit 1

curl -sS -X PATCH -H "$AUTH" -H "Content-Type: application/json" \
  "$API/zones/$CF_ZONE_ID/dns_records/$ID" \
  --data "{\"type\":\"AAAA\",\"name\":\"$SSH_HOST\",\"content\":\"$IP\",\"ttl\":60,\"proxied\":false}" \
  >/dev/null

echo "$(date -Iseconds) updated $SSH_HOST -> $IP"
```

依赖 `jq` 来解析 JSON。Alpine 上执行 `apk add jq curl` 即可。 用 `sed` 硬抠 JSON 也能跑，但字段顺序一变就会坏，不值得省这个包。

## 04 / 一分钟一次的 cron

```bash title="CRONTAB / ROOT"
* * * * * /usr/local/sbin/cf-aaaa-update.sh >> /var/log/cf-aaaa-update.log 2>&1
```

脚本在地址没变时直接退出，所以每分钟执行一次不会产生太多请求。 如果担心日志无限增长，可以用 `logrotate` 或定期截断。

## 05 / 验证

先在服务器上手动跑一次，再检查 DNS：

```shell title="SHELL / ALPINE"
/usr/local/sbin/cf-aaaa-update.sh
tail -20 /var/log/cf-aaaa-update.log
nslookup ssh.example.com 1.1.1.1
```

```powershell title="POWERSHELL / WINDOWS"
Resolve-DnsName ssh.example.com -Type AAAA -Server 1.1.1.1
ssh -v user@ssh.example.com
```

前缀变化后，通常 1 到 2 分钟就能生效。如果域名解析正确但 SSH 仍超时， 先检查客户端有没有 IPv6，再检查服务商防火墙是否放行 22。

## 06 / 安全提醒

-   Token 只给 DNS 编辑权限，并且只作用于一个 Zone；
-   环境文件权限 600，不要把 Token 写进脚本或日志；
-   SSH 尽量改成密钥登录，密码登录只作为临时手段；
-   如果不想暴露 22，可以改用 Cloudflare Access、Tailscale 或只走内网跳板；
-   DDNS 只解决「找得到」，不解决「该不该对公网开放」。

这套东西不复杂，但很依赖细节：记录类型、代理状态、IPv6 地址来源、Token 权限， 任何一个错了都可能表现为「域名能查，但连不上」。

---
title: 旧笔记本改造家庭服务器：从噪音到静音
description: 8GB 内存、35GB 磁盘、一块快要报废的电池。它本来该被淘汰， 却刚好适合放在角落里跑监控、机器人和一堆实验。旧笔记本做家庭服务器， 最大的优势不是性能，而是自带 UPS、功耗低、还有一块可以救命的屏幕。
pubDate: 2026-10-05
tags:
  - 硬件
  - 自托管
minutes: 10
draft: false
summary: 8GB 内存、35GB 磁盘、一块快要报废的电池。它本来该被淘汰， 却刚好适合放在角落里跑监控、机器人和一堆实验。旧笔记本做家庭服务器， 最大的优势不是性能，而是自带 UPS、功耗低、还有一块可以救命的屏幕。
---

## 00 / 为什么是旧笔记本

迷你主机和树莓派当然更整洁，但旧笔记本有几个很难替代的优点：

-   **自带电池：**短暂停电时不会立刻关机，相当于一个低配 UPS；
-   **自带屏幕和键盘：**网络没起来时，接上就能现场排障；
-   **功耗可控：**低负载下通常只有十几瓦；
-   **成本为零：**它已经在抽屉里躺了几年。

## 01 / 先做一次硬件体检

在装系统之前，先确认这块机器还值得托付：

```shell title="SHELL / UBUNTU"
# 电池健康
upower -i /org/freedesktop/UPower/devices/battery_BAT0

# 磁盘健康
sudo smartctl -a /dev/sda

# 温度与风扇
sensors

# 内存与磁盘
free -h
df -h /
```

如果磁盘开始出现重映射扇区，尽快换一块 SSD；如果电池鼓包，直接拆掉， 不要把一个膨胀的电池放在无人看管的角落里。

## 02 / 系统：不要桌面

服务器不需要图形界面。Ubuntu Server 或 Alpine 都可以，关键是关掉不用的服务， 把资源留给真正要跑的东西。笔记本还要处理合盖和休眠：

```ini title="SYSTEMD / logind.conf"
HandleLidSwitch=ignore
HandleLidSwitchExternalPower=ignore
HandleSuspendKey=ignore
```

```shell title="SHELL / UBUNTU"
sudo systemctl restart systemd-logind
loginctl show-session $(loginctl | awk '/tty/{print $1; exit}') -p Active
```

如果不改，合上盖子后机器会休眠，所有服务一起消失。 有些机型还需要在 BIOS 里关闭「合盖休眠」。

## 03 / 噪音与温度

旧笔记本最吵的时候往往不是满载，而是风扇策略太激进。 先清理灰尘、换硅脂，再观察空闲温度：

```shell title="SHELL / UBUNTU"
sensors
cat /sys/class/thermal/thermal_zone*/temp
cpupower frequency-info
```

把 CPU governor 调成 `powersave` 或 `ondemand`， 限制最大频率，通常就能把风扇压到很低的转速。把机器放在通风的硬表面上， 不要塞进封闭的柜子里。

## 04 / 服务与内存边界

8GB 内存听起来不少，但 Docker、Java 和浏览器自动化一起上，很快就会见底。 给容器加内存限制，给 JVM 设堆上限：

```yaml title="YAML / compose 示例"
services:
  bot:
    image: example/bot:latest
    mem_limit: 512m
    restart: unless-stopped

  monitor:
    image: louislam/uptime-kuma:1
    mem_limit: 256m
    restart: unless-stopped
```

不要让所有服务都设置 `restart: always` 却没有任何资源边界。 一个内存泄漏的进程可以把整台机器拖进 OOM，最后所有服务一起重启。

## 05 / 35GB 磁盘怎么活

小磁盘最容易被日志和镜像撑爆。把它当成一个需要定期打扫的房间：

```shell title="SHELL / DOCKER"
docker system df
docker image prune -a
docker builder prune

sudo journalctl --vacuum-size=200M
du -sh /var/log/* | sort -h
```

把不常用的镜像和大文件放到外接硬盘或另一台机器上。 数据库目录不要放在会随容器删除的临时层里。

## 06 / 备份：不要只备份到同一块盘

旧硬盘随时可能坏。至少把重要数据备份到另一台机器或云端，并定期做恢复测试：

```shell title="SHELL / RESTIC"
restic -r sftp:backup.example.com:/srv/restic init
restic -r sftp:backup.example.com:/srv/restic backup /opt /etc
restic -r sftp:backup.example.com:/srv/restic check
restic -r sftp:backup.example.com:/srv/restic snapshots
```

备份没有恢复测试，就等于没有备份。至少每季度挑一个文件恢复出来， 确认密钥、路径和权限都是对的。

## 07 / 小结

旧笔记本不是「凑合能用」，而是一台有明确边界的服务器： 不要指望它跑重型数据库，也不要把它当成唯一副本。 把电源、散热、磁盘和备份这四件事处理好，它可以安静地在角落里跑很久。

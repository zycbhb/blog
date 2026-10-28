#!/bin/sh
set -eu
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
export PATH

BASE=/var/www/blog
API="https://api.github.com/repos/zycbhb/blog/releases/tags/deploy"
LOG=/home/deploy/deploy.log

log() {
  echo "$(date '+%F %T') $*" >> "$LOG"
}

release=$(curl -fsSL --retry 2 --retry-delay 2 --max-time 30 \
  -H 'User-Agent: blog-deploy' "$API" 2>/dev/null) || {
  log "github api failed"
  exit 1
}

sha_url=$(printf '%s' "$release" | jq -r '.assets[]? | select(.name=="sha.txt") | .browser_download_url' | head -n1)
tar_url=$(printf '%s' "$release" | jq -r '.assets[]? | select(.name=="site.tar.gz") | .browser_download_url' | head -n1)

if [ -z "$sha_url" ] || [ -z "$tar_url" ]; then
  log "release assets missing"
  exit 1
fi

new_sha=$(curl -fsSL --retry 2 --retry-delay 2 --max-time 30 "$sha_url" | tr -d '\r\n')
if [ "${#new_sha}" -ne 40 ]; then
  log "invalid sha length"
  exit 1
fi
case "$new_sha" in
  *[!0-9a-f]*)
    log "invalid sha format"
    exit 1
    ;;
esac

current_target=$(readlink "$BASE/current" 2>/dev/null || true)
current_sha=$(basename "$current_target" 2>/dev/null || true)
if [ "$new_sha" = "$current_sha" ]; then
  exit 0
fi

tmp_tar="/tmp/blog-site-$new_sha.tar.gz"
if ! curl -fsSL --retry 2 --retry-delay 2 --max-time 120 -o "$tmp_tar" "$tar_url"; then
  log "download failed $new_sha"
  rm -f "$tmp_tar"
  exit 1
fi

release_dir="$BASE/releases/$new_sha"
rm -rf "$release_dir"
mkdir -p "$release_dir"
if ! tar -xzf "$tmp_tar" -C "$release_dir"; then
  log "extract failed $new_sha"
  rm -f "$tmp_tar"
  exit 1
fi
rm -f "$tmp_tar"

if [ ! -f "$release_dir/index.html" ]; then
  log "missing index.html $new_sha"
  exit 1
fi

find "$release_dir" -type d -exec chmod 755 {} +
find "$release_dir" -type f -exec chmod 644 {} +

rm -f "$BASE"/releases/*/.current.new 2>/dev/null || true
ln -sfn "releases/$new_sha" "$BASE/current"
target=$(readlink "$BASE/current" 2>/dev/null || true)

if [ "$target" != "releases/$new_sha" ] || [ ! -f "$BASE/current/index.html" ]; then
  log "current switch failed $new_sha (target=$target)"
  exit 1
fi

i=0
for dir in $(ls -1dt "$BASE"/releases/* 2>/dev/null || true); do
  i=$((i + 1))
  if [ "$i" -le 5 ]; then
    continue
  fi
  if [ "$dir" = "$release_dir" ]; then
    continue
  fi
  rm -rf "$dir"
done

log "deployed $new_sha"

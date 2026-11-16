#!/bin/bash
set -euo pipefail
printf '\nLinux for MacBook Air M1 (2020)\nBased on Fedora Asahi Remix; uses the official Asahi installer.\n\n'
if [ "$(uname -s)" != Darwin ]; then echo 'Run this launcher on your Mac in macOS.'; exit 1; fi
model=$(sysctl -n hw.model)
if [ "$model" != 'MacBookAir10,1' ]; then echo "Expected MacBookAir10,1 (M1 Air); found $model. Stop and check compatibility."; exit 1; fi
printf 'Installation resizes disk partitions. Back up your files first and connect power.\nKeep macOS and its recovery environment. Follow the official installer instructions.\nRead https://asahilinux.org/fedora/ before continuing.\n\n'
read -r -p 'Type INSTALL after backing up and reviewing the instructions, or press Enter to cancel: ' answer
if [ "$answer" != INSTALL ]; then echo 'Cancelled. No installer was run.'; exit 0; fi
installer=$(mktemp -t dock-asahi)
trap 'rm -f "$installer"' EXIT
curl --fail --location --proto '=https' --tlsv1.2 https://alx.sh -o "$installer"
printf '\nDownloaded the official installer to %s\n' "$installer"
read -r -p 'Type REVIEW to view its source first, or press Enter to cancel: ' review
if [ "$review" != REVIEW ]; then echo 'Cancelled.'; exit 0; fi
less "$installer"
read -r -p 'Type RUN to start the official interactive installer, or press Enter to cancel: ' run
if [ "$run" != RUN ]; then echo 'Cancelled.'; exit 0; fi
/bin/sh "$installer"

#!/usr/bin/env bash
set -euo pipefail
export PORT="${PORT:-8799}"
export FORGE_ANDROID_APK_ARTIFACT_DIR="${FORGE_ANDROID_APK_ARTIFACT_DIR:-/home/v0id/apk-share/forge-builder-artifacts}"
export FORGE_ANDROID_APK_BUILDER_PUBLIC_BASE_URL="${FORGE_ANDROID_APK_BUILDER_PUBLIC_BASE_URL:-https://virgil-server.tailce4511.ts.net}"
export FORGE_ANDROID_APK_BUILDER_TOKEN="$(cat /home/v0id/.hermes/run/forge_android_builder_token)"
export JAVA_HOME="${JAVA_HOME:-/home/v0id/.cache/rilable-android-tools/jdk}"
export ANDROID_HOME="${ANDROID_HOME:-/home/v0id/.cache/rilable-android-tools/android-sdk}"
export ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$ANDROID_HOME}"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
cd /home/v0id/Projects/rilable/backend
exec npm run android:builder

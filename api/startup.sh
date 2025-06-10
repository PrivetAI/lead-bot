#!/bin/bash

echo "🚀 Starting WhatsApp Lead Bot..."

# Clean up existing processes
echo "🧹 Cleaning up existing Chrome processes..."
pkill -9 -f chrome 2>/dev/null || true
pkill -9 -f chromium 2>/dev/null || true

# Clean up lock files
echo "🗑️ Cleaning up lock files..."
rm -rf /tmp/chrome-* 2>/dev/null || true
rm -rf /app/sessions/*/SingletonLock 2>/dev/null || true
rm -rf /app/sessions/*/SingletonSocket 2>/dev/null || true
rm -rf /app/sessions/*/SingletonCookie 2>/dev/null || true

# Ensure directories exist
mkdir -p /app/sessions /app/logs /tmp/chrome-sessions /tmp/wa-sessions 2>/dev/null || true

sleep 2

echo "✅ Cleanup completed, starting application..."

exec node src/index.js
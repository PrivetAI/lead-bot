#!/bin/bash

echo "🚀 Starting WhatsApp Lead Bot..."

# Kill any existing Chrome/Chromium processes
echo "🧹 Cleaning up existing Chrome processes..."
pkill -9 -f chrome 2>/dev/null || true
pkill -9 -f chromium 2>/dev/null || true
pkill -9 -f "Chromium" 2>/dev/null || true

# Clean up lock files and temporary directories
echo "🗑️ Cleaning up lock files..."
rm -rf /tmp/chrome-* 2>/dev/null || true
rm -rf /tmp/wa-sessions 2>/dev/null || true
rm -rf /app/sessions/*/SingletonLock 2>/dev/null || true
rm -rf /app/sessions/*/SingletonSocket 2>/dev/null || true
rm -rf /app/sessions/*/SingletonCookie 2>/dev/null || true

# Ensure sessions directory exists and has correct permissions
echo "📁 Setting up sessions directory..."
mkdir -p /app/sessions
chmod 755 /app/sessions

# Wait a bit for cleanup
sleep 2

echo "✅ Cleanup completed, starting application..."

# Start the Node.js application
exec node src/index.js
EOF
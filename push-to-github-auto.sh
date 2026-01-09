#!/bin/bash

# Arb-Visualizer - Automatic GitHub Push Script
# Run this script to push to GitHub and trigger automatic APK builds

echo "🚀 Arb-Visualizer - GitHub Auto-Push"
echo "===================================="
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Not in project directory"
    echo "Please cd to the arb-visualizer/Arb-Visualizer folder first"
    exit 1
fi

# GitHub username
GITHUB_USER="bamove6969"
REPO_NAME="arb-visualizer"

echo "📋 GitHub Repository: https://github.com/$GITHUB_USER/$REPO_NAME"
echo ""

# Check if repo exists on GitHub
echo "⚠️  BEFORE RUNNING THIS SCRIPT:"
echo "1. Go to: https://github.com/new"
echo "2. Create repository named: $REPO_NAME"
echo "3. Make it PUBLIC (required for free GitHub Actions)"
echo "4. DON'T check any boxes (no README, .gitignore, etc)"
echo "5. Get your Personal Access Token from: https://github.com/settings/tokens"
echo ""
read -p "Have you created the repo and have your token ready? (yes/no): " READY

if [ "$READY" != "yes" ]; then
    echo "❌ Please create the repository first, then run this script again"
    exit 1
fi

# Get GitHub token
echo ""
echo "🔑 Enter your GitHub Personal Access Token:"
echo "   (It starts with 'ghp_' and won't be shown as you type)"
read -sp "Token: " GITHUB_TOKEN
echo ""

if [ -z "$GITHUB_TOKEN" ]; then
    echo "❌ No token provided"
    exit 1
fi

# Configure git
echo ""
echo "⚙️  Configuring git..."
git config user.email "jasp@arbvisualizer.app"
git config user.name "bamove6969"

# Check if remote exists
if git remote | grep -q "^origin$"; then
    echo "🔄 Updating remote URL..."
    git remote set-url origin https://$GITHUB_TOKEN@github.com/$GITHUB_USER/$REPO_NAME.git
else
    echo "➕ Adding remote..."
    git remote add origin https://$GITHUB_TOKEN@github.com/$GITHUB_USER/$REPO_NAME.git
fi

# Push to GitHub
echo ""
echo "📤 Pushing to GitHub..."
git push -u origin main

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ SUCCESS! Code pushed to GitHub!"
    echo ""
    echo "🎉 NEXT STEPS:"
    echo "1. Go to: https://github.com/$GITHUB_USER/$REPO_NAME/actions"
    echo "2. Watch the APK build (takes ~5-10 minutes)"
    echo "3. When done, go to: https://github.com/$GITHUB_USER/$REPO_NAME/releases"
    echo "4. Download: app-universal-debug.apk"
    echo "5. Install on your Pixel 10 Pro Fold!"
    echo ""
    echo "📱 APK will be automatically built with support for:"
    echo "   ✅ arm64-v8a (your Pixel)"
    echo "   ✅ armeabi-v7a (older phones)"
    echo "   ✅ x86_64 (tablets)"
    echo "   ✅ x86 (legacy devices)"
    echo ""
else
    echo ""
    echo "❌ Push failed. Common issues:"
    echo "1. Wrong token (get new one at https://github.com/settings/tokens)"
    echo "2. Repository doesn't exist (create at https://github.com/new)"
    echo "3. Repository is private (make it PUBLIC for free Actions)"
    exit 1
fi

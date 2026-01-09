#!/bin/bash
# Arb-Visualizer - Automated GitHub Push
# Run this script after extracting the zip

echo "🚀 Pushing Arb-Visualizer to GitHub..."
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Not in project directory"
    echo "Please cd to the Arb-Visualizer folder first"
    exit 1
fi

# Fix git safe directory warning
echo "⚙️  Configuring git..."
git config --global --add safe.directory "$(pwd)"

# Initialize git if not already
if [ ! -d ".git" ]; then
    echo "🔧 Initializing git repository..."
    git init
    git branch -M main
fi

# Configure git user
git config user.email "jasp@arbvisualizer.app"
git config user.name "bamove6969"

# Add all files
echo "📦 Adding files..."
git add -A

# Commit
echo "💾 Creating commit..."
git commit -m "feat: All 10 features implemented - ready for APK build" 2>/dev/null || echo "Files already committed"

# Set remote (uses git credential helper for authentication)
echo "🔗 Setting up GitHub remote..."
git remote remove origin 2>/dev/null
git remote add origin https://github.com/bamove6969/arb-visualizer.git

# Push with force to overwrite everything
echo "📤 Pushing to GitHub (this will overwrite existing content)..."
git push -u origin main --force

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ SUCCESS! Code pushed to GitHub!"
    echo ""
    echo "🎉 NEXT STEPS:"
    echo "1. Go to: https://github.com/bamove6969/arb-visualizer/actions"
    echo "2. Watch the APK build (takes ~5-10 minutes)"
    echo "3. Download from: https://github.com/bamove6969/arb-visualizer/releases"
    echo ""
    echo "📱 Download: app-universal-debug.apk"
    echo "   Install on your Pixel 10 Pro Fold!"
    echo ""
else
    echo ""
    echo "❌ Push failed. Check your internet connection and try again."
    exit 1
fi

#!/bin/bash

# API Toll NPM Publish Script
# Publishes all 5 packages to npm as @apitoll/*

set -e

DRY_RUN=${DRY_RUN:-false}
PACKAGES=("seller-sdk" "buyer-sdk" "shared" "langchain" "mcp-server")

echo "🚀 API Toll NPM Publish"
echo "================================"
echo "Dry run: $DRY_RUN"
echo ""

# Step 1: Build all packages
echo "📦 Building all packages..."
npm run build 2>&1 | tail -10
echo "✅ Build complete"
echo ""

# Step 2: Publish shared first (other packages depend on it)
echo "📤 Publishing packages..."
echo ""

for PACKAGE in "${PACKAGES[@]}"; do
    PACKAGE_PATH="packages/$PACKAGE"
    
    if [ ! -d "$PACKAGE_PATH" ]; then
        echo "⚠️  Skipping $PACKAGE (directory not found)"
        continue
    fi
    
    echo "Publishing @apitoll/$PACKAGE..."
    
    cd "$PACKAGE_PATH"
    
    # Verify build exists
    if [ ! -d "dist" ]; then
        echo "❌ dist/ folder not found for $PACKAGE"
        exit 1
    fi
    
    # Dry run or real publish
    if [ "$DRY_RUN" = true ]; then
        echo "  [DRY RUN] npm publish"
        npm publish --dry-run --tag beta 2>&1 | tail -5
    else
        echo "  [LIVE] npm publish"
        npm publish --tag beta 2>&1 | tail -5
    fi
    
    echo "✅ @apitoll/$PACKAGE published"
    echo ""
    
    cd ../..
done

echo "================================"
echo "✅ All packages published!"
echo ""
echo "Verify on npm:"
for PACKAGE in "${PACKAGES[@]}"; do
    echo "  npm view @apitoll/$PACKAGE"
done

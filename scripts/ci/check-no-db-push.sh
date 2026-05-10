#!/bin/bash
set -e

echo "Checking for forbidden prisma db push commands..."

FOUND=$(grep -r "prisma db push" \
  --include="*.yml" \
  --include="*.yaml" \
  --include="*.sh" \
  --include="Dockerfile*" \
  . \
  --exclude-dir=".git" \
  --exclude-dir="node_modules" \
  --exclude-dir="docs" \
  2>/dev/null || true)

if [ -n "$FOUND" ]; then
  echo "❌ ERROR: Found 'prisma db push' in committed files:"
  echo "$FOUND"
  exit 1
fi

echo "✅ No 'prisma db push' found in committed files"
#!/usr/bin/env bash
set -e

echo "=== Gama Os: Upstream Sync Utility ==="
echo "Fetching latest changes from upstream (pingdotgg/t3code)..."
git fetch upstream main

CURRENT_BRANCH=$(git branch --show-current)
echo "Current branch: $CURRENT_BRANCH"

echo "Fast-forwarding upstream-main branch..."
git fetch upstream main:upstream-main

echo "Merging upstream changes into $CURRENT_BRANCH..."
git merge upstream-main --no-edit

echo "Upstream sync completed successfully!"

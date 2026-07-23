#!/bin/bash

echo "Starting CyberGuard Go Backend..."

if [ ! -f "go.mod" ]; then
    echo "Initializing Go module..."
    go mod init cyberguard-backend
fi

echo "Downloading dependencies..."
go mod tidy

echo "Building backend..."
go build -o cyberguard-backend main.go

echo "Starting server..."
./cyberguard-backend

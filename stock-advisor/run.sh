#!/bin/bash
set -e

cd "$(dirname "$0")"

if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

source venv/bin/activate

echo "Installing Python dependencies..."
pip install -r requirements.txt -q

if [ ! -d "frontend/node_modules" ]; then
    echo "Installing frontend dependencies..."
    cd frontend && npm install && cd ..
fi

echo "Building frontend..."
cd frontend && npm run build && cd ..

echo ""
echo "=========================================="
echo "  Stock Trading Advisor"
echo "=========================================="
echo ""
echo "  Dashboard: http://localhost:8000"
echo "  API Docs:  http://localhost:8000/docs"
echo ""
echo "=========================================="
echo ""

python main.py

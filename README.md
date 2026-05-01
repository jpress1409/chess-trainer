# Chess Tutor

A chess training web application with Stockfish-powered position analysis.

## Tech Stack
- **Frontend**: Next.js 14, React, TailwindCSS, chessboardjsx, chess.js
- **Backend**: FastAPI, python-chess, Stockfish
- **Analysis**: Stockfish chess engine

## Project Structure
```
chess-tutor/
├── frontend/          # Next.js frontend
│   ├── app/          # App router pages
│   └── package.json  # Frontend dependencies
└── backend/          # FastAPI backend
    ├── main.py       # API server
    └── requirements.txt
```

## Setup Instructions

### Quick Start (Windows)
Run the PowerShell script to automatically kill existing processes and start both servers:
```powershell
.\start-servers.ps1
```

### Manual Setup

#### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Frontend runs on http://localhost:3000

#### Backend Setup
```bash
cd backend

# Install Python dependencies
pip install -r requirements.txt

# Download Stockfish
# 1. Visit https://stockfishchess.org/download/
# 2. Download Windows version
# 3. Extract to backend/stockfish/ directory
# 4. Ensure the executable is named stockfish-windows-x86-64-avx2.exe
# 5. Update STOCKFISH_PATH in .env if needed

# Run the server
python main.py
```
Backend runs on http://localhost:8000

## Features
- Interactive chess board with drag-and-drop
- Real-time game state tracking
- Stockfish position analysis
- Move validation
- New game functionality

## API Endpoints
- `GET /` - Health check
- `POST /api/analyze` - Analyze position with Stockfish
- `POST /api/validate-move` - Validate chess moves

## Future Ideas
- Create user profiles
- Save and replay games
- Game history tracking
- Advanced coaching features

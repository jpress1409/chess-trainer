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

## Issues

- Wrong moves makes the game shit itself
    - Allow only legal moves
- chessboard is cuit off on the right
    ```Error that goes with the above issue
    Web Console:
            4
        chessboard.min.js:70 Uncaught Invariant Violation: Cannot call hover after drop.
            at e.exports (chessboard.min.js:70:30)
            at t.hover (chessboard.min.js:239:104)
            at r.<computed> [as hover] (chessboard.min.js:7054:47)
            at e.handleTopDragOver (chessboard.min.js:5070:65)
        e.exports	@	chessboard.min.js:70
        t.hover	@	chessboard.min.js:239
        r.<computed>	@	chessboard.min.js:7054
        e.handleTopDragOver	@	chessboard.min.js:5070
    
    Terminal:
            ✓ Ready in 1727ms
        ○ Compiling / ...
        ✓ Compiled / in 5.2s (436 modules)
        ⨯ node_modules\chessboardjsx\dist\chessboard.min.js (1:253) @ window
        ⨯ ReferenceError: window is not defined
            at __webpack_require__ (C:\Users\jpres\OneDrive\Desktop\Coding\portfolio\chess-tutor\frontend\.next\server\webpack-runtime.js:33:42)
            at eval (./app/page.tsx:9:71)
            at (ssr)/./app/page.tsx (C:\Users\jpres\OneDrive\Desktop\Coding\portfolio\chess-tutor\frontend\.next\server\app\page.js:140:1)
            at __webpack_require__ (C:\Users\jpres\OneDrive\Desktop\Coding\portfolio\chess-tutor\frontend\.next\server\webpack-runtime.js:33:42)
            at JSON.parse (<anonymous>)
        null
        ○ Compiling /not-found ...
        ✓ Compiled /not-found in 4.4s (427 modules)
        ⨯ node_modules\chessboardjsx\dist\chessboard.min.js (1:253) @ window
        ⨯ ReferenceError: window is not defined
            at __webpack_require__ (C:\Users\jpres\OneDrive\Desktop\Coding\portfolio\chess-tutor\frontend\.next\server\webpack-runtime.js:33:42)
            at eval (./app/page.tsx:9:71)
            at (ssr)/./app/page.tsx (C:\Users\jpres\OneDrive\Desktop\Coding\portfolio\chess-tutor\frontend\.next\server\app\page.js:140:1)
            at __webpack_require__ (C:\Users\jpres\OneDrive\Desktop\Coding\portfolio\chess-tutor\frontend\.next\server\webpack-runtime.js:33:42)
            at JSON.parse (<anonymous>)
        null
    ```

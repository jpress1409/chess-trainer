from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import chess
import os
from stockfish import Stockfish

app = FastAPI()

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Stockfish
STOCKFISH_PATH = os.getenv("STOCKFISH_PATH", "stockfish/stockfish-windows-x86-64-avx2.exe")

try:
    stockfish = Stockfish(path=STOCKFISH_PATH)
    stockfish.set_skill_level(10)
except Exception as e:
    print(f"Warning: Could not initialize Stockfish: {e}")
    stockfish = None

class AnalysisRequest(BaseModel):
    fen: str

class AnalysisResponse(BaseModel):
    best_move: str
    evaluation: str

class MoveValidationRequest(BaseModel):
    fen: str
    from_square: str
    to_square: str

@app.get("/")
def read_root():
    return {"message": "Chess Tutor API", "stockfish_ready": stockfish is not None}

@app.post("/api/analyze", response_model=AnalysisResponse)
def analyze_position(request: AnalysisRequest):
    """Analyze a chess position using Stockfish"""
    if stockfish is None:
        raise HTTPException(status_code=503, detail="Stockfish not available")
    
    try:
        stockfish.set_fen_position(request.fen)
        best_move = stockfish.get_best_move()
        evaluation = stockfish.get_evaluation()
        
        return {
            "best_move": best_move,
            "evaluation": str(evaluation)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

@app.post("/api/validate-move")
def validate_move(request: MoveValidationRequest):
    """Validate if a move is legal"""
    try:
        board = chess.Board(request.fen)
        move = chess.Move.from_uci(f"{request.from_square}{request.to_square}")
        
        if move in board.legal_moves:
            return {"valid": True, "move": move.uci()}
        return {"valid": False, "error": "Illegal move"}
    except Exception as e:
        return {"valid": False, "error": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import chess
import os
import requests
from stockfish import Stockfish
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

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

# Get absolute path
script_dir = os.path.dirname(os.path.abspath(__file__))
STOCKFISH_PATH = os.path.join(script_dir, STOCKFISH_PATH)

print(f"Looking for Stockfish at: {STOCKFISH_PATH}")
print(f"File exists: {os.path.exists(STOCKFISH_PATH)}")

try:
    stockfish = Stockfish(path=STOCKFISH_PATH)
    print(f"Stockfish initialized successfully from: {STOCKFISH_PATH}")
except Exception as e:
    print(f"Warning: Could not initialize Stockfish: {e}")
    print(f"Please download Stockfish from https://stockfishchess.org/download/")
    print(f"Extract to backend/stockfish/ directory and ensure the executable exists")
    stockfish = None

class AnalysisRequest(BaseModel):
    fen: str
    skill_level: int = 10

class AnalysisResponse(BaseModel):
    best_move: str
    evaluation: str

class MoveValidationRequest(BaseModel):
    fen: str
    from_square: str
    to_square: str

class GameAnalysisRequest(BaseModel):
    move_history: list[dict]
    player_color: str
    game_mode: str
    difficulty: str

class GameAnalysisResponse(BaseModel):
    analysis: str

@app.get("/")
def read_root():
    return {"message": "Chess Tutor API", "stockfish_ready": stockfish is not None}

@app.post("/api/analyze", response_model=AnalysisResponse)
def analyze_position(request: AnalysisRequest):
    """Analyze a chess position using Stockfish"""
    if stockfish is None:
        raise HTTPException(status_code=503, detail="Stockfish not available")
    
    try:
        print(f"Analyzing position: {request.fen} with skill level: {request.skill_level}")
        
        # Set skill level if provided
        try:
            stockfish.set_skill_level(request.skill_level)
        except AttributeError:
            print("set_skill_level not available, using default strength")
        
        stockfish.set_fen_position(request.fen)
        best_move = stockfish.get_best_move()
        print(f"Best move: {best_move}")
        
        # Use python-chess for material evaluation since Stockfish library lacks evaluation methods
        try:
            board = chess.Board(request.fen)
            
            # Material values (in centipawns)
            piece_values = {
                chess.PAWN: 100,
                chess.KNIGHT: 320,
                chess.BISHOP: 330,
                chess.ROOK: 500,
                chess.QUEEN: 900,
                chess.KING: 0
            }
            
            # Calculate material difference
            white_material = 0
            black_material = 0
            
            for square in chess.SQUARES:
                piece = board.piece_at(square)
                if piece:
                    value = piece_values.get(piece.piece_type, 0)
                    if piece.color == chess.WHITE:
                        white_material += value
                    else:
                        black_material += value
            
            # Calculate evaluation (positive = white advantage)
            eval_score = white_material - black_material
            print(f"Material evaluation: {eval_score} (white: {white_material}, black: {black_material})")
            
            eval_str = f"+{eval_score}" if eval_score >= 0 else str(eval_score)
        except Exception as e:
            print(f"Error getting material evaluation: {e}")
            eval_str = "0.0"
        
        print(f"Returning evaluation string: {eval_str}")
        return {
            "best_move": best_move,
            "evaluation": eval_str
        }
    except Exception as e:
        print(f"Analysis error: {e}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

@app.post("/api/validate-move")
def validate_move(request: MoveValidationRequest):
    """Validate if a move is legal"""
    try:
        board = chess.Board(request.fen)
        move = chess.Move.from_uci(f"{request.from_square}{request.to_square}")
        
        if move in board.legal_moves:
            return {"legal": True}
        else:
            return {"legal": False}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Validation failed: {str(e)}")

@app.post("/api/game-analysis", response_model=GameAnalysisResponse)
def analyze_game(request: GameAnalysisRequest):
    """Analyze a completed game using OpenRouter API (free tier)"""
    try:
        # Format the move history for the prompt
        moves_str = "\n".join([
            f"{i+1}. {move['color']} {move['piece']} from {move['from']} to {move['to']}"
            for i, move in enumerate(request.move_history)
        ])

        prompt = f"""You are a chess coach. Analyze this completed chess game and provide constructive feedback.

Game Details:
- Player color: {request.player_color}
- Game mode: {request.game_mode}
- Difficulty: {request.difficulty}

Move History:
{moves_str}

Please provide:
1. Overall assessment of the game
2. Key moments and turning points
3. Specific advice for the {request.player_color} player
4. Areas for improvement
5. Positive moves to highlight

Keep your analysis concise and actionable (under 300 words)."""

        # Call OpenRouter API (free tier)
        openrouter_api_key = os.getenv("OPENROUTER_API_KEY", "")
        print(f"OPENROUTER_API_KEY exists: {bool(openrouter_api_key)}")
        if not openrouter_api_key or openrouter_api_key == "your_openrouter_api_key_here":
            raise HTTPException(status_code=503, detail="OPENROUTER_API_KEY not set in environment")

        openrouter_response = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {openrouter_api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": "http://localhost:3000",
                "X-Title": "Chess Tutor"
            },
            json={
                "model": "meta-llama/llama-3-8b-instruct",
                "messages": [
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.7,
                "max_tokens": 500
            },
            timeout=60
        )

        print(f"OpenRouter Response status: {openrouter_response.status_code}")
        print(f"OpenRouter Response body: {openrouter_response.text[:500]}")

        if openrouter_response.status_code == 200:
            result = openrouter_response.json()
            print(f"OpenRouter Result type: {type(result)}")
            print(f"OpenRouter Result: {result}")
            
            analysis = result["choices"][0]["message"]["content"]
            return {"analysis": analysis}
        else:
            raise HTTPException(status_code=503, detail=f"OpenRouter API error: {openrouter_response.text}")

    except requests.exceptions.RequestException as e:
        print(f"Request exception: {e}")
        raise HTTPException(status_code=503, detail=f"API connection failed: {str(e)}")
    except Exception as e:
        print(f"General exception: {e}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

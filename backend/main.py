from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import chess
import chess.engine
import os
import math
import requests
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

app = FastAPI()

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "https://chess-trainer-hspt.onrender.com"],
    allow_origin_regex="https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Stockfish path
_stockfish_env = os.getenv("STOCKFISH_PATH", "stockfish/stockfish-windows-x86-64-avx2.exe")

# If it's an absolute path or on PATH (no slashes), use as-is; otherwise resolve relative to script dir
if os.path.isabs(_stockfish_env) or os.sep not in _stockfish_env and "/" not in _stockfish_env:
    STOCKFISH_PATH = _stockfish_env
else:
    script_dir = os.path.dirname(os.path.abspath(__file__))
    STOCKFISH_PATH = os.path.join(script_dir, _stockfish_env)

print(f"Looking for Stockfish at: {STOCKFISH_PATH}")
print(f"File exists: {os.path.exists(STOCKFISH_PATH)}")

def evaluate_position(fen: str, depth: int = 18):
    """
    Evaluate a chess position using Stockfish and convert to win probabilities.
    
    Args:
        fen: FEN string of the position
        depth: Analysis depth (default 18)
    
    Returns:
        dict with eval, white_win_prob, black_win_prob
    """
    try:
        # Initialize Stockfish engine
        engine = chess.engine.SimpleEngine.popen_uci(STOCKFISH_PATH)
        
        # Create board from FEN
        board = chess.Board(fen)
        
        # Analyze position
        info = engine.analyse(board, chess.engine.Limit(depth=depth))
        
        # Extract evaluation in centipawns
        score = info["score"]
        
        # Handle mate scores
        if score.is_mate():
            # Mate in N moves - convert to large advantage
            mate_moves = score.mate()
            if mate_moves > 0:
                # White mates
                eval_cp = 10000 - (mate_moves * 100)
            else:
                # Black mates
                eval_cp = -10000 + (abs(mate_moves) * 100)
        else:
            # Regular evaluation in centipawns
            eval_cp = score.white().score(mate_score=10000)
        
        # Convert centipawns to pawns
        eval_pawns = eval_cp / 100.0
        
        # Convert to win probability using logistic function
        # P(white) = 1 / (1 + exp(-0.7 * eval_pawns))
        white_win_prob = 1.0 / (1.0 + math.exp(-0.7 * eval_pawns))
        black_win_prob = 1.0 - white_win_prob
        
        # Close engine
        engine.quit()
        
        return {
            "eval": eval_pawns,
            "white_win_prob": white_win_prob,
            "black_win_prob": black_win_prob
        }
    except Exception as e:
        print(f"Error evaluating position: {e}")
        return {
            "eval": 0.0,
            "white_win_prob": 0.5,
            "black_win_prob": 0.5
        }

class AnalysisRequest(BaseModel):
    fen: str
    skill_level: int = 10

class AnalysisResponse(BaseModel):
    best_move: str
    evaluation: str
    white_win_prob: float
    black_win_prob: float

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
    return {"message": "Chess Tutor API", "stockfish_ready": os.path.exists(STOCKFISH_PATH)}

@app.post("/api/analyze", response_model=AnalysisResponse)
def analyze_position(request: AnalysisRequest):
    """Analyze a chess position using Stockfish"""
    if not os.path.exists(STOCKFISH_PATH):
        raise HTTPException(status_code=503, detail="Stockfish not available")
    
    try:
        # Get best move using Stockfish
        engine = chess.engine.SimpleEngine.popen_uci(STOCKFISH_PATH)
        board = chess.Board(request.fen)
        result = engine.play(board, chess.engine.Limit(depth=request.skill_level))
        best_move = result.move.uci()
        engine.quit()
        
        # Get evaluation and win probabilities
        eval_result = evaluate_position(request.fen, depth=request.skill_level)
        
        return {
            "best_move": best_move,
            "evaluation": f"{eval_result['eval']:+.2f}",
            "white_win_prob": eval_result['white_win_prob'],
            "black_win_prob": eval_result['black_win_prob']
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

Please provide your analysis in HTML format with collapsible sections using HTML <details> and <summary> tags. Each section should default to collapsed.

Use the following structure:
<details>
<summary>1. Overall Assessment</summary>
[Content]
</details>

<details>
<summary>2. Key Moments and Turning Points</summary>
[Content]
</details>

<details>
<summary>3. Specific Advice for {request.player_color} Player</summary>
[Content]
</details>

<details>
<summary>4. Areas for Improvement</summary>
[Content]
</details>

<details>
<summary>5. Positive Moves to Highlight</summary>
[Content]
</details>

Keep your analysis concise and actionable (under 300 words total)."""

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

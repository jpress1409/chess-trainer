# Chess Tutor Backend

FastAPI backend for chess analysis using Stockfish.

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Download Stockfish:
   - Download from https://stockfishchess.org/download/
   - Extract to `stockfish/` directory
   - Update path in `.env` if needed

3. Run the server:
```bash
python main.py
```

## API Endpoints

- `GET /` - Health check
- `POST /api/analyze` - Analyze position with Stockfish
- `POST /api/validate-move` - Validate chess move

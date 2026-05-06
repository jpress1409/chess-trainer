"use client"

import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import { useRouter, useSearchParams } from "next/navigation"

const Chessboard = dynamic(() => import("chessboardjsx"), { ssr: false })
import { Chess } from "chess.js"

type GameMode = "pvp" | "pvc"
type Difficulty = "easy" | "medium" | "hard"

export default function GamePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const initialMode = (searchParams.get("mode") as GameMode) || "pvp"
  const initialColor = (searchParams.get("color") as "white" | "black") || "white"
  const initialDifficulty = (searchParams.get("difficulty") as Difficulty) || "medium"

  const [game, setGame] = useState(new Chess())
  const [fen, setFen] = useState(game.fen())
  const [gameStatus, setGameStatus] = useState("Ready to play")
  const [loading, setLoading] = useState(false)
  const [gameMode, setGameMode] = useState<GameMode>(initialMode)
  const [playerColor, setPlayerColor] = useState<"white" | "black">(initialColor)
  const [isCpuThinking, setIsCpuThinking] = useState(false)
  const [isProcessingMove, setIsProcessingMove] = useState(false)
  const [gameOver, setGameOver] = useState(false)
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null)
  const [legalMoves, setLegalMoves] = useState<string[]>([])
  const [difficulty, setDifficulty] = useState<Difficulty>(initialDifficulty)
  const [moveHistory, setMoveHistory] = useState<Array<{from: string, to: string, piece: string, color: string}>>([])
  const [gameAnalysis, setGameAnalysis] = useState<string | null>(null)
  const [kingSquare, setKingSquare] = useState<string | null>(null)
  const [winProbability, setWinProbability] = useState<{ white: number; black: number } | null>(null)

  const getPieceName = (piece: string) => {
    const pieceNames: Record<string, string> = {
      p: "Pawn",
      n: "Knight",
      b: "Bishop",
      r: "Rook",
      q: "Queen",
      k: "King"
    }
    return pieceNames[piece.toLowerCase()] || piece
  }

  const onSquareClick = (square: string) => {
    // Prevent moves after game over
    if (gameOver) {
      return
    }

    // In CPU mode, prevent moving when it's CPU's turn
    if (gameMode === "pvc" && isCpuThinking) {
      return
    }

    // In CPU mode, prevent CPU from moving player's pieces
    if (gameMode === "pvc") {
      const isWhiteTurn = game.turn() === "w"
      const isPlayerWhite = playerColor === "white"
      if (isWhiteTurn !== isPlayerWhite) {
        return
      }
    }

    // If no piece selected, try to select this square
    if (!selectedSquare) {
      const piece = game.get(square as any)
      if (piece) {
        const isWhitePiece = piece.color === "w"
        const isWhiteTurn = game.turn() === "w"
        if (isWhitePiece === isWhiteTurn) {
          setSelectedSquare(square)
          // Get legal moves for this piece
          const moves = game.moves({ square: square as any, verbose: true }).map((m: any) => m.to)
          // If in check, filter to only moves that escape check for this specific piece
          if (game.isCheck()) {
            const pieceMoves = game.moves({ square: square as any, verbose: true })
            const checkEscapingMoves = pieceMoves.filter((m: any) => {
              const testGame = new Chess(game.fen())
              testGame.move(m)
              return !testGame.isCheck()
            }).map((m: any) => m.to)
            setLegalMoves(checkEscapingMoves)
          } else {
            setLegalMoves(moves)
          }
        }
      }
    } else {
      // If piece selected, try to move to clicked square
      if (legalMoves.includes(square)) {
        setIsProcessingMove(true)
        
        try {
          const move = game.move({
            from: selectedSquare as any,
            to: square as any,
            promotion: "q",
          })

          if (move === null) {
            setGameStatus("Illegal move! Try again.")
            setIsProcessingMove(false)
          } else {
            setFen(game.fen())
            setGameStatus(`Moved ${getPieceName(move.piece)} from ${selectedSquare.toUpperCase()} to ${square.toUpperCase()}`)
            
            // Track move
            setMoveHistory(prev => [...prev, {
              from: selectedSquare,
              to: square,
              piece: getPieceName(move.piece),
              color: move.color === "w" ? "white" : "black"
            }])

            // Update king square if in check (delay until after animation)
            setTimeout(() => {
              if (game.isCheck()) {
                const turnColor = game.turn() === "w" ? "white" : "black"
                const board = game.board()
                let foundKing = null
                for (let row = 0; row < 8; row++) {
                  for (let col = 0; col < 8; col++) {
                    const piece = board[row][col]
                    if (piece && piece.type === 'k' && piece.color === game.turn()) {
                      foundKing = `${String.fromCharCode(97 + col)}${8 - row}`
                      break
                    }
                  }
                  if (foundKing) break
                }
                setKingSquare(foundKing)
              } else {
                setKingSquare(null)
              }
              updateWinProbability()
            }, 600)

            if (game.isCheckmate()) {
              setGameStatus("Checkmate!")
              setGameOver(true)
              handleGameAnalysis()
            } else if (game.isDraw()) {
              setGameStatus("Draw!")
              setGameOver(true)
              handleGameAnalysis()
            } else if (game.isCheck()) {
              const isWhiteTurn = game.turn() === "w"
              const isPlayerWhite = playerColor === "white"
              const isPlayerTurn = isWhiteTurn === isPlayerWhite
              setGameStatus(isPlayerTurn ? "CHECK! You must get out of check." : "CPU is in check!")
              if (gameMode === "pvc") {
                makeCpuMove()
              }
            } else if (gameMode === "pvc") {
              makeCpuMove()
            }
          }
        } catch (error) {
          console.error("Move error:", error)
          setGameStatus("Invalid move! Try again.")
        } finally {
          setIsProcessingMove(false)
        }
      }
      
      // Deselect
      setSelectedSquare(null)
      setLegalMoves([])
    }
  }

  const makeCpuMove = async () => {
    setIsCpuThinking(true)
    try {
      const skillLevel = difficulty === "easy" ? 5 : difficulty === "medium" ? 10 : 15
      const response = await fetch("http://localhost:8000/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fen: game.fen(), skill_level: skillLevel }),
      })

      if (response.ok) {
        const data = await response.json()
        
        if (!data.best_move || data.best_move.length < 4) {
          setGameStatus("CPU move failed - invalid response")
          return
        }

        const from = data.best_move.substring(0, 2)
        const to = data.best_move.substring(2, 4)
        const promotion = data.best_move.length > 4 ? data.best_move.substring(4, 5) : undefined

        if (from === to) {
          setGameStatus("CPU move failed - invalid move")
          return
        }

        const cpuMove = game.move({
          from,
          to,
          promotion,
        })

        if (cpuMove) {
          setFen(game.fen())
          setGameStatus(`CPU moved ${getPieceName(cpuMove.piece)} from ${cpuMove.from.toUpperCase()} to ${cpuMove.to.toUpperCase()}`)
          
          // Track CPU move
          setMoveHistory(prev => [...prev, {
            from: cpuMove.from,
            to: cpuMove.to,
            piece: getPieceName(cpuMove.piece),
            color: cpuMove.color === "w" ? "white" : "black"
          }])

          // Update king square if in check (delay until after animation)
          setTimeout(() => {
            if (game.isCheck()) {
              const board = game.board()
              let foundKing = null
              for (let row = 0; row < 8; row++) {
                for (let col = 0; col < 8; col++) {
                  const piece = board[row][col]
                  if (piece && piece.type === 'k' && piece.color === game.turn()) {
                    foundKing = `${String.fromCharCode(97 + col)}${8 - row}`
                    break
                  }
                }
                if (foundKing) break
              }
              setKingSquare(foundKing)
            } else {
              setKingSquare(null)
            }
            updateWinProbability()
          }, 600)

          if (game.isCheckmate()) {
            setGameStatus("CPU Checkmate!")
            setGameOver(true)
            handleGameAnalysis()
          } else if (game.isDraw()) {
            setGameStatus("Draw!")
            setGameOver(true)
            handleGameAnalysis()
          } else if (game.isCheck()) {
            const isWhiteTurn = game.turn() === "w"
            const isPlayerWhite = playerColor === "white"
            const isPlayerTurn = isWhiteTurn === isPlayerWhite
            setGameStatus(isPlayerTurn ? "CHECK! You must get out of check." : "CPU is in check!")
          }
        } else {
          setGameStatus("CPU move failed - illegal move")
        }
      } else {
        setGameStatus("CPU move failed - backend error")
      }
    } catch (error) {
      console.error("CPU move error:", error)
      setGameStatus("CPU move failed")
    } finally {
      setIsCpuThinking(false)
    }
  }

  const handleUndo = () => {
    if (game.history().length === 0) {
      setGameStatus("No moves to undo")
      return
    }

    game.undo()
    setFen(game.fen())
    setGameStatus("Last move undone")
    setGameOver(false)
    setKingSquare(null)
    
    // Remove last move from history
    setMoveHistory(prev => prev.slice(0, -1))
  }

  const handleNewGame = () => {
    const newGame = new Chess()
    setGame(newGame)
    setFen(newGame.fen())
    setGameStatus("New game started")
    setIsCpuThinking(false)
    setGameOver(false)
    setSelectedSquare(null)
    setLegalMoves([])
    setMoveHistory([])
    setGameAnalysis(null)
    setKingSquare(null)
    setWinProbability(null)
    
    // If playing as black in CPU mode, make CPU move first
    if (gameMode === "pvc" && playerColor === "black") {
      setTimeout(() => makeCpuMove(), 500)
    }
  }

  const handleBackToSetup = () => {
    router.push("/setup")
  }

  const updateWinProbability = async () => {
    try {
      const response = await fetch("http://localhost:8000/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fen: game.fen(), skill_level: 15 }),
      })
      const data = await response.json()
      console.log("Win probability data:", data)
      
      // Use the win probabilities directly from the API response
      if (data.white_win_prob !== undefined && data.black_win_prob !== undefined) {
        setWinProbability({ 
          white: data.white_win_prob * 100, 
          black: data.black_win_prob * 100 
        })
      } else {
        console.log("Win probabilities not in response, using fallback")
        setWinProbability({ white: 50, black: 50 })
      }
    } catch (error) {
      console.error("Win probability error:", error)
    }
  }

  const handleGameAnalysis = async () => {
    setLoading(true)
    try {
      const response = await fetch("http://localhost:8000/api/game-analysis", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          move_history: moveHistory,
          player_color: playerColor,
          game_mode: gameMode,
          difficulty: difficulty
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setGameAnalysis(data.analysis)
      } else {
        setGameAnalysis("Game analysis failed - backend may not be running")
      }
    } catch (error) {
      setGameAnalysis("Error connecting to backend for game analysis")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gray-900 text-white p-8">
      <div className="w-full">
        <h1 className="text-4xl font-bold mb-8 text-center">Chess Tutor</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-3 bg-gray-800 p-6 rounded-lg">
            <h2 className="text-2xl font-semibold mb-4">Game Status</h2>
            <p className={`text-lg ${game.isCheck() ? "text-red-400 font-bold" : ""}`}>{gameStatus}</p>
            
            <div className="mt-4">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-300">White: {winProbability ? winProbability.white.toFixed(1) : "50.0"}%</span>
                <span className="text-gray-300">Black: {winProbability ? winProbability.black.toFixed(1) : "50.0"}%</span>
              </div>
              <div className="w-full h-4 bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-white transition-all duration-500"
                  style={{ width: `${winProbability ? winProbability.white : 50}%` }}
                />
              </div>
            </div>
            
            <div className="mt-6">

              <h3 className="text-xl font-semibold mb-3 mt-6">Game Settings</h3>
              <div className="mb-4">
                <label className="block mb-2 text-sm">Game Mode</label>
                <select
                  value={gameMode}
                  onChange={(e) => setGameMode(e.target.value as GameMode)}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded"
                >
                  <option value="pvp">Player vs Player</option>
                  <option value="pvc">Player vs CPU</option>
                </select>
              </div>

              {gameMode === "pvc" && (
                <>
                  <div className="mb-4">
                    <label className="block mb-2 text-sm">Play as</label>
                    <select
                      value={playerColor}
                      onChange={(e) => setPlayerColor(e.target.value as "white" | "black")}
                      className="w-full bg-gray-700 text-white px-4 py-2 rounded"
                    >
                      <option value="white">White</option>
                      <option value="black">Black</option>
                    </select>
                  </div>

                  <div className="mb-4">
                    <label className="block mb-2 text-sm">Difficulty</label>
                    <select
                      value={difficulty}
                      onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                      className="w-full bg-gray-700 text-white px-4 py-2 rounded"
                    >
                      <option value="easy">Easy (~800 Elo)</option>
                      <option value="medium">Medium (~1500 Elo)</option>
                      <option value="hard">Hard (~2000 Elo)</option>
                    </select>
                  </div>
                </>
              )}

              <h3 className="text-xl font-semibold mb-3 mt-6">Controls</h3>
              <button 
                onClick={handleBackToSetup}
                className="bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded mr-2 mb-2 w-full"
              >
                Back to Setup
              </button>
              <button 
                onClick={handleNewGame}
                className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded mr-2 mb-2 w-full"
              >
                New Game
              </button>
              <button 
                onClick={handleUndo}
                className="bg-orange-600 hover:bg-orange-700 px-4 py-2 rounded mr-2 mb-2 w-full"
              >
                Undo Last Move
              </button>

              {gameOver && (
                <div className="mt-4 text-red-400 font-semibold">
                  Game Over - Start a new game
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-6 bg-gray-800 p-8 rounded-lg flex flex-col items-center justify-center">
            <h2 className="text-2xl font-semibold mb-6">Chess Board</h2>
            <div className="flex justify-center items-center">
              <Chessboard 
                position={fen} 
                onSquareClick={onSquareClick}
                onDrop={({ sourceSquare, targetSquare }: { sourceSquare: string; targetSquare: string }) => {
                  // Check if move is valid
                  const move = game.move({
                    from: sourceSquare as any,
                    to: targetSquare as any,
                    promotion: "q",
                  })

                  if (move === null) {
                    setGameStatus("Illegal move! Try again.")
                    return false
                  }

                  setFen(game.fen())
                  setGameStatus(`Moved ${getPieceName(move.piece)} from ${sourceSquare.toUpperCase()} to ${targetSquare.toUpperCase()}`)
      
                  // Track move
                  setMoveHistory(prev => [...prev, {
                    from: sourceSquare,
                    to: targetSquare,
                    piece: getPieceName(move.piece),
                    color: move.color === "w" ? "white" : "black"
                  }])

      // Update king square if in check (delay until after animation)
      setTimeout(() => {
        if (game.isCheck()) {
          const board = game.board()
          let foundKing = null
          for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
              const piece = board[row][col]
              if (piece && piece.type === 'k' && piece.color === game.turn()) {
                foundKing = `${String.fromCharCode(97 + col)}${8 - row}`
                break
              }
            }
            if (foundKing) break
          }
          setKingSquare(foundKing)
        } else {
          setKingSquare(null)
        }
        updateWinProbability()
      }, 600)

      if (game.isCheckmate()) {
        setGameStatus("Checkmate!")
        setGameOver(true)
        handleGameAnalysis()
      } else if (game.isDraw()) {
        setGameStatus("Draw!")
        setGameOver(true)
        handleGameAnalysis()
      } else if (game.isCheck()) {
        const isWhiteTurn = game.turn() === "w"
        const isPlayerWhite = playerColor === "white"
        const isPlayerTurn = isWhiteTurn === isPlayerWhite
        setGameStatus(isPlayerTurn ? "CHECK! You must get out of check." : "CPU is in check!")
        if (gameMode === "pvc") {
          makeCpuMove()
        }
      } else if (gameMode === "pvc") {
        makeCpuMove()
      }

      setSelectedSquare(null)
      setLegalMoves([])
      return true
    }}
                squareStyles={{
                  ...(selectedSquare && {
                    [selectedSquare]: {
                      backgroundColor: "rgba(255, 255, 0, 0.5)"
                    }
                  }),
                  ...(kingSquare && {
                    [kingSquare]: {
                      backgroundColor: "rgba(255, 0, 0, 0.6)"
                    }
                  }),
                  ...Object.fromEntries(legalMoves.map(square => [
                    square, 
                    { backgroundColor: "rgba(0, 255, 0, 0.3)" }
                  ]))
                }}
                draggable={true}
                width={600}
                transitionDuration={600}
                orientation={playerColor === "black" ? "black" : "white"}
              />
            </div>
          </div>

          <div className="lg:col-span-3 bg-gray-800 p-6 rounded-lg flex flex-col h-full">
            <h2 className="text-2xl font-semibold mb-4">Game Analysis</h2>
            {gameOver && gameAnalysis && (
              <div className="p-4 bg-purple-900 rounded-lg flex-grow overflow-y-auto">
                <div 
                  className="text-purple-300 text-sm"
                  dangerouslySetInnerHTML={{ __html: gameAnalysis }}
                />
              </div>
            )}
            {!gameOver && (
              <p className="text-gray-400 text-sm">Complete a game to get AI analysis</p>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}

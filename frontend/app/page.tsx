"use client"

import { useState, useEffect } from "react"
import dynamic from "next/dynamic"

const Chessboard = dynamic(() => import("chessboardjsx"), { ssr: false })
import { Chess } from "chess.js"

export default function Home() {
  const [game] = useState(new Chess())
  const [fen, setFen] = useState(game.fen())
  const [gameStatus, setGameStatus] = useState("Ready to play")
  const [analysis, setAnalysis] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const onDrop = ({ sourceSquare, targetSquare }: { sourceSquare: string; targetSquare: string }) => {
    const move = game.move({
      from: sourceSquare,
      to: targetSquare,
      promotion: "q",
    })

    if (move === null) return

    setFen(game.fen())
    setGameStatus(`Moved ${move.piece} from ${sourceSquare} to ${targetSquare}`)
    setAnalysis(null)

    if (game.isCheckmate()) {
      setGameStatus("Checkmate!")
    } else if (game.isDraw()) {
      setGameStatus("Draw!")
    } else if (game.isCheck()) {
      setGameStatus("Check!")
    }
  }

  const handleNewGame = () => {
    game.reset()
    setFen(game.fen())
    setGameStatus("New game started")
    setAnalysis(null)
  }

  const handleAnalysis = async () => {
    setLoading(true)
    try {
      const response = await fetch("http://localhost:8000/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fen }),
      })

      if (response.ok) {
        const data = await response.json()
        setAnalysis(`Best move: ${data.best_move}, Evaluation: ${data.evaluation}`)
      } else {
        setAnalysis("Analysis failed - backend may not be running")
      }
    } catch (error) {
      setAnalysis("Error connecting to backend")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-center">Chess Tutor</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-gray-800 p-6 rounded-lg">
            <h2 className="text-2xl font-semibold mb-4">Chess Board</h2>
            <div className="flex justify-center">
              <Chessboard position={fen} onDrop={onDrop} />
            </div>
          </div>

          <div className="bg-gray-800 p-6 rounded-lg">
            <h2 className="text-2xl font-semibold mb-4">Game Status</h2>
            <p className="text-lg">{gameStatus}</p>
            
            {analysis && (
              <div className="mt-4 p-4 bg-green-900 rounded-lg">
                <p className="text-green-300">{analysis}</p>
              </div>
            )}
            
            <div className="mt-6">
              <h3 className="text-xl font-semibold mb-3">Controls</h3>
              <button 
                onClick={handleNewGame}
                className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded mr-2"
              >
                New Game
              </button>
              <button 
                onClick={handleAnalysis}
                disabled={loading}
                className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded disabled:bg-gray-600"
              >
                {loading ? "Analyzing..." : "Get Analysis"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

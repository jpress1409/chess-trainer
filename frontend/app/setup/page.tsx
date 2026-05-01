"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

type GameMode = "pvp" | "pvc"
type Difficulty = "easy" | "medium" | "hard"
type PlayerColor = "white" | "black"

export default function SetupPage() {
  const router = useRouter()
  const [gameMode, setGameMode] = useState<GameMode>("pvp")
  const [playerColor, setPlayerColor] = useState<PlayerColor>("white")
  const [difficulty, setDifficulty] = useState<Difficulty>("medium")

  const handleStartGame = () => {
    const params = new URLSearchParams()
    params.set("mode", gameMode)
    params.set("color", playerColor)
    params.set("difficulty", difficulty)
    router.push(`/game?${params.toString()}`)
  }

  return (
    <main className="min-h-screen bg-gray-900 text-white p-8 flex items-center justify-center">
      <div className="max-w-md w-full bg-gray-800 p-8 rounded-lg">
        <h1 className="text-4xl font-bold mb-8 text-center">Chess Tutor</h1>
        
        <div className="space-y-6">
          <div>
            <label className="block mb-2 text-lg font-semibold">Game Mode</label>
            <select
              value={gameMode}
              onChange={(e) => setGameMode(e.target.value as GameMode)}
              className="w-full bg-gray-700 text-white px-4 py-3 rounded"
            >
              <option value="pvp">Player vs Player</option>
              <option value="pvc">Player vs CPU</option>
            </select>
          </div>

          {gameMode === "pvc" && (
            <>
              <div>
                <label className="block mb-2 text-lg font-semibold">Play as</label>
                <select
                  value={playerColor}
                  onChange={(e) => setPlayerColor(e.target.value as PlayerColor)}
                  className="w-full bg-gray-700 text-white px-4 py-3 rounded"
                >
                  <option value="white">White</option>
                  <option value="black">Black</option>
                </select>
              </div>

              <div>
                <label className="block mb-2 text-lg font-semibold">Difficulty</label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                  className="w-full bg-gray-700 text-white px-4 py-3 rounded"
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
            </>
          )}

          <button
            onClick={handleStartGame}
            className="w-full bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded text-lg font-semibold mt-8"
          >
            Start Game
          </button>
        </div>
      </div>
    </main>
  )
}

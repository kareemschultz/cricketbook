import type { Match, Innings, BatsmanEntry, BowlerEntry } from "@/types/cricket"
import { formatOvers } from "./cricket-engine"

// ─── Text scorecard ────────────────────────────────────────────────────────────

function pad(str: string, len: number): string {
  return str.length >= len ? str.slice(0, len) : str + " ".repeat(len - str.length)
}

function formatBatsmanRow(entry: BatsmanEntry): string {
  const name = pad(entry.isOut ? entry.playerName : `${entry.playerName}*`, 20)
  const dismissal = pad(entry.dismissalText, 20)
  const r = pad(String(entry.runs), 4)
  const b = pad(String(entry.balls), 4)
  const fours = pad(String(entry.fours), 3)
  const sixes = pad(String(entry.sixes), 3)
  const sr = entry.balls > 0 ? ((entry.runs / entry.balls) * 100).toFixed(1) : "0.0"
  return `${name}${dismissal}${r}${b}${fours}${sixes}${pad(sr, 6)}`
}

function formatBowlerRow(entry: BowlerEntry): string {
  const name = pad(entry.playerName, 20)
  const overs = pad(`${entry.overs}${entry.balls > 0 ? "." + entry.balls : ""}`, 5)
  const m = pad(String(entry.maidens), 3)
  const r = pad(String(entry.runs), 4)
  const w = pad(String(entry.wickets), 3)
  const eco = entry.legalDeliveries > 0 ? entry.economy.toFixed(2) : "0.00"
  return `${name}${overs}${m}${r}${w}${pad(eco, 6)}`
}

function formatInningsText(innings: Innings, teamName: string, ballsPerOver: number): string {
  const lines: string[] = []
  lines.push(`${teamName.toUpperCase()} BATTING`)
  lines.push(`${"─".repeat(60)}`)
  lines.push(`${pad("Batsman", 20)}${pad("Dismissal", 20)}${pad("R", 4)}${pad("B", 4)}${pad("4s", 3)}${pad("6s", 3)}${"SR"}`)
  lines.push(`${"─".repeat(60)}`)
  for (const b of innings.battingCard) {
    lines.push(formatBatsmanRow(b))
  }
  lines.push(`${"─".repeat(60)}`)
  const { wide, noBall, bye, legBye, penalty } = innings.extras
  lines.push(`Extras (W:${wide} NB:${noBall} B:${bye} LB:${legBye} Pen:${penalty}): ${innings.extras.total}`)
  lines.push(
    `TOTAL: ${innings.totalRuns}/${innings.totalWickets} (${formatOvers(innings.totalLegalDeliveries, ballsPerOver)} ov)`
  )

  if (innings.fallOfWickets.length > 0) {
    lines.push("")
    lines.push("Fall of Wickets:")
    lines.push(innings.fallOfWickets.map((f) => `${f.wicketNumber}-${f.score} (${f.playerName}, ${f.overs})`).join("  "))
  }

  lines.push("")
  lines.push(`${teamName.toUpperCase()} BOWLING`)
  lines.push(`${"─".repeat(60)}`)
  lines.push(`${pad("Bowler", 20)}${pad("O", 5)}${pad("M", 3)}${pad("R", 4)}${pad("W", 3)}${"Eco"}`)
  lines.push(`${"─".repeat(60)}`)
  for (const b of innings.bowlingCard) {
    lines.push(formatBowlerRow(b))
  }
  lines.push(`${"─".repeat(60)}`)

  return lines.join("\n")
}

export function buildTextScorecard(match: Match, teamNames: Record<string, string>): string {
  const lines: string[] = []
  lines.push("ScoreFlow Scorecard")
  lines.push("═".repeat(60))
  lines.push(`${match.team1Name} vs ${match.team2Name}`)
  lines.push(`${match.format}  •  ${match.date instanceof Date ? match.date.toDateString() : new Date(match.date).toDateString()}${match.venue ? "  •  " + match.venue : ""}`)
  lines.push("")

  for (const innings of match.innings) {
    const battingTeamName = teamNames[innings.battingTeamId] ?? innings.battingTeamId
    lines.push(formatInningsText(innings, battingTeamName, match.rules.ballsPerOver))
    lines.push("")
  }

  if (match.result) {
    lines.push("═".repeat(60))
    lines.push(match.result)
  }

  lines.push("")
  lines.push("Scored with ScoreFlow")
  return lines.join("\n")
}

export async function copyTextScorecard(match: Match, teamNames: Record<string, string>): Promise<void> {
  const text = buildTextScorecard(match, teamNames)
  await navigator.clipboard.writeText(text)
}

// ─── Image share ───────────────────────────────────────────────────────────────

export async function shareAsImage(elementId: string, filename = "scorecard.png"): Promise<void> {
  const { default: html2canvas } = await import("html2canvas")
  const element = document.getElementById(elementId)
  if (!element) return

  const canvas = await html2canvas(element, {
    backgroundColor: "#1a1a2e",
    scale: 2,
    useCORS: true,
  })

  canvas.toBlob(async (blob) => {
    if (!blob) return
    const file = new File([blob], filename, { type: "image/png" })

    if (navigator.share && navigator.canShare({ files: [file] })) {
      await navigator.share({
        title: "ScoreFlow Scorecard",
        files: [file],
      })
    } else {
      // Fallback: download
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    }
  }, "image/png")
}

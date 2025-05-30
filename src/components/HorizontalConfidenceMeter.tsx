import React from "react"

interface HorizontalConfidenceMeterProps {
  /** 1.0 – 10.0 */
  value: number
  /** total segments */
  segments?: number
  /** bar thickness in px */
  height?: number
}

export const HorizontalConfidenceMeter: React.FC<HorizontalConfidenceMeterProps> = ({
  value,
  segments = 10,
  height = 8,
}) => {
  // clamp to [1,10]
  const v = Math.max(1, Math.min(10, value))
  // fraction along the bar (0…1)
  const frac = (v - 1) / (segments - 1)
  const bubbleLeft = `${frac * 100}%`

  // build an array of inline‐style objects, each a little segment
  const bars = Array.from({ length: segments }, (_, i) => {
    const pos = i / (segments - 1) // 0 → 1
    // hue: red→yellow for first half, yellow→green for second
    const hue = pos < 0.5
      ? (pos * 2) * 60            // 0→60
      : 60 + ((pos - 0.5) * 2) * 60 // 60→120
    return { backgroundColor: `hsl(${hue},80%,50%)` }
  })

  return (
    <div className="relative w-full select-none">
      <div className="flex w-full" style={{ height }}>
        {bars.map((styleObj, i) => (
          <div key={i} style={{ ...styleObj, flex: 1 }} />
        ))}
      </div>
      <div
        className="absolute -top-5 flex flex-col items-center"
        style={{ left: bubbleLeft, transform: "translateX(-50%)" }}
      >
        <div className="text-xs font-medium bg-blue-600 text-white px-1 rounded">
          {v.toFixed(1)}
        </div>
        <div className="w-2 h-2 bg-blue-600 rounded-full mt-0.5" />
      </div>
    </div>
  )
}

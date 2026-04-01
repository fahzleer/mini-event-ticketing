type Props = { remaining: number; total: number }

export function TicketBadge({ remaining, total }: Props) {
  const pct = total > 0 ? remaining / total : 0
  const isSoldOut = remaining === 0
  const isLow = pct < 0.1 && !isSoldOut

  const color = isSoldOut
    ? "bg-gray-200 text-gray-500"
    : isLow
      ? "bg-red-100 text-red-700"
      : "bg-green-100 text-green-700"

  return (
    <span className={`px-2 py-1 rounded text-sm font-medium ${color}`}>
      {isSoldOut ? "Sold out" : isLow ? `Only ${remaining} left!` : `${remaining} left`}
    </span>
  )
}

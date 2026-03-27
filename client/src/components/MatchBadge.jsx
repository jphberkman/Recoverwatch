export function MatchBadge({ score }) {
  const s = (score || 'unlikely').toLowerCase();
  if (s === 'high') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-950/80 px-2.5 py-0.5 text-xs font-medium text-red-200 ring-1 ring-red-800">
        <span aria-hidden>🔴</span> High Match
      </span>
    );
  }
  if (s === 'possible') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-950/80 px-2.5 py-0.5 text-xs font-medium text-amber-200 ring-1 ring-amber-800">
        <span aria-hidden>🟡</span> Possible Match
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-700/80 px-2.5 py-0.5 text-xs font-medium text-slate-300 ring-1 ring-slate-600">
      <span aria-hidden>⚪</span> Unlikely
    </span>
  );
}

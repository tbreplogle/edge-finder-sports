// components/SportTabs.tsx
const TABS = ["mlb","ncaaf","nfl","ncaab"] as const;
export type Sport = typeof TABS[number];

export default function SportTabs({ sport, onChange }:{sport:Sport, onChange:(s:Sport)=>void}) {
  return (
    <div className="flex gap-2">
      {TABS.map(s => (
        <button
          key={s}
          className={`px-3 py-1 rounded ${sport===s ? "bg-black text-white" : "bg-gray-200"}`}
          onClick={()=>onChange(s)}
        >
          {s.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

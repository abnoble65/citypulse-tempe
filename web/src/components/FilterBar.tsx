import { COLORS, FONTS } from "../theme";
import { NEIGHBORHOODS } from "../data";

interface FilterBarProps {
  selected: string;
  onSelect: (name: string) => void;
}

export function FilterBar({ selected, onSelect }: FilterBarProps) {
  return (
    <div style={{
      display: "flex", gap: 8, padding: "14px 32px",
      background: COLORS.white,
      borderBottom: `1px solid ${COLORS.lightBorder}`,
      overflowX: "auto",
      flexWrap: "wrap",
    }}>
      {NEIGHBORHOODS.map(n => {
        const active = selected === n.name;
        return (
          <button key={n.name} onClick={() => onSelect(n.name)}
            style={{
              background: active ? COLORS.orangePale : COLORS.cream,
              color: active ? COLORS.orange : COLORS.midGray,
              border: active ? `1.5px solid ${COLORS.orange}` : `1.5px solid transparent`,
              borderRadius: 24,
              padding: "7px 16px", fontSize: 13, fontWeight: 600,
              cursor: "pointer", transition: "all 0.2s",
              fontFamily: FONTS.body,
              whiteSpace: "nowrap",
              display: "flex", alignItems: "center", gap: 7,
            }}
          >
            <n.Icon size={18} color={active ? COLORS.orange : COLORS.warmGray} />
            {n.name}
          </button>
        );
      })}
    </div>
  );
}

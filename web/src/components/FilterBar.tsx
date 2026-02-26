import { COLORS, FONTS } from "../theme";
import { DistrictIcon } from "./Icons";
import type { DistrictConfig } from "../districts";

interface FilterBarProps {
  districtConfig: DistrictConfig;
  selected: string;
  onSelect: (name: string) => void;
}

export function FilterBar({ districtConfig, selected, onSelect }: FilterBarProps) {
  const pills = [
    { name: districtConfig.allLabel, Icon: DistrictIcon },
    ...districtConfig.neighborhoods.map(n => ({ name: n.name, Icon: n.Icon })),
  ];

  return (
    <div className="cp-filter" style={{
      display: "flex", gap: 8, padding: "14px 16px",
      background: COLORS.white,
      borderBottom: `1px solid ${COLORS.lightBorder}`,
      overflowX: "auto",
      flexWrap: "nowrap",
    }}>
      {pills.map(({ name, Icon }) => {
        const active = selected === name;
        return (
          <button key={name} onClick={() => onSelect(name)}
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
            <Icon size={18} color={active ? COLORS.orange : COLORS.warmGray} />
            {name}
          </button>
        );
      })}
    </div>
  );
}

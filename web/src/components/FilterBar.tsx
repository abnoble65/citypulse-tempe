import { COLORS, FONTS } from "../theme";
import { DistrictIcon } from "./Icons";
import type { DistrictConfig } from "../districts";

interface FilterBarProps {
  districtConfig: DistrictConfig;
  selected: string;
  onSelect: (name: string) => void;
  /** When true, pills wrap to multiple lines instead of horizontal scrolling */
  wrap?: boolean;
}

export function FilterBar({ districtConfig, selected, onSelect, wrap = false }: FilterBarProps) {
  const pills = [
    { name: districtConfig.allLabel, Icon: DistrictIcon },
    ...districtConfig.neighborhoods.map(n => ({ name: n.name, Icon: n.Icon })),
  ];

  return (
    <div style={{ position: "relative" }}>
      <div className="cp-filter" style={{
        display: "flex", gap: 8, padding: "10px 16px",
        paddingBottom: wrap ? 10 : 14, /* extra space so scrollbar doesn't overlap pills */
        background: COLORS.white,
        borderBottom: `1px solid ${COLORS.lightBorder}`,
        ...(wrap
          ? { flexWrap: "wrap" as const }
          : { overflowX: "auto" as const, WebkitOverflowScrolling: "touch" as const, flexWrap: "nowrap" as const, scrollbarWidth: "none" as const }
        ),
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
                flexShrink: 0,
                flexGrow: 0,
                minWidth: "max-content", /* key: size to content, defeats all width constraints */
                overflow: "visible",     /* prevent any clipping on WebKit */
                display: "flex", alignItems: "center", gap: 7,
              }}
            >
              <Icon size={18} color={active ? COLORS.orange : COLORS.warmGray} />
              {name}
            </button>
          );
        })}
        {/* Trailing spacer — prevents last pill clipping on iOS overflow:auto */}
        <div style={{ flexShrink: 0, width: 16 }} aria-hidden="true" />
      </div>
      {/* Fade hint on right edge — signals more pills off-screen */}
      {!wrap && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute", top: 0, right: 0, bottom: 0, width: 40,
            background: `linear-gradient(to right, transparent, ${COLORS.white})`,
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
}

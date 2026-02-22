import { COLORS, FONTS } from "../theme";

export function SectionLabel({ text }: { text: string }) {
  return (
    <div style={{
      display: "inline-block",
      background: COLORS.orangePale,
      color: COLORS.orange,
      padding: "5px 14px", borderRadius: 20,
      fontSize: 11, fontWeight: 700,
      letterSpacing: "0.1em",
      textTransform: "uppercase",
      marginBottom: 16,
      fontFamily: FONTS.body,
    }}>{text}</div>
  );
}

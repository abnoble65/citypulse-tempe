import { useState, useEffect } from "react";
import { FONTS } from "../theme";
import { CityPulseLogo } from "./Icons";

interface SplashScreenProps {
  onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [phase, setPhase] = useState(0);
  // 0: dark, image fades in        (0s)
  // 1: logo appears + zoom begins  (0.8s)
  // 2: title sweeps in             (1.6s)
  // 3: tagline + pulse line        (2.4s)
  // 4: hold                        (3.6s)
  // 5: fade out                    (4.6s)

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 800),
      setTimeout(() => setPhase(2), 1600),
      setTimeout(() => setPhase(3), 2400),
      setTimeout(() => setPhase(4), 3600),
      setTimeout(() => setPhase(5), 4600),
      setTimeout(() => onComplete(), 5400),
    ];
    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        overflow: "hidden",
        background: "#0A0806",
        opacity: phase >= 5 ? 0 : 1,
        transition: "opacity 0.8s ease",
      }}
    >
      {/* Background image with Ken Burns zoom */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "url(/images/Temp_Abstract.png)",
          backgroundSize: "cover",
          backgroundPosition: "center center",
          transform: phase >= 1 ? "scale(1.05)" : "scale(1.0)",
          opacity: phase >= 1 ? 1 : 0.6,
          transition:
            "transform 5s cubic-bezier(0.25, 0.1, 0.25, 1), opacity 1.2s ease",
          filter: "brightness(0.85)",
        }}
      />

      {/* Radial vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at center, transparent 20%, rgba(10,8,6,0.45) 70%, rgba(10,8,6,0.85) 100%)",
        }}
      />

      {/* Bottom gradient for text legibility */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "60%",
          background:
            "linear-gradient(180deg, transparent 0%, rgba(10,8,6,0.4) 40%, rgba(10,8,6,0.75) 100%)",
        }}
      />

      {/* Content */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10,
        }}
      >
        {/* Logo */}
        <div
          style={{
            opacity: phase >= 1 ? 1 : 0,
            transform:
              phase >= 1
                ? "translateY(0) scale(1)"
                : "translateY(20px) scale(0.9)",
            transition: "all 0.8s cubic-bezier(0.22, 1, 0.36, 1)",
            marginBottom: 28,
            filter: "drop-shadow(0 4px 24px rgba(0,0,0,0.5))",
          }}
        >
          <CityPulseLogo size={80} />
        </div>

        {/* Title */}
        <div style={{ overflow: "hidden", marginBottom: 16, paddingBottom: 12 }}>
          <h1
            style={{
              fontFamily: FONTS.heading,
              fontSize: "clamp(36px, 10vw, 88px)",
              fontWeight: 800,
              letterSpacing: "-0.02em",
              lineHeight: 1,
              color: "#FDEAB0",
              opacity: phase >= 2 ? 1 : 0,
              transform:
                phase >= 2 ? "translateY(0)" : "translateY(100%)",
              transition: "all 0.9s cubic-bezier(0.22, 1, 0.36, 1)",
              textShadow:
                "0 2px 20px rgba(0,0,0,0.6), 0 4px 40px rgba(0,0,0,0.3)",
            }}
          >
            CityPulse
          </h1>
        </div>

        {/* Tagline */}
        <p
          style={{
            fontFamily: FONTS.body,
            fontSize: "clamp(13px, 2.5vw, 17px)",
            fontWeight: 500,
            color: "rgba(253,234,176,0.7)",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            opacity: phase >= 3 ? 1 : 0,
            transform:
              phase >= 3 ? "translateY(0)" : "translateY(12px)",
            transition: "all 0.7s cubic-bezier(0.22, 1, 0.36, 1)",
            textShadow: "0 1px 10px rgba(0,0,0,0.5)",
          }}
        >
          Urban Intelligence · Tempe
        </p>

        {/* Pulse heartbeat line */}
        <svg
          width="200"
          height="30"
          viewBox="0 0 200 30"
          style={{
            marginTop: 32,
            opacity: phase >= 3 ? 0.5 : 0,
            transition: "opacity 0.6s ease",
          }}
        >
          <path
            d="M0 15 L60 15 L75 5 L90 25 L105 10 L115 15 L200 15"
            fill="none"
            stroke="#F2C464"
            strokeWidth="2"
            strokeLinecap="round"
            className="pulse-draw"
          />
        </svg>
      </div>
    </div>
  );
}

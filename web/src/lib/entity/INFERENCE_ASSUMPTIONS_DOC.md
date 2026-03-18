# CityPulse Intelligence Signals — Methodology & Assumptions

**Version:** 1.0  
**Last updated:** March 2026  
**Applies to:** CityPulse SF FastCast, Sprint 6 and later  

---

## Purpose

This document explains how CityPulse computes its AI-derived intelligence signals.
It is intended for:

- **Customers** using CityPulse data to make investment, planning, or development decisions
- **Partners** (CC3D / Nextspace) embedding CityPulse intelligence in 3D scenes
- **Internal teams** reviewing signal methodology before deployment

Every signal is derived from public civic data using documented formulas. This document
describes what we measure, how we measure it, and where our estimates may fall short.

---

## Data Sources

All intelligence signals are derived from the following sources.

| Source | What It Provides | Access |
|--------|-----------------|--------|
| CC3D Building Models | Height, volume, footprint, roof geometry | CC3D / Nextspace API |
| SF Assessor Property Characteristics | Building use, year built, ownership, assessed value | DataSF Socrata API |
| DBI Building Permits | Permit history, renovation dates, occupancy type | DataSF Socrata API |
| SF Planning Zoning Districts | Zoning code, special districts | SF Planning GIS ArcGIS REST |
| SF Height & Bulk Districts | Height limits, bulk district controls | SF Planning GIS ArcGIS REST |
| SF Energy Benchmarking | Site EUI, ENERGY STAR score | DataSF Socrata API |
| CityPulse AI Inference Engine | Derived scores and signals | Computed — no external source |

All civic datasets are public records. CityPulse does not purchase or use proprietary data
for any signal described in this document unless explicitly noted.

---

## Signals Reference

### 1. Development Readiness Score (0–100)

**What it measures:** How ready a parcel is for new development or major renovation,
based on available zoning capacity, recent permit activity, planning commission attention,
and building age.

**Formula:**

```
Score = headroom_component + permit_component + hearing_component + age_component
```

| Component | Weight | How it's computed |
|-----------|--------|-------------------|
| Height headroom | 40 pts | (zoning limit − actual height) / 50m × 40. Capped at 40. |
| Permit activity | 25 pts | min(total permits, 10) / 10 × 25 |
| Hearing activity | 15 pts | min(total hearings, 5) / 5 × 15 |
| Building age | 20 pts | min(age in years, 50) / 50 × 20 |

**Label thresholds:**

| Score | Label | Meaning |
|-------|-------|---------|
| 75–100 | PRIME | Strong indicators across multiple dimensions |
| 50–74 | HIGH | Above-average readiness |
| 25–49 | WATCH | Some signals present; monitor for changes |
| 0–24 | LOW | Limited near-term development indicators |

**Limitations and disclosures:**

- Height headroom is a geometric measure only. It does not account for shadow ordinances
  (San Francisco Proposition K), setback requirements, or discretionary review likelihood,
  any of which may prevent a building from reaching its theoretical height limit.
- Permit activity is a volume count. It does not distinguish permit type. A cosmetic
  renovation and a structural addition each count equally.
- Hearing activity does not reflect hearing outcome. A denied project counts the same
  as an approved one.
- Building age does not account for historic landmark designation or conservation easements,
  which may restrict redevelopment regardless of age.
- **This score is a signal, not a feasibility determination.** It should be used to
  prioritise further investigation, not as a substitute for a qualified feasibility study.

---

### 2. Development Readiness Label (PRIME / HIGH / WATCH / LOW)

**What it measures:** A categorical summary of the readiness score.

**Formula:** Threshold applied to the readiness score (see table above).

**Limitations:** Same as readiness score.

---

### 3. Redevelopment Potential Score (0–100)

**What it measures:** The fraction of the allowed zoning height envelope that is
currently unused. A building at its height limit scores 0. A low-rise building in
a high-rise zone scores near 100.

**Formula:**

```
Score = (zoning_height_limit − actual_height) / zoning_height_limit × 100
```

**Limitations and disclosures:**

- This is a pure geometric ratio. It does not reflect:
  - Shadow and sunlight ordinances that may block height additions
  - Historic preservation or landmark status
  - Below-grade conditions (soil quality, underground infrastructure)
  - Ownership structure (condominium regimes, ground leases)
  - Market demand for additional density in the specific zone
- A score of 100 does not mean a building can or should be redeveloped.
  It means the parcel is significantly under its allowed envelope.

---

### 4. Economic Activity Index (0–100)

**What it measures:** The level of recent economic and construction activity
associated with a building, based on permit volume, hearing frequency, and
recency of renovation.

**Formula:**

```
Index = permit_component + hearing_component + recency_component
```

| Component | Weight | How it's computed |
|-----------|--------|-------------------|
| Permit volume | 50 pts | min(total permits, 20) / 20 × 50 |
| Hearing activity | 30 pts | min(total hearings, 10) / 10 × 30 |
| Renovation recency | 20 pts | max(0, 1 − years since renovation / 20) × 20 |

**Limitations and disclosures:**

- Permit counts reflect DBI records only. Work done without permits is not captured.
- Hearing counts reflect planning commission agenda appearances. They do not
  distinguish the nature or outcome of the hearing.
- Recency decay is linear over 20 years. A renovation from 21 years ago
  contributes zero points regardless of its scale.

---

### 5. Sustainability Score (0–100)

**What it measures:** A composite measure of a building's energy efficiency and
rooftop solar suitability.

**Formula:**

```
Score = eui_component + rating_component + solar_component
```

| Component | Weight | How it's computed |
|-----------|--------|-------------------|
| Site EUI | 50 pts | min(SF average EUI / building EUI, 2) × 25 |
| ENERGY STAR rating | 30 pts | A=30, B=22, C=12, D=0 |
| Rooftop solar suitability | 20 pts | (1 − pitch/45°) × min(footprint/2000m², 1) × 20 |

**SF average EUI used as baseline:** 70 kBtu/sqft/yr  
*(Source: SF Department of Environment 2022 Existing Buildings Benchmarking Report)*

**Limitations and disclosures:**

- The SF average EUI is a single citywide figure. It does not account for building
  type. Data centres, hospitals, and laboratories have legitimately higher EUI
  than office buildings. A high-EUI score for a data centre does not indicate
  poor energy management.
- ENERGY STAR scores are self-reported by building owners through the ENERGY STAR
  Portfolio Manager platform. They are not independently verified by CityPulse
  unless the property holds active ENERGY STAR certification.
- Solar suitability is based on roof pitch and footprint area from CC3D geometry.
  It does not account for rooftop obstructions (HVAC equipment, elevator shafts,
  skylights) which commonly reduce usable solar area by 20–40%.
- Buildings not required to submit energy benchmarking data under SF's Existing
  Buildings Ordinance (generally properties under 10,000 sqft) will have null
  values for EUI and ENERGY STAR score. Their sustainability score will be null
  unless roof geometry data is available.

---

### 6. Carbon Emissions Estimate (metric tons CO₂e / year)

**What it measures:** An estimate of annual carbon emissions from building energy
use, derived from measured or reported site EUI and estimated floor area.

**Formula:**

```
Estimated floor area (sqft) = CC3D footprint (m²) × estimated stories × 10.7639
Estimated stories            = round(building height (m) / 4m per floor)
Total site energy (kBtu/yr)  = site EUI × estimated floor area
Carbon emissions             = total site energy × 0.000233 metric tons CO₂e/kBtu
```

**Grid emission factor:** 0.000233 metric tons CO₂e per kBtu  
*(Source: PG&E 2022 Power Content Label — annual average, converted from lbs CO₂e/kWh)*

**Limitations and disclosures:**

- **This is an estimate, not a measured value.** It is derived from a reported
  or benchmarked site EUI multiplied by an estimated floor area.
- Floor area is estimated from CC3D building geometry (footprint × height / 4m
  per floor). Actual floor area can differ from this estimate by ±15% due to
  atrium floors, mechanical floors, podium levels, and structural variation.
- The grid emission factor is an annual average. Actual emissions vary by time
  of day and season. This estimate does not model time-of-use variation.
- **Scope 1 emissions are not included.** Natural gas heating, on-site combustion,
  and vehicle fleet emissions are not captured in this estimate.
- On-site renewable generation (solar panels, fuel cells) is not deducted.
  A building with significant on-site solar may have lower actual grid emissions
  than this estimate suggests.
- This estimate should not be used for regulatory reporting, carbon credit
  calculations, or compliance filings without independent verification.

---

## What CityPulse Does Not Model

The following factors are not currently captured in any CityPulse signal:

| Factor | Why it matters | Status |
|--------|---------------|--------|
| Landmark / historic designation | Restricts redevelopment regardless of envelope | Not modelled — Sprint 7 candidate |
| Shadow ordinances (Prop K) | Blocks height additions in many SF districts | Not modelled — Sprint 7 candidate |
| Soil and foundation conditions | May make development uneconomic despite zoning | Not modelled — requires external data |
| Ownership structure | Ground leases, condo regimes block redevelopment | Not modelled |
| Scope 1 emissions (gas, fleet) | Material in many building types | Not modelled — Sprint 8 candidate |
| On-site renewable generation | Reduces actual grid emissions | Not modelled |
| Permit type distinctions | Cosmetic vs structural weight differently | Planned improvement |
| Hearing outcome | Approved vs denied hearings weight differently | Planned improvement |

---

## Calibration Status

All scoring weights and thresholds are based on internal calibration against
SF Financial District commercial parcels as of Q1 2026. They have not yet been
validated against other SF districts or other markets.

**Planned calibration work:**

- Validate readiness score against known SF development outcomes (2015–2024)
- Calibrate EUI baseline per building type (office, retail, residential)
- Expand to Alameda County and Santa Clara County datasets (county expansion roadmap)

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | March 2026 | Initial release — SF FastCast, Sprint 6 |

---

*Questions about this methodology should be directed to the CityPulse product team.
This document is updated with each sprint that modifies inference logic.*

import { CoitTowerIcon, TransamericaIcon, ChinatownGateIcon, CableCarIcon, DistrictIcon } from "./components/Icons";

export interface Neighborhood {
  name: string;
  zip: string | null;
  Icon: React.FC<{ size?: number; color?: string }>;
}

export const NEIGHBORHOODS: Neighborhood[] = [
  { name: "All District 3", zip: null, Icon: DistrictIcon },
  { name: "North Beach", zip: "94133", Icon: CoitTowerIcon },
  { name: "Financial District", zip: "94111", Icon: TransamericaIcon },
  { name: "Chinatown", zip: "94108", Icon: ChinatownGateIcon },
  { name: "Russian Hill", zip: "94109", Icon: CableCarIcon },
];

export const MOCK_PERMITS = [
  { address: "350 Bush St", value: 12.4, type: "Commercial", status: "Issued" },
  { address: "600 Stockton St", value: 8.7, type: "Residential", status: "Filed" },
  { address: "1 Grant Ave", value: 6.2, type: "Mixed Use", status: "Issued" },
  { address: "888 Kearny St", value: 5.8, type: "Commercial", status: "Complete" },
  { address: "1200 Columbus Ave", value: 4.9, type: "Residential", status: "Filed" },
  { address: "455 Broadway", value: 4.1, type: "Retail", status: "Issued" },
  { address: "200 Bay St", value: 3.6, type: "Mixed Use", status: "Filed" },
  { address: "770 Pacific Ave", value: 2.8, type: "Residential", status: "Complete" },
  { address: "333 Grant Ave", value: 2.3, type: "Retail", status: "Issued" },
  { address: "50 Francisco St", value: 1.9, type: "Residential", status: "Filed" },
];

export const MOCK_STATUS = [
  { name: "Issued", value: 312, pct: 38, color: "#D4643B" },
  { name: "Filed", value: 267, pct: 33, color: "#E8845E" },
  { name: "Complete", value: 156, pct: 19, color: "#5B9A5F" },
  { name: "Expired", value: 82, pct: 10, color: "#B0A89E" },
];

export const MOCK_VALUE_BY_TYPE = [
  { type: "Commercial", val: 22.4, color: "#D4643B" },
  { type: "Residential", val: 14.1, color: "#E8845E" },
  { type: "Mixed Use", val: 9.8, color: "#D4963B" },
  { type: "Retail", val: 5.9, color: "#5B9A5F" },
];

export interface HearingDetail {
  majorActions: string;
  commissionerConcerns: { name: string; concern: string }[];
  publicImpact: string[];
  publicSentiment?: {
    speakers: number;
    forProject: number;
    againstProject: number;
    neutral: number;
    topThemes: string[];
    notableQuotes: string[];
    source: "sfgovtv_captions" | "minutes_pdf";
  };
  videoUrl?: string;
}

export interface Hearing {
  date: string;
  address: string;
  action: "Approved" | "Continued" | "Disapproved";
  votes: { aye: number; nay: number; absent: number };
  desc: string;
  shadow: boolean;
  detail: HearingDetail;
}

export const MOCK_HEARINGS: Hearing[] = [
  {
    date: "Jan 16, 2025",
    address: "350 Bush St",
    action: "Approved",
    votes: { aye: 5, nay: 1, absent: 1 },
    desc: "Office-to-residential conversion, 120 units with ground floor retail.",
    shadow: true,
    detail: {
      majorActions: "The Commission approved a Conditional Use Authorization for the conversion of a 14-story office building to 120 residential units with 8,400 sq ft of ground-floor retail. The approval includes conditions requiring 15% below-market-rate units on-site, a $2.1M transportation impact fee, and completion of a Section 295 shadow study before construction permits are issued. The project sponsor agreed to a modified setback on the south facade to reduce shadow impact on St. Mary's Square.",
      commissionerConcerns: [
        {
          name: "Commissioner Moore",
          concern: "Expressed concern about the cumulative effect of office-to-residential conversions on the district's commercial tax base. Requested that staff prepare a fiscal impact analysis before additional conversion projects are heard. Noted that the loss of Class B office space may be irreversible."
        },
        {
          name: "Commissioner Imperial",
          concern: "Questioned whether 15% BMR is sufficient given the project's location in a transit-rich area. Urged the sponsor to consider 20% BMR or deeper affordability levels. Also raised concerns about construction-phase impacts on adjacent Chinatown businesses."
        },
        {
          name: "Commissioner Braun",
          concern: "Voted nay. Argued that the shadow impact on St. Mary's Square has not been adequately studied and that the modified setback is insufficient. Called for a full Section 295 hearing before approval rather than as a condition."
        },
      ],
      publicImpact: [
        "Shadow impact on St. Mary's Square during afternoon hours (Oct–Feb) pending full Section 295 analysis. The park is heavily used by Chinatown seniors for exercise and socializing.",
        "18-month construction timeline will generate sustained noise, dust, and truck traffic on Bush Street between Kearny and Montgomery. Adjacent office tenants and ground-floor businesses should expect disruption.",
        "Loss of 85,000 sq ft of Class B office space reduces options for small and mid-size businesses seeking affordable downtown office leases.",
        "120 new residential units will add approximately 200 daily transit trips to the already-strained 30-Stockton and California Cable Car lines.",
      ],
      publicSentiment: {
        speakers: 14,
        forProject: 4,
        againstProject: 8,
        neutral: 2,
        topThemes: [
          "Shadow impact on St. Mary's Square",
          "Displacement of existing office tenants",
          "Insufficient affordable housing percentage",
          "Construction noise affecting Chinatown residents",
        ],
        notableQuotes: [
          "St. Mary's Square is the living room for hundreds of Chinatown seniors. Taking their sunlight is taking their health.",
          "We support housing, but not at the cost of the small businesses that have been here for 40 years.",
        ],
        source: "sfgovtv_captions",
      },
      videoUrl: "https://sanfrancisco.granicus.com/ViewPublisher.php?view_id=20",
    },
  },
  {
    date: "Jan 9, 2025",
    address: "600 Stockton St",
    action: "Continued",
    votes: { aye: 0, nay: 0, absent: 0 },
    desc: "Mixed-use development, 80 units. Continued for environmental review.",
    shadow: false,
    detail: {
      majorActions: "The Commission voted unanimously to continue the project to allow completion of the Preliminary Environmental Assessment. Staff reported that the initial traffic analysis underestimated peak-hour vehicle trips by approximately 30%, and that a revised Transportation Impact Study is required. The project sponsor was directed to conduct additional community outreach in the Chinatown neighborhood before the item returns.",
      commissionerConcerns: [
        {
          name: "Commissioner So",
          concern: "Raised significant concerns about the adequacy of the community engagement process. Noted that outreach materials were only provided in English despite the project's location adjacent to Chinatown. Requested multilingual notices and at least one community meeting conducted in Cantonese."
        },
        {
          name: "Commissioner McGarry",
          concern: "Questioned the below-grade parking structure in a seismically active zone with a high water table. Asked staff to confirm that the geotechnical analysis accounts for sea-level rise projections through 2070."
        },
      ],
      publicImpact: [
        "Project timeline extended by an estimated 6–12 months. Adjacent property owners and businesses in planning limbo until environmental review is complete.",
        "Revised traffic study may reveal greater congestion impacts on Stockton Street, which already operates at Level of Service E during evening peak hours.",
        "Three ground-floor retail tenants at the current site are on month-to-month leases with no relocation assistance plan in place.",
        "The project's proximity to the Stockton Street tunnel portal raises ventilation and air quality concerns that are not yet addressed in the environmental scope.",
      ],
      publicSentiment: {
        speakers: 22,
        forProject: 3,
        againstProject: 16,
        neutral: 3,
        topThemes: [
          "Lack of multilingual community outreach",
          "Traffic congestion on Stockton Street",
          "Displacement of existing small businesses",
          "Air quality near tunnel portal",
          "Inadequate affordable housing",
        ],
        notableQuotes: [
          "Nobody in our community even knew about this project until last week. That is not engagement.",
          "Stockton Street is already gridlocked. Adding 80 units with a parking garage will make it unbearable.",
        ],
        source: "sfgovtv_captions",
      },
      videoUrl: "https://sanfrancisco.granicus.com/ViewPublisher.php?view_id=20",
    },
  },
  {
    date: "Dec 19, 2024",
    address: "1 Grant Ave",
    action: "Approved",
    votes: { aye: 6, nay: 0, absent: 1 },
    desc: "Former department store conversion to hotel and retail complex.",
    shadow: false,
    detail: {
      majorActions: "The Commission unanimously approved the conversion of the former Macy's building to a 200-room hotel with 45,000 sq ft of ground-floor and second-floor retail. The approval includes a $3.5M community benefits package: $1.5M for Chinatown community programs, $1.2M for public realm improvements on Grant Avenue, and $800K for a workforce development fund targeting District 3 residents. The project is expected to generate 340 permanent jobs and 500 construction jobs over a 24-month build period.",
      commissionerConcerns: [
        {
          name: "Commissioner Campbell",
          concern: "While voting in favor, expressed concern about the hotel market's recovery trajectory. Requested that the sponsor provide annual reports on occupancy rates and local hiring targets to the Commission for the first five years of operation."
        },
        {
          name: "Commissioner Williams",
          concern: "Raised questions about loading dock operations and delivery vehicle routing. Grant Avenue is narrow and heavily pedestrianized. Requested a detailed logistics plan to prevent truck conflicts with pedestrian traffic, especially during Chinese New Year and other cultural events."
        },
      ],
      publicImpact: [
        "24-month construction period will affect pedestrian access and retail foot traffic on Grant Avenue — the primary commercial corridor for Chinatown tourism and local shopping.",
        "Hotel operations will generate approximately 200 additional vehicle trips daily, including ride-hail and tour bus activity. Curb management on Grant and O'Farrell will need active enforcement.",
        "The $1.5M Chinatown community benefits package is welcome but represents less than 0.5% of the estimated project value. Community groups had requested $4M.",
        "Positive impact: 340 permanent jobs with a local hiring commitment could benefit District 3 residents, particularly in hospitality and retail sectors with high unemployment rates.",
      ],
      publicSentiment: {
        speakers: 18,
        forProject: 11,
        againstProject: 5,
        neutral: 2,
        topThemes: [
          "Support for job creation and economic revival",
          "Construction impact on Grant Avenue businesses",
          "Community benefits package deemed insufficient",
          "Delivery truck routing concerns",
        ],
        notableQuotes: [
          "This building has been empty for three years. Any project that brings life back to Grant Avenue has our support.",
          "We asked for $4 million in community benefits and got $1.5 million. We'll take it, but the Commission should know this doesn't make us whole.",
        ],
        source: "sfgovtv_captions",
      },
      videoUrl: "https://sanfrancisco.granicus.com/ViewPublisher.php?view_id=20",
    },
  },
];

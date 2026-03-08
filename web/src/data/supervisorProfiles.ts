/**
 * supervisorProfiles.ts — CityPulse
 *
 * Factual civic-information profiles for SF Board of Supervisors members.
 * All data sourced from official city pages (sfbos.org).
 * Neutral tone, no editorializing. Every claim attributed to a source.
 */

// ── Interfaces ───────────────────────────────────────────────────────────────

export interface CommitteeMembership {
  name: string;
  role: "Chair" | "Vice Chair" | "Vice-Chair" | "President" | "Member";
}

export interface StatedPriority {
  topic: string;
  position: string;
  source: string;
  sourceUrl: string;
  /** Icon key used by SupervisorProfileCard to pick an inline SVG. */
  icon: "shield" | "home" | "building" | "pill" | "trash" | "storefront";
}

export interface ContactInfo {
  office: string;
  phone: string;
  email: string;
}

export interface SourceLink {
  label: string;
  url: string;
}

export interface SupervisorProfile {
  districtNumber: string;
  name: string;
  /** Optional name in another language (e.g. Chinese characters). */
  altName?: string;
  termStart: string;
  termEnd: string;
  /** Optional note displayed beside term dates (e.g. "Final term"). */
  termNote?: string;
  /** Short background paragraph. */
  background: string;
  education: string;
  residency: string;
  priorRole: string;
  committees: CommitteeMembership[];
  statedPriorities: StatedPriority[];
  communityRecord: string[];
  contact: ContactInfo;
  sources: SourceLink[];
}

// ── Profiles ─────────────────────────────────────────────────────────────────
// All data below sourced from sfbos.org supervisor pages, accessed March 2026.

export const SUPERVISOR_PROFILES: Record<string, SupervisorProfile> = {

  // ── District 1 — Connie Chan ─────────────────────────────────────────────
  "1": {
    districtNumber: "1",
    name: "Connie Chan",
    altName: "陳詩敏",
    termStart: "January 8, 2025",
    termEnd: "January 8, 2029",
    termNote: "Final term",
    background:
      "Born in Hong Kong, Chan moved to San Francisco at age 13 with her mother and younger brother. Her family obtained a rent-controlled Chinatown apartment, and her mother worked as a claims processor at Chinese Hospital. She graduated from Galileo High School and earned her bachelor's degree from UC Davis. She began her career as a volunteer interpreter with the SF Bar Association's Volunteer Legal Outreach and in community organizer roles with SF SAFE and Community Youth Center.",
    education: "UC Davis (bachelor's degree). Galileo High School graduate.",
    residency: "Richmond District homeowner. Married to firefighter Ed since 2011; raising a son in public school.",
    priorRole: "Legislative aide to Supervisor Sophie Maxwell; aide to DA Kamala D. Harris; aide to Supervisor Aaron Peskin; aide to Assemblymember Kevin Mullin; administrative roles at SF Recreation & Parks Department and City College of San Francisco.",
    committees: [
      { name: "Budget & Finance Committee", role: "Chair" },
      { name: "Budget & Appropriations Committee", role: "Chair" },
      { name: "SF County Transportation Authority", role: "Member" },
      { name: "Local Agency Formation Commission", role: "Member" },
      { name: "Free City College Oversight Committee", role: "Member" },
    ],
    statedPriorities: [
      {
        topic: "Budget Oversight",
        position: "Chairs both Budget & Finance and Budget & Appropriations committees, leading fiscal oversight for the city.",
        source: "sfbos.org",
        sourceUrl: "https://sfbos.org/supervisor-chan-district-1",
        icon: "building",
      },
      {
        topic: "API Equity",
        position: "Established the API Equity Fund in 2022 to provide capital investments in Asian and Pacific Islander–serving community organizations.",
        source: "sfbos.org",
        sourceUrl: "https://sfbos.org/supervisor-chan-district-1",
        icon: "storefront",
      },
      {
        topic: "LGBTQIA+ Protections",
        position: "Supports gender-affirming care access and LGBTQIA+ youth protections citywide.",
        source: "sfbos.org",
        sourceUrl: "https://sfbos.org/supervisor-chan-district-1",
        icon: "shield",
      },
      {
        topic: "Free City College",
        position: "Serves on the Free City College Oversight Committee, supporting affordable education access for San Francisco residents.",
        source: "sfbos.org",
        sourceUrl: "https://sfbos.org/supervisor-chan-district-1",
        icon: "storefront",
      },
      {
        topic: "Community Investment",
        position: "Administers the Community Opportunity Fund to direct resources to underserved neighborhoods in the Richmond District.",
        source: "sfbos.org",
        sourceUrl: "https://sfbos.org/supervisor-chan-district-1",
        icon: "home",
      },
      {
        topic: "Transportation",
        position: "Serves on the SF County Transportation Authority, working on transit improvements for the westside.",
        source: "sfbos.org",
        sourceUrl: "https://sfbos.org/supervisor-chan-district-1",
        icon: "building",
      },
    ],
    communityRecord: [
      "Volunteer interpreter, SF Bar Association's Volunteer Legal Outreach",
      "Community organizer, SF SAFE and Community Youth Center",
      "Legislative aide to Supervisor Sophie Maxwell, DA Kamala Harris, Supervisor Aaron Peskin, and Assemblymember Kevin Mullin",
      "Administrative roles at SF Recreation & Parks and City College of SF",
      "Richmond District homeowner raising a son in public school",
    ],
    contact: {
      office: "City Hall, Room 244, 1 Dr. Carlton B. Goodlett Place, SF 94102",
      phone: "(415) 554-7410",
      email: "ChanStaff@sfgov.org",
    },
    sources: [
      { label: "Official Board page", url: "https://sfbos.org/supervisor-chan-district-1" },
      { label: "SF Board committee assignments", url: "https://sfbos.org/committees" },
    ],
  },

  // ── District 2 — Stephen Sherrill ────────────────────────────────────────
  "2": {
    districtNumber: "2",
    name: "Stephen Sherrill",
    termStart: "December 18, 2024",
    termEnd: "January 8, 2027",
    background:
      "Sherrill served as Director of the Mayor's Office of Innovation under Mayor London Breed, developing ASTRID to integrate housing, health, and emergency response data. Previously, he was a senior policy advisor in New York City under Mayor Michael Bloomberg, working on clean streets, disaster response, and sustainability initiatives including Hurricane Sandy relief efforts. Father of two young children.",
    education: "",
    residency: "District 2 resident. Frequently found at Marina Green, local coffee shops, and meeting with small business owners.",
    priorRole: "Director, Mayor's Office of Innovation. Senior policy advisor, New York City (under Mayor Michael Bloomberg).",
    committees: [
      { name: "Rules Committee", role: "Vice Chair" },
      { name: "Government Audit & Oversight Committee", role: "Member" },
      { name: "SF Downtown Revitalization & Economic Recovery Financing District", role: "Member" },
      { name: "SF County Transportation Authority", role: "Member" },
    ],
    statedPriorities: [
      {
        topic: "Public Safety",
        position: "Committed to enhancing public safety across District 2 neighborhoods including the Marina, Pacific Heights, and Cow Hollow.",
        source: "sfbos.org",
        sourceUrl: "https://sfbos.org/supervisor-sherrill-district-2",
        icon: "shield",
      },
      {
        topic: "Clean Neighborhoods",
        position: "Prioritizes ensuring clean, safe neighborhoods through improved city services and accountability.",
        source: "sfbos.org",
        sourceUrl: "https://sfbos.org/supervisor-sherrill-district-2",
        icon: "trash",
      },
      {
        topic: "Small Business",
        position: "Supports small businesses through initiatives like 'First Year Free' to reduce barriers for new entrepreneurs.",
        source: "sfbos.org",
        sourceUrl: "https://sfbos.org/supervisor-sherrill-district-2",
        icon: "storefront",
      },
      {
        topic: "Commercial Corridors",
        position: "Focuses on improving commercial corridors to strengthen neighborhood vitality and economic activity.",
        source: "sfbos.org",
        sourceUrl: "https://sfbos.org/supervisor-sherrill-district-2",
        icon: "building",
      },
      {
        topic: "Family-Friendly City",
        position: "Works to make raising a family in San Francisco more feasible and joyful, as a father of two young children.",
        source: "sfbos.org",
        sourceUrl: "https://sfbos.org/supervisor-sherrill-district-2",
        icon: "home",
      },
      {
        topic: "Data-Driven Government",
        position: "Created ASTRID to integrate housing, health, and emergency response data as Director of the Mayor's Office of Innovation.",
        source: "sfbos.org",
        sourceUrl: "https://sfbos.org/supervisor-sherrill-district-2",
        icon: "building",
      },
    ],
    communityRecord: [
      "Director, Mayor's Office of Innovation under Mayor London Breed",
      "Created ASTRID system integrating housing, health, and emergency response data",
      "Senior policy advisor in NYC under Mayor Michael Bloomberg",
      "Led Hurricane Sandy emergency response and sustainability initiatives in NYC",
      "Father of two young children, active in District 2 community",
    ],
    contact: {
      office: "City Hall, Room 244, 1 Dr. Carlton B. Goodlett Place, SF 94102",
      phone: "(415) 554-7752",
      email: "SherrillStaff@sfgov.org",
    },
    sources: [
      { label: "Official Board page", url: "https://sfbos.org/supervisor-sherrill-district-2" },
      { label: "SF Board committee assignments", url: "https://sfbos.org/committees" },
    ],
  },

  // ── District 3 — Danny Sauter ────────────────────────────────────────────
  "3": {
    districtNumber: "3",
    name: "Danny Sauter",
    altName: "李爾德",
    termStart: "January 8, 2025",
    termEnd: "January 8, 2029",
    background:
      "Community organizer in District 3 for over a decade. Former Executive Director of SF Neighborhood Centers Together, supporting youth and seniors at Cameron House in Chinatown and TEL HI Neighborhood Center in North Beach. Co-founded Bamboo, a marketing agency, growing it from 2 to 50 employees.",
    education: "Miami University – Marketing major, dual minors in Entrepreneurship and Chinese. Studied abroad in China, learned Mandarin.",
    residency: "North Beach resident for over a decade. Renter – one of two renters on the Board of Supervisors.",
    priorRole: "Executive Director, SF Neighborhood Centers Together. President, North Beach Neighbors (8+ years). First Housing Chair, SF Sierra Club.",
    committees: [
      { name: "SF Downtown Revitalization & Economic Recovery Financing District", role: "Chair" },
      { name: "Government Audit & Oversight Committee", role: "Vice-Chair" },
      { name: "Budget & Finance Committee", role: "Member" },
      { name: "Budget & Appropriations Committee", role: "Member" },
      { name: "SF County Transportation Authority", role: "Member" },
    ],
    statedPriorities: [
      {
        topic: "Public Safety",
        position: "Supports fully staffing SFPD and expanding community policing in North Beach, Chinatown, and the Financial District.",
        source: "dannyd3.com",
        sourceUrl: "https://www.dannyd3.com/priorities",
        icon: "shield",
      },
      {
        topic: "Housing",
        position: "Advocates for streamlining housing approvals and protecting existing rent-controlled units while encouraging new construction.",
        source: "dannyd3.com",
        sourceUrl: "https://www.dannyd3.com/priorities",
        icon: "home",
      },
      {
        topic: "Development Oversight",
        position: "Calls for transparent review of major developments and community input on projects affecting neighborhood character.",
        source: "dannyd3.com",
        sourceUrl: "https://www.dannyd3.com/priorities",
        icon: "building",
      },
      {
        topic: "Fentanyl Crisis",
        position: "Supports expanding treatment access, safe consumption sites debate, and aggressive enforcement against open-air drug dealing.",
        source: "dannyd3.com",
        sourceUrl: "https://www.dannyd3.com/priorities",
        icon: "pill",
      },
      {
        topic: "Clean Streets",
        position: "Pushes for increased DPW resources for street cleaning and graffiti removal in commercial corridors.",
        source: "dannyd3.com",
        sourceUrl: "https://www.dannyd3.com/priorities",
        icon: "trash",
      },
      {
        topic: "Small Business",
        position: "Champions reducing permitting fees and timelines for small businesses, especially in Chinatown and North Beach.",
        source: "dannyd3.com",
        sourceUrl: "https://www.dannyd3.com/priorities",
        icon: "storefront",
      },
    ],
    communityRecord: [
      "Executive Director, SF Neighborhood Centers Together – supporting youth and seniors at Cameron House and TEL HI",
      "President, North Beach Neighbors for 8+ years",
      "First Housing Chair, SF Sierra Club",
      "Co-founded Bamboo, a marketing agency (grew from 2 to 50 employees)",
      "North Beach resident and renter for over a decade",
    ],
    contact: {
      office: "City Hall, Room 244, 1 Dr. Carlton B. Goodlett Place, SF 94102",
      phone: "(415) 554-7450",
      email: "Danny.Sauter@sfgov.org",
    },
    sources: [
      { label: "Official Board page", url: "https://sfbos.org/supervisor-sauter" },
      { label: "Danny Sauter campaign site", url: "https://www.dannyd3.com" },
      { label: "SF Board committee assignments", url: "https://sfbos.org/committees" },
    ],
  },

  // ── District 4 — Alan Wong ───────────────────────────────────────────────
  "4": {
    districtNumber: "4",
    name: "Alan Wong",
    termStart: "December 1, 2025",
    termEnd: "January 8, 2027",
    background:
      "Lifelong Sunset District resident and son of Hong Kong immigrants. Attended San Francisco public schools (De Avila Elementary, Herbert Hoover Middle, Abraham Lincoln High School), then City College of San Francisco. Served on the City College Board of Trustees for five years, including two terms as board president. California Army National Guard veteran with 15+ years of service, from paralegal specialist to public affairs detachment commander.",
    education: "City College of San Francisco; UC San Diego (bachelor's); University of San Francisco (Master's in Public Affairs).",
    residency: "Lifelong Sunset District resident.",
    priorRole: "City College Board of Trustees (5 years, two terms as president). Legislative aide, Board of Supervisors. Children's Council of San Francisco staff. California Army National Guard (15+ years).",
    committees: [
      { name: "Public Safety and Neighborhood Services Committee", role: "Member" },
      { name: "SF County Transportation Authority", role: "Member" },
    ],
    statedPriorities: [
      {
        topic: "Free City College",
        position: "Champions preserving Free City College as an accessible educational resource for all San Francisco residents.",
        source: "sfbos.org",
        sourceUrl: "https://sfbos.org/supervisor-wong-district-4",
        icon: "storefront",
      },
      {
        topic: "Language Access",
        position: "Advocates for protecting Cantonese language programs to serve the district's large Chinese-speaking community.",
        source: "sfbos.org",
        sourceUrl: "https://sfbos.org/supervisor-wong-district-4",
        icon: "building",
      },
      {
        topic: "Affordable Education",
        position: "Works to keep educational opportunities affordable and accessible for San Francisco residents at all levels.",
        source: "sfbos.org",
        sourceUrl: "https://sfbos.org/supervisor-wong-district-4",
        icon: "storefront",
      },
      {
        topic: "Public Safety",
        position: "Completed SFPD Community Police Academy and serves on the Public Safety and Neighborhood Services Committee.",
        source: "sfbos.org",
        sourceUrl: "https://sfbos.org/supervisor-wong-district-4",
        icon: "shield",
      },
      {
        topic: "Emergency Preparedness",
        position: "Trained in SF Fire Department's Neighborhood Emergency Response Team (NERT) program for community disaster readiness.",
        source: "sfbos.org",
        sourceUrl: "https://sfbos.org/supervisor-wong-district-4",
        icon: "shield",
      },
    ],
    communityRecord: [
      "City College Board of Trustees – 5 years, two terms as board president",
      "California Army National Guard – 15+ years, paralegal specialist to public affairs commander",
      "Legislative aide, Board of Supervisors",
      "Children's Council of San Francisco – assisting families with child care services",
      "SF Fire Department NERT training and SFPD Community Police Academy graduate",
    ],
    contact: {
      office: "City Hall, Room 244, 1 Dr. Carlton B. Goodlett Place, SF 94102",
      phone: "(415) 554-7460",
      email: "WongStaff@sfgov.org",
    },
    sources: [
      { label: "Official Board page", url: "https://sfbos.org/supervisor-wong-district-4" },
      { label: "SF Board committee assignments", url: "https://sfbos.org/committees" },
    ],
  },

  // ── District 5 — Bilal Mahmood ───────────────────────────────────────────
  "5": {
    districtNumber: "5",
    name: "Bilal Mahmood",
    termStart: "January 8, 2025",
    termEnd: "January 8, 2029",
    background:
      "The son of Pakistani immigrants, Mahmood is the first South Asian and Muslim-American elected to the San Francisco Board of Supervisors. He was a policy analyst in the Obama Administration's US Office of Innovation. He cofounded a software company democratizing AI access for small businesses, and launched a community impact fund during the pandemic supporting guaranteed income programs, bystander training, domestic violence awareness, and zero emission building advocacy.",
    education: "Stanford University (B.S. in Biological Sciences). Cambridge University (Gates Scholarship).",
    residency: "Lifelong renter currently residing in the Tenderloin.",
    priorRole: "Policy analyst, Obama Administration US Office of Innovation. Cofounder, AI software company. Community impact fund organizer.",
    committees: [
      { name: "Public Safety and Neighborhood Services Committee", role: "Vice-Chair" },
      { name: "SF Downtown Revitalization & Economic Recovery Financing District", role: "Vice-Chair" },
      { name: "Land Use and Transportation Committee", role: "Member" },
      { name: "SF County Transportation Authority", role: "Member" },
    ],
    statedPriorities: [
      {
        topic: "Street Safety",
        position: "Leading a Street Safety Investment Priorities Survey to allocate $700,000 in Neighborhood Transportation Program funds toward painted safety zones, speed humps, and raised crosswalks.",
        source: "sfbos.org",
        sourceUrl: "https://sfbos.org/supervisor-mahmood-district-5",
        icon: "shield",
      },
      {
        topic: "Housing Crisis",
        position: "Advancing resolutions to address the housing crisis through increased production and affordability measures.",
        source: "sfbos.org",
        sourceUrl: "https://sfbos.org/supervisor-mahmood-district-5",
        icon: "home",
      },
      {
        topic: "Fentanyl Crisis",
        position: "Advancing resolutions to address the fentanyl and substance abuse crisis in the Tenderloin and citywide.",
        source: "sfbos.org",
        sourceUrl: "https://sfbos.org/supervisor-mahmood-district-5",
        icon: "pill",
      },
      {
        topic: "Public Safety",
        position: "Serves as Vice-Chair of the Public Safety and Neighborhood Services Committee, focusing on community safety in District 5.",
        source: "sfbos.org",
        sourceUrl: "https://sfbos.org/supervisor-mahmood-district-5",
        icon: "shield",
      },
      {
        topic: "Zero-Emission Buildings",
        position: "Advocates for zero-emission buildings as part of San Francisco's climate goals and sustainability efforts.",
        source: "sfbos.org",
        sourceUrl: "https://sfbos.org/supervisor-mahmood-district-5",
        icon: "trash",
      },
      {
        topic: "Small Business",
        position: "Cofounded a software company to democratize AI access for small and medium-sized businesses; focused on economic innovation in the Obama Administration.",
        source: "sfbos.org",
        sourceUrl: "https://sfbos.org/supervisor-mahmood-district-5",
        icon: "storefront",
      },
    ],
    communityRecord: [
      "First South Asian and Muslim-American elected to the SF Board of Supervisors",
      "Policy analyst, Obama Administration US Office of Innovation and Entrepreneurship",
      "Cofounded AI software company serving small and medium-sized businesses",
      "Funded guaranteed income programs for restaurant workers during the pandemic",
      "Organized AAPI bystander training programs and domestic violence awareness campaigns",
      "Elected member, SF Democratic County Central Committee",
    ],
    contact: {
      office: "City Hall, Room 244, 1 Dr. Carlton B. Goodlett Place, SF 94102",
      phone: "(415) 554-7630",
      email: "MahmoodStaff@sfgov.org",
    },
    sources: [
      { label: "Official Board page", url: "https://sfbos.org/supervisor-mahmood-district-5" },
      { label: "SF Board committee assignments", url: "https://sfbos.org/committees" },
    ],
  },

  // ── District 6 — Matt Dorsey ─────────────────────────────────────────────
  "6": {
    districtNumber: "6",
    name: "Matt Dorsey",
    termStart: "January 8, 2023",
    termEnd: "January 8, 2027",
    background:
      "A City government veteran who previously served as SFPD communications director. Spent fourteen years in the San Francisco City Attorney's Office handling cases involving marriage equality, education access, public health, tenants rights, and worker protections. He is an out gay man and the board's only openly HIV positive member and only current member to acknowledge his history with substance-use disorder.",
    education: "",
    residency: "",
    priorRole: "SFPD communications director. San Francisco City Attorney's Office (14 years). Led communications for 2019 No on Prop C campaign opposing JUUL Labs.",
    committees: [
      { name: "Public Safety and Neighborhood Services Committee", role: "Chair" },
      { name: "Budget & Finance Committee", role: "Vice-Chair" },
      { name: "Budget & Appropriations Committee", role: "Vice-Chair" },
      { name: "SF Downtown Revitalization & Economic Recovery Financing District", role: "Member" },
      { name: "SF County Transportation Authority", role: "Member" },
      { name: "Treasure Island Mobility Management Agency", role: "President" },
    ],
    statedPriorities: [
      {
        topic: "Recovery & Addiction",
        position: "Committed to providing recovery pathways for individuals struggling with addiction, drawing on personal experience with substance-use disorder.",
        source: "sfbos.org",
        sourceUrl: "https://sfbos.org/supervisor-dorsey-district-6",
        icon: "pill",
      },
      {
        topic: "Housing",
        position: "Supports expanding housing at all affordability levels across District 6 and citywide.",
        source: "sfbos.org",
        sourceUrl: "https://sfbos.org/supervisor-dorsey-district-6",
        icon: "home",
      },
      {
        topic: "Public Safety",
        position: "Chairs the Public Safety and Neighborhood Services Committee, investing in resources to enhance community safety in SoMa and the Tenderloin.",
        source: "sfbos.org",
        sourceUrl: "https://sfbos.org/supervisor-dorsey-district-6",
        icon: "shield",
      },
      {
        topic: "Public Health",
        position: "Handled public health cases during 14 years in the City Attorney's Office; only openly HIV positive member of the Board.",
        source: "sfbos.org",
        sourceUrl: "https://sfbos.org/supervisor-dorsey-district-6",
        icon: "pill",
      },
      {
        topic: "Tenant Protections",
        position: "Worked on tenants rights and worker protections cases during his tenure in the City Attorney's Office.",
        source: "sfbos.org",
        sourceUrl: "https://sfbos.org/supervisor-dorsey-district-6",
        icon: "home",
      },
      {
        topic: "Tobacco & Vaping",
        position: "Led communications strategy for the 2019 campaign that successfully defeated JUUL-backed Proposition C.",
        source: "sfbos.org",
        sourceUrl: "https://sfbos.org/supervisor-dorsey-district-6",
        icon: "shield",
      },
    ],
    communityRecord: [
      "San Francisco City Attorney's Office – 14 years handling marriage equality, education, public health, and tenant rights cases",
      "SFPD communications director",
      "Led communications for 2019 No on Prop C campaign defeating JUUL-backed measure",
      "Openly HIV positive Board member advocating for health equity",
      "Recovery advocate drawing on personal experience with substance-use disorder",
    ],
    contact: {
      office: "City Hall, Room 244, 1 Dr. Carlton B. Goodlett Place, SF 94102",
      phone: "(415) 554-7970",
      email: "DorseyStaff@sfgov.org",
    },
    sources: [
      { label: "Official Board page", url: "https://sfbos.org/supervisor-dorsey-district-6" },
      { label: "SF Board committee assignments", url: "https://sfbos.org/committees" },
    ],
  },

  // ── District 7 — Myrna Melgar ────────────────────────────────────────────
  "7": {
    districtNumber: "7",
    name: "Myrna Melgar",
    termStart: "January 8, 2025",
    termEnd: "January 8, 2029",
    background:
      "An urban planner, economic development and housing policy expert who has served in various city government roles. Family immigrated from El Salvador during the 1980s civil war. Fluent in English, Spanish, and French, and speaks Swedish proficiently. Lives in Ingleside Terraces with husband Sean Donahue and three daughters.",
    education: "Bachelor's in Liberal Arts, Excelsior College. Master's in Urban Planning (housing development concentration), Columbia University.",
    residency: "Ingleside Terraces resident.",
    priorRole: "Executive Director, Jamestown Community Center. Deputy Director, Mission Economic Development Agency. Director of Homeownership Programs, Mayor's Office of Housing. President, City Planning Commission. Vice President, Building Inspection Commission.",
    committees: [
      { name: "Land Use and Transportation Committee", role: "Chair" },
      { name: "SF County Transportation Authority", role: "Vice Chair" },
      { name: "Treasure Island Mobility Management Agency", role: "Member" },
    ],
    statedPriorities: [
      {
        topic: "Homelessness",
        position: "Prioritizes reducing homelessness through expanded services and housing-first approaches on the westside.",
        source: "sfbos.org",
        sourceUrl: "https://sfbos.org/supervisor-melgar-district-7",
        icon: "home",
      },
      {
        topic: "Housing & Homeownership",
        position: "Works to increase affordable housing and homeownership opportunities while strengthening rent control protections.",
        source: "sfbos.org",
        sourceUrl: "https://sfbos.org/supervisor-melgar-district-7",
        icon: "home",
      },
      {
        topic: "Small Business",
        position: "Supports small businesses and worker rights to strengthen neighborhood commercial corridors across District 7.",
        source: "sfbos.org",
        sourceUrl: "https://sfbos.org/supervisor-melgar-district-7",
        icon: "storefront",
      },
      {
        topic: "Transportation Safety",
        position: "Chairs the Land Use and Transportation Committee, focusing on pedestrian, bicycle, and transit safety improvements.",
        source: "sfbos.org",
        sourceUrl: "https://sfbos.org/supervisor-melgar-district-7",
        icon: "building",
      },
      {
        topic: "Climate & Environment",
        position: "Advocates for reducing the city's carbon footprint and investing in sustainable infrastructure.",
        source: "sfbos.org",
        sourceUrl: "https://sfbos.org/supervisor-melgar-district-7",
        icon: "trash",
      },
      {
        topic: "Senior Services",
        position: "Expands access to senior services and education for disadvantaged youth on the westside of San Francisco.",
        source: "sfbos.org",
        sourceUrl: "https://sfbos.org/supervisor-melgar-district-7",
        icon: "shield",
      },
    ],
    communityRecord: [
      "Executive Director, Jamestown Community Center",
      "Deputy Director, Mission Economic Development Agency",
      "Director of Homeownership Programs, Mayor's Office of Housing (Newsom Administration)",
      "President, City Planning Commission",
      "Vice President, Building Inspection Commission",
      "Board member of multiple San Francisco nonprofit human service organizations",
    ],
    contact: {
      office: "City Hall, Room 244, 1 Dr. Carlton B. Goodlett Place, SF 94102",
      phone: "(415) 554-6516",
      email: "MelgarStaff@sfgov.org",
    },
    sources: [
      { label: "Official Board page", url: "https://sfbos.org/supervisor-melgar-district-7" },
      { label: "SF Board committee assignments", url: "https://sfbos.org/committees" },
    ],
  },

  // ── District 8 — Rafael Mandelman ────────────────────────────────────────
  "8": {
    districtNumber: "8",
    name: "Rafael Mandelman",
    termStart: "January 8, 2023",
    termEnd: "January 8, 2027",
    termNote: "Final term",
    background:
      "Represents District 8, including Castro, Glen Park, Noe Valley, Diamond Heights, Mission Dolores, and Cole Valley. One of the LGBTQ members of the Board of Supervisors and was one of the only LGBTQ Supervisors in Northern California during his first term. Currently serves as President of the Board of Supervisors.",
    education: "",
    residency: "",
    priorRole: "",
    committees: [
      { name: "Board of Supervisors", role: "President" },
      { name: "SF County Transportation Authority", role: "Chair" },
      { name: "Treasure Island Mobility Management Agency", role: "Vice Chair" },
      { name: "Transbay Joint Powers Authority", role: "Vice Chair" },
      { name: "Budget & Appropriations Committee", role: "Member" },
      { name: "Rules Committee", role: "Member" },
      { name: "Association of Bay Area Governments Executive Board", role: "Member" },
    ],
    statedPriorities: [
      {
        topic: "Climate Action",
        position: "Led legislation requiring all-electric major renovations (effective July 2026) and prohibiting gas-powered landscaping equipment (effective January 2026).",
        source: "sfbos.org",
        sourceUrl: "https://sfbos.org/supervisor-mandelman-district-8",
        icon: "trash",
      },
      {
        topic: "Immigrant Defense",
        position: "Led a $3.5 million plan to fund immigrant defense services in San Francisco.",
        source: "sfbos.org",
        sourceUrl: "https://sfbos.org/supervisor-mandelman-district-8",
        icon: "shield",
      },
      {
        topic: "LGBTQ Preservation",
        position: "Requested city landmarks designation for 16 LGBTQ historic sites to preserve the community's cultural heritage.",
        source: "sfbos.org",
        sourceUrl: "https://sfbos.org/supervisor-mandelman-district-8",
        icon: "building",
      },
      {
        topic: "Public Safety",
        position: "Co-hosts community town halls on safety issues throughout District 8 neighborhoods.",
        source: "sfbos.org",
        sourceUrl: "https://sfbos.org/supervisor-mandelman-district-8",
        icon: "shield",
      },
      {
        topic: "Charter Reform",
        position: "Collaborating on a potential 2026 ballot measure to streamline city governance and improve government efficiency.",
        source: "sfbos.org",
        sourceUrl: "https://sfbos.org/supervisor-mandelman-district-8",
        icon: "building",
      },
      {
        topic: "Transportation",
        position: "Chairs the SF County Transportation Authority, overseeing regional transit planning and investment.",
        source: "sfbos.org",
        sourceUrl: "https://sfbos.org/supervisor-mandelman-district-8",
        icon: "building",
      },
    ],
    communityRecord: [
      "President, Board of Supervisors",
      "Led all-electric renovation requirement legislation (effective July 2026)",
      "Led gas-powered landscaping equipment prohibition (effective January 2026)",
      "Secured $3.5 million in immigrant defense funding",
      "Requested city landmark designation for 16 LGBTQ historic sites",
      "Hosts regular office hours and community town halls across District 8",
    ],
    contact: {
      office: "City Hall, Room 244, 1 Dr. Carlton B. Goodlett Place, SF 94102",
      phone: "(415) 554-6968",
      email: "MandelmanStaff@sfgov.org",
    },
    sources: [
      { label: "Official Board page", url: "https://sfbos.org/supervisor-mandelman-district-8" },
      { label: "SF Board committee assignments", url: "https://sfbos.org/committees" },
    ],
  },

  // ── District 9 — Jackie Fielder ──────────────────────────────────────────
  "9": {
    districtNumber: "9",
    name: "Jackie Fielder",
    termStart: "January 8, 2025",
    termEnd: "January 8, 2029",
    background:
      "A Mission renter, public bank organizer, former city commissioner and educator, and climate and environmental justice advocate. Granddaughter of Mexican immigrants and Native American grandparents; citizen of the Three Affiliated Tribes of North Dakota with Two Kettle Lakota and Hidatsa descent. Co-founded the San Francisco Defund DAPL Coalition (2017) and the San Francisco Public Bank Coalition. Served as Commissioner and Vice Chair of SFLAFCo from November 2021 to March 2024, overseeing Clean Power SF. Previously Co-Director of Stop the Money Pipeline.",
    education: "Stanford University (B.A. in Public Policy, M.A. in Sociology, 2016). Taught 'Race, Women, and Class' at San Francisco State University (2018–2020).",
    residency: "Mission District renter.",
    priorRole: "Commissioner and Vice Chair, SFLAFCo (2021–2024). Co-Director, Stop the Money Pipeline. Co-founder, SF Defund DAPL Coalition and SF Public Bank Coalition. Educator, San Francisco State University.",
    committees: [
      { name: "Government Audit & Oversight Committee", role: "Chair" },
      { name: "Local Agency Formation Commission", role: "Chair" },
      { name: "SF County Transportation Authority", role: "Member" },
    ],
    statedPriorities: [
      {
        topic: "Environmental Justice",
        position: "Champions climate and environmental justice advocacy, co-founding the SF Defund DAPL Coalition to oppose fossil fuel pipeline financing.",
        source: "sfbos.org",
        sourceUrl: "https://sfbos.org/supervisor-fielder-district-9",
        icon: "trash",
      },
      {
        topic: "Public Banking",
        position: "Co-founded the SF Public Bank Coalition to establish the nation's first city-owned bank to support small businesses, affordable housing, and renewable energy.",
        source: "sfbos.org",
        sourceUrl: "https://sfbos.org/supervisor-fielder-district-9",
        icon: "storefront",
      },
      {
        topic: "Affordable Housing",
        position: "Advocates for affordable housing protections and tenant rights in the Mission District and citywide.",
        source: "sfbos.org",
        sourceUrl: "https://sfbos.org/supervisor-fielder-district-9",
        icon: "home",
      },
      {
        topic: "Renewable Energy",
        position: "Served as Commissioner and Vice Chair of SFLAFCo overseeing Clean Power SF, advancing renewable energy citywide.",
        source: "sfbos.org",
        sourceUrl: "https://sfbos.org/supervisor-fielder-district-9",
        icon: "trash",
      },
      {
        topic: "Small Business",
        position: "Supports small businesses through the proposed city-owned public bank and equitable economic development policies.",
        source: "sfbos.org",
        sourceUrl: "https://sfbos.org/supervisor-fielder-district-9",
        icon: "storefront",
      },
      {
        topic: "Government Oversight",
        position: "Chairs the Government Audit & Oversight Committee, ensuring transparency and accountability in city operations.",
        source: "sfbos.org",
        sourceUrl: "https://sfbos.org/supervisor-fielder-district-9",
        icon: "building",
      },
    ],
    communityRecord: [
      "Co-founded SF Defund DAPL Coalition (2017) opposing Wall Street bank financing of the Dakota Access Pipeline",
      "Co-founded SF Public Bank Coalition to establish the nation's first city-owned bank",
      "Commissioner and Vice Chair, SFLAFCo (2021–2024), overseeing Clean Power SF",
      "Co-Director, Stop the Money Pipeline – national coalition disrupting fossil fuel financing",
      "Taught 'Race, Women, and Class' at SF State University's College of Ethnic Studies (2018–2020)",
    ],
    contact: {
      office: "City Hall, Room 244, 1 Dr. Carlton B. Goodlett Place, SF 94102",
      phone: "(415) 554-5144",
      email: "FielderStaff@sfgov.org",
    },
    sources: [
      { label: "Official Board page", url: "https://sfbos.org/supervisor-fielder-district-9" },
      { label: "SF Board committee assignments", url: "https://sfbos.org/committees" },
    ],
  },

  // ── District 10 — Shamann Walton ─────────────────────────────────────────
  "10": {
    districtNumber: "10",
    name: "Shamann Walton",
    termStart: "January 8, 2023",
    termEnd: "January 8, 2027",
    background:
      "Born in San Francisco and lived in public housing at an early age in Bayview and Potrero Hill. Has worked in District 10 neighborhoods for decades. Former president and member of the San Francisco Board of Education, where he led efforts to close the achievement gap for Black, Latino, and special needs students, helped secure funding for the school district's first African American Achievement initiative, and advocated for undocumented student protection, teacher retention, graduation rates, educator housing, and Mission Bay school development.",
    education: "",
    residency: "Lifelong San Francisco resident. Grew up in Bayview and Potrero Hill public housing.",
    priorRole: "President and member, San Francisco Board of Education.",
    committees: [
      { name: "Rules Committee", role: "Chair" },
      { name: "Budget & Appropriations Committee", role: "Member" },
      { name: "SF County Transportation Authority", role: "Member" },
      { name: "Treasure Island Mobility Management Agency", role: "Member" },
    ],
    statedPriorities: [
      {
        topic: "Violence Reduction",
        position: "Prioritizes reducing violence in District 10 communities including Bayview, Potrero Hill, and Visitacion Valley.",
        source: "sfbos.org",
        sourceUrl: "https://sfbos.org/supervisor-walton-district-10",
        icon: "shield",
      },
      {
        topic: "Affordable Housing",
        position: "Advanced affordable housing developments including Doris Vincent and Oscar James Apartments in Shipyard, Sophie Maxwell Building at Power Station, and 25th Street development in Potrero Hill.",
        source: "sfbos.org",
        sourceUrl: "https://sfbos.org/supervisor-walton-district-10",
        icon: "home",
      },
      {
        topic: "Community Infrastructure",
        position: "Secured community infrastructure improvements including a playground and YMCA at Crane Cove Park.",
        source: "sfbos.org",
        sourceUrl: "https://sfbos.org/supervisor-walton-district-10",
        icon: "building",
      },
      {
        topic: "Commercial Corridors",
        position: "Invests in commercial corridor development on 3rd Street, Leland Avenue, and 22nd and 18th Streets to strengthen local economies.",
        source: "sfbos.org",
        sourceUrl: "https://sfbos.org/supervisor-walton-district-10",
        icon: "storefront",
      },
      {
        topic: "Reparations",
        position: "Secured a funding mechanism for reparations to address historical inequities in San Francisco.",
        source: "sfbos.org",
        sourceUrl: "https://sfbos.org/supervisor-walton-district-10",
        icon: "building",
      },
      {
        topic: "Education Equity",
        position: "Led efforts on the Board of Education to close the achievement gap for Black, Latino, and special needs students and secured funding for the African American Achievement and Leadership Initiative.",
        source: "sfbos.org",
        sourceUrl: "https://sfbos.org/supervisor-walton-district-10",
        icon: "storefront",
      },
    ],
    communityRecord: [
      "President and member, San Francisco Board of Education",
      "Secured funding for the school district's first African American Achievement and Leadership Initiative",
      "Advocated for educator housing and Mission Bay school development",
      "Advanced affordable housing: Doris Vincent, Oscar James Apartments, Sophie Maxwell Building",
      "Secured playground and YMCA at Crane Cove Park",
      "Lifelong San Francisco resident with deep roots in Bayview and Potrero Hill",
    ],
    contact: {
      office: "City Hall, Room 244, 1 Dr. Carlton B. Goodlett Place, SF 94102",
      phone: "(415) 554-7670",
      email: "WaltonStaff@sfgov.org",
    },
    sources: [
      { label: "Official Board page", url: "https://sfbos.org/supervisor-walton-district-10" },
      { label: "SF Board committee assignments", url: "https://sfbos.org/committees" },
    ],
  },

  // ── District 11 — Chyanne Chen ───────────────────────────────────────────
  "11": {
    districtNumber: "11",
    name: "Chyanne Chen",
    termStart: "January 8, 2025",
    termEnd: "January 8, 2029",
    background:
      "An immigrant and mother who has lived in District 11 for over two decades. Immigrated to the United States from a small village in China at age 15 with her family. Mother to two daughters and caregiver to elderly parents.",
    education: "Galileo High School. UC Davis (undergraduate degree). Cornell University (master's degree). Currently pursuing doctoral degree.",
    residency: "District 11 resident for over two decades.",
    priorRole: "",
    committees: [
      { name: "Land Use and Transportation Committee", role: "Vice-Chair" },
      { name: "SF County Transportation Authority", role: "Member" },
    ],
    statedPriorities: [
      {
        topic: "Land Use & Planning",
        position: "Serves as Vice-Chair of the Land Use and Transportation Committee, overseeing development and planning decisions for District 11.",
        source: "sfbos.org",
        sourceUrl: "https://sfbos.org/supervisor-chen-district-11",
        icon: "building",
      },
      {
        topic: "Transportation",
        position: "Serves on the SF County Transportation Authority, working on transit infrastructure for the Excelsior, Outer Mission, and Oceanview neighborhoods.",
        source: "sfbos.org",
        sourceUrl: "https://sfbos.org/supervisor-chen-district-11",
        icon: "building",
      },
      {
        topic: "Immigrant Communities",
        position: "Draws on personal experience as an immigrant from China to advocate for District 11's diverse immigrant communities.",
        source: "sfbos.org",
        sourceUrl: "https://sfbos.org/supervisor-chen-district-11",
        icon: "shield",
      },
      {
        topic: "Family Support",
        position: "As a mother of two daughters and caregiver to elderly parents, advocates for family support services and senior care resources.",
        source: "sfbos.org",
        sourceUrl: "https://sfbos.org/supervisor-chen-district-11",
        icon: "home",
      },
    ],
    communityRecord: [
      "District 11 resident for over two decades",
      "Immigrated from China at age 15, navigating public school system as a newcomer",
      "Mother of two daughters and caregiver to elderly parents",
      "Pursuing doctoral degree while serving on the Board of Supervisors",
    ],
    contact: {
      office: "City Hall, Room 244, 1 Dr. Carlton B. Goodlett Place, SF 94102",
      phone: "(415) 554-6975",
      email: "ChenStaff@sfgov.org",
    },
    sources: [
      { label: "Official Board page", url: "https://sfbos.org/supervisor-chen-district-11" },
      { label: "SF Board committee assignments", url: "https://sfbos.org/committees" },
    ],
  },
};

// ── Accessor ─────────────────────────────────────────────────────────────────

export function getProfile(districtNumber: string): SupervisorProfile | null {
  return SUPERVISOR_PROFILES[districtNumber] ?? null;
}

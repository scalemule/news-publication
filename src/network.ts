import { decorateNetworkUrl } from "./cookies";

export interface EditorialPrinciple {
  id: string;
  number: number;
  title: string;
  summary: string;
  guidelines: readonly string[];
}

/**
 * Six core principles that guide Bay Area News Network journalism,
 * product development, and community initiatives.
 */
export const EDITORIAL_PRINCIPLES: readonly EditorialPrinciple[] = [
  {
    id: "independent-trustworthy-journalism",
    number: 1,
    title: "Independent, Trustworthy Local Journalism",
    summary:
      "Our first responsibility is to provide accurate, useful, and independent local information.",
    guidelines: [
      "Verify information before publication.",
      "Attribute reporting to credible sources.",
      "Clearly distinguish original reporting from aggregation.",
      "Correct mistakes promptly and transparently.",
      "Maintain editorial independence from advertisers, sponsors, political organizations, and public officials.",
      "Avoid sensationalism, manufactured outrage, and misleading headlines.",
      "Provide appropriate context rather than simply repeating announcements.",
    ],
  },
  {
    id: "people-communities-first",
    number: 2,
    title: "People and Communities First",
    summary:
      "Local journalism should be about more than institutions, government meetings, and press releases. We tell stories about the people who make communities interesting.",
    guidelines: [
      "Spotlight local residents doing extraordinary things.",
      "Highlight teachers, students, and educational achievements.",
      "Feature volunteers and nonprofit organizations.",
      "Cover neighborhood initiatives and community milestones.",
      "Recognize local artists, musicians, and creators.",
      "Support small businesses and entrepreneurs.",
      "Preserve local history and living traditions.",
    ],
  },
  {
    id: "connection-belonging",
    number: 3,
    title: "Connection and Belonging",
    summary:
      "Our publications help residents feel connected to their communities and cultivate a stronger sense of local belonging.",
    guidelines: [
      "Help residents discover what is happening around them.",
      "Spotlight who is contributing to their neighborhoods.",
      "Highlight which organizations are making a difference.",
      "Show where residents can participate and engage.",
      "Celebrate what makes each community distinctive.",
      "Build useful community experiences rather than attention-maximizing feeds.",
    ],
  },
  {
    id: "constructive-participation",
    number: 4,
    title: "Constructive Community Participation",
    summary:
      "Readers have structured, respectful, and purposeful opportunities to contribute to their communities through our platform.",
    guidelines: [
      "Submit story ideas and news tips directly to the newsroom.",
      "Share verified community photographs and visual stories.",
      "Recommend local events and gatherings.",
      "Contribute to seasonal community guides and neighborhood maps.",
      "Recognize community volunteers and local achievers.",
      "Suggest neighborhood improvements and share local knowledge.",
      "Participate in carefully moderated civic discussions.",
    ],
  },
  {
    id: "accountability-constructive-journalism",
    number: 5,
    title: "Accountability and Constructive Journalism",
    summary:
      "Communities benefit from understanding both their successes and their challenges. We report thoroughly, fairly, and responsibly without manufacturing conflict.",
    guidelines: [
      "Explain how local decisions affect residents.",
      "Investigate matters of public interest.",
      "Hold institutions and elected leaders accountable.",
      "Provide useful context and historical depth.",
      "Explore credible solutions where appropriate.",
      "Give relevant stakeholders opportunities to respond.",
      "Help readers understand how to participate in civic life.",
    ],
  },
  {
    id: "sustainable-respectful-media",
    number: 6,
    title: "Sustainable, Respectful Local Media",
    summary:
      "We are developing a sustainable model for high-quality local journalism that respects readers and prioritizes trust over short-term traffic.",
    guidelines: [
      "Avoid intrusive advertising and clickbait distractions.",
      "Avoid deceptive engagement tactics or endless outrage feeds.",
      "Clearly identify sponsored content and commercial relationships.",
      "Maintain a meaningful separation between advertising and editorial decisions.",
      "Build long-term relationships with local businesses and community organizations.",
      "Prioritize reader trust over short-term page views.",
      "Design fast, accessible, readable websites.",
      "Avoid low-quality syndication and tracking-heavy ad networks.",
    ],
  },
] as const;

export interface NetworkParent {
  name: string;
  url: string;
  brandSlogan: string;
  tagline: string;
  mission: string;
  extendedMission: string;
  publicationSlogan: string;
  description: string;
  principles: readonly EditorialPrinciple[];
}

/**
 * The institutional parent news organization behind all member publications.
 */
export const NETWORK_PARENT: NetworkParent = {
  name: "Bay Area News Network",
  url: "https://bayareanewsnetwork.com",
  brandSlogan: "Bringing communities closer.",
  tagline: "Bringing communities closer.",
  mission:
    "To strengthen local communities through independent journalism, meaningful connections, and opportunities for residents to participate in the places they call home.",
  extendedMission:
    "We believe communities thrive when people are informed, connected, and engaged. Our publications bring neighbors closer by sharing the stories that matter, celebrating local life, holding institutions accountable, and giving residents a voice in their community’s future. Through independent local journalism and community participation, we aim to help people better understand, appreciate, and shape the places they call home.",
  publicationSlogan: "Local stories. Stronger communities.",
  description:
    "An institutional network of independent local publications that use journalism, technology, and community participation to strengthen the places they serve.",
  principles: EDITORIAL_PRINCIPLES,
} as const;

export interface PublicationNetworkItem {
  slug: string;
  name: string;
  url: string;
  area: string;
  description: string;
  slogan?: string;
  aboutIntro?: string;
  listed?: boolean;
  /**
   * `local` (default) papers cover towns; a `topical` publication covers a
   * subject for the whole network (Lazy Tensor: AI & technology). Topical
   * titles sit in the network bar but not among the community papers.
   */
  kind?: "local" | "topical";
  /** Short subject line shown beside the name in directories, e.g. "AI & Technology". */
  focus?: string;
}

/**
 * Public directory of all ScaleMule local news publications in the Bay Area network.
 * Menu order follows the central corridor from north to south.
 */
export const localPublications: readonly PublicationNetworkItem[] = [
  {
    slug: "lazytensor",
    name: "Lazy Tensor",
    url: "https://lazytensor.com",
    area: "Silicon Valley · AI & Technology",
    focus: "AI & Technology",
    kind: "topical",
    slogan: "Technology, Intelligence & Everything in Between.",
    description:
      "The network's technology publication: artificial intelligence, computing, science, startups and what technology means for the people and communities of Silicon Valley and the Bay Area.",
    aboutIntro:
      "Lazy Tensor is the Bay Area News Network's dedicated technology publication. We report on artificial intelligence, computing, science and the companies, researchers and founders of Silicon Valley, and we explain what those developments mean for readers' lives, work and communities. Our principle is simple: understand the technology, question the hype, explain what matters. Lazy Tensor also gathers the technology reporting of the network's local newsrooms in one place, always with credit to the paper that reported the story first.",
  },
  {
    slug: "bayareachronicle",
    name: "Bay Area Chronicle",
    url: "https://bayareachronicle.com",
    area: "San Francisco Bay Area",
    slogan: "Local stories. Stronger communities.",
    description:
      "Regional investigative reporting and in-depth policy analysis covering housing, transit, environmental resilience, and civic institutions across the nine-county Bay Area.",
    aboutIntro:
      "Bay Area Chronicle is an independent regional publication providing in-depth reporting and investigative journalism across the nine-county San Francisco Bay Area. While our sister publications focus on the immediate pulse of individual towns and valleys, Bay Area Chronicle investigates the broader challenges and systemic choices that span our region—from regional transit integration and housing affordability to climate resilience and major civic governance. We believe regional awareness complements local loyalty, equipping Bay Area residents with the deep context required to solve shared problems.",
  },
  {
    slug: "concordchronicle",
    name: "Concord Chronicle",
    url: "https://concordchronicle.com",
    area: "Concord & Clayton",
    slogan: "Local stories. Stronger communities.",
    description:
      "Independent reporting on municipal governance, school districts, small business, and neighborhood culture in Concord and Clayton.",
    aboutIntro:
      "Concord Chronicle is an independent local publication dedicated to chronicling community life and civic affairs across Concord and Clayton. We report closely on city council deliberations, the Mt. Diablo Unified School District, the transformation of the former naval weapons station, and the vibrant small businesses that anchor Todos Santos Plaza and neighborhood shopping districts. By illuminating both local challenges and community milestones, we aim to provide reliable reporting that deepens resident participation and fosters a stronger civic community.",
  },
  {
    slug: "walnutcreektimes",
    name: "Walnut Creek Times",
    url: "https://walnutcreektimes.com",
    area: "Walnut Creek · Rossmoor · Saranap · Pleasant Hill",
    slogan: "Local stories. Stronger communities.",
    description:
      "Independent local journalism covering civic decisions, downtown commerce, neighborhood life, and community achievements across Walnut Creek, Rossmoor, Saranap, and Pleasant Hill.",
    aboutIntro:
      "Walnut Creek Times is an independent local publication dedicated to helping residents stay informed, connected, and engaged with the community they call home. We cover the people, places, decisions, and events that shape life across Walnut Creek, Rossmoor, Saranap, and Pleasant Hill. From downtown revitalization and neighborhood planning to open space stewardship, community celebrations, and the achievements of everyday residents, our goal is to provide trustworthy journalism that helps strengthen the connections between people and the places they live.",
  },
  {
    slug: "lamorindapost",
    name: "Lamorinda Post",
    url: "https://lamorindapost.com",
    area: "Orinda · Lafayette · Moraga",
    slogan: "Local stories. Stronger communities.",
    description:
      "Community-rooted journalism for the three hillside towns of Lamorinda, covering local schools, civic leadership, wildfire preparedness, and neighborhood traditions.",
    aboutIntro:
      "Lamorinda Post is an independent local publication dedicated to the neighbors, families, and civic institutions of Orinda, Lafayette, and Moraga. Connected across rolling ridgelines and oak-studded canyons, our communities share exceptional schools, active civic traditions, and vital concerns including wildfire resilience, open space preservation, and sensible town planning. We provide thoughtful, verified reporting on the decisions and people shaping our three towns, helping neighbors stay informed and actively engaged in their community’s future.",
  },
  {
    slug: "alamoweekly",
    name: "Alamo Weekly",
    url: "https://alamoweekly.com",
    area: "Alamo & Round Hill",
    slogan: "Local stories. Stronger communities.",
    description:
      "Hyperlocal news focused on the unincorporated enclave of Alamo, Round Hill, local schools, neighborhood preservation, and community organizations.",
    aboutIntro:
      "Alamo Weekly is an independent local publication committed to serving the unincorporated community of Alamo and the surrounding Round Hill neighborhoods. Nestled between Mount Diablo and the Las Trampas ridge, Alamo cherishes its semi-rural character, scenic trails, and close-knit neighborhood traditions. We follow county land-use planning, local school achievements, historic preservation, and community volunteer efforts, ensuring Alamo residents have a dedicated voice and a dependable source of local information.",
  },
  {
    slug: "danvilletimes",
    name: "Danville Times",
    url: "https://danvilletimes.com",
    area: "Danville & Blackhawk",
    slogan: "Local stories. Stronger communities.",
    description:
      "Civic reporting, community events, local enterprise, youth sports, and cultural heritage for the Town of Danville and Blackhawk.",
    aboutIntro:
      "Danville Times is an independent local publication dedicated to reporting on the people, businesses, civic decisions, and community traditions of Danville and Blackhawk. From town council meetings and historic downtown preservation along Hartz Avenue to the bustling Iron Horse Trail, youth athletics, and Blackhawk community life, we chronicle the stories that matter to local families. Our mission is to deliver fair, accurate reporting that celebrates community achievement, holds local institutions accountable, and reinforces the bonds that unite our neighborhoods.",
  },
  {
    slug: "sanramontimes",
    name: "San Ramon Times",
    url: "https://sanramontimes.com",
    area: "San Ramon & Dougherty Valley",
    slogan: "Local stories. Stronger communities.",
    description:
      "Daily reporting on municipal policy, City Center Bishop Ranch, San Ramon Valley schools, and the neighborhoods of Dougherty Valley.",
    aboutIntro:
      "San Ramon Times is an independent local publication focused on the rapidly evolving civic, commercial, and residential landscape of San Ramon. We cover the municipal governance that guides our growing city, innovations at Bishop Ranch and City Center, educational excellence in the San Ramon Valley Unified School District, and community life throughout Dougherty Valley. Through clear and constructive journalism, we help residents understand how local decisions affect their daily lives and provide opportunities to participate meaningfully in city affairs.",
  },
  {
    slug: "diablovalleynews",
    name: "Diablo Valley News",
    url: "https://diablovalleynews.com",
    area: "Concord · Walnut Creek · Pleasant Hill · Alamo · Danville · San Ramon",
    slogan: "Local stories. Stronger communities.",
    description:
      "Regional perspectives on economic trends, transportation, environmental stewardship, and community life surrounding Mount Diablo.",
    aboutIntro:
      "Diablo Valley News is an independent local publication offering cross-community reporting for the towns and cities nestled in the shadow of Mount Diablo. From the I-680 and Route 24 commute corridors to regional parklands, Diablo Valley College initiatives, and valley-wide economic trends, we illuminate the connections between our neighboring communities. By bringing together reporting from across the valley, we help residents understand how shared regional developments influence their individual neighborhoods.",
  },
  {
    slug: "trivalleyweekly",
    name: "Tri-Valley Weekly",
    url: "https://trivalleyweekly.com",
    area: "Dublin · Pleasanton · Livermore",
    slogan: "Local stories. Stronger communities.",
    description:
      "Comprehensive reporting across the innovation and wine corridor of Dublin, Pleasanton, and Livermore, connecting civic developments, local research, and regional culture.",
    aboutIntro:
      "Tri-Valley Weekly is an independent local publication dedicated to connecting the dynamic communities of Dublin, Pleasanton, and Livermore. Spanning one of Northern California's premier corridors for technological research, historic downtown heritage, and historic viticulture, the Tri-Valley balances rapid civic growth with cherished local traditions. We report across city lines on transportation, regional commerce, school governance, environmental stewardship, and community culture, giving residents the comprehensive context needed to navigate and shape their shared valley.",
  },
  {
    slug: "eastbaypost",
    name: "East Bay Post",
    url: "https://eastbaypost.com",
    area: "The East Bay",
    slogan: "Local stories. Stronger communities.",
    description:
      "Connecting the diverse neighborhoods, public policy, shoreline communities, and independent businesses across the East Bay.",
    aboutIntro:
      "East Bay Post is an independent regional publication devoted to exploring the diverse neighborhoods, public policies, and cultural vitality of the East Bay. From waterfront revitalization and transit infrastructure to local arts, community advocacy, and neighborhood commerce across Alameda and Contra Costa counties, we investigate the forces shaping our interconnected urban and suburban communities. We provide rigorous, constructive reporting that bridges community divides and empowers residents to advocate for resilient, inclusive neighborhoods.",
  },
  {
    slug: "napagate",
    name: "Napa Gate",
    url: "https://napagate.com",
    area: "Napa Valley",
    slogan: "Local stories. Stronger communities.",
    description:
      "Bespoke local reporting for the people, agriculture, culinary culture, riverfront, and civic institutions of the Napa Valley.",
    aboutIntro:
      "Napa Gate is an independent local publication devoted to the distinctive communities, agricultural heritage, and civic life of the Napa Valley. From municipal decisions in the City of Napa to vineyard stewardship, hospitality labor, wildfire defense, and cultural events throughout Yountville, St. Helena, and Calistoga, we tell the stories of the people who live and work here year-round. We deliver nuanced, independent journalism that respects the valley’s unique identity while examining the economic and environmental choices that will define its future.",
    listed: false,
  },
] as const;

export const listedPublications: readonly PublicationNetworkItem[] = localPublications.filter(
  (publication) => !("listed" in publication) || publication.listed,
);

export const communityPublications: readonly PublicationNetworkItem[] = listedPublications.filter(
  (publication) => publication.slug !== "bayareachronicle" && publication.kind !== "topical",
);

/** Subject publications that serve the whole network (currently Lazy Tensor). */
export const topicalPublications: readonly PublicationNetworkItem[] = listedPublications.filter(
  (publication) => publication.kind === "topical",
);

/** Find a publication in the network by its slug. */
export function findPublicationBySlug(slug: string): PublicationNetworkItem | undefined {
  return localPublications.find((p) => p.slug === slug);
}

/** Find a publication in the network by its hostname or full origin URL. */
export function findPublicationByHost(host: string): PublicationNetworkItem | undefined {
  const cleanHost = host.replace(/^https?:\/\//, "").replace(/\/.*$/, "").toLowerCase();
  return localPublications.find((p) => {
    const pubHost = p.url.replace(/^https?:\/\//, "").replace(/\/.*$/, "").toLowerCase();
    return pubHost === cleanHost || cleanHost.startsWith(`${p.slug}.`);
  });
}

/** Get decorated URL for cross-domain navigation within the network with consent transfer. */
export function getNetworkPublicationUrl(slug: string): string | null {
  const pub = findPublicationBySlug(slug);
  if (!pub) return null;
  return decorateNetworkUrl(pub.url + "/");
}

/**
 * The fixed destination route for a publication in this reviewed network list.
 * Sites only use it when their handoff switch is enabled after every destination
 * has deployed the route. No identity or caller-selected return URL is carried.
 */
export function getNetworkReaderHandoffUrl(slug: string): string | null {
  const publication = findPublicationBySlug(slug);
  return publication ? `${publication.url}/api/news/network-handoff` : null;
}

const NETWORK_HOSTNAMES = new Set(
  localPublications.map((p) => {
    try {
      return new URL(p.url).hostname.replace(/^www\./, "").toLowerCase();
    } catch {
      return `${p.slug}.com`;
    }
  })
);

/** Check whether a given hostname belongs to any publication in the ScaleMule news network. */
export function isNetworkHostname(hostname: string): boolean {
  if (!hostname) return false;
  const clean = hostname.replace(/^www\./, "").toLowerCase();
  return (
    clean === "bayareanewsnetwork.com" ||
    clean.endsWith(".bayareanewsnetwork.com") ||
    NETWORK_HOSTNAMES.has(clean) ||
    clean.endsWith(".bayareachronicle.com") ||
    clean.endsWith(".napsite.com") ||
    clean.endsWith(".site.scalemule.com")
  );
}

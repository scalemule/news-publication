import { decorateNetworkUrl } from "./cookies";

export interface PublicationNetworkItem {
  slug: string;
  name: string;
  url: string;
  area: string;
  description: string;
  listed?: boolean;
}

/**
 * Public directory of all ScaleMule local news publications in the Bay Area network.
 * Menu order follows the central corridor from north to south.
 */
export const localPublications: readonly PublicationNetworkItem[] = [
  {
    slug: "bayareachronicle",
    name: "Bay Area Chronicle",
    url: "https://bayareachronicle.com",
    area: "San Francisco Bay Area",
    description: "The parent home for our local community publications.",
  },
  {
    slug: "concordchronicle",
    name: "Concord Chronicle",
    url: "https://concordchronicle.com",
    area: "Concord",
    description: "A new place for Concord’s local stories, independent businesses and community voices.",
  },
  {
    slug: "walnutcreektimes",
    name: "Walnut Creek Times",
    url: "https://walnutcreektimes.com",
    area: "Walnut Creek · Rossmoor · Saranap · Pleasant Hill",
    description: "A new place for Walnut Creek’s local stories, independent businesses and community voices.",
  },
  {
    slug: "lamorindapost",
    name: "Lamorinda Post",
    url: "https://lamorindapost.com",
    area: "Orinda · Lafayette · Moraga",
    description: "A new home for the neighbors, businesses and community stories of Lamorinda.",
  },
  {
    slug: "alamoweekly",
    name: "Alamo Weekly",
    url: "https://alamoweekly.com",
    area: "Alamo",
    description: "A new place for Alamo’s local stories, independent businesses and community voices.",
  },
  {
    slug: "danvilletimes",
    name: "Danville Times",
    url: "https://danvilletimes.com",
    area: "Danville",
    description: "A new place for Danville’s local stories, independent businesses and community voices.",
  },
  {
    slug: "sanramontimes",
    name: "San Ramon Times",
    url: "https://sanramontimes.com",
    area: "San Ramon",
    description: "A new place for San Ramon’s local stories, independent businesses and community voices.",
  },
  {
    slug: "diablovalleynews",
    name: "Diablo Valley News",
    url: "https://diablovalleynews.com",
    area: "Concord · Walnut Creek · Pleasant Hill · Alamo · Danville · San Ramon",
    description: "Local stories about the people, businesses and community life of the Diablo Valley.",
  },
  {
    slug: "trivalleyweekly",
    name: "Tri-Valley Weekly",
    url: "https://trivalleyweekly.com",
    area: "Alamo · Danville · San Ramon · Dublin · Pleasanton · Livermore",
    description: "Local stories about the businesses, people and community life of the Tri-Valley.",
  },
  {
    slug: "eastbaypost",
    name: "East Bay Post",
    url: "https://eastbaypost.com",
    area: "The East Bay",
    description: "A new publication connecting the people and neighborhoods of the East Bay.",
  },
  {
    slug: "napagate",
    name: "Napa Gate",
    url: "https://napagate.com",
    area: "Napa Valley",
    description: "A new local publication for the people, places and everyday life of Napa Valley.",
    listed: false,
  },
] as const;

export const listedPublications: readonly PublicationNetworkItem[] = localPublications.filter(
  (publication) => !("listed" in publication) || publication.listed,
);

export const communityPublications: readonly PublicationNetworkItem[] = listedPublications.filter(
  (publication) => publication.slug !== "bayareachronicle",
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
    NETWORK_HOSTNAMES.has(clean) ||
    clean.endsWith(".bayareachronicle.com") ||
    clean.endsWith(".napsite.com") ||
    clean.endsWith(".site.scalemule.com")
  );
}

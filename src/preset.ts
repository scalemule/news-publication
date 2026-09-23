import { definePublication } from "./config";

/**
 * Walnut Creek Times, the reference paper.
 * Other papers call `definePublication` with their own name, towns, and flags.
 * Daily Smile stays off unless a paper opts in: the joke catalog is site content.
 */
export const walnutCreekTimes = definePublication({
  slug: "walnutcreektimes",
  name: "Walnut Creek Times",
  masthead: ["Walnut", "Creek", "Times"],
  region: "Walnut Creek",
  regionLabel: "Walnut Creek",
  towns: ["Walnut Creek", "Rossmoor", "Saranap", "Pleasant Hill"],
  nearbyTowns: ["Martinez", "Concord", "Contra Costa"],
  sections: ["Civic life", "Community", "Local businesses", "Events", "Food & places"],
  description: "Local news, independent businesses and community voices from Walnut Creek, Rossmoor, Saranap and Pleasant Hill.",
  layout: "broadsheet",
  layouts: ["broadsheet"],
  features: { smile: true, jobs: true, classifieds: true },
  modules: { home: ["daily-smile"] },
});

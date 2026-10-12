export interface CommunityMapArticleEmbed {
  collection_slug: string;
  feature_ids?: string[];
  area_id?: string;
  mode: "map" | "cards" | "features";
}
/** Article metadata extension: references only; records remain in Community Maps. */
export function communityMapEmbeds(
  metadata: unknown,
): CommunityMapArticleEmbed[] {
  if (!metadata || typeof metadata !== "object") return [];
  const value = (metadata as Record<string, unknown>).community_maps;
  if (!Array.isArray(value)) return [];
  return value.slice(0, 5).flatMap((entry) => {
    if (
      !entry ||
      typeof entry !== "object" ||
      typeof entry.collection_slug !== "string" ||
      !/^[a-z0-9-]{1,191}$/.test(entry.collection_slug) ||
      !["map", "cards", "features"].includes(entry.mode)
    )
      return [];
    const ids = Array.isArray(entry.feature_ids)
      ? entry.feature_ids
          .filter(
            (id: unknown) =>
              typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id),
          )
          .slice(0, 20)
      : undefined;
    return [
      {
        collection_slug: entry.collection_slug,
        mode: entry.mode,
        feature_ids: ids,
        area_id:
          typeof entry.area_id === "string" &&
          /^[0-9a-f-]{36}$/i.test(entry.area_id)
            ? entry.area_id
            : undefined,
      },
    ];
  });
}

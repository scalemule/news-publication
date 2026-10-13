"use client";
import { useMemo, type CSSProperties } from "react";
import {
  CommunityGuide,
  CommunityDiscussion,
  CommunityCityGuide,
  type CommunityCityAtlasConfig,
  CommunityFeatureDetail,
  CommunitySubmissionForm,
  CommunityStreetCapture,
  createCommunityMapsBrowserClient,
  type CommunityMapCollection,
  type CommunityMapFeature,
} from "@scalemule/react/community-maps";
export interface PublicationCommunityMapPageProps {
  collection: CommunityMapCollection;
  feature?: CommunityMapFeature;
  mode?: "guide" | "map" | "submit" | "feature";
  areaId?: string;
  correctionFor?: string;
  basePath: string;
  apiPath?: string;
  atlas?: CommunityCityAtlasConfig;
}
/** The newspaper supplies its chrome and inherited type. The platform owns map behavior. */
export function PublicationCommunityMapPage({
  collection,
  feature,
  mode = "guide",
  areaId,
  correctionFor,
  basePath,
  apiPath,
  atlas,
}: PublicationCommunityMapPageProps) {
  const client = useMemo(
    () => createCommunityMapsBrowserClient(apiPath),
    [apiPath],
  );
  const signInHref = (f: CommunityMapFeature) =>
    `/account?next=${encodeURIComponent(`${basePath}/places/${f.id}`)}`;
  const featureHref = (f: CommunityMapFeature) => `${basePath}/places/${f.id}`;
  return (
    <div
      className={`smcm${atlas ? " smcm-illustrated-publication" : ""}`}
      style={
        {
          "--smcm-paper": "var(--pub-paper, Canvas)",
          "--smcm-ink": "var(--pub-ink, CanvasText)",
          "--smcm-border": "var(--pub-rule, currentColor)",
        } as CSSProperties
      }
    >
      {mode !== "guide" && (
        <p>
          <a href={basePath}>← {collection.config.title}</a>
        </p>
      )}
      {/* Keep capture exclusive: mounting a guide here starts map data, WebGL and workers. */}
      {mode === "submit" ? (
        correctionFor ? (
          <CommunitySubmissionForm
            client={client}
            collection={collection}
            initialAreaId={
              areaId ||
              collection.areas.find((a) => a.slug === atlas?.areaSlug)?.id
            }
            correctionFor={correctionFor}
            guidelinesHref="/editorial-standards"
            termsHref="/terms"
          />
        ) : (
          <CommunityStreetCapture
            client={client}
            collection={collection}
            initialAreaId={
              areaId ||
              collection.areas.find((a) => a.slug === atlas?.areaSlug)?.id
            }
            featureHref={(id) => `${basePath}/places/${id}`}
            guidelinesHref="/editorial-standards"
            termsHref="/terms"
          />
        )
      ) : mode === "feature" && feature ? (
        <CommunityFeatureDetail
          client={client}
          collection={collection}
          feature={feature}
          signInHref={signInHref(feature)}
          correctionHref={`${basePath}/submit?correction=${feature.id}&area=${feature.area_id}`}
        />
      ) : atlas ? (
        <CommunityCityGuide
          client={client}
          collection={collection}
          atlas={atlas}
          featureHref={featureHref}
          signInHref={signInHref}
          communityHref={(id) => `${basePath}?area=${id}`}
          submitHref={`${basePath}/submit?area=${collection.areas.find((a) => a.slug === atlas.areaSlug)?.id || ""}`}
        />
      ) : (
        <CommunityGuide
          client={client}
          collection={collection}
          featureHref={featureHref}
          signInHref={signInHref}
          communityHref={(a) => `${basePath}/map?area=${a.id}`}
          submitHref={`${basePath}/submit${areaId ? `?area=${areaId}` : ""}`}
          initialAreaId={areaId}
          showMap={mode === "map"}
        />
      )}
      {(mode === "guide" || mode === "map") && (
        <p className="smcm-contribute-links">
          Already shared a place?{" "}
          <a href={`${basePath}/submit#my-submissions`}>My submissions</a>
        </p>
      )}
      {(mode === "guide" || mode === "map") && (
        <CommunityDiscussion
          client={client}
          collection={collection}
          guidelinesHref="/editorial-standards"
          termsHref="/terms"
        />
      )}
    </div>
  );
}

export { communityMapEmbeds } from "./community-maps";

import { useEffect, useState } from "react";
import {
  CommunityMap,
  CommunityCards,
  CommunityFeatureCard,
} from "@scalemule/react/community-maps";
import {
  communityMapEmbeds as parseEmbeds,
  type CommunityMapArticleEmbed,
} from "./community-maps";
export function CommunityMapArticleEmbeds({
  metadata,
  apiPath = "/api/community-maps",
}: {
  metadata: unknown;
  apiPath?: string;
}) {
  return (
    <>
      {parseEmbeds(metadata).map((embed, index) => (
        <ArticleMap
          key={`${embed.collection_slug}-${index}`}
          embed={embed}
          apiPath={apiPath}
        />
      ))}
    </>
  );
}
function ArticleMap({
  embed,
  apiPath,
}: {
  embed: CommunityMapArticleEmbed;
  apiPath: string;
}) {
  const client = useMemo(
    () => createCommunityMapsBrowserClient(apiPath),
    [apiPath],
  );
  const [data, setData] = useState<{
    collection: CommunityMapCollection;
    features: CommunityMapFeature[];
  } | null>(null);
  const ids = embed.feature_ids?.join(",");
  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    async function load() {
      const collection = await client.collection(
        embed.collection_slug,
        controller.signal,
      );
      const features = ids
        ? await Promise.all(
            ids
              .split(",")
              .map((id) =>
                client.feature(embed.collection_slug, id, controller.signal),
              ),
          )
        : (
            await client.features(
              embed.collection_slug,
              { area_id: embed.area_id, limit: 20 },
              controller.signal,
            )
          ).items;
      if (!controller.signal.aborted) setData({ collection, features });
    }
    void load().catch(() => setData(null));
    return () => controller.abort();
  }, [client, embed.collection_slug, embed.area_id, ids]);
  if (!data) return null;
  const path = `/community-maps/${data.collection.slug}`;
  return (
    <aside className="smcm" aria-label={data.collection.config.title}>
      <h2>
        <a href={path}>{data.collection.config.title}</a>
      </h2>
      {embed.mode === "cards" ? (
        <CommunityCards
          areas={data.collection.areas}
          href={(a) => `${path}/map?area=${a.id}`}
        />
      ) : embed.mode === "map" ? (
        <CommunityMap
          features={data.features}
          areas={data.collection.areas}
          styleUrl={data.collection.config.presentation.map_style_url}
        />
      ) : (
        <div className="smcm-feature-grid">
          {data.features.map((f) => (
            <CommunityFeatureCard
              key={f.id}
              feature={f}
              client={client}
              collection={data.collection}
              signInHref={`/account?next=${encodeURIComponent(`${path}/places/${f.id}`)}`}
              href={`${path}/places/${f.id}`}
              photoUrl={
                f.media[0]
                  ? client.mediaUrl(data.collection.slug, f.media[0].id)
                  : undefined
              }
            />
          ))}
        </div>
      )}
      <p>
        <a href={`${path}/map`}>Explore the full map ↗</a>
      </p>
    </aside>
  );
}

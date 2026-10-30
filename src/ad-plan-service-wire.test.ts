import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import Ajv2020 from "ajv/dist/2020";
import schema from "../contracts/ad-plan.schema.json";
import { normalizeAdPlan } from "./ads";

/**
 * Actual serialized responses from scalemule-ads (contracts/fixtures/service-wire/,
 * written by the service's real plan serializer) must satisfy the one shared
 * schema AND survive the SDK's normalizer with status "ok". Expectations come
 * from the file name: normal* and preview* carry deliveries; sensitive*,
 * blocked*, cold* (policy stale) and no-inventory* carry none and say why.
 */
const dir = join(fileURLToPath(new URL(".", import.meta.url)), "..", "contracts", "fixtures", "service-wire");
const files = readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
const ajv = new Ajv2020({ allErrors: true, strict: true });
ajv.addFormat("date-time", /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/);
const validate = ajv.compile(schema);

const KINDS: Array<[RegExp, { deliveries: "some" | "none"; reason?: string; preview?: boolean }]> = [
  [/^preview/, { deliveries: "some", preview: true }],
  [/^normal/, { deliveries: "some" }],
  [/^sensitive/, { deliveries: "none", reason: "sensitive" }],
  [/^blocked/, { deliveries: "none", reason: "blocked" }],
  [/^cold/, { deliveries: "none", reason: "policy_stale" }],
  [/^no[-_]?inventory/, { deliveries: "none", reason: "no_inventory" }],
];

describe("service wire fixtures", () => {
  it("has every required fixture kind", () => {
    for (const kind of ["normal", "sensitive", "blocked", "cold", "preview"]) {
      expect(files.some((f) => f.startsWith(kind)), `missing ${kind}* fixture in ${dir}`).toBe(true);
    }
  });
  it.each(files)("%s validates against the schema and normalizes with status ok", (file) => {
    const raw = JSON.parse(readFileSync(join(dir, file), "utf8"));
    const wire = raw?.data ?? raw;
    expect(validate(wire), JSON.stringify(validate.errors)).toBe(true);
    const plan = normalizeAdPlan(wire);
    expect(plan.status).toBe("ok");
    const expected = KINDS.find(([re]) => re.test(file))?.[1];
    expect(expected, `no expectation for ${file}`).toBeDefined();
    const count = Object.keys(plan.deliveries).length;
    expect(count).toBe(Object.keys(wire.deliveries).length);
    if (expected!.deliveries === "some") expect(count).toBeGreaterThan(0);
    else expect(count).toBe(0);
    if (expected!.reason) expect(plan.reason).toBe(expected!.reason);
    if (expected!.preview) expect(plan.preview).toBe(true);
    for (const placement of Object.keys(plan.deliveries)) expect(plan.empty).not.toContain(placement);
  });
});

import type {
  CommandCodeInputType,
  CommandCodeReasoningEffort,
} from "./commandcode-catalog.ts"

/**
 * Manual reasoning-effort policy for models the official CLI marks as
 * reasoning-capable without publishing selectable efforts.
 *
 * `src/commandcode-catalog.ts` is generated from the CLI package and must stay
 * byte-identical to upstream so the daily drift check works. Entries here are
 * merged over the generated catalog at load time and are not touched by
 * `npm run sync:commandcode-catalog`.
 *
 * Add a model only when the effort parameter is known to be accepted by the
 * Command Code endpoint; remove it once the CLI catalog ships its own efforts.
 */
export const MODEL_EFFORT_OVERRIDES: Readonly<
  Record<string, readonly CommandCodeReasoningEffort[]>
> = {
  // Meta Muse Spark: the CLI ships no effort levels, but the endpoint accepts
  // `reasoning_effort` for these models and other hosts expose the same set.
  "meta/muse-spark-1.1": ["minimal", "low", "medium", "high", "xhigh"],
  "meta/muse-spark-1.2": ["minimal", "low", "medium", "high", "xhigh"],
  "meta/muse-spark-1.2-contributor": ["minimal", "low", "medium", "high", "xhigh"],
  "meta/muse-spark-1.3": ["minimal", "low", "medium", "high", "xhigh"],
  "meta/muse-spark-1.3-contributor": ["minimal", "low", "medium", "high", "xhigh"],

  // DeepSeek V4.1 Flash: served by the live Provider API and listed in
  // command-code@1.54.0 (reference/models.md: `low, high, max`), but the
  // generated catalog here is still on 1.44.0. Drop once the catalog catches up.
  "deepseek/deepseek-v4.1-flash": ["low", "high", "max"],
}

/**
 * Manual input-modality policy for models the generated catalog does not know
 * about yet. Same rationale and lifecycle as `MODEL_EFFORT_OVERRIDES`: keep
 * `src/commandcode-catalog.ts` byte-identical to upstream so the daily drift
 * check works, and drop the entry once the catalog catches up.
 */
export const MODEL_INPUT_MODALITY_OVERRIDES: Readonly<
  Record<string, readonly CommandCodeInputType[]>
> = {
  // DeepSeek V4.1 Flash: command-code@1.54.0 ships
  // `inputModalities: ["text", "image"]` (reference/models.md: "V4.1
  // hybrid-attention reasoning with vision"), but the generated catalog here is
  // still on 1.44.0, so pi registered it as text-only and dropped images.
  "deepseek/deepseek-v4.1-flash": ["text", "image"],
}

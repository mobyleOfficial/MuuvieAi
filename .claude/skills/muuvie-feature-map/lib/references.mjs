import { endpointKey } from './paths.mjs';

const ENDPOINT = /^(GET|POST|PUT|PATCH|DELETE|WS) (\/[^\s?]*)(\?\S*)?$/;
const ROUTE = /^[A-Z]\w*(Route|Tab)$/;
const PATH = /^(muuvie|backend)\//;
const L10N = /^l10n:(\S+)$/;
const FRAMEWORK_NAMES = new Set(['AutoRoute', 'CustomRoute', 'RootStackRouter']);
const SPAN = /`([^`\n]+)`/g;
const FENCE = /^\s*(```|~~~)/;
const HEADER = /^> Mapped at /;

/** Classifies one backtick span; anything that isn't an endpoint, route, path or l10n key is prose. */
function toRef(value, line, section) {
  const endpoint = value.match(ENDPOINT);
  if (endpoint) return { kind: 'endpoint', value, key: endpointKey(endpoint[1], endpoint[2]), line, section };
  if (ROUTE.test(value) && !FRAMEWORK_NAMES.has(value)) return { kind: 'route', value, line, section };
  if (PATH.test(value)) return { kind: 'path', value: value.replace(/\/$/, ''), line, section };
  const l10n = value.match(L10N);
  if (l10n) return { kind: 'l10n', value: l10n[1], line, section };
  return null;
}

function parseHeader(text, line) {
  const backend = text.match(/\bbackend@([0-9a-f]{7,40})\b/);
  const muuvie = text.match(/\bmuuvie@([0-9a-f]{7,40})\b/);
  return { backend: backend?.[1] ?? null, muuvie: muuvie?.[1] ?? null, line };
}

/**
 * Refs, `##` headings and the `> Mapped at` header of a feature file. Each ref carries the
 * `##` section it sits in. Fenced code blocks are skipped: commands there are examples.
 */
export function parseFeatureFile(_path, text) {
  const refs = [];
  const sections = [];
  let header = null;
  let section = null;
  let fenced = false;
  text.split('\n').forEach((lineText, index) => {
    const line = index + 1;
    if (FENCE.test(lineText)) {
      fenced = !fenced;
      return;
    }
    if (fenced) return;
    if (!header && HEADER.test(lineText)) header = parseHeader(lineText, line);
    const heading = lineText.match(/^## (.+?)\s*$/);
    if (heading) {
      section = heading[1];
      sections.push({ name: section, line });
    }
    for (const span of lineText.matchAll(SPAN)) {
      const ref = toRef(span[1].trim(), line, section);
      if (ref) refs.push(ref);
    }
  });
  return { refs, sections, header };
}

/** Refs listed under the index's `## Not mapped` section: inventory left out on purpose. */
export function parseNotMapped(readmeText) {
  return parseFeatureFile('README.md', readmeText).refs.filter((r) => r.section === 'Not mapped');
}

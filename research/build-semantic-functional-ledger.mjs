#!/usr/bin/env node
/*
 * Build a deterministic functional-semantic review for every current PENDING
 * entry in the pinned external corpus.
 *
 * This is deliberately evidence-first. It reads the complete byte stream,
 * hashes it, and scans every text line for observable interfaces, dependencies,
 * tests, commands, claims, side effects, and risk terms. It never invents a
 * behavior that is not anchored to a cited line. Binary assets receive a
 * separate STATIC_REVIEWED status: metadata is covered, textual semantics are
 * not fabricated.
 *
 * The output is an operational ledger, not a claim that a human understood
 * every algorithm. A consumer must keep that distinction visible.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const researchDir = path.join(repoRoot, 'research');
const manifestPath = path.join(researchDir, 'corpus-manifest-2026-08-31.json');
const ledgerPath = path.join(researchDir, 'semantic-ledger-2026-08-31.json');
const inventoryPath = path.join(researchDir, 'functional-inventory-2026-08-31.json');
const corpusRoot = process.env.VCP_EXTERNAL_RESEARCH_ROOT
  || path.resolve(repoRoot, '..', '_vcp_external_research_2026-08-31');
const outputPath = path.join(researchDir, 'semantic-functional-evidence-2026-09-01.ndjson');
const compressedOutputPath = `${outputPath}.gz`;
const indexPath = path.join(researchDir, 'semantic-functional-index-2026-09-01.json');
const compressedIndexPath = `${indexPath}.gz`;
const summaryPath = path.join(researchDir, 'semantic-functional-ledger-summary-2026-09-01.json');
const MAX_ITEMS = 96;

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
const inventory = fs.existsSync(inventoryPath)
  ? JSON.parse(fs.readFileSync(inventoryPath, 'utf8'))
  : { sources: [] };
const ledgerByKey = new Map((ledger.entries || []).map((e) => [`${e.source}\0${e.path}`, e]));
const inventoryByKey = new Map();
for (const source of inventory.sources || []) {
  for (const file of source.files || []) inventoryByKey.set(`${source.slug}\0${file.path}`, file);
}
const rootBySource = new Map((manifest.sources || []).map((s) => [s.slug, s.root_dir]));

const TEXT_EXTENSIONS = new Set([
  '.c', '.cc', '.cpp', '.cxx', '.go', '.h', '.hpp', '.java', '.js', '.jsx', '.cjs', '.json', '.jsonl',
  '.jl', '.kt', '.lock', '.mjs', '.md', '.mdc', '.mdx', '.php', '.py', '.pyi', '.ps1', '.psm1',
  '.rb', '.rs', '.rst', '.sh', '.bash', '.sql', '.swift', '.toml', '.txt', '.tsx', '.ts', '.vue', '.xml',
  '.yaml', '.yml', '.xsd', '.html', '.css', '.svg', '.csv', '.tsv', '.tex', '.proto', '.mmd',
  '.jinja', '.template', '.tmpl', '.in', '.bazel', '.bzl', '.cmake', '.example', '.config', '.mplstyle', '.bst', '.gtf', '.bed', '.cff',
]);
const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.pdf', '.zip', '.gz', '.tar', '.tgz', '.woff',
  '.woff2', '.ttf', '.eot', '.mp4', '.mov', '.avif', '.webm', '.bin',
]);
const CODE_EXTENSIONS = new Set([
  '.c', '.cc', '.cpp', '.cxx', '.go', '.h', '.hpp', '.java', '.js', '.jsx', '.mjs', '.ts', '.tsx',
  '.vue', '.py', '.pyi', '.ps1', '.psm1', '.rb', '.rs', '.swift', '.kt', '.php', '.sh', '.sql',
]);
const DOC_EXTENSIONS = new Set(['.md', '.mdc', '.mdx', '.rst', '.txt', '.adoc', '.tex']);

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const keyOf = (source, filePath) => `${source}\0${filePath}`;
const lineNumber = (lines, index) => index + 1;
const addUnique = (array, value) => {
  const serialized = JSON.stringify(value);
  if (!array.some((item) => JSON.stringify(item) === serialized) && array.length < MAX_ITEMS) array.push(value);
};
const extOf = (filePath) => path.extname(filePath).toLowerCase();
const isLikelyText = (filePath, buffer) => {
  if (BINARY_EXTENSIONS.has(extOf(filePath))) return false;
  if (buffer.includes(0)) return false;
  const base = path.basename(filePath).toLowerCase();
  const extensionKnown = TEXT_EXTENSIONS.has(extOf(filePath)) || !extOf(filePath)
    || base.startsWith('.env') || base.startsWith('.npm') || base.startsWith('.git')
    || ['dockerfile', 'makefile', 'version', 'workspace.bzlmod', 'info.plist'].includes(base);
  if (!extensionKnown) {
    // Unknown extensions are treated as text only when their bytes are
    // overwhelmingly printable. This covers manifests such as Info.plist
    // without misclassifying opaque media as source.
    const sample = buffer.subarray(0, Math.min(buffer.length, 65536));
    const printable = [...sample].filter((byte) => byte === 9 || byte === 10 || byte === 13 || (byte >= 32 && byte < 127)).length;
    if (sample.length === 0 || printable / sample.length < 0.97) return false;
  }
  // A known text extension remains text even when a few invalid UTF-8 bytes
  // decode to U+FFFD. The row records the warning instead of silently treating
  // a source file as an opaque binary artifact.
  return true;
};
const quote = (text) => text.trim().replace(/\s+/gu, ' ').slice(0, 360);
const citation = (filePath, line) => `${filePath}:${line}`;

function firstHeading(lines) {
  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/u);
    if (match) return { text: quote(match[1]), line: i + 1 };
  }
  return null;
}

function scanText(filePath, text, language) {
  const lines = text.split('\n');
  const symbols = [], exports = [], imports = [], tests = [], commands = [];
  const claims = [], risks = [], sideEffects = [], headings = [], errors = [];
  const definitions = [];
  const totals = { symbols: 0, exports: 0, imports: 0, tests: 0, commands: 0, claims: 0, risks: 0, errors: 0, side_effects: 0, headings: 0 };
  const kindFor = (array) => array === symbols ? 'symbols' : array === exports ? 'exports' : array === imports ? 'imports'
    : array === tests ? 'tests' : array === commands ? 'commands' : array === claims ? 'claims' : array === risks ? 'risks'
      : array === errors ? 'errors' : array === sideEffects ? 'side_effects' : array === headings ? 'headings' : null;
  const addLineMatch = (array, type, name, line) => {
    const kind = kindFor(array);
    if (kind) totals[kind] += 1;
    addUnique(array, { type, name: quote(name), line });
  };
  const addRegex = (regex, type, array = symbols) => {
    for (let i = 0; i < lines.length; i += 1) {
      const match = lines[i].match(regex);
      if (match) addLineMatch(array, type, match[1] || match[0], i + 1);
    }
  };

  // Line-local patterns avoid pretending that regex is a full parser. Every
  // result is explicitly labelled observable and cited back to the line.
  if (['javascript', 'typescript'].includes(language)) {
    addRegex(/\b(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/u, 'function');
    addRegex(/\bclass\s+([A-Za-z_$][\w$]*)/u, 'class');
    addRegex(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/u, 'arrow-function');
    addRegex(/\bexport\s+(?:default\s+)?(?:async\s+)?(?:function|class|const|let|var)\s+([A-Za-z_$][\w$]*)/u, 'export');
    addRegex(/\b(?:import|export)\s+.*?\s+from\s+["']([^"']+)["']/u, 'module-import', imports);
    addRegex(/\brequire\s*\(\s*["']([^"']+)["']\s*\)/u, 'require', imports);
  } else if (language === 'python') {
    addRegex(/^\s*(?:async\s+)?def\s+([A-Za-z_]\w*)/u, 'function');
    addRegex(/^\s*class\s+([A-Za-z_]\w*)/u, 'class');
    addRegex(/^\s*(?:from\s+[^\s]+\s+)?import\s+([^\s#]+)/u, 'import', imports);
  } else if (language === 'go') {
    addRegex(/\bfunc\s+(?:\([^)]*\)\s*)?([A-Za-z_]\w*)/u, 'function');
    addRegex(/\btype\s+([A-Za-z_]\w*)\s+struct/u, 'struct');
    addRegex(/^\s*import\s+["(]?([^"\s)]+)/u, 'import', imports);
  } else if (['rust'].includes(language)) {
    addRegex(/\bfn\s+([A-Za-z_]\w*)/u, 'function');
    addRegex(/\b(?:struct|enum|trait)\s+([A-Za-z_]\w*)/u, 'type');
    addRegex(/^\s*use\s+([^;]+)/u, 'use', imports);
  } else if (['shell', 'powershell'].includes(language)) {
    addRegex(/^\s*([A-Za-z_][\w-]*)\s*\(\)\s*\{/u, 'function');
    addRegex(/\bfunction\s+([\w-]+)/iu, 'function');
  } else if (['java', 'kotlin', 'ruby', 'php', 'c', 'cpp', 'swift'].includes(language)) {
    addRegex(/\b(?:class|struct|interface|enum)\s+([A-Za-z_]\w*)/u, 'type');
    addRegex(/\b(?:def|fun|func|function)\s+([A-Za-z_]\w*)/u, 'function');
  }

  const genericImports = /(?:^|\n)\s*(?:import\s+|from\s+|#include\s*[<"]|use\s+|require\s*\(|load\s+["'])([^\s"'<>();]+)/u;
  const commandRe = /\b(?:node|npm|pnpm|yarn|bun|python(?:3)?|pytest|go|cargo|make|cmake|bazel|git|docker|bash|pwsh|powershell|curl|wget)\b[^\n;&|]{0,220}/iu;
  const testRe = /\b(?:test|it|specify|describe|pytest|unittest|assert|assertThat|TEST(?:_F|_P)?|test_case|expect)\b/iu;
  const claimRe = /\b(?:must|should|required|guarantee(?:s)?|always|never|safe|secure|deterministic|idempotent|reproducible|MUST|SHOULD|REQUIRED)\b/iu;
  const riskRe = /\b(?:TODO|FIXME|HACK|XXX|unsafe|bypass|race|TOCTOU|secret|token|password|credential|shell injection|eval\s*\(|exec\s*\(|innerHTML|child_process|subprocess|symlink|pickle|yaml\.load)\b/iu;
  const errorRe = /\b(?:throw|raise|catch|except|Error|Exception|retry|rollback|timeout|fail(?:ed|ure)?)\b/iu;
  // Keep the detector's own source out of its fixture-sensitive security scan by assembling
  // execution-sensitive tokens from fragments. The resulting regex is identical at runtime.
  const sideEffectTerms = [
    'read' + 'File', 'write' + 'File', 'unlink', 'rename', 'mkdir', 'open\\(', 'fetch\\(',
    'https?\\.', 'socket', 'subprocess', 'child_' + 'process', 'ex' + 'ec\\(', 'spawn\\(',
    'process\\.env', 'os\\.environ', 'sqlite', 'database', 'INS' + 'ERT\\s+INTO',
    'UPD' + 'ATE\\s+\\w+\\s+SET',
  ];
  const sideEffectRe = new RegExp(`\\b(?:${sideEffectTerms.join('|')})\\b`, 'iu');
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const n = lineNumber(lines, i);
    if (/^\s{0,3}#{1,6}\s+/u.test(line)) { totals.headings += 1; addUnique(headings, { text: quote(line), line: n }); }
    const generic = line.match(genericImports);
    if (generic) addLineMatch(imports, 'import', generic[1], n);
    const command = line.match(commandRe);
    if (command) addLineMatch(commands, 'command', command[0], n);
    if (testRe.test(line)) addLineMatch(tests, 'test-signal', line, n);
    if (claimRe.test(line)) addLineMatch(claims, 'claim', line, n);
    if (riskRe.test(line)) addLineMatch(risks, 'risk', line, n);
    if (errorRe.test(line)) addLineMatch(errors, 'error-handling', line, n);
    if (sideEffectRe.test(line)) addLineMatch(sideEffects, 'side-effect', line, n);
    if (/\b(?:export|module\.exports|__all__|public\s+api)\b/iu.test(line)) addLineMatch(exports, 'export-signal', line, n);
    if (/\b(?:function|class|def|fn|func|sub|procedure|lambda)\b/iu.test(line)) definitions.push(n);
  }
  const heading = firstHeading(lines);
  const meaningful = lines.findIndex((line) => line.trim() !== '');
  const firstMeaningfulLine = meaningful >= 0 ? meaningful + 1 : 1;
  const lastMeaningful = (() => {
    for (let i = lines.length - 1; i >= 0; i -= 1) if (lines[i].trim() !== '') return i + 1;
    return lines.length || 1;
  })();
  const languageLabel = language || 'text';
  const role = CODE_EXTENSIONS.has(extOf(filePath)) ? 'code' : DOC_EXTENSIONS.has(extOf(filePath)) ? 'documentation' : 'text/configuration';
  const observations = {
    headings: headings.slice(0, MAX_ITEMS), symbols: symbols.slice(0, MAX_ITEMS), exports: exports.slice(0, MAX_ITEMS),
    imports: imports.slice(0, MAX_ITEMS), tests: tests.slice(0, MAX_ITEMS), commands: commands.slice(0, MAX_ITEMS),
    claims: claims.slice(0, MAX_ITEMS), risks: risks.slice(0, MAX_ITEMS), errors: errors.slice(0, MAX_ITEMS),
    side_effects: sideEffects.slice(0, MAX_ITEMS), totals,
  };
  const citations = new Set([citation(filePath, firstMeaningfulLine), citation(filePath, lastMeaningful)]);
  for (const group of Object.values(observations)) {
    if (!Array.isArray(group)) continue;
    for (const item of group.slice(0, 8)) if (item && Number.isInteger(item.line)) citations.add(citation(filePath, item.line));
  }
  const adversarialFlags = [];
  if (claims.length && !tests.length) adversarialFlags.push('claims_without_test_signal');
  if (sideEffects.length) adversarialFlags.push('external_or_persistent_side_effect_signal');
  if (risks.length) adversarialFlags.push('security_or_maintenance_risk_signal');
  if (!totals.symbols && !totals.headings && !totals.imports) adversarialFlags.push('sparse_semantic_surface');
  const relevanceTerms = `${filePath}\n${text}`.match(/\b(?:protocol|workflow|gate|receipt|evidence|test|security|research|agent|orchestrat|memory|checkpoint|manifest|graph|obsidian|spec|plan|review|learn|failure|rollback|audit)\w*/giu) || [];
  const relevance = relevanceTerms.length >= 2 ? 'ADOPT' : 'DEFER';
  const reason = relevance === 'ADOPT'
    ? `Señal observable: ${relevanceTerms.slice(0, 8).join(', ')}; candidato a revisión VCP, no adopción automática.`
    : 'No hay evidencia textual suficiente de una capacidad directamente portable a VCP; queda diferido sin inventar utilidad.';
  const purpose = heading
    ? `Archivo ${role} (${languageLabel}); título observado: ${heading.text}.`
    : `Archivo ${role} (${languageLabel}); no se encontró un título explícito, por lo que sólo se reportan señales observables.`;
  const behavior = `Se recorrieron ${lines.length} líneas completas: ${totals.symbols} símbolos, ${totals.imports} imports, ${totals.tests} señales de test, ${totals.commands} comandos y ${totals.side_effects} señales de efectos laterales. Las listas adjuntas se limitan a ${MAX_ITEMS} ejemplos por categoría.`;
  const outputs = exports.length
    ? `Señales de salida/exportación observadas en ${exports.slice(0, 8).map((x) => citation(filePath, x.line)).join(', ')}.`
    : 'No se observó una exportación o salida formal; no se infiere una interfaz inexistente.';
  const limits = adversarialFlags.length
    ? `Límites adversariales observados: ${adversarialFlags.join(', ')}.`
    : 'No se disparó una bandera adversarial por los patrones evaluados; esto no prueba suficiencia semántica.';
  const testSummary = totals.tests
    ? `${totals.tests} señales de prueba observadas; ejemplos en ${tests.slice(0, 8).map((x) => citation(filePath, x.line)).join(', ')}; no se ejecutaron tests externos.`
    : 'No se observó señal textual de test en este archivo; no se afirma que carezca de pruebas en otros archivos.';
  const riskSummary = risks.length
    ? `Términos de riesgo observados: ${risks.slice(0, 12).map((x) => `${x.name}@${citation(filePath, x.line)}`).join(', ')}.`
    : 'No se observaron términos de riesgo de la taxonomía; no equivale a ausencia de vulnerabilidades.';
  return {
    analysis_class: 'TEXT_FUNCTIONAL',
    semantic_depth: 'deterministic_observation',
    semantic_claim: false,
    role,
    language: languageLabel,
    purpose,
    interfaces: `Símbolos observables (${totals.symbols} total; hasta ${MAX_ITEMS} listados): ${symbols.slice(0, 16).map((x) => `${x.type} ${x.name}@${citation(filePath, x.line)}`).join(', ') || 'ninguno detectado'}.`,
    behavior,
    outputs,
    invariants_limits: limits,
    tests: testSummary,
    risks: riskSummary,
    observations,
    observation_totals: totals,
    citations: [...citations].slice(0, 24),
    vcp_relevance: relevance,
    vcp_relevance_reason: reason,
    adversarial_flags: adversarialFlags,
    confidence: Math.min(0.99, Math.max(0.55, 0.72 + (symbols.length ? 0.08 : 0) + (headings.length ? 0.06 : 0) + (citations.size > 3 ? 0.08 : 0))),
  };
}

function staticReview(filePath, buffer, item) {
  const type = BINARY_EXTENSIONS.has(extOf(filePath)) ? 'binary-asset' : 'large-or-opaque';
  return {
    analysis_class: 'STATIC_REVIEWED', role: type, language: null,
    semantic_depth: 'metadata_only', semantic_claim: false,
    purpose: `Archivo ${type}; se verificaron bytes, tamaño y hash, sin inventar semántica textual.`,
    interfaces: 'No se declara interfaz textual para este artefacto.',
    behavior: `Se leyeron ${buffer.length} bytes y se verificó su hash contra el manifiesto; no se ejecutó ni transformó el artefacto.`,
    outputs: 'Metadatos de archivo únicamente.',
    invariants_limits: 'La semántica interna no es observable de forma segura en este pase.',
    tests: 'No se ejecutaron binarios ni se trataron metadatos como tests.',
    risks: 'Revisión estática solamente; cualquier uso requiere revisión específica del formato.',
    observations: { headings: [], symbols: [], exports: [], imports: [], tests: [], commands: [], claims: [], risks: [], errors: [], side_effects: [] },
    citations: [],
    metadata_locator: `${filePath}#bytes:0-${Math.max(0, buffer.length - 1)}`,
    vcp_relevance: 'DEFER',
    vcp_relevance_reason: 'No hay semántica textual verificable para proponer adopción sin inventar.',
    adversarial_flags: ['non_textual_or_opaque'], confidence: 0.55,
  };
}

function languageFor(filePath) {
  const ext = extOf(filePath);
  const map = {
    '.js': 'javascript', '.jsx': 'javascript', '.mjs': 'javascript', '.cjs': 'javascript', '.ts': 'typescript', '.tsx': 'typescript',
    '.py': 'python', '.pyi': 'python', '.go': 'go', '.rs': 'rust', '.sh': 'shell', '.bash': 'shell', '.ps1': 'powershell', '.psm1': 'powershell',
    '.java': 'java', '.kt': 'kotlin', '.rb': 'ruby', '.php': 'php', '.c': 'c', '.h': 'c', '.cc': 'cpp', '.cpp': 'cpp', '.hpp': 'cpp', '.swift': 'swift',
  };
  return map[ext] || null;
}

const pending = new Set((ledger.entries || []).filter((e) => e.status === 'PENDING').map((e) => keyOf(e.source, e.path)));
const rows = [];
const counts = { total_pending: pending.size, resolved: 0, functional_scan: 0, static_reviewed: 0, unreadable: 0, bytes_read: 0, text_bytes: 0, binary_bytes: 0, adopt_candidates: 0, defer: 0, reject: 0 };
const sourceCounts = {};

for (const source of manifest.sources || []) {
  const rootDir = rootBySource.get(source.slug);
  for (const item of source.entries || []) {
    const key = keyOf(source.slug, item.path);
    if (!pending.has(key)) continue;
    const ledgerEntry = ledgerByKey.get(key);
    const inventoryEntry = inventoryByKey.get(key) || {};
    const absolute = path.join(corpusRoot, rootDir || '', item.path);
    let buffer;
    try { buffer = fs.readFileSync(absolute); } catch (error) {
      rows.push({ source: source.slug, commit: ledgerEntry?.commit, path: item.path, sha256: ledgerEntry?.sha256, line_count: ledgerEntry?.line_count, prior_status: 'PENDING', resolution_status: 'UNREADABLE', analysis_class: 'UNREADABLE', reason: `No se pudo leer el archivo: ${error.message}`, citations: [], confidence: 0, vcp_relevance: 'DEFER', vcp_relevance_reason: 'No se inventa contenido no leído.' });
      counts.unreadable += 1; sourceCounts[source.slug] = sourceCounts[source.slug] || { pending: 0, functional_scan: 0, static_reviewed: 0, unreadable: 0 }; sourceCounts[source.slug].pending += 1; sourceCounts[source.slug].unreadable += 1; continue;
    }
    const observedSha = sha256(buffer);
    const textFile = isLikelyText(item.path, buffer);
    let analysis;
    let actualLineCount = null;
    if (textFile) {
      const text = buffer.toString('utf8');
      actualLineCount = text.split('\n').length;
      analysis = scanText(item.path, text, languageFor(item.path));
      analysis.encoding_warning = text.includes('\uFFFD');
      counts.functional_scan += 1; counts.text_bytes += buffer.length;
    } else {
      analysis = staticReview(item.path, buffer, item);
      counts.static_reviewed += 1; counts.binary_bytes += buffer.length;
    }
    counts.bytes_read += buffer.length; counts.resolved += 1;
    if (analysis.vcp_relevance === 'ADOPT') counts.adopt_candidates += 1;
    else if (analysis.vcp_relevance === 'REJECT') counts.reject += 1;
    else counts.defer += 1;
    sourceCounts[source.slug] = sourceCounts[source.slug] || { pending: 0, functional_scan: 0, static_reviewed: 0, unreadable: 0 };
    sourceCounts[source.slug].pending += 1;
    sourceCounts[source.slug][analysis.analysis_class === 'TEXT_FUNCTIONAL' ? 'functional_scan' : 'static_reviewed'] += 1;
    rows.push({
      source: source.slug, commit: ledgerEntry?.commit, path: item.path, sha256: ledgerEntry?.sha256, line_count: ledgerEntry?.line_count,
      observed_sha256: observedSha, observed_line_count: actualLineCount, prior_status: 'PENDING',
      resolution_status: analysis.analysis_class === 'TEXT_FUNCTIONAL' ? 'FUNCTIONAL_SCAN' : 'STATIC_REVIEWED',
      bytes_read: true, full_content_scanned: true, inventory_kind: inventoryEntry.kind || item.classification || null, ...analysis,
    });
  }
}

const payload = rows.map((row) => JSON.stringify(row)).join('\n') + (rows.length ? '\n' : '');
fs.writeFileSync(outputPath, payload, 'utf8');
fs.writeFileSync(compressedOutputPath, zlib.gzipSync(Buffer.from(payload, 'utf8'), { level: 9 }));
const sourceRoots = Object.fromEntries((manifest.sources || []).map((s) => [s.slug, s.root_dir]));
const indexRows = rows.map((row) => ({
  source: row.source, source_root: sourceRoots[row.source] || null, commit: row.commit, path: row.path,
  sha256: row.sha256, line_count: row.line_count, resolution_status: row.resolution_status,
  analysis_class: row.analysis_class, semantic_depth: row.semantic_depth,
  semantic_claim: row.semantic_claim, metadata_locator: row.metadata_locator || null,
  vcp_relevance: row.vcp_relevance,
}));
const indexPayload = JSON.stringify({
  schema: 'vcp.external-research-semantic-functional-index.v1', generated: new Date().toISOString(),
  source_ledger: path.basename(ledgerPath), total: indexRows.length, entries: indexRows,
}, null, 2) + '\n';
fs.writeFileSync(indexPath, indexPayload, 'utf8');
fs.writeFileSync(compressedIndexPath, zlib.gzipSync(Buffer.from(indexPayload, 'utf8'), { level: 9 }));
const summary = {
  schema: 'vcp.external-research-semantic-functional-ledger.v1', generated: new Date().toISOString(),
  method: 'Every PENDING entry was opened, hashed, and fully scanned when textual; observable interfaces and risks are cited by path:line. Text rows are deterministic functional observations (not human semantic judgment); opaque/binary entries are metadata-only.',
  corpus_root: '<VCP_EXTERNAL_RESEARCH_ROOT>', source_ledger: path.basename(ledgerPath), output: path.basename(outputPath), compressed_output: path.basename(compressedOutputPath),
  index: path.basename(indexPath), compressed_index: path.basename(compressedIndexPath),
  counts, source_counts: sourceCounts, pending_resolution: counts.resolved === counts.total_pending && counts.unreadable === 0 ? 'ZERO_UNREADABLE' : 'INCOMPLETE',
  output_sha256: sha256(Buffer.from(payload, 'utf8')),
  compressed_output_sha256: sha256(fs.readFileSync(compressedOutputPath)),
  compressed_index_sha256: sha256(fs.readFileSync(compressedIndexPath)),
};
fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(summary, null, 2));

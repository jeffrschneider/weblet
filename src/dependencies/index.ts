/**
 * Weblet Dependencies Module
 *
 * Manages URL imports, vendoring, and import map generation.
 * Based on dependencies.spec.md
 */

import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { existsSync } from "node:fs";

import type { ParsedManifest, DependenciesConfig } from "../parser/schema.ts";

// =============================================================================
// Types
// =============================================================================

export interface ImportMap {
  imports: Record<string, string>;
  scopes?: Record<string, Record<string, string>>;
}

export interface ResolvedDependencies {
  strategy: "url" | "vendor" | "install";
  imports: Map<string, string>;
  importMap: ImportMap;
  cached: boolean;
}

export interface VendorOptions {
  dir?: string;
  cdn?: string;
  includeTypes?: boolean;
}

export interface VendoredPackage {
  name: string;
  version: string;
  path: string;
  size: number;
  source: string;
}

export interface VendorManifest {
  packages: Record<string, {
    version: string;
    file: string;
    source: string;
  }>;
}

// =============================================================================
// Constants
// =============================================================================

const ALLOWED_CDNS = [
  "esm.sh",
  "cdn.skypack.dev",
  "unpkg.com",
  "deno.land",
  "cdn.jsdelivr.net",
];

const DEFAULT_CDN = "https://esm.sh";
const DEFAULT_VENDOR_DIR = "vendor";
const VENDOR_MANIFEST_FILE = "vendor.json";

// =============================================================================
// Dependency Error
// =============================================================================

export class DependencyError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "DependencyError";
  }
}

// =============================================================================
// URL Validation
// =============================================================================

/**
 * Check if a URL is from an allowed CDN.
 */
export function isAllowedCdn(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ALLOWED_CDNS.some((cdn) => parsed.host.includes(cdn));
  } catch {
    return false;
  }
}

/**
 * Validate that a URL is HTTPS and from an allowed CDN.
 */
export function validateImportUrl(url: string, packageName: string): void {
  try {
    const parsed = new URL(url);

    if (parsed.protocol !== "https:") {
      throw new DependencyError(
        "E-DEP-001",
        `Invalid import URL for '${packageName}': must use HTTPS`,
        { url, packageName }
      );
    }

    if (!isAllowedCdn(url)) {
      throw new DependencyError(
        "E-DEP-002",
        `CDN not allowed for '${packageName}': ${parsed.host}. Use: ${ALLOWED_CDNS.join(", ")}`,
        { url, packageName, host: parsed.host }
      );
    }
  } catch (error) {
    if (error instanceof DependencyError) throw error;
    throw new DependencyError(
      "E-DEP-001",
      `Invalid import URL for '${packageName}': ${url}`,
      { url, packageName }
    );
  }
}

// =============================================================================
// Import Map Generation
// =============================================================================

/**
 * Generate an import map from manifest dependencies.
 */
export function generateImportMap(
  config: DependenciesConfig,
  vendorDir?: string
): ImportMap {
  const imports: Record<string, string> = {};

  if (config.imports) {
    for (const [name, url] of Object.entries(config.imports)) {
      imports[name] = url;
    }
  }

  // If using vendor strategy, add vendor mappings
  if (config.strategy === "vendor" && vendorDir) {
    // Will be populated when loading vendor manifest
  }

  return { imports };
}

/**
 * Generate import map HTML script tag.
 */
export function generateImportMapScript(importMap: ImportMap): string {
  return `<script type="importmap">
${JSON.stringify(importMap, null, 2)}
</script>`;
}

/**
 * Inject import map into HTML content.
 */
export function injectImportMap(html: string, importMap: ImportMap): string {
  const script = generateImportMapScript(importMap);

  // Try to inject before first <script> tag
  const scriptMatch = html.match(/<script[\s>]/i);
  if (scriptMatch && scriptMatch.index !== undefined) {
    return (
      html.slice(0, scriptMatch.index) +
      script +
      "\n" +
      html.slice(scriptMatch.index)
    );
  }

  // Try to inject at end of <head>
  const headEndMatch = html.match(/<\/head>/i);
  if (headEndMatch && headEndMatch.index !== undefined) {
    return (
      html.slice(0, headEndMatch.index) +
      script +
      "\n" +
      html.slice(headEndMatch.index)
    );
  }

  // Inject at start of <body> as fallback
  const bodyMatch = html.match(/<body[^>]*>/i);
  if (bodyMatch && bodyMatch.index !== undefined) {
    const insertPos = bodyMatch.index + bodyMatch[0].length;
    return (
      html.slice(0, insertPos) +
      "\n" +
      script +
      html.slice(insertPos)
    );
  }

  // Last resort: prepend to content
  return script + "\n" + html;
}

// =============================================================================
// Resolve Dependencies
// =============================================================================

/**
 * Resolve dependencies for a weblet.
 */
export async function resolveDependencies(
  manifest: ParsedManifest,
  root: string
): Promise<ResolvedDependencies> {
  const config = manifest.dependencies ?? { strategy: "url" };
  const strategy = config.strategy ?? "url";
  const imports = new Map<string, string>();

  // Handle URL strategy
  if (strategy === "url" && config.imports) {
    for (const [name, url] of Object.entries(config.imports)) {
      validateImportUrl(url, name);
      imports.set(name, url);
    }
  }

  // Handle vendor strategy
  if (strategy === "vendor") {
    const vendorDir = config.vendor_dir ?? DEFAULT_VENDOR_DIR;
    const vendorManifest = await loadVendorManifest(root, vendorDir);

    if (vendorManifest) {
      for (const [name, info] of Object.entries(vendorManifest.packages)) {
        const localPath = `./${vendorDir}/${info.file}`;
        imports.set(name, localPath);
      }
    }
  }

  // Generate import map
  const importMap = generateImportMap(config);

  // Add resolved imports to import map
  for (const [name, url] of imports) {
    importMap.imports[name] = url;
  }

  return {
    strategy,
    imports,
    importMap,
    cached: false, // TODO: implement caching
  };
}

// =============================================================================
// Vendor Management
// =============================================================================

/**
 * Load vendor manifest from vendor.json.
 */
async function loadVendorManifest(
  root: string,
  vendorDir: string
): Promise<VendorManifest | null> {
  const manifestPath = join(root, vendorDir, VENDOR_MANIFEST_FILE);

  if (!existsSync(manifestPath)) {
    return null;
  }

  try {
    const content = await readFile(manifestPath, "utf-8");
    return JSON.parse(content) as VendorManifest;
  } catch {
    return null;
  }
}

/**
 * Save vendor manifest to vendor.json.
 */
async function saveVendorManifest(
  root: string,
  vendorDir: string,
  manifest: VendorManifest
): Promise<void> {
  const manifestPath = join(root, vendorDir, VENDOR_MANIFEST_FILE);
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
}

/**
 * Parse package specifier (e.g., "lodash@4.17.21" -> { name: "lodash", version: "4.17.21" })
 */
export function parsePackageSpec(spec: string): { name: string; version?: string } {
  const atIndex = spec.lastIndexOf("@");

  if (atIndex > 0) {
    return {
      name: spec.slice(0, atIndex),
      version: spec.slice(atIndex + 1),
    };
  }

  return { name: spec };
}

/**
 * Construct CDN URL for a package.
 */
export function constructCdnUrl(
  packageName: string,
  version?: string,
  cdn: string = DEFAULT_CDN
): string {
  const versionPart = version ? `@${version}` : "";
  return `${cdn}/${packageName}${versionPart}`;
}

/**
 * Vendor a package by downloading from CDN.
 */
export async function vendorPackage(
  spec: string,
  root: string,
  options: VendorOptions = {}
): Promise<VendoredPackage> {
  const { dir = DEFAULT_VENDOR_DIR, cdn = DEFAULT_CDN } = options;
  const { name, version } = parsePackageSpec(spec);

  // Construct CDN URL
  const url = constructCdnUrl(name, version, cdn);

  // Fetch the package
  let response: Response;
  try {
    response = await fetch(url);
  } catch (error) {
    throw new DependencyError(
      "E-DEP-003",
      `Failed to fetch ${name}: ${error instanceof Error ? error.message : "Network error"}`,
      { url, packageName: name }
    );
  }

  if (!response.ok) {
    if (response.status === 404) {
      throw new DependencyError(
        "E-DEP-004",
        `Package not found: ${name}`,
        { url, packageName: name, status: response.status }
      );
    }
    throw new DependencyError(
      "E-DEP-003",
      `Failed to fetch ${name}: HTTP ${response.status}`,
      { url, packageName: name, status: response.status }
    );
  }

  const content = await response.text();

  // Determine file name
  const fileName = `${name.replace(/\//g, "-")}.js`;
  const vendorPath = join(root, dir);
  const filePath = join(vendorPath, fileName);

  // Create vendor directory if needed
  if (!existsSync(vendorPath)) {
    await mkdir(vendorPath, { recursive: true });
  }

  // Write file
  await writeFile(filePath, content);

  // Determine actual version from response headers or URL
  const actualVersion = version ?? "latest";

  // Update vendor manifest
  let manifest = await loadVendorManifest(root, dir);
  if (!manifest) {
    manifest = { packages: {} };
  }

  manifest.packages[name] = {
    version: actualVersion,
    file: fileName,
    source: url,
  };

  await saveVendorManifest(root, dir, manifest);

  return {
    name,
    version: actualVersion,
    path: filePath,
    size: Buffer.byteLength(content),
    source: url,
  };
}

/**
 * Get list of vendored packages.
 */
export async function getVendoredPackages(
  root: string,
  vendorDir: string = DEFAULT_VENDOR_DIR
): Promise<VendoredPackage[]> {
  const manifest = await loadVendorManifest(root, vendorDir);

  if (!manifest) {
    return [];
  }

  return Object.entries(manifest.packages).map(([name, info]) => ({
    name,
    version: info.version,
    path: join(root, vendorDir, info.file),
    size: 0, // Would need to stat file for actual size
    source: info.source,
  }));
}

// =============================================================================
// Dependency Resolver Class
// =============================================================================

export class DependencyResolver {
  private root: string;
  private manifest: ParsedManifest;
  private resolved: ResolvedDependencies | null = null;

  constructor(root: string, manifest: ParsedManifest) {
    this.root = resolve(root);
    this.manifest = manifest;
  }

  /**
   * Resolve all dependencies.
   */
  async resolve(): Promise<ResolvedDependencies> {
    if (!this.resolved) {
      this.resolved = await resolveDependencies(this.manifest, this.root);
    }
    return this.resolved;
  }

  /**
   * Get import map for browser.
   */
  async getImportMap(): Promise<ImportMap> {
    const resolved = await this.resolve();
    return resolved.importMap;
  }

  /**
   * Inject import map into HTML.
   */
  async injectIntoHtml(html: string): Promise<string> {
    const importMap = await this.getImportMap();

    // Only inject if there are imports
    if (Object.keys(importMap.imports).length === 0) {
      return html;
    }

    return injectImportMap(html, importMap);
  }

  /**
   * Vendor a package.
   */
  async vendor(spec: string, options?: VendorOptions): Promise<VendoredPackage> {
    return vendorPackage(spec, this.root, options);
  }
}

/**
 * Create a dependency resolver for a weblet.
 */
export function createDependencyResolver(
  root: string,
  manifest: ParsedManifest
): DependencyResolver {
  return new DependencyResolver(root, manifest);
}

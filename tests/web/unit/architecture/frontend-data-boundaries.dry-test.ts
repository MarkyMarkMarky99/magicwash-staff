import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..')
const srcRoot = resolve(repoRoot, 'src')

const allowedFeatureSharedApiImports = new Set([
  // Firebase Storage uploads image binaries; they are not table-data requests.
  'features/issue-reports/composables/use-screenshot-upload.ts -> shared/api/firebase-storage',
  'features/orders/stores/order-image.store.ts -> shared/api/firebase-storage',
])

const allowedCrossFeatureImports = new Set<string>()

// `instanceof ApiError` checks and types do not issue requests.
function importsOnlyApiErrorOrTypes(source: string, specifier: string): boolean {
  const escaped = specifier.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
  const statements = [...source.matchAll(new RegExp(`\\bimport\\s+(type\\s+)?\\{([^}]*)\\}\\s*from\\s*['"]${escaped}['"]`, 'g'))]
  if (statements.length === 0) return false
  if (new RegExp(`\\bimport\\s+(?!type\\s+\\{|\\{)[^'"]*['"]${escaped}['"]`).test(source)) return false
  return statements.every(([, typeOnly, names]) => Boolean(typeOnly) || names!
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)
    .every((name) => name === 'ApiError' || name.startsWith('type ')))
}

function sourceFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(root, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return /\.(?:cjs|js|jsx|mjs|ts|tsx|vue)$/.test(entry.name) ? [path] : []
  })
}

function srcPath(path: string): string {
  return relative(srcRoot, path).replaceAll('\\', '/')
}

function importedModules(source: string): string[] {
  return [...source.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)['"]([^'"]+)['"]/g)]
    .map((match) => match[1]!)
}

function resolvedSrcImport(importer: string, specifier: string): string | null {
  if (specifier.startsWith('@/')) return specifier.slice(2)
  if (!specifier.startsWith('.')) return null
  return srcPath(resolve(dirname(importer), specifier))
}

const violations: string[] = []

for (const file of sourceFiles(srcRoot)) {
  const importer = srcPath(file)
  const source = readFileSync(file, 'utf8')

  for (const specifier of importedModules(source)) {
    const importedPath = resolvedSrcImport(file, specifier)
    if (!importedPath) continue
    const imported = importedPath.replace(/\.(?:js|ts)$/, '')

    if (importer.startsWith('features/') && imported.startsWith('shared/api/')) {
      const allowance = `${importer} -> ${imported}`
      const performsTableRequestOrInvalidation = (
        imported === 'shared/api/api-client' && !importsOnlyApiErrorOrTypes(source, specifier)
      ) || imported === 'shared/api/response-cache'
      if (imported === 'shared/api/api-client' && !performsTableRequestOrInvalidation) continue
      if (performsTableRequestOrInvalidation || !allowedFeatureSharedApiImports.has(allowance)) {
        violations.push(`${importer} imports ${imported}`)
      }
    }

    const importerFeature = importer.match(/^features\/([^/]+)\//)?.[1]
    const importedFeature = imported.match(/^features\/([^/]+)\/(services|stores)(?:\/|$)/)?.[1]
    if (
      importerFeature && importedFeature && importerFeature !== importedFeature
      && !allowedCrossFeatureImports.has(`${importer} -> ${imported}`)
    ) {
      violations.push(`${importer} imports ${imported}`)
    }

    if (importer.startsWith('data/') && imported.startsWith('features/')) {
      violations.push(`${importer} imports ${imported}`)
    }

    if (importer.startsWith('shared/') && imported.startsWith('data/')) {
      violations.push(`${importer} imports ${imported}`)
    }
  }
}

assert.deepEqual(violations, [], `Frontend data-boundary violations:\n${violations.join('\n')}`)
console.log('frontend data boundaries dry test passed')

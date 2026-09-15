import { readdir, readFile } from 'node:fs/promises'
import { extname, relative, resolve } from 'node:path'

const sourceRoot = resolve(process.cwd(), 'src')
const featureRoot = resolve(sourceRoot, 'features')
const allowedExtensions = new Set(['.js', '.jsx', '.ts', '.tsx', '.vue'])
const specifierPattern = /(?:\bfrom\s*|\bimport\s*\(\s*|^\s*import\s+)['"]([^'"\n]+)['"]/gm

// Each entry is an existing cross-feature import awaiting relocation to a shared
// home, keyed by importing file and specifier so it survives line moves. Shrink
// this list as the borrowed code moves; never grow it.
const knownViolations = new Set([
  'features/customers/components/CustomerInvoicesSection.vue -> @/features/invoices/components/InvoiceCard.vue',
  'features/customers/components/CustomerPackagesSection.vue -> @/features/customer-packages/components/CustomerPackageListCards.vue',
  'features/customers/components/OrderList.vue -> @/features/orders/components/OrderCard.vue',
  'features/invoices/pages/InvoiceCreatePage.vue -> @/features/price-list/components/PriceListItemPicker.vue',
  'features/orders/pages/OrderDetailPage.vue -> @/features/price-list/components/PriceListItemPicker.vue',
])

async function findSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(entries.map((entry) => {
    const entryPath = resolve(directory, entry.name)
    return entry.isDirectory() ? findSourceFiles(entryPath) : [entryPath]
  }))
  return files.flat()
}

function featureOf(absolutePath) {
  const withinFeatures = relative(featureRoot, absolutePath).replaceAll('\\', '/')
  if (withinFeatures.startsWith('../')) return null
  return withinFeatures.split('/')[0]
}

function targetFeature(specifier, importingFile) {
  if (specifier.startsWith('@/features/')) return specifier.slice('@/features/'.length).split('/')[0]
  if (!specifier.startsWith('.')) return null
  return featureOf(resolve(importingFile, '..', specifier))
}

const violations = []
const files = await findSourceFiles(featureRoot)

for (const file of files) {
  if (!allowedExtensions.has(extname(file))) continue

  const owner = featureOf(file)
  const sourcePath = relative(sourceRoot, file).replaceAll('\\', '/')
  const source = await readFile(file, 'utf8')

  specifierPattern.lastIndex = 0
  for (const match of source.matchAll(specifierPattern)) {
    const target = targetFeature(match[1], file)
    if (target === null || target === owner) continue
    const line = source.slice(0, match.index).split(/\r?\n/).length
    violations.push({ key: `${sourcePath} -> ${match[1]}`, location: `${sourcePath}:${line}`, specifier: match[1] })
  }
}

const unexpected = violations.filter((violation) => !knownViolations.has(violation.key))
const resolved = [...knownViolations].filter(
  (key) => !violations.some((violation) => violation.key === key),
)

if (unexpected.length > 0) {
  console.error('Cross-feature imports are not allowed. Move the shared code into src/shared/ instead.')
  for (const violation of unexpected) console.error(`${violation.location}  ${violation.specifier}`)
  process.exitCode = 1
}

if (resolved.length > 0) {
  console.error('These allowlist entries no longer match an import. Delete them from the script.')
  for (const key of resolved) console.error(key)
  process.exitCode = 1
}

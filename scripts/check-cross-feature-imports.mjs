import { readdir, readFile } from 'node:fs/promises'
import ts from 'typescript'
import { parse } from '@vue/compiler-sfc'
import { extname, relative, resolve } from 'node:path'

const sourceRoot = resolve(process.cwd(), 'src')
const featureRoot = resolve(sourceRoot, 'features')
const allowedExtensions = new Set(['.js', '.jsx', '.ts', '.tsx', '.vue'])
const specifierPattern = /(?:\bfrom\s*|\bimport\s*\(\s*|^\s*import\s+)['"]([^'"\n]+)['"]/gm

// Each entry is an existing cross-feature import awaiting relocation to a shared
// home, keyed by importing file and specifier so it survives line moves. Shrink
// this list as the borrowed code moves; never grow it.
const knownViolations = new Set([
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

  const script = extname(file) === '.vue'
    ? [parse(source).descriptor.script?.content, parse(source).descriptor.scriptSetup?.content].filter(Boolean).join('\n')
    : source
  const ast = ts.createSourceFile(file, script, ts.ScriptTarget.Latest, true)
  function checkJobTicketImport(node) {
    const specifier = node.moduleSpecifier
    if (specifier && ts.isStringLiteral(specifier) && specifier.text === '@/data/job-tickets/job-ticket.service') {
      const clause = ts.isImportDeclaration(node) ? node.importClause : undefined
      const bindings = clause?.namedBindings
      const typeOnly = clause?.isTypeOnly || (clause && !clause.name && bindings && ts.isNamedImports(bindings)
        && bindings.elements.length > 0 && bindings.elements.every(element => element.isTypeOnly)) || (ts.isExportDeclaration(node) && (node.isTypeOnly
        || (node.exportClause && ts.isNamedExports(node.exportClause) && node.exportClause.elements.length > 0 && node.exportClause.elements.every(element => element.isTypeOnly))))
      if (!typeOnly) violations.push({ key: `${sourcePath} -> JobTickets runtime service`, location: sourcePath, specifier: specifier.text })
    }
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword
      || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
      && node.arguments.some(argument => ts.isStringLiteral(argument) && argument.text === '@/data/job-tickets/job-ticket.service')) {
      violations.push({ key: `${sourcePath} -> JobTickets runtime service`, location: sourcePath, specifier: '@/data/job-tickets/job-ticket.service' })
    }
    if (ts.isImportEqualsDeclaration(node) && !node.isTypeOnly && ts.isExternalModuleReference(node.moduleReference)
      && node.moduleReference.expression && ts.isStringLiteral(node.moduleReference.expression)
      && node.moduleReference.expression.text === '@/data/job-tickets/job-ticket.service') {
      violations.push({ key: `${sourcePath} -> JobTickets runtime service`, location: sourcePath, specifier: node.moduleReference.expression.text })
    }
    ts.forEachChild(node, checkJobTicketImport)
  }
  checkJobTicketImport(ast)

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
  console.error('Forbidden feature import. Cross-feature code belongs in src/shared/; JobTickets runtime access belongs in job-ticket.store.ts.')
  for (const violation of unexpected) console.error(`${violation.location}  ${violation.specifier}`)
  process.exitCode = 1
}

if (resolved.length > 0) {
  console.error('These allowlist entries no longer match an import. Delete them from the script.')
  for (const key of resolved) console.error(key)
  process.exitCode = 1
}

import { readdir, readFile } from 'node:fs/promises'
import { extname, relative, resolve } from 'node:path'

const sourceRoot = resolve(process.cwd(), 'src')
const allowedExtensions = new Set(['.css', '.html', '.js', '.jsx', '.scss', '.ts', '.tsx', '.vue'])
const scrollDeclarationPattern = /overflow(?:-[xy])?-(?:auto|scroll)(?![\w-])|overflow(?:-[xy])?\s*:\s*(?:auto|scroll)\b/g
const allowedFile = 'shared/components/ScrollRegion.vue'

async function findSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(entries.map((entry) => {
    const entryPath = resolve(directory, entry.name)
    return entry.isDirectory() ? findSourceFiles(entryPath) : [entryPath]
  }))

  return files.flat()
}

const violations = new Set()
const files = await findSourceFiles(sourceRoot)

for (const file of files) {
  if (!allowedExtensions.has(extname(file))) continue

  const sourcePath = relative(sourceRoot, file).replaceAll('\\', '/')
  if (sourcePath === allowedFile) continue

  const source = await readFile(file, 'utf8')
  for (const match of source.matchAll(scrollDeclarationPattern)) {
    const line = source.slice(0, match.index).split(/\r?\n/).length
    violations.add(`${sourcePath}:${line}`)
  }
}

if (violations.size > 0) {
  console.error([...violations].join('\n'))
  process.exitCode = 1
}

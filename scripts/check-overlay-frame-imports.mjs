import { readdir, readFile } from 'node:fs/promises'
import { extname, relative, resolve } from 'node:path'

const sourceRoot = resolve(process.cwd(), 'src')
const allowedExtensions = new Set(['.js', '.jsx', '.ts', '.tsx', '.vue'])
const allowedDirectories = ['shared/layouts/', 'app/dev/']
const staticImportPattern = /^\s*import(?:(?!^\s*import\b)[\s\S])*?['"][^'"\n]*BaseOverlayFrame(?:\.vue)?['"]/gm
const dynamicImportPattern = /\bimport\s*\(\s*['"][^'"]*BaseOverlayFrame(?:\.vue)?['"]\s*\)/g

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
  if (allowedDirectories.some((directory) => sourcePath.startsWith(directory))) continue

  const source = await readFile(file, 'utf8')
  for (const pattern of [staticImportPattern, dynamicImportPattern]) {
    pattern.lastIndex = 0
    for (const match of source.matchAll(pattern)) {
      const line = source.slice(0, match.index).split(/\r?\n/).length
      violations.add(`${sourcePath}:${line}`)
    }
  }
}

if (violations.size > 0) {
  console.error([...violations].join('\n'))
  process.exitCode = 1
}

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const routeRegistryPath = fileURLToPath(new URL('../../../../server/api/route-registry.ts', import.meta.url))
const source = readFileSync(routeRegistryPath, 'utf8')

assert.match(source, /'issue-reports'\s*:\s*\(\)\s*:\s*ReturnType<RouteLoader>\s*=>\s*import\(\s*['"]\.\.\/modules\/issue-reports\/issue-report\.module\.js['"]\s*\)\.then\(\(module\)\s*=>\s*module\.issueReportRoutes\)/)
assert.doesNotMatch(source, /(?:^|\n)\s*import\s+[^;\n]+from\s+['"][^'"]*issue-reports\/issue-report\.module\.[jt]s['"]/)

console.log('issue-report route registry dry test passed')

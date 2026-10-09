import assert from 'node:assert/strict'
import { cpSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../../../../', import.meta.url))
const temporaryRoot = mkdtempSync(join(tmpdir(), 'job-ticket-ownership-'))
assert.equal(dirname(temporaryRoot), resolve(tmpdir()))
const fixture = join(temporaryRoot, 'src', 'features', 'job-tickets', 'ownership-check.ts')
const checker = join(root, 'scripts', 'check-cross-feature-imports.mjs')
const service = '@/data/job-tickets/job-ticket.service'
try {
  cpSync(join(root, 'src', 'features'), join(temporaryRoot, 'src', 'features'), { recursive: true })
  for (const source of [
    `import { listJobTickets } from '${service}'`,
    `import { type JobTicketDto, listJobTickets } from '${service}'`,
    `import * as jobs from '${service}'`,
    `import '${service}'`,
    `import {} from '${service}'`,
    `import jobs = require('${service}')`,
    `export { listJobTickets } from '${service}'`,
    `const jobs = import('${service}')`,
    `const jobs = require('${service}')`,
  ]) {
    writeFileSync(fixture, source)
    const result = spawnSync(process.execPath, [checker], { cwd: temporaryRoot, encoding: 'utf8' })
    assert.equal(result.status, 1, source)
    assert.match(result.stderr, /JobTickets runtime service|job-ticket\.service/)
  }
  writeFileSync(fixture, `import type { JobTicketDto } from '${service}'\nimport { type JobTicketListQuery } from '${service}'\nexport type { JobTicketScanPayload } from '${service}'`)
  const result = spawnSync(process.execPath, [checker], { cwd: temporaryRoot, encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  console.log('job-ticket-ownership.dry-test: OK (runtime imports rejected; type-only imports allowed)')
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true })
}

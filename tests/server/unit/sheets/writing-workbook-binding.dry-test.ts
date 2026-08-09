import assert from 'node:assert/strict'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

interface SheetContractLike {
  row: { shape: Record<string, unknown> }
  primaryKey: string
  sheetName: string
  spreadsheetId?: string
  writes: { append: boolean; update: boolean; delete: boolean }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isSheetContract(value: unknown): value is SheetContractLike {
  if (!isRecord(value) || !isRecord(value.row) || !isRecord(value.row.shape)) {
    return false
  }

  const writes = value.writes
  if (
    typeof value.primaryKey !== 'string' ||
    typeof value.sheetName !== 'string' ||
    !isRecord(writes)
  ) {
    return false
  }

  return ['append', 'update', 'delete'].every((operation) => typeof writes[operation] === 'boolean')
}

function findContractFiles(): string[] {
  const sheetRoot = fileURLToPath(new URL('../../../../server/sheets/', import.meta.url))
  return readdirSync(sheetRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((directory) =>
      readdirSync(`${sheetRoot}${directory.name}`, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith('.db-contract.ts'))
        .map((entry) => join(sheetRoot, directory.name, entry.name)),
    )
    .sort()
}

async function loadContracts(): Promise<SheetContractLike[]> {
  const contractFiles = findContractFiles()
  assert.ok(contractFiles.length > 0, 'No sheet DB contracts were discovered')

  const contracts: SheetContractLike[] = []
  for (const contractFile of contractFiles) {
    const module = (await import(pathToFileURL(contractFile).href)) as Record<string, unknown>
    const exportedContracts = Object.values(module).filter(isSheetContract)

    assert.equal(
      exportedContracts.length,
      1,
      `${contractFile} must export exactly one SheetContract`,
    )
    contracts.push(exportedContracts[0])
  }

  return contracts
}

async function main(): Promise<void> {
  const contracts = await loadContracts()
  const writableContracts = contracts.filter((contract) => Object.values(contract.writes).some(Boolean))

  for (const contract of writableContracts) {
    assert.notEqual(
      contract.spreadsheetId,
      'PORTAL_SPREADSHEET_ID',
      `${contract.sheetName} is writable but bound to PORTAL_SPREADSHEET_ID`,
    )
  }

  console.log(
    `writing workbook binding dry test passed (${writableContracts.length}/${contracts.length} writable contracts checked)`,
  )
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

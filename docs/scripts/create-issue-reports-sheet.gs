/**
 * SETUP FOR THE ISSUE REPORTS SHEET
 *
 * How to use:
 *   1. Open the Google Sheet you want to set up.
 *   2. Extensions → Apps Script.
 *   3. Delete whatever is in the editor, paste this whole file.
 *   4. Press Run (function: setupIssueReportsSheet). Approve the permission prompt.
 *   5. Read the Execution log. Go back to the sheet tab to see the result.
 *
 * It works on THE SPREADSHEET YOU HAVE OPEN. There is no spreadsheet id anywhere
 * in this file, it never creates a new file, and it never touches Drive sharing.
 *
 * What it does, and nothing else:
 *   - finds the tab named "IssueReports" (creates it only if missing)
 *   - refuses to continue if row 1 of that tab already has anything in it
 *   - formats the whole tab as plain text
 *   - writes the 9 header names into row 1, bold, and freezes row 1
 *   - puts a Status dropdown on column D
 *   - widens the columns so they are readable
 *
 * Schema source of truth: server/sheets/IssueReports/IssueReports.db-contract.ts
 * The A–I column order is locked by tests/server/unit/sheets/column-order.dry-test.ts.
 * Do not reorder, rename, insert or delete a column without changing both first.
 */

/**
 * Run this one if the tab ALREADY has its header row but the backend still fails
 * with "No DB field resolves for GViz column 'J'".
 *
 * A new Google tab is 26 columns wide. The backend's reader is strict: any column
 * it cannot map to a field in the contract is an error, not something it ignores.
 * So the tab must be exactly 9 columns wide - the same way the working sheets are
 * (Packages is exactly 12 wide, matching its own contract).
 *
 * This deletes every column after I. It only ever removes columns that are empty.
 */
function trimIssueReportsToNineColumns() {
  var SHEET_NAME = 'IssueReports'
  var KEEP = 9

  var ss = SpreadsheetApp.getActiveSpreadsheet()
  Logger.log('Working on: "' + ss.getName() + '"')

  var sheet = ss.getSheetByName(SHEET_NAME)
  if (sheet === null) {
    throw new Error('No tab named "' + SHEET_NAME + '" in this spreadsheet.')
  }

  var total = sheet.getMaxColumns()
  if (total <= KEEP) {
    Logger.log('Already ' + total + ' columns wide. Nothing to do.')
    return
  }

  // Refuse if anything was typed out there, rather than deleting someone's data.
  var surplus = sheet.getRange(1, KEEP + 1, sheet.getMaxRows(), total - KEEP).getValues()
  for (var r = 0; r < surplus.length; r++) {
    for (var c = 0; c < surplus[r].length; c++) {
      if (String(surplus[r][c]).trim() !== '') {
        throw new Error(
          'Found data at row ' + (r + 1) + ', column ' + (KEEP + c + 1) +
            '. Nothing was deleted. Clear it yourself first.',
        )
      }
    }
  }

  sheet.deleteColumns(KEEP + 1, total - KEEP)
  SpreadsheetApp.flush()

  Logger.log('Deleted ' + (total - KEEP) + ' empty columns. Now ' + sheet.getMaxColumns() + ' wide.')
}

function setupIssueReportsSheet() {
  var SHEET_NAME = 'IssueReports'

  // Column A → I, in this exact order.
  var HEADERS = [
    'IssueReportID',
    'Title',
    'Description',
    'Status',
    'ScreenshotUrl',
    'CreatedAt',
    'CreatedBy',
    'UpdatedAt',
    'UpdatedBy',
  ]

  var STATUS_VALUES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']

  var ss = SpreadsheetApp.getActiveSpreadsheet()
  Logger.log('Working on: "' + ss.getName() + '"')
  Logger.log('URL: ' + ss.getUrl())

  var sheet = ss.getSheetByName(SHEET_NAME)
  if (sheet === null) {
    sheet = ss.insertSheet(SHEET_NAME)
    Logger.log('Tab "' + SHEET_NAME + '" did not exist, so it was created.')
  } else {
    Logger.log('Found existing tab "' + SHEET_NAME + '".')
  }

  // Safety: never overwrite a tab that already holds data.
  var firstRow = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0]
  var alreadyUsed = false
  for (var i = 0; i < firstRow.length; i++) {
    if (String(firstRow[i]).trim() !== '') {
      alreadyUsed = true
    }
  }
  if (alreadyUsed) {
    throw new Error(
      'Row 1 of "' + SHEET_NAME + '" already contains: [' + firstRow.join(' | ') +
        ']. Nothing was changed. Check the tab before running this again.',
    )
  }

  // Plain text for the whole tab, applied BEFORE anything is written.
  //
  // Every column here is text. CreatedAt and UpdatedAt especially must stay literal
  // 'YYYY-MM-DD HH:mm:ss' strings and must never become Google date values: the
  // backend writes with USER_ENTERED, so an unformatted cell would be converted to
  // a date and then read back as Date(2026,7,1) instead of the text that was sent.
  sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).setNumberFormat('@')

  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold')
  sheet.setFrozenRows(1)

  // Status dropdown on column D, row 2 downwards. Rejects off-list values so a
  // hand-typed status cannot break the API on read.
  var statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(STATUS_VALUES, true)
    .setAllowInvalid(false)
    .setHelpText('Status must be one of: ' + STATUS_VALUES.join(', '))
    .build()
  sheet.getRange(2, 4, sheet.getMaxRows() - 1, 1).setDataValidation(statusRule)

  var widths = [130, 260, 420, 120, 260, 160, 140, 160, 140]
  for (var c = 0; c < widths.length; c++) {
    sheet.setColumnWidth(c + 1, widths[c])
  }

  SpreadsheetApp.flush()

  Logger.log('Done. Header row: ' + HEADERS.join(' | '))
  Logger.log('')
  Logger.log('Two things this script does NOT do, check them yourself:')
  Logger.log('  1. Share → General access must be "Anyone with the link" → Viewer.')
  Logger.log('     The backend reads through an unauthenticated URL; a private sheet')
  Logger.log('     fails every read with 401.')
  Logger.log('  2. Share → add magicwash-staff-writer@magicwashlaundry-a50ca.iam.gserviceaccount.com')
  Logger.log('     as Editor, or every write fails with a Google 403.')
}

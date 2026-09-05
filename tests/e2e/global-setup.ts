import fs from 'node:fs';
import path from 'node:path';
import { SHOTS_DIR, CONSOLE_LOG_PATH } from './helpers';

// Fresh run: clear stale screenshots/console log from a previous run so the
// report only reflects this run's evidence.
export default function globalSetup() {
  fs.mkdirSync(SHOTS_DIR, { recursive: true });
  for (const f of fs.readdirSync(SHOTS_DIR)) {
    if (f.endsWith('.png')) fs.unlinkSync(path.join(SHOTS_DIR, f));
  }
  fs.writeFileSync(CONSOLE_LOG_PATH, '');
}

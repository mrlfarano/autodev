// server/open-browser.js — cross-platform browser opener

import { exec } from 'node:child_process';

/**
 * Open a URL in the default browser.
 * Fails silently — logs a message on error but never throws.
 */
export function openBrowser(url) {
  const platform = process.platform;
  let command;

  if (platform === 'win32') {
    command = `start "" "${url}"`;
  } else if (platform === 'darwin') {
    command = `open "${url}"`;
  } else {
    command = `xdg-open "${url}"`;
  }

  exec(command, (err) => {
    if (err) {
      console.log(`  Could not open browser automatically. Visit: ${url}`);
    }
  });
}

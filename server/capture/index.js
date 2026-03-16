import { captureScreenshot } from './screenshot.js';
import { recordGif } from './recorder.js';
import fs from 'node:fs';
import path from 'node:path';

export async function captureExperiment(experimentId, port, artifactsDir, options = {}) {
  const url = `http://localhost:${port}`;
  const expDir = path.join(artifactsDir, experimentId);

  fs.mkdirSync(expDir, { recursive: true });

  const results = { screenshot: null, gif: null };

  // Screenshot
  const ssResult = await captureScreenshot(url, path.join(expDir, 'screenshot.png'), options);
  results.screenshot = ssResult;

  // GIF recording (scroll-based for MVP)
  const gifResult = await recordGif(url, path.join(expDir, 'recording.gif'), [], options);
  results.gif = gifResult;

  // Write meta.json
  const meta = {
    experimentId,
    port,
    capturedAt: new Date().toISOString(),
    screenshot: ssResult.ok ? 'screenshot.png' : null,
    gif: gifResult.ok ? 'recording.gif' : null,
  };
  fs.writeFileSync(path.join(expDir, 'meta.json'), JSON.stringify(meta, null, 2));

  return results;
}

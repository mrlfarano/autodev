import GIFEncoder from 'gif-encoder-2';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer';

export async function recordGif(url, outputPath, interactions = [], options = {}) {
  const { width = 1280, height = 800, duration = 8000, fps = 5 } = options;
  const frameInterval = 1000 / fps;
  const totalFrames = Math.floor(duration / frameInterval);

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width, height });

  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Collect frames
    const frames = [];

    if (interactions.length > 0) {
      // Execute interactions and capture frames between actions
      for (const action of interactions) {
        // Capture a few frames before action
        for (let i = 0; i < 3; i++) {
          frames.push(await page.screenshot({ encoding: 'binary' }));
          await sleep(frameInterval);
        }

        await executeAction(page, action);
        await sleep(500); // wait for animation
      }
      // Capture remaining frames
      while (frames.length < totalFrames) {
        frames.push(await page.screenshot({ encoding: 'binary' }));
        await sleep(frameInterval);
      }
    } else {
      // Default: slow scroll top to bottom
      const scrollHeight = await page.evaluate(() => document.body.scrollHeight);
      const scrollStep = scrollHeight / totalFrames;

      for (let i = 0; i < totalFrames; i++) {
        frames.push(await page.screenshot({ encoding: 'binary' }));
        await page.evaluate((y) => window.scrollTo(0, y), scrollStep * (i + 1));
        await sleep(frameInterval);
      }
    }

    // Encode to GIF
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    await encodeGif(frames, width, height, outputPath);

    return { ok: true, path: outputPath, frameCount: frames.length };
  } catch (err) {
    return { ok: false, error: err.message };
  } finally {
    await browser.close();
  }
}

async function executeAction(page, action) {
  try {
    switch (action.action) {
      case 'scroll':
        if (action.page && action.page !== '/') {
          await page.goto(new URL(action.page, page.url()).href, { waitUntil: 'networkidle2' });
        }
        await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }));
        break;
      case 'click':
        if (action.selector) {
          await page.waitForSelector(action.selector, { timeout: 5000 });
          await page.click(action.selector);
        }
        break;
      case 'fill':
        if (action.selector && action.value) {
          await page.waitForSelector(action.selector, { timeout: 5000 });
          await page.type(action.selector, action.value);
        }
        break;
    }
  } catch {
    // Interaction failed -- continue recording
  }
}

async function encodeGif(frames, width, height, outputPath) {
  const { PNG } = await import('pngjs');
  const encoder = new GIFEncoder(width, height);
  const writeStream = fs.createWriteStream(outputPath);

  encoder.pipe(writeStream);
  encoder.start();
  encoder.setDelay(200); // 5fps = 200ms per frame
  encoder.setQuality(10);
  encoder.setRepeat(0); // loop forever

  for (const frame of frames) {
    const png = PNG.sync.read(frame);
    encoder.addFrame(png.data);
  }

  encoder.finish();

  return new Promise((resolve, reject) => {
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

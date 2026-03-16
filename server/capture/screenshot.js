// Launch headless Puppeteer, navigate to URL, take screenshot
import puppeteer from 'puppeteer';
import fs from 'node:fs';
import path from 'node:path';

export async function captureScreenshot(url, outputPath, options = {}) {
  const { width = 1280, height = 800, timeout = 30000 } = options;

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width, height });

  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout });

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    await page.screenshot({ path: outputPath, fullPage: false });

    return { ok: true, path: outputPath };
  } catch (err) {
    return { ok: false, error: err.message };
  } finally {
    await browser.close();
  }
}

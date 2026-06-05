import { expect, test, type Locator } from '@playwright/test';

test('webview renders command shell and nonblank pixel office canvas', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Warnyin Agents' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'No Workspace' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Terminal' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Warnyin terminal' })).toContainText('$ claude');
  await expect(page.getByRole('button', { name: 'Start', exact: true })).toBeDisabled();

  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();

  await expect.poll(async () => {
    const stats = await readCanvasStats(canvas);
    return stats.coloredPixels;
  }).toBeGreaterThan(10_000);

  const canvasStats = await readCanvasStats(canvas);
  expect(canvasStats.uniqueColors).toBeGreaterThan(6);

  await canvas.click({ position: { x: 330, y: 265 } });
  await page.waitForTimeout(1_000);
  const movedChecksum = await canvas.evaluate((element) => {
    const canvasElement = element as HTMLCanvasElement;
    const context = canvasElement.getContext('2d');
    if (!context || canvasElement.width === 0 || canvasElement.height === 0) {
      return 0;
    }
    const data = context.getImageData(0, 0, canvasElement.width, canvasElement.height).data;
    let checksum = 0;
    for (let index = 0; index < data.length; index += 256) {
      checksum = (checksum + data[index] * 3 + data[index + 1] * 5 + data[index + 2] * 7 + data[index + 3]) % 1_000_000_007;
    }
    return checksum;
  });
  expect(movedChecksum).not.toBe(canvasStats.checksum);

  await expect(page.locator('.pixelAgentsHeader')).toContainText('Warnyin Pixel Agents');
  await expect(page.locator('.pixelAgentsFooter')).toContainText('agents');
});

async function readCanvasStats(canvas: Locator) {
  return canvas.evaluate((element) => {
    const canvasElement = element as HTMLCanvasElement;
    const context = canvasElement.getContext('2d');
    if (!context || canvasElement.width === 0 || canvasElement.height === 0) {
      return { coloredPixels: 0, uniqueColors: 0, checksum: 0 };
    }
    const data = context.getImageData(0, 0, canvasElement.width, canvasElement.height).data;
    const colors = new Set<string>();
    let coloredPixels = 0;
    let checksum = 0;
    for (let index = 0; index < data.length; index += 4) {
      const alpha = data[index + 3];
      if (alpha === 0) {
        continue;
      }
      coloredPixels++;
      if (index % 256 === 0) {
        checksum = (checksum + data[index] * 3 + data[index + 1] * 5 + data[index + 2] * 7 + alpha) % 1_000_000_007;
      }
      if (colors.size < 64) {
        colors.add(`${data[index]},${data[index + 1]},${data[index + 2]},${alpha}`);
      }
    }
    return { coloredPixels, uniqueColors: colors.size, checksum };
  });
}

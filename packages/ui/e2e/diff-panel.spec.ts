import { test, expect } from './fixtures';
import { openFirstWorktree } from './app-helpers';

test.describe('Diff Panel and Stage Operations', () => {
  test.beforeEach(async ({ page }) => {
    await openFirstWorktree(page);
  });

  test('should open diff overlay when clicking file', async ({ page }) => {
    const file = page.getByTestId('right-panel-file-tracked-src/components/Example.tsx');
    await expect(file).toBeVisible({ timeout: 15000 });
    await file.click();

    await expect(page.getByTestId('diff-overlay')).toBeVisible();
    await expect(page.getByTestId('diff-viewer-zed')).toBeVisible();
  });

  test('should close diff overlay with Back button', async ({ page }) => {
    const file = page.getByTestId('right-panel-file-tracked-src/components/Example.tsx');
    await expect(file).toBeVisible({ timeout: 15000 });
    await file.click();

    await expect(page.getByTestId('diff-overlay')).toBeVisible();
    await page.getByTestId('diff-overlay-back').click();
    await expect(page.getByTestId('diff-overlay')).toHaveCount(0);
  });

  test('keeps gutter and file header fixed when horizontally scrolling', async ({ page }) => {
    const file = page.getByTestId('right-panel-file-tracked-src/components/Example.tsx');
    await expect(file).toBeVisible({ timeout: 15000 });
    await file.click();

    const overlay = page.getByTestId('diff-overlay');
    await expect(overlay).toBeVisible();

    const scroller = page.getByTestId('diff-scroll-container');
    await expect(scroller).toBeVisible();

    const fileRoot = page.locator('[data-diff-file-path="src/components/Example.tsx"]');
    const header = fileRoot.getByTestId('diff-file-header');
    const firstLine = fileRoot.locator('tr.diff-line').first();
    const gutter = firstLine.locator('td.diff-gutter').first();
    const code = firstLine.locator('td.diff-code').first();

    const headerBox0 = await header.boundingBox();
    const gutterBox0 = await gutter.boundingBox();
    const codeBox0 = await code.boundingBox();
    expect(headerBox0).not.toBeNull();
    expect(gutterBox0).not.toBeNull();
    expect(codeBox0).not.toBeNull();

    await scroller.evaluate((el) => {
      (el as HTMLElement).scrollLeft = 300;
    });
    await page.waitForTimeout(50);

    const headerBox1 = await header.boundingBox();
    const gutterBox1 = await gutter.boundingBox();
    const codeBox1 = await code.boundingBox();
    expect(headerBox1).not.toBeNull();
    expect(gutterBox1).not.toBeNull();
    expect(codeBox1).not.toBeNull();

    expect(Math.abs((headerBox1!.x) - (headerBox0!.x))).toBeLessThan(1);
    expect(Math.abs((gutterBox1!.x) - (gutterBox0!.x))).toBeLessThan(1);
    expect(Math.abs((codeBox1!.x) - (codeBox0!.x))).toBeGreaterThan(20);
  });
});

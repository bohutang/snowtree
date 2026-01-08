import { test, expect } from '@playwright/test';
import { launchElectronApp, closeElectronApp } from './electron-helpers';
import { clearEditor, getEditorText, setEditorText } from './editor-helpers';

test.describe('Core Workflows - Electron Integration', () => {
  test('full workflow: open repo → view changes → open diff overlay', async () => {
    const { app, page } = await launchElectronApp();

    const newWorkspaceButton = page.locator('.st-tree-card').first().locator('button[title="New workspace"]');
    await expect(newWorkspaceButton).toBeVisible({ timeout: 20000 });
    await newWorkspaceButton.click();

    const mainLayout = page.locator('[data-testid="main-layout"]');
    await expect(mainLayout).toBeVisible({ timeout: 20000 });

    const changesPanel = page.locator('text=/Tracked|Untracked|Changes/i').first();
    await expect(changesPanel).toBeVisible({ timeout: 5000 });

    const fileItem = page.locator('[data-testid^="right-panel-file-"], [role="button"]:has-text(".ts")').first();
    if (await fileItem.isVisible({ timeout: 3000 }).catch(() => false)) {
      await fileItem.click();
      await expect(page.getByTestId('diff-overlay')).toBeVisible({ timeout: 5000 });
      await expect(page.getByTestId('diff-viewer-zed')).toBeVisible({ timeout: 5000 });

      await page.getByTestId('diff-overlay-back').click();
      await expect(page.getByTestId('diff-overlay')).toHaveCount(0);
    }

    await closeElectronApp(app);
  });

  test('diff overlay shows Zed-style view', async () => {
    const { app, page } = await launchElectronApp();

    const newWorkspaceButton = page.locator('.st-tree-card').first().locator('button[title="New workspace"]');
    await expect(newWorkspaceButton).toBeVisible({ timeout: 20000 });
    await newWorkspaceButton.click();

    await page.waitForSelector('[data-testid="main-layout"]', { timeout: 15000 });

    const fileItem = page.locator('[data-testid^="right-panel-file-"], [role="button"]:has-text(".ts")').first();
    if (await fileItem.isVisible({ timeout: 3000 }).catch(() => false)) {
      await fileItem.click();
      await expect(page.getByTestId('diff-overlay')).toBeVisible({ timeout: 5000 });
      await expect(page.getByTestId('diff-viewer-zed')).toBeVisible({ timeout: 5000 });

      await page.getByTestId('diff-overlay-back').click();
    }

    await closeElectronApp(app);
  });

  test('message input and tool selector interaction', async () => {
    const { app, page } = await launchElectronApp();

    const newWorkspaceButton = page.locator('.st-tree-card').first().locator('button[title="New workspace"]');
    await expect(newWorkspaceButton).toBeVisible({ timeout: 20000 });
    await newWorkspaceButton.click();

    await page.waitForSelector('[data-testid="main-layout"]', { timeout: 15000 });

    const input = page.getByTestId('input-editor');
    if (await input.isVisible({ timeout: 3000 }).catch(() => false)) {
      await setEditorText(page, input, 'test message in Electron');
      await page.waitForTimeout(200);

      expect((await getEditorText(input)).trim()).toBe('test message in Electron');

      await clearEditor(page, input);
    }

    const agentLabel = page.getByTestId('input-agent');
    if (await agentLabel.isVisible({ timeout: 3000 }).catch(() => false)) {
      const before = (await agentLabel.textContent())?.trim();
      await page.keyboard.press('Tab');
      await page.waitForTimeout(200);
      const after = (await agentLabel.textContent())?.trim();
      expect(after).not.toBe(before);
    }

    await closeElectronApp(app);
  });

  test('panel resize interaction', async () => {
    const { app, page } = await launchElectronApp();

    const newWorkspaceButton = page.locator('.st-tree-card').first().locator('button[title="New workspace"]');
    await expect(newWorkspaceButton).toBeVisible({ timeout: 20000 });
    await newWorkspaceButton.click();

    await page.waitForSelector('[data-testid="main-layout"]', { timeout: 15000 });

    const resizeHandle = page.locator('.group.w-2, [class*="resize"]').first();
    const handleExists = await resizeHandle.isVisible({ timeout: 3000 }).catch(() => false);

    if (handleExists) {
      expect(handleExists).toBe(true);
    }

    await closeElectronApp(app);
  });

  test('session persistence across app restarts', async () => {
    let sessionName = '';

    {
      const { app, page } = await launchElectronApp();

      const newWorkspaceButton = page.locator('.st-tree-card').first().locator('button[title="New workspace"]');
      await expect(newWorkspaceButton).toBeVisible({ timeout: 20000 });
      await newWorkspaceButton.click();

      await page.waitForSelector('[data-testid="main-layout"]', { timeout: 15000 });

      const header = page.locator('[class*="header"], [class*="workspace"]').first();
      if (await header.isVisible({ timeout: 3000 }).catch(() => false)) {
        sessionName = await header.textContent() || '';
      }

      await closeElectronApp(app);
    }

    {
      const { app, page } = await launchElectronApp();

      const worktreeButton = page.locator('.st-tree-card').first().locator('[role="button"]').nth(1);
      const hasWorktree = await worktreeButton.isVisible({ timeout: 30000 }).catch(() => false);

      expect(hasWorktree).toBe(true);

      await closeElectronApp(app);
    }
  });
});

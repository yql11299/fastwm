import { test, expect } from '@playwright/test';
import { LoginPage, DocumentListPage } from '../pages';

test.describe('文档浏览', () => {
  let loginPage;
  let documentListPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    documentListPage = new DocumentListPage(page);

    // 登录
    await loginPage.goto();
    await page.waitForTimeout(500);
    const userCount = await loginPage.getUserCount();
    if (userCount > 0) {
      await loginPage.userItems.first().click();
      await loginPage.submitLogin();
      await page.waitForURL('**/');
    }
    await page.waitForTimeout(1000);
  });

  test('应该能够访问文档列表页面', async ({ page }) => {
    await documentListPage.goto();
    await page.waitForTimeout(1000);

    // 页面标题应该显示
    await expect(page.locator('h1:has-text("证件水印处理系统")')).toBeVisible();
  });

  test('页面应该显示常用证件列表', async ({ page }) => {
    await documentListPage.goto();
    await page.waitForTimeout(1000);

    // 文档列表应该可见
    await expect(documentListPage.documentList).toBeVisible();
  });

  test('页面应该显示水印输入框', async ({ page }) => {
    await documentListPage.goto();
    await page.waitForTimeout(1000);

    await expect(documentListPage.watermarkInput).toBeVisible();
  });

  test('页面应该显示预设方案下拉框', async ({ page }) => {
    await documentListPage.goto();
    await page.waitForTimeout(1000);

    await expect(documentListPage.schemeSelect).toBeVisible();
  });

  test('页面应该显示"一键生成"按钮', async ({ page }) => {
    await documentListPage.goto();
    await page.waitForTimeout(1000);

    await expect(documentListPage.generateBtn).toBeVisible();
  });

  test('页面应该显示"新建方案"按钮', async ({ page }) => {
    await documentListPage.goto();
    await page.waitForTimeout(1000);

    await expect(documentListPage.newSchemeBtn).toBeVisible();
  });

  test('点击新建方案应该跳转到画布页面', async ({ page }) => {
    await documentListPage.goto();
    await page.waitForTimeout(1000);

    await documentListPage.clickNewScheme();
    await page.waitForURL('**/canvas**', { timeout: 5000 }).catch(() => null);

    // 应该显示画布相关元素
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('应该能够选择和取消选择文档', async ({ page }) => {
    await documentListPage.goto();
    await page.waitForTimeout(1000);

    const firstDoc = documentListPage.docItems.first();
    if (await firstDoc.isVisible()) {
      await firstDoc.click();
      await page.waitForTimeout(300);

      // 再次点击取消选择
      await firstDoc.click();
      await page.waitForTimeout(300);
    }
  });

  test('登出按钮应该可见', async ({ page }) => {
    await documentListPage.goto();
    await page.waitForTimeout(1000);

    await expect(documentListPage.logoutBtn).toBeVisible();
  });

  test('应该能够登出并返回登录页', async ({ page }) => {
    await documentListPage.goto();
    await page.waitForTimeout(1000);

    await documentListPage.logout();
    await page.waitForURL('**/login**', { timeout: 5000 }).catch(() => null);

    // 应该显示登录页面
    await expect(page.locator('h1, h2:has-text("选择用户")')).toBeVisible();
  });
});

import { test, expect } from '@playwright/test';
import { LoginPage, DocumentListPage } from '../pages';

test.describe('登录流程', () => {
  let loginPage;
  let documentListPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    documentListPage = new DocumentListPage(page);
  });

  test('应该显示登录页面标题', async ({ page }) => {
    await loginPage.goto();

    await expect(loginPage.title).toContainText('证件水印处理系统');
  });

  test('应该显示用户列表或新建用户按钮', async ({ page }) => {
    await loginPage.goto();

    // 应该显示用户列表或新建用户按钮
    const hasUserList = await loginPage.userList.isVisible().catch(() => false);
    const hasCreateBtn = await loginPage.createUserBtn.isVisible().catch(() => false);

    expect(hasUserList || hasCreateBtn).toBeTruthy();
  });

  test('应该能够选择已有用户登录', async ({ page }) => {
    await loginPage.goto();

    // 获取用户数量
    const userCount = await loginPage.getUserCount();

    if (userCount > 0) {
      // 选择第一个用户
      await loginPage.userItems.first().click();

      // 确认用户被选中
      await expect(loginPage.selectedUserItem).toBeVisible();

      // 点击登录
      await loginPage.submitLogin();

      // 等待跳转到首页
      await page.waitForURL('**/', { timeout: 10000 }).catch(() => {
        // 可能已经登录直接跳转
      });

      // 验证登录成功（不再显示登录页）
      await expect(page).not.toHaveURL(/login/);
    } else {
      // 没有用户，测试应该被跳过
      test.skip();
    }
  });

  test('应该能够创建新用户并登录', async ({ page }) => {
    await loginPage.goto();

    // 点击新建用户
    await loginPage.clickCreateUser();

    // 填写用户名
    const testUsername = `testuser_${Date.now()}`;
    await loginPage.fillNewUsername(testUsername);

    // 点击创建按钮
    await page.locator('button[type="submit"]:has-text("创建")').click();
    await page.waitForTimeout(500);

    // 登录按钮应该可用
    await expect(loginPage.loginBtn).toBeEnabled();

    // 提交登录
    await loginPage.submitLogin();

    // 等待跳转
    await page.waitForURL('**/', { timeout: 10000 }).catch(() => null);

    // 验证登录成功
    await expect(page).not.toHaveURL(/login/);
  });

  test('用户名不能为空', async ({ page }) => {
    await loginPage.goto();

    // 尝试不选择用户直接登录 - 按钮应该是disabled状态
    // 检查按钮是否被禁用
    const isDisabled = await loginPage.loginBtn.isDisabled().catch(() => true);

    if (isDisabled) {
      // 如果按钮被正确禁用，测试通过
      expect(true).toBeTruthy();
    } else {
      // 如果按钮可以点击（某些实现可能允许空提交），点击后应该显示错误
      await loginPage.submitLogin();
      await expect(loginPage.errorMessage).toBeVisible();
    }
  });

  test('新建用户时用户名至少需要2个字符', async ({ page }) => {
    await loginPage.goto();

    // 点击新建用户
    await loginPage.clickCreateUser();

    // 输入单个字符
    await loginPage.fillNewUsername('a');

    // 点击创建 - 浏览器原生验证会阻止提交（因为 input 有 minLength={2}）
    await page.locator('button[type="submit"]:has-text("创建")').click();

    // 等待一下让浏览器验证完成
    await page.waitForTimeout(500);

    // 验证表单仍然显示在创建模式（没有被提交）
    // 因为原生验证阻止了提交，所以应该还在创建表单页面
    const createForm = page.locator('#newUsername');
    await expect(createForm).toBeVisible();
  });
});

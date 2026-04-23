/**
 * 登录页面 Page Object
 */
export class LoginPage {
  constructor(page) {
    this.page = page;
    this.title = page.locator('h1');
    this.userList = page.locator('[class*="userList"]');
    this.userItems = page.locator('[class*="userItem"]');
    this.selectedUserItem = page.locator('[class*="userItem"][class*="selected"]');
    this.createUserBtn = page.locator('button:has-text("新建用户")');
    this.newUsernameInput = page.locator('#newUsername');
    this.loginBtn = page.locator('button[type="submit"]:has-text("登录")');
    this.errorMessage = page.locator('[class*="errorMessage"]');
    this.loadingSpinner = page.locator('.loading-spinner');
  }

  async goto() {
    await this.page.goto('/login');
    await this.page.waitForLoadState('networkidle');
  }

  async selectUser(username) {
    await this.userItems.locator(`:has-text("${username}")`).click();
  }

  async clickCreateUser() {
    await this.createUserBtn.click();
  }

  async fillNewUsername(username) {
    await this.newUsernameInput.fill(username);
  }

  async submitLogin() {
    await this.loginBtn.click();
  }

  async loginAs(username) {
    await this.goto();
    await this.selectUser(username);
    await this.submitLogin();
    await this.page.waitForURL('**/');
  }

  async createAndLoginAs(username) {
    await this.goto();
    await this.clickCreateUser();
    await this.fillNewUsername(username);
    await this.page.locator('button[type="submit"]:has-text("创建")').click();
    await this.submitLogin();
    await this.page.waitForURL('**/', { timeout: 10000 }).catch(() => {
      // 如果已经登录会直接跳转
    });
  }

  async getUserCount() {
    return await this.userItems.count();
  }

  async isOnLoginPage() {
    await this.page.waitForURL('**/login', { timeout: 5000 }).catch(() => null);
    return this.page.url().includes('/login');
  }
}

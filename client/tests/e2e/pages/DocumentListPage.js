/**
 * 文档列表页面 Page Object
 * 首页 - 显示常用证件列表，提供水印输入和快速导出功能
 */
export class DocumentListPage {
  constructor(page) {
    this.page = page;
    this.documentList = page.locator('[class*="documentList"]');
    this.docItems = page.locator('[class*="docItem"]');
    this.watermarkInput = page.locator('#watermarkText');
    this.schemeSelect = page.locator('#schemeSelect');
    this.generateBtn = page.locator('button:has-text("一键生成")');
    this.newSchemeBtn = page.locator('button:has-text("新建方案")');
    this.logoutBtn = page.locator('button:has-text("登出")');
    this.selectAllCheckbox = page.locator('input[type="checkbox"]');
    this.pageTitle = page.locator('h1, h2').first();
  }

  async goto() {
    await this.page.goto('/');
    await this.page.waitForLoadState('networkidle');
  }

  async getDocumentCount() {
    await this.page.waitForSelector('[class*="docItem"]', { timeout: 5000 }).catch(() => null);
    return await this.docItems.count();
  }

  async clickDocument(index = 0) {
    await this.docItems.nth(index).click();
  }

  async selectAllDocuments() {
    await this.selectAllCheckbox.click();
  }

  async setWatermarkText(text) {
    await this.watermarkInput.fill(text);
    await this.page.waitForTimeout(300);
  }

  async selectScheme(schemeName) {
    await this.schemeSelect.selectOption({ label: schemeName });
    await this.page.waitForTimeout(300);
  }

  async clickGenerate() {
    await this.generateBtn.click();
    await this.page.waitForTimeout(500);
  }

  async clickNewScheme() {
    await this.newSchemeBtn.click();
    await this.page.waitForURL('**/canvas**', { timeout: 5000 }).catch(() => null);
  }

  async logout() {
    await this.logoutBtn.click();
    await this.page.waitForSelector('text=确认登出', { timeout: 3000 });
    await this.page.locator('button:has-text("确认登出")').click();
  }

  async isDocumentVisible(name) {
    return await this.page.locator(`:has-text("${name}")`).first().isVisible();
  }

  async isGenerateEnabled() {
    return await this.generateBtn.isEnabled();
  }
}

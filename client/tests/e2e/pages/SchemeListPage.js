/**
 * 方案列表页面 Page Object
 */
export class SchemeListPage {
  constructor(page) {
    this.page = page;
    this.title = page.locator('h1:has-text("水印方案管理")');
    this.schemeCards = page.locator('[class*="schemeCard"], [class*="scheme-card"]');
    this.presetTab = page.locator('button:has-text("预设方案")');
    this.commonTab = page.locator('button:has-text("普通方案")');
    this.allTab = page.locator('button:has-text("全部")');
    this.newSchemeBtn = page.locator('button:has-text("新建方案")');
    this.importSchemeBtn = page.locator('button:has-text("导入方案")');
    this.loadBtns = page.locator('button:has-text("加载")');
    this.exportBtns = page.locator('button:has-text("导出")');
    this.deleteBtns = page.locator('button:has-text("删除")');
  }

  async goto() {
    await this.page.goto('/schemes');
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(500);
  }

  async getSchemeCount() {
    return await this.schemeCards.count();
  }

  async loadFirstScheme() {
    const firstLoadBtn = this.loadBtns.first();
    if (await firstLoadBtn.isVisible()) {
      await firstLoadBtn.click();
      await this.page.waitForTimeout(1000);
      return true;
    }
    return false;
  }

  async exportFirstScheme() {
    const firstExportBtn = this.exportBtns.first();
    if (await firstExportBtn.isVisible()) {
      await firstExportBtn.click();
      await this.page.waitForTimeout(500);
      return true;
    }
    return false;
  }

  async clickNewScheme() {
    await this.newSchemeBtn.click();
    await this.page.waitForTimeout(300);
  }

  async clickImportScheme() {
    await this.importSchemeBtn.click();
    await this.page.waitForTimeout(300);
  }

  async filterPreset() {
    await this.presetTab.click();
    await this.page.waitForTimeout(300);
  }

  async filterCommon() {
    await this.commonTab.click();
    await this.page.waitForTimeout(300);
  }

  async filterAll() {
    await this.allTab.click();
    await this.page.waitForTimeout(300);
  }
}

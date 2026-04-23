/**
 * 布局画布页面 Page Object
 * 调整布局模式 - 显示常用证件列表，支持拖拽排序、删除、新增证件
 */
export class LayoutCanvasPage {
  constructor(page) {
    this.page = page;
    this.documentGrid = page.locator('[class*="documentGrid"]');
    this.docItems = page.locator('[class*="docItem"]');
    this.backBtn = page.locator('button:has-text("返回")');
    this.saveBtn = page.locator('button:has-text("保存布局")');
    this.cancelBtn = page.locator('button:has-text("取消")');
    this.addDocBtn = page.locator('button:has-text("添加证件")');
    this.trashZone = page.locator('[class*="trashZone"]');
    this.saveMessage = page.locator('[class*="saveMessage"]');
  }

  async goto() {
    await this.page.goto('/layout');
    await this.page.waitForLoadState('networkidle');
  }

  async getDocumentCount() {
    await this.page.waitForSelector('[class*="docItem"]', { timeout: 5000 }).catch(() => null);
    return await this.docItems.count();
  }

  async clickBack() {
    await this.backBtn.click();
    await this.page.waitForURL('**/', { timeout: 5000 }).catch(() => null);
  }

  async saveLayout() {
    await this.saveBtn.click();
    await this.page.waitForTimeout(500);
  }

  async cancel() {
    await this.cancelBtn.click();
  }

  async openAddDocuments() {
    await this.addDocBtn.click();
    // 文件对话框会出现
  }

  async closeModal() {
    const closeBtn = this.page.locator('[class*="modal"] button:has-text("关闭"), [class*="modal"] button:has-text("×")').first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
    }
  }

  async deleteDocument(index = 0) {
    // Hover to show delete button
    await this.docItems.nth(index).hover();
    const deleteBtn = this.docItems.nth(index).locator('[class*="deleteBtn"]');
    if (await deleteBtn.isVisible()) {
      await deleteBtn.click();
    }
  }

  async isSaveMessageVisible() {
    return await this.saveMessage.isVisible().catch(() => false);
  }

  async getSaveMessageText() {
    return await this.saveMessage.textContent().catch(() => '');
  }
}

/**
 * 生成测试用空白 PDF 文件
 *
 * 使用方法:
 *   node generate-blank-pdfs.mjs
 */

import { PDFDocument } from 'pdf-lib';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateBlankPdfs() {
  // A4: 595x842 points (210x297mm at 72dpi)
  const a4Doc = await PDFDocument.create();
  a4Doc.addPage([595, 842]);
  const a4Bytes = await a4Doc.save();
  await fs.writeFile(path.join(__dirname, 'blank-a4.pdf'), a4Bytes);
  console.log('Generated blank-a4.pdf (595x842)');

  // Letter: 612x792 points (8.5x11 inches at 72dpi)
  const letterDoc = await PDFDocument.create();
  letterDoc.addPage([612, 792]);
  const letterBytes = await letterDoc.save();
  await fs.writeFile(path.join(__dirname, 'blank-letter.pdf'), letterBytes);
  console.log('Generated blank-letter.pdf (612x792)');

  // A3: 842x1191 points
  const a3Doc = await PDFDocument.create();
  a3Doc.addPage([842, 1191]);
  const a3Bytes = await a3Doc.save();
  await fs.writeFile(path.join(__dirname, 'blank-a3.pdf'), a3Bytes);
  console.log('Generated blank-a3.pdf (842x1191)');

  console.log('\nAll blank PDFs generated successfully!');
}

generateBlankPdfs().catch(console.error);

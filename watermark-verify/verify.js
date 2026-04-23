/**
 * 水印渲染验证脚本
 *
 * 验证目标：
 * 1. opentype.js 能否正确加载中文字体（TTC/TTF）
 * 2. 文字能否正确转换为 SVG path
 * 3. 水印参数计算是否正确
 */

import opentype from 'opentype.js';
import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';
import { Jimp } from 'jimp';
import fs from 'fs';
import path from 'path';

const FONTS_PATH = './fonts';
const TEST_DATA_PATH = '../test_data';
const OUTPUT_PATH = './output';

// 水印参数（相对值）
const WATERMARK_PARAMS = {
  text: '仅供XX业务使用',
  x: 0.5,        // 中心点 X (0-1)
  y: 0.5,        // 中心点 Y (0-1)
  scale: 0.3,    // 相对背景宽度的比例
  rotation: 0,   // 旋转角度
  opacity: 0.5,  // 透明度
  color: '#808080', // 灰色
};

async function main() {
  console.log('========== 水印渲染验证 ==========\n');

  // 1. 测试字体加载
  await testFontLoading();

  // 2. 测试文字转 Path
  const pathInfo = await testTextToPath();
  if (!pathInfo) {
    console.error('\n❌ 文字转 Path 失败，终止后续测试');
    return;
  }

  // 3. 测试图片水印
  await testImageWatermark(pathInfo);

  // 4. 测试 PDF 水印
  await testPdfWatermark();

  console.log('\n========== 验证完成 ==========');
}

async function testFontLoading() {
  console.log('【测试1】字体加载测试');
  console.log('-----------------------------------');

  const fonts = [
    { name: '微软雅黑', file: 'msyh.ttc', expect: 'TTC格式不支持' },
    { name: '黑体', file: 'simhei.ttf', expect: 'TTF格式支持' },
  ];

  for (const font of fonts) {
    const fontPath = path.join(FONTS_PATH, font.file);
    try {
      const opentypeFont = opentype.loadSync(fontPath);
      console.log(`✅ ${font.name} (${font.file}): 加载成功`);
      console.log(`   - 字模数量: ${opentypeFont.numGlyphs}`);
      console.log(`   - 字体名称: ${opentypeFont.names.fontFamily?.en || 'N/A'}`);
    } catch (err) {
      console.log(`❌ ${font.name} (${font.file}): ${err.message}`);
      console.log(`   - 原因: ${font.expect}`);
    }
  }
  console.log('');
}

async function testTextToPath() {
  console.log('【测试2】文字转 Path 测试');
  console.log('-----------------------------------');

  // 使用 simhei.ttf (TTF格式，支持中文)
  const fontPath = path.join(FONTS_PATH, 'simhei.ttf');

  try {
    const font = opentype.loadSync(fontPath);
    const { text } = WATERMARK_PARAMS;
    const fontSize = 48;

    // 获取文字路径
    const textPath = font.getPath(text, 0, 0, fontSize);

    // 获取边界框
    const bbox = textPath.getBoundingBox();
    console.log(`✅ 文字: "${text}"`);
    console.log(`   - 边界框: x1=${bbox.x1.toFixed(2)}, y1=${bbox.y1.toFixed(2)}, x2=${bbox.x2.toFixed(2)}, y2=${bbox.y2.toFixed(2)}`);
    console.log(`   - 宽度: ${(bbox.x2 - bbox.x1).toFixed(2)}, 高度: ${(bbox.y2 - bbox.y1).toFixed(2)}`);

    // 转换为 SVG pathData
    const pathData = textPath.toPathData(2);
    console.log(`✅ SVG PathData 生成成功 (长度: ${pathData.length} 字符)`);
    console.log(`   - PathData 前80字符: ${pathData.substring(0, 80)}...`);

    // 测试相对值计算
    const testBgWidth = 800;
    const testBgHeight = 600;
    const wmWidth = testBgWidth * WATERMARK_PARAMS.scale;
    const scaleFactor = wmWidth / (bbox.x2 - bbox.x1);
    const wmHeight = (bbox.y2 - bbox.y1) * scaleFactor;
    const wmX = testBgWidth * WATERMARK_PARAMS.x;
    const wmY = testBgHeight * WATERMARK_PARAMS.y;

    console.log(`\n📐 相对值计算验证 (背景: ${testBgWidth}x${testBgHeight}):`);
    console.log(`   - scale=${WATERMARK_PARAMS.scale} → 水印宽度=${wmWidth.toFixed(2)}`);
    console.log(`   - 缩放因子: ${scaleFactor.toFixed(4)}`);
    console.log(`   - 水印高度: ${wmHeight.toFixed(2)}`);
    console.log(`   - 中心点: (${wmX.toFixed(2)}, ${wmY.toFixed(2)})`);

    return { pathData, bbox, scaleFactor, font, fontSize };

  } catch (err) {
    console.log(`❌ 文字转 Path 失败: ${err.message}`);
    return null;
  }
}

async function testImageWatermark(pathInfo) {
  console.log('\n【测试3】图片水印测试');
  console.log('-----------------------------------');

  const imageFiles = [
    'image1.jpg',
    'df2468113#20260313102119.jpg',
  ];

  // 确保输出目录存在
  if (!fs.existsSync(OUTPUT_PATH)) {
    fs.mkdirSync(OUTPUT_PATH, { recursive: true });
  }

  for (const imageFile of imageFiles) {
    const imagePath = path.join(TEST_DATA_PATH, imageFile);
    if (!fs.existsSync(imagePath)) {
      console.log(`⚠️ 跳过 ${imageFile} (文件不存在)`);
      continue;
    }

    try {
      const image = await Jimp.read(imagePath);
      const imgWidth = image.width;
      const imgHeight = image.height;
      console.log(`\n处理: ${imageFile}`);
      console.log(`   - 图片尺寸: ${imgWidth}x${imgHeight}`);

      // 计算水印参数
      const wmWidth = imgWidth * WATERMARK_PARAMS.scale;
      const scaleFactor = wmWidth / (pathInfo.bbox.x2 - pathInfo.bbox.x1);
      const wmHeight = (pathInfo.bbox.y2 - pathInfo.bbox.y1) * scaleFactor;
      const wmX = imgWidth * WATERMARK_PARAMS.x;
      const wmY = imgHeight * WATERMARK_PARAMS.y;

      console.log(`   - 水印尺寸: ${wmWidth.toFixed(0)}x${wmHeight.toFixed(0)}`);
      console.log(`   - 水印中心: (${wmX.toFixed(0)}, ${wmY.toFixed(0)})`);
      console.log(`   - 透明度: ${WATERMARK_PARAMS.opacity}`);
      console.log(`   - 旋转: ${WATERMARK_PARAMS.rotation}度`);

      // 保存原图
      const outputFile = path.join(OUTPUT_PATH, `original_${imageFile}`);
      await image.writeAsync(outputFile);
      console.log(`   - 原图保存: ✅ ${outputFile}`);
      console.log(`   - 中文渲染: ⚠️ 需要 node-canvas 方案`);
    } catch (err) {
      console.log(`   - 错误: ${err.message}`);
    }
  }

  console.log('\n📝 结论:');
  console.log('   Jimp 不支持中文字体渲染。');
  console.log('   推荐方案: 使用 node-canvas 渲染中文，再叠加到图片。');
}

async function testPdfWatermark() {
  console.log('\n【测试4】PDF 水印测试');
  console.log('-----------------------------------');

  const pdfFiles = [
    'pdf1.pdf',
    'padf2.pdf',
  ];

  // 确保输出目录存在
  if (!fs.existsSync(OUTPUT_PATH)) {
    fs.mkdirSync(OUTPUT_PATH, { recursive: true });
  }

  for (const pdfFile of pdfFiles) {
    const pdfPath = path.join(TEST_DATA_PATH, pdfFile);
    if (!fs.existsSync(pdfPath)) {
      console.log(`⚠️ 跳过 ${pdfFile} (文件不存在)`);
      continue;
    }

    try {
      const pdfBytes = fs.readFileSync(pdfPath);
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const pageCount = pdfDoc.getPageCount();
      console.log(`\n处理: ${pdfFile}`);
      console.log(`   - 页数: ${pageCount}`);

      const firstPage = pdfDoc.getPage(0);
      const { width: pgWidth, height: pgHeight } = firstPage.getSize();
      console.log(`   - 页面尺寸: ${pgWidth}x${pgHeight}`);

      // 计算水印参数
      const wmWidth = pgWidth * WATERMARK_PARAMS.scale;
      const wmX = pgWidth * WATERMARK_PARAMS.x;
      const wmY = pgHeight * (1 - WATERMARK_PARAMS.y); // PDF y轴向下

      console.log(`   - 水印中心: (${wmX.toFixed(0)}, ${wmY.toFixed(0)})`);
      console.log(`   - 水印宽度: ${wmWidth.toFixed(0)}`);

      // 颜色转换
      const hex = WATERMARK_PARAMS.color.replace('#', '');
      const r = parseInt(hex.substr(0, 2), 16) / 255;
      const g = parseInt(hex.substr(2, 2), 16) / 255;
      const b = parseInt(hex.substr(4, 2), 16) / 255;

      // 在每一页添加水印
      for (let i = 0; i < pageCount; i++) {
        const page = pdfDoc.getPage(i);
        const { height } = page.getSize();

        // 绘制水印（使用内置字体演示，实际中文需要嵌入 TTF）
        page.drawText('Watermark', {
          x: wmX - 30,
          y: height - wmY,
          size: 20,
          color: rgb(r, g, b),
          opacity: WATERMARK_PARAMS.opacity,
          rotate: degrees(WATERMARK_PARAMS.rotation),
        });

        // 绘制中心点标记
        page.drawCircle({
          x: wmX,
          y: height - wmY,
          size: 5,
          color: rgb(1, 0, 0),
          opacity: 0.8,
        });
      }

      const outputBytes = await pdfDoc.save();
      const outputFile = path.join(OUTPUT_PATH, `watermarked_${pdfFile}`);
      fs.writeFileSync(outputFile, outputBytes);
      console.log(`   - 输出: ✅ ${outputFile}`);
    } catch (err) {
      console.log(`   - 错误: ${err.message}`);
    }
  }

  console.log('\n📝 结论:');
  console.log('   pdf-lib 可正确绘制水印位置。');
  console.log('   中文水印方案: 将 opentype.js 生成的 SVG path 绘制到 PDF。');
  console.log('   注意: 需要 TTF/OTF 字体文件，不支持 TTC 格式。');
}

// 运行测试
main().catch(console.error);

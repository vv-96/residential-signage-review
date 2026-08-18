import sharp from "sharp";
import fs from "node:fs";

const pdf = "E:/ObsidianWarehouse/住宅标识/住宅标识/5.测试/案例/14亩观萃大区标识方案.pdf";
try {
  const input = fs.readFileSync(pdf);
  const img = await sharp(input, { density: 150, page: 0 })
    .jpeg({ quality: 80 })
    .toBuffer({ resolveWithObject: true });
  console.log("PDF page 1 rendered OK:", img.info.width, "x", img.info.height, img.info.format, img.data.length, "bytes");
  fs.writeFileSync("test-page1.jpg", img.data);
} catch (e) {
  console.error("FAILED:", e.message);
}

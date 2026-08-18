import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { createCanvas } from "@napi-rs/canvas";
import fs from "node:fs";

const pdfPath = "E:/ObsidianWarehouse/住宅标识/住宅标识/5.测试/案例/14亩观萃大区标识方案.pdf";
const data = new Uint8Array(fs.readFileSync(pdfPath));

const doc = await getDocument({ data }).promise;
console.log("页数:", doc.numPages);

const page = await doc.getPage(1);
const viewport = page.getViewport({ scale: 1.5 });
const canvas = createCanvas(Math.floor(viewport.width), Math.floor(viewport.height));
const ctx = canvas.getContext("2d");
await page.render({ canvasContext: ctx, viewport }).promise;
const buf = canvas.toBuffer("image/jpeg", { quality: 0.8 });
console.log("第1页渲染:", buf.length, "bytes,", canvas.width, "x", canvas.height);
fs.writeFileSync("test-render-p1.jpg", buf);
await doc.destroy();

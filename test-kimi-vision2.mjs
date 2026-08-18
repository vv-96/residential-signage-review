import fs from "node:fs";

const apiKey = "sk-jCJmdTKARmC3xYnPFvw7XEVfSTj2hC3wBXY0m35qJOEoeXDH";
const base64 = fs.readFileSync("test-render-p1.jpg").toString("base64");

const body = {
  model: "kimi-k2.6",
  messages: [
    { role: "user", content: [
      { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64}` } },
      { type: "text", text: "这是住宅标识设计方案图纸的第1页。请简要描述这一页包含哪些内容（文字标题、图纸类型、出现的标识类型）。用中文回答，50字以内。" },
    ] },
  ],
  max_tokens: 300,
};

const res = await fetch("https://api.moonshot.cn/v1/chat/completions", {
  method: "POST",
  headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
  body: JSON.stringify(body),
});
const data = await res.json();
const msg = data.choices?.[0]?.message;
console.log("HTTP:", res.status);
console.log("message keys:", msg ? Object.keys(msg) : "none");
console.log("content:", JSON.stringify(msg?.content)?.slice(0, 300));
console.log("reasoning:", JSON.stringify(msg?.reasoning_content)?.slice(0, 300));
console.log("usage:", JSON.stringify(data.usage));

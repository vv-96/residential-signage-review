import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request("http://localhost/", { headers: { accept: "text/html" } }), {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  }, { waitUntil() {}, passThroughOnException() {} });
}

test("server-renders the paged residential signage audit home", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /住宅标识智能审核/);
  assert.match(html, /从一份 PDF 开始审核/);
  assert.match(html, /新建审核项目/);
  assert.match(html, /v1\.0-rc2/);
  assert.doesNotMatch(html, /选择审核步骤/);
  assert.doesNotMatch(html, /Your site is taking shape|Building your site/);
});

import assert from "node:assert/strict"
import test from "node:test"
import { fileURLToPath } from "node:url"

import { DOMParser } from "linkedom"
import { createServer } from "vite"

const worker = "https://images.example.workers.dev"
const image = "https://bunshun.ismcdn.jp/mwimgs/d/c/1500wm/photo.jpg"

class HtmlDOMParser extends DOMParser {
  parseFromString(source, type) {
    return super.parseFromString(`<html><body>${source}</body></html>`, type)
  }
}
globalThis.DOMParser = HtmlDOMParser

test("prepared entries share Worker URLs across content, covers and attachments, including full-text replacement", async (context) => {
  const root = fileURLToPath(new URL("../../", import.meta.url))
  const server = await createServer({
    configFile: false,
    root,
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true },
    resolve: { alias: { "@": `${root}src` } },
    define: { "import.meta.env.VITE_BUNSHUN_IMAGE_WORKER_URL": JSON.stringify(worker) },
  })
  context.after(() => server.close())
  const { default: prepareEntry } = await server.ssrLoadModule("/src/utils/entry-presentation.js")
  const original = {
    id: 42,
    starred: true,
    status: "read",
    content: `<h2>Summary</h2><img src="${image}">`,
    enclosures: [{ url: image, mime_type: "image/jpeg" }],
  }
  const prepared = prepareEntry(original)
  const expected = new URL("/image", worker)
  expected.searchParams.set("url", image)
  assert.equal(prepared.coverSource, expected.href)
  assert.equal(prepared.attachments.images[0].url, expected.href)
  assert.equal(prepared.enclosures[0].url, expected.href)
  assert.ok(prepared.content.includes(expected.href))
  assert.equal(original.content.includes(worker), false)
  const full = prepareEntry({ ...prepared, content: `<h2>Page 2</h2><img src="${image}">` })
  assert.equal(full.coverSource, expected.href)
  assert.deepEqual(full.headings, [{ id: "heading-0", level: 2, text: "Page 2" }])
  assert.equal(full.starred, true)
  assert.equal(full.status, "read")
  assert.equal(prepareEntry(full).content, full.content)

  const placeholder = "data:image/gif;base64,R0lGODlhAQABAGAAACH5BAEKAP8ALAAAAAABAAEAAAgEAP8FBAA7"
  const enclosureUrl = "https://shuon.ismcdn.jp/mwimgs/photo.jpg"
  const enclosure = { url: enclosureUrl, mime_type: "image/jpeg" }
  const transparent = prepareEntry({
    content: `<img src="${placeholder}" width="800" height="500">`,
    enclosures: [enclosure],
  })
  assert.equal(transparent.coverSource, enclosureUrl)
  assert.equal(transparent.coverWidth, null)
  assert.equal(transparent.coverHeight, null)
  const normal = prepareEntry({
    content: '<img src="https://example.com/body.jpg" width="640" height="480">',
    enclosures: [enclosure],
  })
  assert.equal(normal.coverSource, "https://example.com/body.jpg")
  assert.equal(normal.coverWidth, 640)
  assert.equal(normal.coverHeight, 480)
  assert.equal(prepareEntry({ content: "<p>No image</p>" }).coverSource, null)
  assert.equal(prepareEntry({ content: `<img src="${placeholder}">` }).coverSource, null)
})

import assert from "node:assert/strict"
import test from "node:test"

import { extractBunshunPage } from "../../workers/bunshun-articles/src/extract.js"
import { collectBunshunArticle } from "../../workers/bunshun-articles/src/handler.js"

const base = "https://bunshun.jp/articles/-/93257"
const gallery = "/articles/photo/93257"
const nav = (page, count, photo = gallery) =>
  `<div class="block pagination black article"><div class="page-num">${Array.from(
    { length: count },
    (_, i) => i + 1,
  )
    .map((n) =>
      n === page
        ? `<a class="active menu-link" href="#">${n}</a>`
        : `<a href="${base}?page=${n}">${n}</a>`,
    )
    .join("")}
  <a class="menu-link" href="${photo}">${count + 1}</a>
  ${page === count ? `<a class="next menu-link" href="${photo}">次へ</a>` : `<a class="next" href="${base}?page=${page + 1}">次へ</a>`}</div></div>`
const fixture = (page = 1, count = 1, photo = gallery) =>
  `<html><head><link rel="canonical" href="${base}"></head><body><div class="article-body"><p>Public article page ${page} with enough meaningful text to validate complete extraction.</p><img src="https://bunshun.ismcdn.jp/mwimgs/a/photo.jpg"><a href="${gallery}?pn=4">写真ページはこちら</a></div>${nav(page, count, photo)}</body></html>`

test("93257-style numbered photo navigation preserves the full single-page body", async () => {
  const result = extractBunshunPage(fixture(), base)
  assert.deepEqual(result.pages, [1])
  assert.ok(result.content.includes("meaningful text"))
  assert.ok(result.content.includes("photo.jpg"))
  assert.ok(result.content.includes(`${gallery}?pn=4`))
  const calls = []
  const article = await collectBunshunArticle(base, {
    fetchPage: async (url) => {
      calls.push(url)
      return new Response(fixture(), { headers: { "Content-Type": "text/html" } })
    },
  })
  assert.equal(article.complete, true)
  assert.equal(article.pageCount, 1)
  assert.deepEqual(calls, [base])
})

test("multi-page articles ending in a photo gallery still fetch every body page only", async () => {
  const calls = []
  const article = await collectBunshunArticle(base, {
    fetchPage: async (url) => {
      calls.push(url)
      const page = Number(new URL(url).searchParams.get("page") || 1)
      return new Response(fixture(page, 3), { headers: { "Content-Type": "text/html" } })
    },
  })
  assert.equal(article.pageCount, 3)
  assert.deepEqual(calls, [base, `${base}?page=2`, `${base}?page=3`])
})

test("foreign, ambiguous and misplaced gallery links still fail instead of skipping pages", () => {
  for (const photo of [
    "/articles/photo/93258",
    "https://other.example/articles/photo/93257",
    "https://user:pass@bunshun.jp/articles/photo/93257",
    "//bunshun.jp/articles/photo/93257",
    `${gallery}?redirect=1`,
    `${gallery}#x`,
  ]) {
    assert.throws(() => extractBunshunPage(fixture(1, 1, photo), base))
  }
  assert.throws(() => extractBunshunPage(fixture().replace(">2</a>", ">3</a>"), base))
  assert.throws(() =>
    extractBunshunPage(fixture().replace('class="menu-link"', 'class="active menu-link"'), base),
  )
  assert.throws(() =>
    extractBunshunPage(fixture(1, 2).replace(`${base}?page=2">次へ`, `${gallery}">次へ`), base),
  )
})

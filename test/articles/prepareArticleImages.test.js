import assert from "node:assert/strict"
import test from "node:test"

import { DOMParser } from "linkedom"

import { prepareArticleImages } from "../../src/utils/prepare-article-images.js"

globalThis.DOMParser = DOMParser

const worker = "https://images.example.workers.dev"
const image = "https://bunshun.ismcdn.jp/mwimgs/d/c/1500wm/photo.jpg"

test("rewrites the image used by body, thumbnail and gallery without responsive bypass", () => {
  const html = `<html><body><picture><source srcset="${image} 2x"><img src="${image}" srcset="${image} 1x" alt="caption"></picture><p>本文</p></body></html>`
  const output = prepareArticleImages(html, worker)
  const document = new DOMParser().parseFromString(output, "text/html")
  const target = document.querySelector("img")
  assert.equal(new URL(target.getAttribute("src")).origin, worker)
  assert.equal(new URL(target.getAttribute("src")).searchParams.get("url"), image)
  assert.equal(target.getAttribute("alt"), "caption")
  assert.equal(target.hasAttribute("srcset"), false)
  assert.equal(document.querySelector("source").hasAttribute("srcset"), false)
  assert.equal(document.querySelector("p").textContent, "本文")
  assert.equal(prepareArticleImages(output, worker), output)
})

test("non-Bunshun content and an unset Worker preserve the exact HTML", () => {
  const html =
    '<p>Article</p><img src="https://other.example/a.jpg" srcset="https://other.example/b.jpg 2x">'
  assert.equal(prepareArticleImages(html, worker), html)
  assert.equal(prepareArticleImages(`<img src="${image}">`, ""), `<img src="${image}">`)
})

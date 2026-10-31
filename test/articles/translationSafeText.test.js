import assert from "node:assert/strict"
import test from "node:test"

import parse from "html-react-parser"
import { parseHTML } from "linkedom"
import { act, createElement } from "react"
import { createRoot } from "react-dom/client"
import { renderToStaticMarkup } from "react-dom/server"

import translationSafeText from "../../src/utils/translation-safe-text.js"

test("translated text remains a valid insertion anchor when React adds a sibling", async () => {
  const previousAct = globalThis.IS_REACT_ACT_ENVIRONMENT
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  const previousWindow = globalThis.window
  const previousDocument = globalThis.document
  const { window } = parseHTML("<html><body></body></html>")
  globalThis.window = window
  globalThis.document = window.document
  const { prototype } = window.Element
  const { insertBefore } = prototype
  // Linkedom accepts detached reference nodes; enforce the browser's DOM rule.

  prototype.insertBefore = function (node, reference) {
    // eslint-disable-next-line unicorn/no-this-outside-of-class
    if (reference && [1, 3].includes(reference.nodeType) && reference.parentNode !== this) {
      throw new DOMException("Reference node is not a child", "NotFoundError")
    }
    // eslint-disable-next-line unicorn/no-this-outside-of-class
    return insertBefore.call(this, node, reference)
  }
  try {
    for (const protectedText of [false, true]) {
      const host = document.createElement("div")
      document.body.append(host)
      const errors = []
      const root = createRoot(host, { onUncaughtError: (error) => errors.push(error) })
      try {
        const content = parse(
          'Article text <a href="#">link</a> tail',
          protectedText ? { transform: translationSafeText } : {},
        )
        const render = (showHint) =>
          createElement("p", null, showHint && createElement("b", { key: "hint" }, "New"), content)
        await act(() => root.render(render(false)))
        const parent = protectedText ? host.querySelector("p > span") : host.querySelector("p")
        const translated = document.createElement("font")
        translated.textContent = "翻訳された本文"
        parent.firstChild.replaceWith(translated)
        if (protectedText) {
          await act(() => root.render(render(true)))
          assert.equal(errors.length, 0)
          assert.equal(host.querySelector("b").textContent, "New")
          assert.ok(host.textContent.includes("翻訳された本文"))
        } else {
          await assert.rejects(async () => await act(() => root.render(render(true))), {
            name: "NotFoundError",
          })
        }
      } finally {
        await act(() => root.unmount())
      }
    }
  } finally {
    prototype.insertBefore = insertBefore
    globalThis.IS_REACT_ACT_ENVIRONMENT = previousAct
    globalThis.window = previousWindow
    globalThis.document = previousDocument
  }
})

test("inline article prose stays translatable and preserves links and whitespace", () => {
  const html = '<p>First <a href="https://example.com">link</a> last.</p>'
  const rendered = renderToStaticMarkup(parse(html, { transform: translationSafeText }))
  assert.equal(
    rendered,
    '<p><span>First </span><a href="https://example.com"><span>link</span></a><span> last.</span></p>',
  )
})

test("literal code, SVG, MathML and table whitespace do not gain invalid span children", () => {
  for (const html of [
    "<pre><code>x &lt; 2</code></pre>",
    "<svg><text>label</text></svg>",
    "<math><mi>x</mi></math>",
    "<select><option>option</option></select>",
  ]) {
    assert.equal(
      renderToStaticMarkup(parse(html, { transform: translationSafeText })),
      renderToStaticMarkup(parse(html)),
    )
  }
  assert.equal(translationSafeText("\n ", { type: "text" }, 0), "\n ")
})

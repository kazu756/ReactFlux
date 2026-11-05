import { persistentAtom } from "@nanostores/persistent"

export const defaultSummarySettings = {
  apiKey: "",
  model: "gpt-4o-mini",
  prompt: "記事の主要な論点と結論を、簡潔でわかりやすい日本語で要約してください。",
}

// Store credentials separately from the settings backup.
export const summarySettings = persistentAtom("openai-summary", defaultSummarySettings, {
  encode: JSON.stringify,
  decode: (value) => ({ ...defaultSummarySettings, ...JSON.parse(value) }),
})

export async function summarizeArticle(article, settings, signal, onText) {
  const document = new DOMParser().parseFromString(article.content || "", "text/html")
  for (const element of document.querySelectorAll("script, style, template, noscript")) {
    element.remove()
  }
  const body = document.body.textContent.replaceAll(/\s+/g, " ").trim()
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    credentials: "omit",
    redirect: "error",
    signal,
    headers: {
      Authorization: `Bearer ${settings.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: settings.model,
      stream: true,
      max_completion_tokens: 2000,
      messages: [
        { role: "system", content: settings.prompt },
        { role: "user", content: `${article.title || ""}\n\n${body.slice(0, 16_000)}` },
      ],
    }),
  })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }
  if (!response.body) {
    throw new Error("Empty response")
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
  let pending = ""
  let summary = ""
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }
      pending += value
      const lines = pending.split("\n")
      pending = lines.pop()
      for (const line of lines) {
        if (!line.startsWith("data:")) {
          continue
        }
        const payload = line.slice(5).trim()
        if (payload === "[DONE]") {
          if (!summary.trim()) {
            throw new Error("Empty summary")
          }
          return
        }
        const event = JSON.parse(payload)
        if (event.error) {
          throw new Error("Stream error")
        }
        const delta = event.choices?.[0]?.delta?.content
        if (typeof delta === "string" && delta) {
          summary += delta
          onText(summary)
        }
      }
    }
    throw new Error("Incomplete response")
  } finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}

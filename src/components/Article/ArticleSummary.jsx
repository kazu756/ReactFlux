import { Button } from "@arco-design/web-react"
import { useStore } from "@nanostores/react"
import { useEffect, useRef, useState } from "react"

import { polyglotState } from "@/hooks/useLanguage"
import { summarizeArticle, summarySettings } from "@/utils/openai-summary"

const ArticleSummary = ({ article }) => {
  const settings = useStore(summarySettings)
  const { polyglot } = useStore(polyglotState)
  const request = useRef(null)
  const [summary, setSummary] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => () => request.current?.abort(), [])

  if (!settings.apiKey) {
    return null
  }

  const generate = async () => {
    if (request.current) {
      return
    }
    const controller = new AbortController()
    request.current = controller
    setLoading(true)
    setSummary("")
    setError("")
    try {
      await summarizeArticle(article, settings, controller.signal, setSummary)
    } catch (error_) {
      if (!controller.signal.aborted) {
        setError(
          error_.message.startsWith("HTTP ")
            ? error_.message
            : polyglot.t("ai.failed", { _: "Could not generate a summary." }),
        )
      }
    } finally {
      request.current = null
      if (!controller.signal.aborted) {
        setLoading(false)
      }
    }
  }

  return (
    <section aria-busy={loading} className="article-ai-summary">
      <Button loading={loading} onClick={generate}>
        <span>{polyglot.t("ai.summarize", { _: "Summarize with AI" })}</span>
      </Button>
      {error && (
        <p role="alert">
          <span>{error}</span>
        </p>
      )}
      {summary && (
        <p style={{ whiteSpace: "pre-wrap" }}>
          <span>{summary}</span>
        </p>
      )}
    </section>
  )
}

export default ArticleSummary

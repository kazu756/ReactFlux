import { Button } from "@arco-design/web-react"
import { IconRobot } from "@arco-design/web-react/icon"
import { useStore } from "@nanostores/react"
import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"

import CustomTooltip from "@/components/ui/CustomTooltip"
import { polyglotState } from "@/hooks/useLanguage"
import { summarizeArticle, summarySettings } from "@/utils/openai-summary"

const ArticleSummary = ({ article, buttonTarget }) => {
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

  const label = polyglot.t("ai.summarize", { _: "Summarize with AI" })

  return (
    <>
      {buttonTarget &&
        createPortal(
          <CustomTooltip mini content={label}>
            <Button
              aria-label={label}
              icon={<IconRobot aria-hidden="true" />}
              loading={loading}
              shape="circle"
              onClick={generate}
            />
          </CustomTooltip>,
          buttonTarget,
        )}
      {(error || summary) && (
        <section aria-busy={loading} className="article-ai-summary">
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
      )}
    </>
  )
}

export default ArticleSummary

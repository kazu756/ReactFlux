import { getArticleImageSource } from "../domain/articles/articleImageSource.js"

// Normalize before creating thumbnails, parser nodes and lightbox slides so every
// view uses the same URL. Other publishers and an unset Worker stay unchanged.
export function prepareArticleImages(content, workerBase, serverUrl) {
  if (!workerBase || !content) {
    return content
  }
  const document = new DOMParser().parseFromString(content, "text/html")
  let changed = false
  for (const image of document.querySelectorAll("img")) {
    const source = image.getAttribute("src")
    const mapped = getArticleImageSource(source, workerBase, serverUrl)
    if (mapped === source) {
      continue
    }
    image.setAttribute("src", mapped)
    // Native responsive selection must not bypass the image Worker.
    image.removeAttribute("srcset")
    for (const candidate of image.closest("picture")?.querySelectorAll("source") ?? []) {
      candidate.removeAttribute("srcset")
    }
    changed = true
  }
  return changed ? document.body.innerHTML : content
}

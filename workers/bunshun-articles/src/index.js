import { handleArticleRequest } from "./handler.js"
const worker = {
  fetch(request, env, ctx) {
    return handleArticleRequest(request, env, {
      cache: caches.default,
      waitUntil: (task) => ctx.waitUntil(task),
    })
  },
}

export default worker

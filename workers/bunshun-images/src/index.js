import { handleImageRequest } from "./handler.js"

const worker = {
  fetch(request, env, ctx) {
    return handleImageRequest(request, {
      cache: caches.default,
      waitUntil: (task) => ctx.waitUntil(task),
    })
  },
}

export default worker

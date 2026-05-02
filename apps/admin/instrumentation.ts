export async function register() {
  // server-side init reserved for future server analytics
}

export const onRequestError = async (
  err: unknown,
  request: {
    path: string
    method: string
    headers: { [key: string]: string }
  },
  context: {
    routerKind: 'Pages Router' | 'App Router'
    routePath: string
    routeType: 'render' | 'route' | 'action' | 'middleware'
    renderSource?: 'react-server-components' | 'react-server-components-payload' | 'server-rendering'
    revalidateReason?: 'on-demand' | 'stale' | undefined
    renderType?: 'dynamic' | 'dynamic-resume'
  }
) => {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  if (!key) return
  const { PostHog } = await import('posthog-node')
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com'
  const client = new PostHog(key, { host, flushAt: 1, flushInterval: 0 })
  await client.captureException(err, undefined, {
    path: request.path,
    method: request.method,
    router_kind: context.routerKind,
    route_path: context.routePath,
    route_type: context.routeType,
  })
  await client.shutdown()
}

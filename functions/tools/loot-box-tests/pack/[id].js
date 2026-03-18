export async function onRequest(context) {
  const url = new URL(context.request.url);
  url.pathname = '/tools/loot-box-tests/pack';
  return context.env.ASSETS.fetch(new Request(url.toString(), context.request));
}

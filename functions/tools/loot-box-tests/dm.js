export async function onRequest(context) {
  const url = new URL(context.request.url);
  url.pathname = '/tools/loot-box-tests/dm.html';
  return context.env.ASSETS.fetch(new Request(url.toString(), context.request));
}

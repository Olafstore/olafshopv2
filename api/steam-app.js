function firstImageFromHtml(value = "") {
  const match = String(value || "").match(/<img[^>]+src=["']([^"']+)["']/i);
  return match ? match[1].replace(/&amp;/g, "&") : "";
}

export default async function handler(request, response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (request.method === "OPTIONS") return response.status(204).end();

  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "METHOD_NOT_ALLOWED" });
  }

  const appId = String(request.query?.appid || "").trim();
  if (!/^\d{1,12}$/.test(appId)) {
    return response.status(400).json({ error: "INVALID_APP_ID" });
  }

  try {
    const steamResponse = await fetch(
      `https://store.steampowered.com/api/appdetails?appids=${encodeURIComponent(appId)}&l=english&cc=us`,
      {
        headers: {
          accept: "application/json",
          "user-agent": "OLAF-SHOP/1.0"
        }
      }
    );

    if (!steamResponse.ok) {
      return response.status(502).json({ error: "STEAM_UPSTREAM_ERROR" });
    }

    const payload = await steamResponse.json();
    const item = payload?.[appId];
    if (!item?.success || !item.data) {
      return response.status(404).json({ error: "STEAM_APP_NOT_FOUND" });
    }

    const data = item.data;
    const fallbackImage = firstImageFromHtml(data.detailed_description) || firstImageFromHtml(data.about_the_game);
    response.setHeader("Cache-Control", "public, s-maxage=21600, stale-while-revalidate=86400");
    return response.status(200).json({
      appId: Number(appId),
      name: data.name || `Steam App ${appId}`,
      type: data.type || "",
      headerImage: data.header_image || fallbackImage || `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/header.jpg`,
      capsuleImage: data.capsule_image || "",
      capsuleImageV5: data.capsule_imagev5 || "",
      shortDescription: data.short_description || "",
      developers: Array.isArray(data.developers) ? data.developers : [],
      publishers: Array.isArray(data.publishers) ? data.publishers : [],
      steamUrl: `https://store.steampowered.com/app/${appId}/`
    });
  } catch (error) {
    return response.status(500).json({
      error: "STEAM_METADATA_FAILED",
      message: String(error?.message || error)
    });
  }
}

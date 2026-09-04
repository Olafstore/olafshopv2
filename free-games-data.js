/*
 * Curated fallback data for the Free Game Radar.
 * The page also refreshes active Epic promotions directly from Epic's public
 * catalogue feed when it is available. Keep platform links official only.
 */
window.OlafFreeGamesData = {
  updatedAt: "2026-09-05T10:00:00+07:00",
  offers: [
    {
      id: "steam-civilization-vii-free-access-sep-2026",
      title: "Sid Meier's Civilization VII",
      platform: "steam",
      platformLabel: "Steam",
      type: "free-access",
      typeLabel: "ทดลองเล่นฟรี",
      startsAt: "2026-09-03T17:00:00Z",
      endsAt: "2026-09-10T17:00:00Z",
      url: "https://store.steampowered.com/app/1295660/Sid_Meiers_Civilization_VII/",
      sourceUrl: "https://store.steampowered.com/news/posts/?enddate=1788456257&feed=steam_community_announcements",
      image: "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1295660/header.jpg",
      summary: "เล่นได้ฟรีในช่วงกิจกรรมเท่านั้น เมื่อหมดเวลาอาจต้องซื้อเกมเพื่อเล่นต่อ"
    }
  ],
  platforms: [
    {
      id: "steam",
      name: "Steam",
      description: "ติดตาม Free to Keep, Free Weekend และข่าวจาก Steam โดยตรง",
      url: "https://store.steampowered.com/news/",
      icon: "gamepad-2"
    },
    {
      id: "epic",
      name: "Epic Games",
      description: "เกมฟรีรายสัปดาห์ — หน้าเว็บจะตรวจข้อเสนอที่กำลังรับได้จาก Epic",
      url: "https://store.epicgames.com/free-games",
      icon: "gift"
    },
    {
      id: "ea",
      name: "EA",
      description: "เกมเล่นฟรีและกิจกรรมทดลองเล่นจากคลังเกมทางการของ EA",
      url: "https://www.ea.com/games/library/freetoplay",
      icon: "radio"
    },
    {
      id: "ubisoft",
      name: "Ubisoft",
      description: "เกมเล่นฟรี ช่วงทดลองเล่น และสิทธิ์แจกจาก Ubisoft โดยตรง",
      url: "https://www.ubisoft.com/games/free",
      icon: "shield-check"
    }
  ]
};

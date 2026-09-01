(function () {
  const MINECRAFT_HERO =
    "https://www.minecraft.net/content/dam/minecraftnet/games/minecraft/key-art/Hero-Image_Vanilla_Deluxe_1200x675.jpg";
  const ROCKSTAR_HERO =
    "https://cdn.cloudflare.steamstatic.com/steam/apps/271590/header.jpg";
  const GTA_V_HERO =
    "https://cdn.cloudflare.steamstatic.com/steam/apps/271590/header.jpg";
  const WINDOWS_IMAGE =
    "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/windows11/windows11-original.svg";
  const WINDOWS_PREORDER_FEATURES = [
    { icon: "credit-card", title: "ชำระเงินในเว็บ", text: "ใช้ระบบออเดอร์และสลิปของร้าน" },
    { icon: "message-circle-more", title: "แอดมินจัดส่ง", text: "ส่งคีย์หลังตรวจสอบสลิป" },
    { icon: "key-round", title: "License Key", text: "คีย์ตามรุ่น Windows ที่เลือก" },
    { icon: "headset", title: "ช่วยแนะนำ", text: "สอบถามขั้นตอนเปิดใช้งานได้" }
  ];
  const WINDOWS_PREORDER_DETAILS = [
    {
      title: "รูปแบบการจัดส่ง",
      body:
        "สินค้า Windows 10 & 11 Keys เป็นแบบพรีออเดอร์ ลูกค้าชำระเงินผ่านระบบเว็บและแอดมินจัดส่งคีย์หลังตรวจสอบสลิปเรียบร้อย"
    },
    {
      title: "ข้อควรทราบก่อนสั่งซื้อ",
      body:
        "กรุณาเลือกรุ่น Windows ให้ตรงกับเครื่องที่จะใช้งาน หากไม่แน่ใจว่าควรเลือก Home หรือ Pro สามารถติดต่อแอดมินก่อนสั่งซื้อได้"
    }
  ];

  const categories = [
    { id: "windows", label: "Key Windows" },
    { id: "minecraft", label: "Minecraft" },
    { id: "rockstar", label: "Rockstar" }
  ];

  const products = [
    {
      id: "windows-10-home",
      name: "Windows 10 Home",
      publisher: "Microsoft",
      category: "windows",
      label: "PRE-ORDER",
      price: 199,
      compareAt: 4385,
      stock: 99,
      sold: 0,
      rating: "",
      delivery: "ชำระเงินในเว็บและรับคีย์ผ่านแอดมินหลังตรวจสอบสลิป",
      warranty: "รับประกันคีย์ตามเงื่อนไขร้าน",
      image: WINDOWS_IMAGE,
      heroImage: WINDOWS_IMAGE,
      tags: ["พรีออเดอร์", "ชำระเงินในเว็บ", "License Key Code", "แอดมินจัดส่ง"],
      description: "คีย์สำหรับเปิดใช้งาน Windows 10 Home จำนวน 1 เครื่อง ชำระเงินผ่านระบบเว็บและแอดมินจัดส่งคีย์หลังตรวจสอบสลิป",
      gallery: [WINDOWS_IMAGE],
      platformLinks: [],
      featureBlocks: WINDOWS_PREORDER_FEATURES,
      detailSections: WINDOWS_PREORDER_DETAILS,
      steamRelatedLinks: [],
      systemRequirements: { minimum: ["Windows 10 Home"], recommended: [] },
      isActive: true,
      sortOrder: 8991
    },
    {
      id: "windows-10-pro",
      name: "Windows 10 Pro",
      publisher: "Microsoft",
      category: "windows",
      label: "PRE-ORDER",
      price: 199,
      compareAt: 4890,
      stock: 99,
      sold: 0,
      rating: "",
      delivery: "ชำระเงินในเว็บและรับคีย์ผ่านแอดมินหลังตรวจสอบสลิป",
      warranty: "รับประกันคีย์ตามเงื่อนไขร้าน",
      image: WINDOWS_IMAGE,
      heroImage: WINDOWS_IMAGE,
      tags: ["พรีออเดอร์", "ชำระเงินในเว็บ", "Retail Key", "เหมาะกับสายทำงาน"],
      description: "คีย์สำหรับเปิดใช้งาน Windows 10 Professional พร้อมฟีเจอร์สำหรับการทำงาน ชำระเงินผ่านระบบเว็บและรอแอดมินจัดส่ง",
      gallery: [WINDOWS_IMAGE],
      platformLinks: [],
      featureBlocks: WINDOWS_PREORDER_FEATURES,
      detailSections: WINDOWS_PREORDER_DETAILS,
      steamRelatedLinks: [],
      systemRequirements: { minimum: ["Windows 10 Pro"], recommended: [] },
      isActive: true,
      sortOrder: 8992
    },
    {
      id: "windows-11-home",
      name: "Windows 11 Home",
      publisher: "Microsoft",
      category: "windows",
      label: "PRE-ORDER",
      price: 199,
      compareAt: 4385,
      stock: 99,
      sold: 0,
      rating: "",
      delivery: "ชำระเงินในเว็บและรับคีย์ผ่านแอดมินหลังตรวจสอบสลิป",
      warranty: "รับประกันคีย์ตามเงื่อนไขร้าน",
      image: WINDOWS_IMAGE,
      heroImage: WINDOWS_IMAGE,
      tags: ["พรีออเดอร์", "ชำระเงินในเว็บ", "License Key Code", "เหมาะกับเครื่องใหม่"],
      description: "คีย์สำหรับเปิดใช้งาน Windows 11 Home จำนวน 1 เครื่อง เหมาะสำหรับการใช้งานทั่วไป ชำระเงินผ่านระบบเว็บและรอแอดมินจัดส่ง",
      gallery: [WINDOWS_IMAGE],
      platformLinks: [],
      featureBlocks: WINDOWS_PREORDER_FEATURES,
      detailSections: WINDOWS_PREORDER_DETAILS,
      steamRelatedLinks: [],
      systemRequirements: { minimum: ["Windows 11 Home และอุปกรณ์ที่รองรับ"], recommended: [] },
      isActive: true,
      sortOrder: 8993
    },
    {
      id: "windows-11-pro",
      name: "Windows 11 Pro",
      publisher: "Microsoft",
      category: "windows",
      label: "PRE-ORDER",
      price: 199,
      compareAt: 4850,
      stock: 99,
      sold: 0,
      rating: "",
      delivery: "ชำระเงินในเว็บและรับคีย์ผ่านแอดมินหลังตรวจสอบสลิป",
      warranty: "รับประกันคีย์ตามเงื่อนไขร้าน",
      image: WINDOWS_IMAGE,
      heroImage: WINDOWS_IMAGE,
      tags: ["พรีออเดอร์", "ชำระเงินในเว็บ", "Retail Key", "เหมาะกับสายมืออาชีพ"],
      description: "คีย์สำหรับเปิดใช้งาน Windows 11 Professional พร้อมฟีเจอร์สำหรับผู้ใช้ระดับมืออาชีพ ชำระเงินผ่านระบบเว็บและรอแอดมินจัดส่ง",
      gallery: [WINDOWS_IMAGE],
      platformLinks: [],
      featureBlocks: WINDOWS_PREORDER_FEATURES,
      detailSections: WINDOWS_PREORDER_DETAILS,
      steamRelatedLinks: [],
      systemRequirements: { minimum: ["Windows 11 Pro และอุปกรณ์ที่รองรับ"], recommended: [] },
      isActive: true,
      sortOrder: 8994
    },
    {
      id: "minecraft-microsoft-account",
      name: "Minecraft: Java & Bedrock Edition — Microsoft Account",
      publisher: "Minecraft / Microsoft",
      category: "minecraft-account",
      label: "PRE-ORDER",
      price: 699,
      compareAt: 999,
      // Fallback content is display-only. Supabase must provide real orderable stock.
      stock: 0,
      sold: 0,
      rating: "",
      delivery: "สินค้าแบบพรีออเดอร์ แอดมินตรวจสอบและจัดส่งบัญชี Microsoft ให้ด้วยตนเอง",
      warranty: "รับประกันการเข้าใช้งานตามเงื่อนไขร้าน กรุณาเปลี่ยนข้อมูลหลังได้รับสินค้า",
      image: MINECRAFT_HERO,
      heroImage: MINECRAFT_HERO,
      tags: ["Minecraft", "Microsoft Account", "Java Edition", "Bedrock Edition", "พรีออเดอร์"],
      description:
        "รับบัญชี Microsoft ที่มี Minecraft: Java & Bedrock Edition สำหรับ PC พร้อมใช้งาน เหมาะสำหรับผู้ที่ต้องการเริ่มเล่นทั้งสอง Edition ผ่าน Minecraft Launcher\n\nสินค้าเป็นประเภทพรีออเดอร์ หลังชำระเงินและแนบสลิป แอดมินจะตรวจสอบออเดอร์และจัดส่งข้อมูลบัญชีให้ด้วยตนเอง กรุณาเปลี่ยนอีเมลสำรอง รหัสผ่าน และข้อมูลความปลอดภัยทันทีหลังได้รับสินค้า",
      gallery: [MINECRAFT_HERO],
      platformLinks: [
        {
          label: "Minecraft Official",
          url: "https://www.minecraft.net/en-us/store/minecraft-deluxe-collection-pc",
          icon: "external-link"
        }
      ],
      featureBlocks: [
        { icon: "box", title: "Java + Bedrock", text: "เล่นได้ครบ 2 Edition บน PC" },
        { icon: "user-round-check", title: "Microsoft ID", text: "รับบัญชีพร้อมสิทธิ์เกม" },
        { icon: "clock-3", title: "พรีออเดอร์", text: "แอดมินจัดส่งด้วยตนเอง" },
        { icon: "shield-check", title: "ดูแลหลังขาย", text: "ช่วยตรวจสอบการเข้าใช้งาน" }
      ],
      detailSections: [
        {
          title: "สิ่งที่จะได้รับ",
          body:
            "บัญชี Microsoft พร้อมสิทธิ์ Minecraft: Java & Bedrock Edition สำหรับ PC\nใช้งานผ่าน Minecraft Launcher\nรองรับการเล่นออนไลน์ตามสิทธิ์ของบัญชีและเงื่อนไขของ Microsoft"
        },
        {
          title: "ข้อควรทราบก่อนสั่งซื้อ",
          body:
            "สินค้าไม่ใช่คีย์และไม่สามารถนำไปเติมในบัญชี Microsoft เดิมได้\nกรุณาเปลี่ยนข้อมูลบัญชีและเปิดการยืนยันตัวตนหลังได้รับสินค้า\nระยะเวลาจัดส่งขึ้นอยู่กับคิวตรวจสอบของแอดมิน"
        }
      ],
      steamRelatedLinks: [],
      systemRequirements: {
        minimum: ["OS: Windows 10/11", "บัญชี Microsoft", "Minecraft Launcher", "เชื่อมต่ออินเทอร์เน็ตสำหรับติดตั้งและยืนยันสิทธิ์"],
        recommended: []
      },
      isActive: true,
      sortOrder: 9001
    },
    {
      id: "minecraft-java-bedrock-key",
      name: "Minecraft: Java & Bedrock Edition — Redeem Key",
      publisher: "Minecraft / Microsoft",
      category: "minecraft-key",
      label: "PRE-ORDER KEY",
      price: 899,
      compareAt: 1190,
      // Fallback content is display-only. Supabase must provide real orderable stock.
      stock: 0,
      sold: 0,
      rating: "",
      delivery: "สินค้าแบบพรีออเดอร์ แอดมินจัดส่งคีย์หลังตรวจสอบการชำระเงิน",
      warranty: "รับประกันคีย์ยังไม่ถูกใช้งานก่อนส่งมอบ",
      image: MINECRAFT_HERO,
      heroImage: MINECRAFT_HERO,
      tags: ["Minecraft Key", "Redeem Code", "Java Edition", "Bedrock Edition", "พรีออเดอร์"],
      description:
        "คีย์สำหรับ Redeem Minecraft: Java & Bedrock Edition for PC เข้าบัญชี Microsoft ของลูกค้าเอง เหมาะสำหรับผู้ที่ต้องการถือสิทธิ์เกมบนบัญชีส่วนตัว\n\nสินค้าเป็นประเภทพรีออเดอร์ แอดมินจะจัดส่งคีย์ให้ด้วยตนเองหลังตรวจสอบสลิป กรุณาตรวจสอบโซนบัญชีและเงื่อนไขคีย์ก่อนยืนยันคำสั่งซื้อ",
      gallery: [MINECRAFT_HERO],
      platformLinks: [
        {
          label: "Minecraft Official",
          url: "https://www.minecraft.net/en-us/store/minecraft-deluxe-collection-pc",
          icon: "external-link"
        }
      ],
      featureBlocks: [
        { icon: "key-round", title: "Redeem Key", text: "เติมเข้าบัญชีของคุณเอง" },
        { icon: "box", title: "Java + Bedrock", text: "สิทธิ์เกมสำหรับ PC" },
        { icon: "clock-3", title: "พรีออเดอร์", text: "แอดมินจัดส่งด้วยตนเอง" },
        { icon: "badge-check", title: "คีย์ใหม่", text: "ตรวจสอบก่อนส่งมอบ" }
      ],
      detailSections: [
        {
          title: "สิ่งที่จะได้รับ",
          body:
            "Minecraft Redeem Key จำนวน 1 คีย์\nใช้เติมเข้าบัญชี Microsoft ของลูกค้า\nได้รับสิทธิ์ Java Edition และ Bedrock Edition สำหรับ PC ตามรายละเอียดสินค้า"
        },
        {
          title: "ข้อควรทราบก่อนสั่งซื้อ",
          body:
            "กรุณาตรวจสอบโซนของคีย์ก่อน Redeem\nคีย์ดิจิทัลที่เปิดดูหรือ Redeem แล้วไม่สามารถคืนหรือเปลี่ยนได้\nระยะเวลาจัดส่งขึ้นอยู่กับคิวตรวจสอบของแอดมิน"
        }
      ],
      steamRelatedLinks: [],
      systemRequirements: {
        minimum: ["OS: Windows 10/11", "บัญชี Microsoft", "Minecraft Launcher", "เชื่อมต่ออินเทอร์เน็ตสำหรับ Redeem"],
        recommended: []
      },
      isActive: true,
      sortOrder: 9002
    },
    {
      id: "rockstar-fivem-account",
      name: "Rockstar Games Account สำหรับเข้า FiveM",
      publisher: "Rockstar Games",
      category: "rockstar",
      label: "FIVEM STOCK",
      price: 129,
      compareAt: 199,
      stock: 0,
      sold: 0,
      rating: "",
      delivery: "จัดส่งบัญชีจากสต็อกหลังแอดมินตรวจสอบสลิป",
      warranty: "รับประกันการเข้าใช้งานครั้งแรก กรุณาเปลี่ยนข้อมูลทันทีหลังได้รับสินค้า",
      image: ROCKSTAR_HERO,
      heroImage: ROCKSTAR_HERO,
      tags: ["Rockstar Games", "FiveM", "Rockstar Account", "Stock"],
      description:
        "บัญชี Rockstar Games สำหรับใช้ล็อกอินเพื่อเข้า FiveM เท่านั้น สินค้านี้ไม่รวมเกม GTA V ลูกค้าต้องมีตัวเกม GTA V ที่รองรับอยู่แล้ว และต้องใช้บัญชี Steam ใหม่ที่ไม่เคยเข้า FiveM มาก่อนตามขั้นตอนของร้าน\n\nระบบจะจองบัญชีจากสต็อกจริงเมื่อสร้างคำสั่งซื้อ และแอดมินจะส่งข้อมูลบัญชีให้หลังตรวจสอบการชำระเงิน",
      gallery: [ROCKSTAR_HERO],
      platformLinks: [
        {
          label: "Rockstar Games",
          url: "https://www.rockstargames.com/gta-v",
          icon: "external-link"
        }
      ],
      featureBlocks: [
        { icon: "package-check", title: "สต็อกจริง", text: "จองบัญชีให้กับออเดอร์" },
        { icon: "gamepad-2", title: "สำหรับ FiveM", text: "ใช้เข้า FiveM เท่านั้น" },
        { icon: "triangle-alert", title: "ไม่รวม GTA V", text: "ต้องมีตัวเกมก่อนใช้งาน" },
        { icon: "shield-check", title: "เปลี่ยนข้อมูล", text: "เปลี่ยนทันทีหลังได้รับ" }
      ],
      detailSections: [
        {
          title: "เงื่อนไขสำคัญ",
          body:
            "บัญชีนี้ใช้สำหรับเข้า FiveM เท่านั้น\nสินค้าไม่รวมตัวเกม GTA V\nต้องใช้บัญชี Steam ใหม่ที่ไม่เคยเข้า FiveM มาก่อน\nกรุณาเปลี่ยนข้อมูลบัญชี Rockstar ให้เรียบร้อยทันทีหลังได้รับสินค้า"
        }
      ],
      steamRelatedLinks: [],
      systemRequirements: {
        minimum: ["มี GTA V ที่รองรับ FiveM", "ติดตั้ง Rockstar Games Launcher", "ติดตั้ง Steam", "ติดตั้ง FiveM"],
        recommended: []
      },
      isActive: true,
      sortOrder: 9010
    },
    {
      id: "rockstar-gta-v-download",
      name: "Grand Theft Auto V — Download Access",
      publisher: "Rockstar Games",
      category: "rockstar",
      label: "GTA V DOWNLOAD",
      price: 199,
      compareAt: 299,
      stock: 0,
      sold: 0,
      rating: "",
      delivery: "จัดส่งข้อมูลดาวน์โหลดจากสต็อกหลังตรวจสอบสลิป",
      warranty: "รับประกันการเข้าใช้งานครั้งแรกตามเงื่อนไขร้าน",
      image: GTA_V_HERO,
      heroImage: GTA_V_HERO,
      tags: ["GTA V", "Download Only", "Rockstar Games", "Stock"],
      description:
        "ตัวเกม GTA V สำหรับใช้โหลดและติดตั้งตัวเกมเท่านั้น เหมาะสำหรับลูกค้าที่ต้องการไฟล์/สิทธิ์ดาวน์โหลดเพื่อใช้งานกับขั้นตอนของร้าน\n\nสินค้านี้เป็นสต็อกจริงแบบเดียวกับไอดีออฟไลน์ ระบบจะจอง 1 ชุดต่อ 1 ออเดอร์เมื่อสร้างคำสั่งซื้อ และจัดส่งข้อมูลหลังตรวจสอบสลิปสำเร็จ ไม่ใช่บัญชี FiveM แยกต่างหาก",
      gallery: [GTA_V_HERO],
      platformLinks: [
        {
          label: "Grand Theft Auto V",
          url: "https://www.rockstargames.com/gta-v",
          icon: "external-link"
        }
      ],
      featureBlocks: [
        { icon: "download", title: "ใช้โหลดตัวเกม", text: "สำหรับดาวน์โหลด/ติดตั้ง GTA V" },
        { icon: "package-check", title: "สต็อกจริง", text: "จอง 1 ชุดต่อ 1 ออเดอร์" },
        { icon: "info", title: "Download Only", text: "ไม่ใช่สินค้า FiveM Account" },
        { icon: "shield-check", title: "ตรวจสอบก่อนส่ง", text: "จัดส่งหลังสลิปถูกต้อง" }
      ],
      detailSections: [
        {
          title: "รายละเอียดสินค้า",
          body:
            "สินค้า Grand Theft Auto V — Download Access ใช้สำหรับโหลด/ติดตั้งตัวเกม GTA V ตามขั้นตอนของร้านเท่านั้น\nไม่ใช่บัญชี FiveM และไม่ใช่การเพิ่มสิทธิ์เข้าเซิร์ฟเวอร์ FiveM โดยตรง"
        },
        {
          title: "ข้อควรทราบ",
          body:
            "กรุณาอ่านรายละเอียดก่อนสั่งซื้อ และติดต่อแอดมินหากไม่แน่ใจว่าสินค้านี้ตรงกับการใช้งานของคุณหรือไม่\nข้อมูลจัดส่งเป็นข้อมูลสำคัญ ควรเก็บไว้ในที่ปลอดภัยหลังได้รับสินค้า"
        }
      ],
      steamRelatedLinks: [],
      systemRequirements: {
        minimum: ["Windows 10/11", "Rockstar Games Launcher", "พื้นที่ว่างสำหรับติดตั้ง GTA V", "เชื่อมต่ออินเทอร์เน็ตสำหรับดาวน์โหลด"],
        recommended: ["SSD สำหรับติดตั้งเกม", "อินเทอร์เน็ตความเร็วสูง"]
      },
      isActive: true,
      sortOrder: 9011
    }
  ];

  const minecraftAccountProduct = products.find((product) => product.id === "minecraft-microsoft-account");
  if (minecraftAccountProduct) {
    minecraftAccountProduct.delivery = "จัดส่งแบบไอดียกเมล — แอดมินตรวจสอบสลิปและส่งบัญชี Microsoft พร้อมข้อมูลอีเมลให้ลูกค้า";
    minecraftAccountProduct.label = "MICROSOFT ID";
  }

  const minecraftKeyProduct = products.find((product) => product.id === "minecraft-java-bedrock-key");
  if (minecraftKeyProduct) {
    minecraftKeyProduct.delivery = "จัดส่งโดยแอดมิน — แอดมินตรวจสอบสลิปและส่ง Redeem Key ให้ลูกค้าแบบเดียวกับ Minecraft Microsoft Account";
  }

  const galleryFallbacks = new Map([
    ["minecraft-java-bedrock-key", MINECRAFT_HERO],
    ["rockstar-fivem-account", ROCKSTAR_HERO],
    ["rockstar-gta-v-download", GTA_V_HERO]
  ]);
  galleryFallbacks.forEach((fallbackImage, productId) => {
    const product = products.find((item) => item.id === productId);
    if (!product) return;
    const gallery = Array.isArray(product.gallery) ? product.gallery.filter(Boolean) : [];
    product.gallery = gallery.length ? gallery : [fallbackImage];
  });

  const windowsFeatureBlocks = [
    { icon: "shopping-cart", title: "สั่งซื้อเลย", text: "สร้างออเดอร์และชำระเงินผ่านระบบร้าน" },
    { icon: "send", title: "แอดมินจัดส่ง", text: "ส่งคีย์หลังตรวจสอบสลิป" },
    { icon: "key-round", title: "License Key", text: "คีย์ตรงตามรุ่น Windows ที่เลือก" },
    { icon: "badge-check", title: "ช่วยแนะนำ", text: "สอบถามขั้นตอนเปิดใช้งานได้" }
  ];
  products.filter((product) => product.category === "windows").forEach((product) => {
    product.featureBlocks = windowsFeatureBlocks.map((feature) => ({ ...feature }));
    product.tags = ["Windows Key", "Pre-order", "สั่งซื้อเลย", "แอดมินจัดส่ง"];
  });

  function isExtraCategory(category) {
    return ["windows", "minecraft-account", "minecraft-key", "rockstar"].includes(
      String(category || "").trim().toLowerCase()
    );
  }

  function getProductById(productId) {
    return products.find((product) => product.id === productId) || null;
  }

  function mergeProducts(onlineProducts = []) {
    const onlineExtraProducts = (Array.isArray(onlineProducts) ? onlineProducts : [])
      .filter((product) => product?.id && isExtraCategory(product.category));
    const source = onlineExtraProducts.length ? onlineExtraProducts : products;
    if (!onlineExtraProducts.length) return source.filter((product) => product.isActive !== false);
    const fallbackById = new Map(products.filter((product) => product?.id).map((product) => [product.id, product]));
    const detailFields = ["description", "gallery", "platformLinks", "featureBlocks", "detailSections", "steamRelatedLinks", "systemRequirements", "sourceMetadata"];
    return source
      .map((product) => {
        const fallback = fallbackById.get(product.id) || {};
        const merged = { ...fallback, ...product };
        detailFields.forEach((field) => {
          const value = product[field];
          const emptyArray = Array.isArray(value) && value.length === 0;
          const emptyObject = value && typeof value === "object" && !Array.isArray(value)
            ? Object.values(value).every((entry) => !Array.isArray(entry) || entry.length === 0)
            : false;
          if (value == null || value === "" || emptyArray || emptyObject) merged[field] = fallback[field];
        });
        return merged;
      })
      .filter((product) => product.isActive !== false);
  }

  window.OlafExtraProducts = {
    categories,
    products,
    isExtraCategory,
    getProductById,
    mergeProducts
  };
})();

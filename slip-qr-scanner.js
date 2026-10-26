(function () {
  const MAX_SLIP_SIZE = 5 * 1024 * 1024;
  const SCAN_DIMENSIONS = [1800, 2600];

  function scannerError(code) {
    const error = new Error(code);
    error.code = code;
    return error;
  }

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(scannerError("SLIP_IMAGE_INVALID"));
      };
      image.src = url;
    });
  }

  async function drawableFromFile(file) {
    if (typeof createImageBitmap === "function") {
      try {
        return await createImageBitmap(file, { imageOrientation: "from-image" });
      } catch (error) {
        // Fall back to an HTML image for browsers with partial imageBitmap support.
      }
    }
    return loadImage(file);
  }

  function canvasForDrawable(drawable, maxDimension) {
    const sourceWidth = Number(drawable.width || drawable.naturalWidth || 0);
    const sourceHeight = Number(drawable.height || drawable.naturalHeight || 0);
    if (!sourceWidth || !sourceHeight) throw scannerError("SLIP_IMAGE_INVALID");

    const scale = maxDimension / Math.max(sourceWidth, sourceHeight);
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw scannerError("SLIP_IMAGE_INVALID");
    context.drawImage(drawable, 0, 0, width, height);
    return { canvas, context, width, height };
  }

  async function scanWithBarcodeDetector(canvas) {
    if (!("BarcodeDetector" in window)) return "";
    try {
      const supported = await window.BarcodeDetector.getSupportedFormats?.();
      if (Array.isArray(supported) && !supported.includes("qr_code")) return "";
      const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
      const results = await detector.detect(canvas);
      return String(results?.[0]?.rawValue || "").trim();
    } catch (error) {
      return "";
    }
  }

  function scanWithJsQr(context, width, height) {
    if (typeof window.jsQR !== "function") return "";
    const imageData = context.getImageData(0, 0, width, height);
    const direct = window.jsQR(imageData.data, width, height, { inversionAttempts: "attemptBoth" });
    if (direct?.data) return String(direct.data).trim();

    // Wallet slips often render a small, low-contrast QR on a colored background.
    // Retry grayscale threshold variants without changing the decoded payload.
    for (const threshold of [145, 185]) {
      const pixels = new Uint8ClampedArray(imageData.data);
      for (let i = 0; i < pixels.length; i += 4) {
        const gray = Math.round(pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114);
        const value = gray >= threshold ? 255 : 0;
        pixels[i] = pixels[i + 1] = pixels[i + 2] = value;
      }
      const result = window.jsQR(pixels, width, height, { inversionAttempts: "attemptBoth" });
      if (result?.data) return String(result.data).trim();
    }
    return "";
  }

  async function scanFile(file) {
    if (!file) throw scannerError("SLIP_FILE_REQUIRED");
    if (!String(file.type || "").startsWith("image/")) {
      throw scannerError("SLIP_FILE_MUST_BE_IMAGE");
    }
    if (Number(file.size || 0) > MAX_SLIP_SIZE) {
      throw scannerError("SLIP_FILE_TOO_LARGE");
    }

    const drawable = await drawableFromFile(file);
    try {
      let nativePayload = "";
      let payload = "";
      for (const dimension of SCAN_DIMENSIONS) {
        const { canvas, context, width, height } = canvasForDrawable(drawable, dimension);
        if (!nativePayload) nativePayload = await scanWithBarcodeDetector(canvas);
        payload = nativePayload || scanWithJsQr(context, width, height);
        if (payload) break;
      }
      if (!payload) throw scannerError("SLIP_QR_NOT_FOUND");
      return {
        payload,
        source: nativePayload ? "barcode-detector" : "jsqr"
      };
    } finally {
      drawable.close?.();
    }
  }

  window.OlafSlipQr = {
    scanFile
  };
})();

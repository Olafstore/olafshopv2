(function () {
  const MAX_SLIP_SIZE = 5 * 1024 * 1024;
  const MAX_SCAN_DIMENSION = 1800;

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

  function canvasForDrawable(drawable) {
    const sourceWidth = Number(drawable.width || drawable.naturalWidth || 0);
    const sourceHeight = Number(drawable.height || drawable.naturalHeight || 0);
    if (!sourceWidth || !sourceHeight) throw scannerError("SLIP_IMAGE_INVALID");

    const scale = Math.min(1, MAX_SCAN_DIMENSION / Math.max(sourceWidth, sourceHeight));
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
    const result = window.jsQR(imageData.data, width, height, {
      inversionAttempts: "attemptBoth"
    });
    return String(result?.data || "").trim();
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
      const { canvas, context, width, height } = canvasForDrawable(drawable);
      const nativePayload = await scanWithBarcodeDetector(canvas);
      const payload = nativePayload || scanWithJsQr(context, width, height);
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

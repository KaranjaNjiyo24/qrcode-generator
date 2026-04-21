const form = document.getElementById("qr-form");
const urlInput = document.getElementById("url-input");
const logoInput = document.getElementById("logo-input");
const statusMessage = document.getElementById("status-message");
const generateBtn = document.getElementById("generate-btn");
const downloadBtn = document.getElementById("download-btn");
const canvas = document.getElementById("qr-canvas");
const placeholderText = document.getElementById("placeholder-text");
const howItWorksBtn = document.getElementById("how-it-works-btn");
const howItWorksPanel = document.getElementById("how-it-works-panel");
const qrColorInput = document.getElementById("qr-color-input");
const defaultColorBtn = document.getElementById("default-color-btn");
const logoColorBtn = document.getElementById("logo-color-btn");
const activeColorText = document.getElementById("active-color-text");
const presetButtons = document.querySelectorAll(".preset-btn");

const QR_SIZE = 900;
const LOGO_MAX_RATIO = 0.2;

let logoDataUrl = null;
let hasGeneratedQr = false;
let latestPayload = "";
let currentQrColor = "#000000";

function clearPresetSelection() {
  presetButtons.forEach((button) => button.classList.remove("active"));
}

function updateActiveColorLabel() {
  if (activeColorText) {
    activeColorText.textContent = `Active QR color: ${currentQrColor.toUpperCase()}`;
  }
}

async function rerenderIfGenerated(statusText) {
  if (!hasGeneratedQr || !latestPayload) {
    return;
  }

  await generateQr(latestPayload);
  if (statusText) {
    setStatus(statusText, "success");
  }
}

function setQrColor(nextColor, options = {}) {
  const normalized = String(nextColor || "").trim().toLowerCase();
  if (!/^#[0-9a-f]{6}$/.test(normalized)) {
    throw new Error("Selected color is invalid. Please choose another color.");
  }

  currentQrColor = normalized;
  if (qrColorInput) {
    qrColorInput.value = normalized;
  }

  if (!options.keepPreset) {
    clearPresetSelection();
  }

  updateActiveColorLabel();
}

if (howItWorksBtn && howItWorksPanel) {
  howItWorksBtn.addEventListener("click", () => {
    const isCurrentlyHidden = howItWorksPanel.hasAttribute("hidden");
    if (isCurrentlyHidden) {
      howItWorksPanel.removeAttribute("hidden");
      howItWorksBtn.setAttribute("aria-expanded", "true");
      howItWorksBtn.textContent = "Hide how it works";
      return;
    }

    howItWorksPanel.setAttribute("hidden", "");
    howItWorksBtn.setAttribute("aria-expanded", "false");
    howItWorksBtn.textContent = "How it works";
  });
}

function findDominantColor(dataUrl) {
  return new Promise(async (resolve, reject) => {
    try {
      const image = await getImageFromDataUrl(dataUrl);
      const swatchCanvas = document.createElement("canvas");
      const swatchSize = 120;
      swatchCanvas.width = swatchSize;
      swatchCanvas.height = swatchSize;

      const ctx = swatchCanvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        reject(new Error("Could not read logo colors."));
        return;
      }

      ctx.drawImage(image, 0, 0, swatchSize, swatchSize);
      const { data } = ctx.getImageData(0, 0, swatchSize, swatchSize);
      const buckets = new Map();

      for (let i = 0; i < data.length; i += 4 * 2) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        if (a < 120) {
          continue;
        }

        // Skip near-white and near-black to better capture brand tones.
        if (r > 240 && g > 240 && b > 240) {
          continue;
        }
        if (r < 20 && g < 20 && b < 20) {
          continue;
        }

        const qr = Math.round(r / 32) * 32;
        const qg = Math.round(g / 32) * 32;
        const qb = Math.round(b / 32) * 32;
        const key = `${Math.min(255, qr)},${Math.min(255, qg)},${Math.min(255, qb)}`;
        buckets.set(key, (buckets.get(key) || 0) + 1);
      }

      if (buckets.size === 0) {
        reject(new Error("Could not detect a dominant color from the logo."));
        return;
      }

      let bestKey = "0,0,0";
      let bestCount = 0;
      buckets.forEach((count, key) => {
        if (count > bestCount) {
          bestCount = count;
          bestKey = key;
        }
      });

      const [red, green, blue] = bestKey.split(",").map((value) => Number(value));
      const hex = `#${[red, green, blue]
        .map((value) => value.toString(16).padStart(2, "0"))
        .join("")}`;
      resolve(hex);
    } catch {
      reject(new Error("Could not detect a dominant color from the logo."));
    }
  });
}

function setStatus(message, type = "") {
  statusMessage.textContent = message;
  statusMessage.classList.remove("error", "success");

  if (type) {
    statusMessage.classList.add(type);
  }
}

function validateUrl(value) {
  if (!value) {
    return { valid: false, reason: "Please enter a URL." };
  }

  try {
    const parsed = new URL(value);
    const validProtocol = parsed.protocol === "http:" || parsed.protocol === "https:";

    if (!validProtocol) {
      return { valid: false, reason: "URL must begin with http:// or https://." };
    }

    return { valid: true, normalized: parsed.toString() };
  } catch {
    return { valid: false, reason: "Enter a valid URL format." };
  }
}

function getImageFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image failed to load."));
    image.src = dataUrl;
  });
}

async function overlayLogo() {
  if (!logoDataUrl) {
    return;
  }

  const ctx = canvas.getContext("2d");
  const logoImage = await getImageFromDataUrl(logoDataUrl);

  const maxLogoSize = QR_SIZE * LOGO_MAX_RATIO;
  const ratio = Math.min(maxLogoSize / logoImage.width, maxLogoSize / logoImage.height);
  const logoWidth = Math.max(1, Math.round(logoImage.width * ratio));
  const logoHeight = Math.max(1, Math.round(logoImage.height * ratio));

  const logoX = (QR_SIZE - logoWidth) / 2;
  const logoY = (QR_SIZE - logoHeight) / 2;

  const padding = Math.round(Math.max(logoWidth, logoHeight) * 0.14);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(logoX - padding, logoY - padding, logoWidth + padding * 2, logoHeight + padding * 2);
  ctx.drawImage(logoImage, logoX, logoY, logoWidth, logoHeight);
}

async function generateQr(payload) {
  await QRCode.toCanvas(canvas, payload, {
    width: QR_SIZE,
    margin: 2,
    errorCorrectionLevel: "H",
    color: {
      dark: currentQrColor,
      light: "#ffffff",
    },
  });

  await overlayLogo();

  hasGeneratedQr = true;
  latestPayload = payload;
  downloadBtn.disabled = false;
  canvas.style.display = "block";
  placeholderText.style.display = "none";
}

if (qrColorInput) {
  qrColorInput.addEventListener("input", async () => {
    try {
      setQrColor(qrColorInput.value);
      await rerenderIfGenerated("QR color updated.");
    } catch (error) {
      setStatus(error.message || "Could not apply that color.", "error");
    }
  });
}

if (defaultColorBtn) {
  defaultColorBtn.addEventListener("click", async () => {
    try {
      setQrColor("#000000");
      await rerenderIfGenerated("QR color reset to default black.");
    } catch (error) {
      setStatus(error.message || "Could not set default color.", "error");
    }
  });
}

if (logoColorBtn) {
  logoColorBtn.addEventListener("click", async () => {
    if (!logoDataUrl) {
      setStatus("Upload a logo first to extract company color.", "error");
      return;
    }

    try {
      const dominantColor = await findDominantColor(logoDataUrl);
      setQrColor(dominantColor);
      await rerenderIfGenerated("Applied dominant logo color to QR.");
    } catch (error) {
      setStatus(error.message || "Could not extract a color from logo.", "error");
    }
  });
}

presetButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    const presetColor = button.dataset.color;
    if (!presetColor) {
      return;
    }

    try {
      clearPresetSelection();
      button.classList.add("active");
      setQrColor(presetColor, { keepPreset: true });
      await rerenderIfGenerated("Preset color applied.");
    } catch (error) {
      setStatus(error.message || "Could not apply preset color.", "error");
    }
  });
});

function readLogoFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read the selected logo."));

    reader.readAsDataURL(file);
  });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("");

  const validation = validateUrl(urlInput.value.trim());
  if (!validation.valid) {
    hasGeneratedQr = false;
    downloadBtn.disabled = true;
    canvas.style.display = "none";
    placeholderText.style.display = "block";
    setStatus(validation.reason, "error");
    return;
  }

  generateBtn.disabled = true;
  generateBtn.textContent = "Generating...";

  try {
    await generateQr(validation.normalized);
    setStatus("QR code ready. You can download it as PNG.", "success");
  } catch (error) {
    hasGeneratedQr = false;
    downloadBtn.disabled = true;
    canvas.style.display = "none";
    placeholderText.style.display = "block";
    setStatus(error.message || "Could not generate the QR code.", "error");
  } finally {
    generateBtn.disabled = false;
    generateBtn.textContent = "Generate QR";
  }
});

logoInput.addEventListener("change", async () => {
  setStatus("");

  const [file] = logoInput.files || [];
  if (!file) {
    logoDataUrl = null;

    if (hasGeneratedQr && latestPayload) {
      try {
        await generateQr(latestPayload);
        setStatus("Logo removed from preview.", "success");
      } catch {
        setStatus("Logo removed, but QR refresh failed.", "error");
      }
    }

    return;
  }

  if (!file.type.startsWith("image/")) {
    logoInput.value = "";
    logoDataUrl = null;
    setStatus("Please upload an image file for the logo.", "error");
    return;
  }

  try {
    logoDataUrl = await readLogoFile(file);
    if (hasGeneratedQr && latestPayload) {
      await generateQr(latestPayload);
      setStatus("Logo applied to QR preview.", "success");
    } else {
      setStatus("Logo uploaded. Generate a QR code to apply it.", "success");
    }
  } catch (error) {
    logoInput.value = "";
    logoDataUrl = null;
    setStatus(error.message || "Failed to load logo image.", "error");
  }
});

updateActiveColorLabel();

downloadBtn.addEventListener("click", () => {
  if (!hasGeneratedQr) {
    setStatus("Generate a QR code before downloading.", "error");
    return;
  }

  canvas.toBlob((blob) => {
    if (!blob) {
      setStatus("PNG export failed. Please try again.", "error");
      return;
    }

    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const safeName = "qr-code";

    anchor.href = objectUrl;
    anchor.download = `${safeName}.png`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    URL.revokeObjectURL(objectUrl);
    setStatus("PNG downloaded successfully.", "success");
  }, "image/png");
});

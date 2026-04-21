const form = document.getElementById("qr-form");
const urlInput = document.getElementById("url-input");
const logoInput = document.getElementById("logo-input");
const statusMessage = document.getElementById("status-message");
const generateBtn = document.getElementById("generate-btn");
const downloadBtn = document.getElementById("download-btn");
const canvas = document.getElementById("qr-canvas");
const placeholderText = document.getElementById("placeholder-text");

const QR_SIZE = 900;
const LOGO_MAX_RATIO = 0.2;

let logoDataUrl = null;
let hasGeneratedQr = false;
let latestPayload = "";

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
      dark: "#0f3d2e",
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

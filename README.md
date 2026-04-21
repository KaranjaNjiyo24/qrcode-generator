# Forest QR Studio

This is a simple client-side QR code generator that lets users:

- Paste a URL and generate a QR code
- Optionally upload an organization logo for center overlay
- Download the final QR as a PNG

## Tech Stack

- HTML, CSS, JavaScript
- [qrcode](https://www.npmjs.com/package/qrcode) browser build via CDN
- No backend required

## Run Locally

1. Open a terminal in this project folder:

```bash
cd /home/r00t/code/machine-learning/qrcode-generator
```

2. Start a local server:

```bash
python3 -m http.server 5500
```

3. Open in your browser:

- http://localhost:5500

## How To Use

1. Click **How it works** in the header for a quick usage guide.
2. Enter a full URL (must start with `http://` or `https://`).
3. Optionally upload a logo image file.
4. Click **Generate QR**.
5. Click **Download PNG** to save the generated image.

## Manual Test Checklist

- Valid URL generates QR preview
- Invalid URL shows validation message
- Logo upload overlays at center
- PNG download saves successfully
- Generated QR scans on phone camera (with and without logo)

## Files

- `index.html`: UI markup and structure
- `styles.css`: Design system and responsive styling
- `app.js`: QR generation, logo overlay, validation, and download logic

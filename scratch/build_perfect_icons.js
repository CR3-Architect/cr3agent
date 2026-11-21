const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    width: 1024,
    height: 1024,
    webPreferences: {
      offscreen: true,
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  const srcImgBase64 = fs.readFileSync('/Users/cr3-architect/.gemini/antigravity/brain/116455e3-5e2b-40c6-bb10-4e2bdf20a142/.user_uploaded/media_1795283661264_6b058d85.jpg').toString('base64');

  const html = `
  <!DOCTYPE html>
  <html>
  <body style="margin:0;background:transparent;">
    <canvas id="c_dock" width="1024" height="1024"></canvas>
    <canvas id="c_ui" width="512" height="512"></canvas>
    <script>
      const img = new Image();
      img.onload = () => {
        // --- 1. DOCK & ICNS (1024x1024 with standard macOS squircle & drop shadow) ---
        const cDock = document.getElementById('c_dock');
        const ctxD = cDock.getContext('2d');
        ctxD.clearRect(0, 0, 1024, 1024);

        const inset = 96;
        const size = 1024 - (inset * 2); // 832x832
        const r = 190; // Standard continuous squircle curvature for macOS

        // Shadow
        ctxD.save();
        ctxD.shadowColor = 'rgba(0, 0, 0, 0.45)';
        ctxD.shadowBlur = 32;
        ctxD.shadowOffsetY = 16;
        ctxD.beginPath();
        ctxD.roundRect(inset, inset, size, size, r);
        ctxD.fillStyle = '#000';
        ctxD.fill();
        ctxD.restore();

        // Clip squircle
        ctxD.save();
        ctxD.beginPath();
        ctxD.roundRect(inset, inset, size, size, r);
        ctxD.clip();

        // Draw image center cropped
        const minDimD = Math.min(img.width, img.height);
        const sxD = (img.width - minDimD) / 2;
        const syD = (img.height - minDimD) / 2;
        ctxD.drawImage(img, sxD, syD, minDimD, minDimD, inset, inset, size, size);

        // Inner border highlight
        ctxD.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctxD.lineWidth = 3;
        ctxD.stroke();
        ctxD.restore();

        // --- 2. UI AVATAR (512x512 tight squircle for in-app UI without padding) ---
        const cUI = document.getElementById('c_ui');
        const ctxU = cUI.getContext('2d');
        ctxU.clearRect(0, 0, 512, 512);

        const rUI = 115; // smooth squircle radius on 512x512
        ctxU.save();
        ctxU.beginPath();
        ctxU.roundRect(0, 0, 512, 512, rUI);
        ctxU.clip();

        ctxU.drawImage(img, sxD, syD, minDimD, minDimD, 0, 0, 512, 512);

        ctxU.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctxU.lineWidth = 4;
        ctxU.stroke();
        ctxU.restore();

        window.renderDone = true;
      };
      img.src = "data:image/jpeg;base64,${srcImgBase64}";
    </script>
  </body>
  </html>
  `;

  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));

  let count = 0;
  while (count < 30) {
    const done = await win.webContents.executeJavaScript('window.renderDone || false');
    if (done) break;
    await new Promise(r => setTimeout(r, 100));
    count++;
  }

  const dockDataUrl = await win.webContents.executeJavaScript("document.getElementById('c_dock').toDataURL('image/png')");
  const uiDataUrl = await win.webContents.executeJavaScript("document.getElementById('c_ui').toDataURL('image/png')");

  const dockBase64 = dockDataUrl.replace(/^data:image\/png;base64,/, '');
  const uiBase64 = uiDataUrl.replace(/^data:image\/png;base64,/, '');

  fs.writeFileSync('/Users/cr3-architect/Projects/Cr3agent/build/icon_squircle_1024.png', dockBase64, 'base64');
  fs.writeFileSync('/Users/cr3-architect/Projects/Cr3agent/build/icon.png', dockBase64, 'base64');
  fs.writeFileSync('/Users/cr3-architect/Projects/Cr3agent/assets/icon.png', dockBase64, 'base64');
  fs.writeFileSync('/Users/cr3-architect/Projects/Cr3agent/renderer/icon.png', uiBase64, 'base64');

  console.log('PNGs_GENERATED_SUCCESSFULLY');
  app.exit(0);
});

document.addEventListener('DOMContentLoaded', async () => {

    // --- Asset Loading & Helpers ---

    function loadImage(src) {
        return new Promise((resolve, reject) => {
            if (!src) return resolve(null);
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => resolve(img);
            img.onerror = (e) => {
                console.warn(`Failed to load image: ${src}`, e);
                resolve(null);
            };
            img.src = src;
        });
    }

    async function loadFonts() {
        const fontsToLoad = [
            { family: 'Ephesis', url: 'font/ephesis-regular.ttf' },
            { family: 'Comfortaa', url: 'font/comfortaa-regular.ttf' },
            { family: 'ComfortaaBold', url: 'font/comfortaa-bold.ttf' },
            { family: 'Playball', url: 'font/playball-regular.ttf' }
        ];

        for (const fontInfo of fontsToLoad) {
            try {
                const font = new FontFace(fontInfo.family, `url(${fontInfo.url})`);
                const loadedFont = await font.load();
                document.fonts.add(loadedFont);
                console.log(`Loaded font: ${fontInfo.family}`);
            } catch (err) {
                console.error(`Failed to load font ${fontInfo.family}:`, err);
            }
        }
        await document.fonts.ready;
    }

    function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
        const words = text.split(' ');
        let line = '';
        let currentY = y;

        for (let n = 0; n < words.length; n++) {
            const testLine = line + words[n] + ' ';
            const metrics = ctx.measureText(testLine);
            const testWidth = metrics.width;
            if (testWidth > maxWidth && n > 0) {
                ctx.fillText(line, x, currentY);
                line = words[n] + ' ';
                currentY += lineHeight;
            } else {
                line = testLine;
            }
        }
        ctx.fillText(line, x, currentY);
    }

    // --- Initialization ---

    await loadFonts();

    // DOM Elements
    const inputDate = document.getElementById('input-date');
    const inputMonth = document.getElementById('input-month');
    const inputQuote = document.getElementById('input-quote');
    const inputName = document.getElementById('input-name');
    const inputDesignation = document.getElementById('input-designation');
    const inputDepartment = document.getElementById('input-department');
    const inputImage = document.getElementById('input-image');
    const btnDownload = document.getElementById('btn-download');

    // Canvas
    const canvas = document.getElementById('image-canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 1080;
    canvas.height = 1080;

    // State
    let state = {
        date: inputDate.value,
        month: inputMonth.value,
        quote: inputQuote.value,
        name: inputName.value,
        designation: inputDesignation.value,
        department: inputDepartment.value,
        userImage: null,
        bgImage: null,
        logoImage: null,
        brightness: 0,
        contrast: 100,
        saturation: 100,
        rotation: 0,
        zoom: 1,
        offsetX: 0,
        offsetY: 0
    };

    const logoImg = await loadImage('kudometrics-logo.svg');
    const birthdayBg = await loadImage('birthday-background.png');
    state.bgImage = birthdayBg;
    state.logoImage = logoImg;

    async function drawCanvas() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 1. Background
        if (state.bgImage) {
            ctx.drawImage(state.bgImage, 0, 0, canvas.width, canvas.height);
        } else {
            // Fallback gradient
            const grd = ctx.createLinearGradient(0, 0, 1080, 1080);
            grd.addColorStop(0, '#fdfcfd');
            grd.addColorStop(1, '#f5eef5');
            ctx.fillStyle = grd;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        // 2. Logo (Top Left)
        if (state.logoImage) {
            ctx.drawImage(state.logoImage, 36, 28, 64, 72);
        }

        // 3. "Happy Birthday" text
        ctx.font = '96px Ephesis';
        ctx.fillStyle = '#D400D4';
        ctx.textAlign = 'center';
        ctx.fillText('Happy Birthday', 540, 140);

        // 4. Polaroid Frame & Image
        const pWidth = 480;
        const pHeight = 600;
        const pX = 540 - (pWidth / 2);
        const pY = 190;

        // Shadow
        ctx.save();
        ctx.shadowColor = "rgba(0, 0, 0, 0.2)";
        ctx.shadowBlur = 40;
        ctx.shadowOffsetX = 10;
        ctx.shadowOffsetY = 20;

        // White Frame
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(pX, pY, pWidth, pHeight);
        ctx.restore();

        // Image Area
        const imgX = pX + 12;
        const imgY = pY + 12;
        const imgW = pWidth - 24;
        const imgH = 460;

        ctx.fillStyle = "#f0f0f0";
        ctx.fillRect(imgX, imgY, imgW, imgH);

        if (state.userImage) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(imgX, imgY, imgW, imgH);
            ctx.clip();

            // Transformations
            const centerX = imgX + imgW / 2;
            const centerY = imgY + imgH / 2;
            ctx.translate(centerX, centerY);
            ctx.rotate((state.rotation * Math.PI) / 180);
            const brightnessFilter = 100 + (state.brightness * 2);
            ctx.filter = `brightness(${brightnessFilter}%) contrast(${state.contrast}%) saturate(${state.saturation}%)`;

            const iRatio = state.userImage.width / state.userImage.height;
            const aRatio = imgW / imgH;
            let sw, sh, sx, sy;
            if (iRatio > aRatio) {
                sh = state.userImage.height;
                sw = sh * aRatio;
            } else {
                sw = state.userImage.width;
                sh = sw / aRatio;
            }
            sw /= state.zoom;
            sh /= state.zoom;
            sx = (state.userImage.width - sw) / 2 - state.offsetX;
            sy = (state.userImage.height - sh) / 2 - state.offsetY;

            ctx.drawImage(state.userImage, sx, sy, sw, sh, -imgW / 2, -imgH / 2, imgW, imgH);
            ctx.restore();
        }

        // Department Label (on image)
        ctx.font = '24px Comfortaa';
        const deptWidth = ctx.measureText(state.department).width;
        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        ctx.fillRect(imgX, imgY + imgH - 40, deptWidth + 30, 40);
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';
        ctx.fillText(state.department, imgX + 15, imgY + imgH - 12);

        // Name & Designation (Polaroid Caption)
        ctx.font = '46px Playball';
        ctx.fillStyle = '#D400D4';
        ctx.textAlign = 'center';
        ctx.fillText(state.name, 540, pY + imgH + 65);

        ctx.font = '26px Playball';
        ctx.fillStyle = '#888888';
        ctx.fillText(state.designation, 540, pY + imgH + 100);

        // 5. Date Box (Pink square on the right side)
        const dbSize = 150;
        const dbX = pX + pWidth - 75;
        const dbY = pY + 40;

        // Background Rotated Rectangle (White Border)
        ctx.save();
        ctx.translate(dbX + dbSize / 2, dbY + dbSize / 2);
        ctx.rotate(15 * Math.PI / 180);
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-dbSize / 2, -dbSize / 2, dbSize, dbSize);
        ctx.restore();

        ctx.save();
        ctx.fillStyle = "#D400D4";
        ctx.fillRect(dbX, dbY, dbSize, dbSize);

        ctx.font = '48px Comfortaa';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(state.date, dbX + dbSize / 2, dbY + 65);
        ctx.fillText(state.month, dbX + dbSize / 2, dbY + 120);
        ctx.restore();

        // 6. Quote (Bottom section)
        ctx.font = '28px Comfortaa';
        ctx.fillStyle = '#444444';
        ctx.textAlign = 'center';
        wrapText(ctx, '"' + state.quote + '"', 540, 850, 800, 36);

        // 7. Footer (Web Address)
        ctx.font = '18px Comfortaa';
        ctx.fillStyle = '#666666';
        ctx.textAlign = 'center';
        ctx.letterSpacing = '2px';
        ctx.fillText('WWW.KUDOMETRICS.COM', 540, 1040);
    }

    function updateState() {
        state.date = inputDate.value;
        state.month = inputMonth.value;
        state.quote = inputQuote.value;
        state.name = inputName.value;
        state.designation = inputDesignation.value;
        state.department = inputDepartment.value;
        drawCanvas();
    }

    [inputDate, inputMonth, inputQuote, inputName, inputDesignation, inputDepartment].forEach(el => el.addEventListener('input', updateState));

    inputImage.addEventListener('change', (e) => {
        if (e.target.files[0]) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const img = new Image();
                img.onload = () => {
                    state.userImage = img;
                    document.getElementById('image-editing-section').style.display = 'flex';
                    drawCanvas();
                };
                img.src = ev.target.result;
            };
            reader.readAsDataURL(e.target.files[0]);
        }
    });

    btnDownload.addEventListener('click', () => {
        const link = document.createElement('a');
        link.download = `Birthday_${state.name.replace(/\s+/g, '_')}.png`;
        link.href = canvas.toDataURL('image/png', 1.0);
        link.click();
    });

    // Editing Listeners
    const sliders = {
        brightness: 'brightness-slider',
        contrast: 'contrast-slider',
        saturation: 'saturation-slider',
        rotation: 'rotation-slider',
        zoom: 'zoom-slider',
        offsetX: 'offset-x-slider',
        offsetY: 'offset-y-slider'
    };

    Object.keys(sliders).forEach(key => {
        const el = document.getElementById(sliders[key]);
        const valEl = document.getElementById(key + '-value');
        el.addEventListener('input', (e) => {
            state[key] = parseFloat(e.target.value);
            if (valEl) valEl.textContent = e.target.value + (key === 'rotation' ? '°' : (key.includes('zoom') ? 'x' : ''));
            drawCanvas();
        });
    });

    document.getElementById('reset-adjustments').addEventListener('click', () => {
        state.brightness = 0; state.contrast = 100; state.saturation = 100; state.rotation = 0; state.zoom = 1; state.offsetX = 0; state.offsetY = 0;
        Object.keys(sliders).forEach(key => {
            const el = document.getElementById(sliders[key]);
            el.value = key === 'contrast' || key === 'saturation' ? 100 : (key === 'zoom' ? 1 : 0);
            const valEl = document.getElementById(key + '-value');
            if (valEl) valEl.textContent = el.value;
        });
        drawCanvas();
    });

    function resizePreview() {
        const scale = 0.75;
        canvas.style.transform = `scale(${scale})`;
        const container = document.getElementById('canvas-container');
        container.style.width = `${canvas.width * scale}px`;
        container.style.height = `${canvas.height * scale}px`;
    }
    window.addEventListener('resize', resizePreview);
    resizePreview();
    drawCanvas();
    setTimeout(drawCanvas, 1000);
});

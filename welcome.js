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
            { family: 'JetBrainsMono', url: 'font/JetBrainsMono-Regular.ttf' },
            { family: 'KittenSwashMonolineTrial', url: 'font/KittenSwashMonolineTrial.ttf' }
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

    // Helper wrapTextReturnsY parses text using standard measureText and returns the final Y Coordinate
    function wrapTextReturnsY(ctx, text, x, y, maxWidth, lineHeight) {
        const words = text.split(' ');
        let line = '';
        let currentY = y;

        for (let n = 0; n < words.length; n++) {
            const testLine = line + words[n] + ' ';
            const metrics = ctx.measureText(testLine);
            const testWidth = metrics.width;

            // Check for new line token if we want to support manual line breaks, keeping it simple for now
            if (testWidth > maxWidth && n > 0) {
                ctx.fillText(line, x, currentY);
                line = words[n] + ' ';
                currentY += lineHeight;
            } else {
                line = testLine;
            }
        }
        ctx.fillText(line, x, currentY);
        return currentY;
    }

    // --- Initialization ---

    await loadFonts();

    // DOM Elements
    const inputHeading = document.getElementById('input-heading');
    const inputGreeting = document.getElementById('input-greeting');
    const inputExperience = document.getElementById('input-experience');
    const inputEmail = document.getElementById('input-email');
    const inputImage = document.getElementById('input-image');
    const btnDownload = document.getElementById('btn-download');

    // Canvas properties
    const canvas = document.getElementById('image-canvas');
    const ctx = canvas.getContext('2d');

    // Setting typical horizontal welcome banner resolution 1200x588 based on standard aspect ratio
    canvas.width = 1200;
    canvas.height = 588;

    // State
    let state = {
        heading: inputHeading.value,
        greeting: inputGreeting.value,
        experience: inputExperience.value,
        email: inputEmail.value,
        userImage: null,
        bgImage: null,
        poppersImg: null,
        poppersBottomImg: null,
        logoImage: null,
        brightness: 0,
        contrast: 100,
        saturation: 100,
        rotation: 0,
        zoom: 1,
        offsetX: 0,
        offsetY: 0
    };

    // Load static assets based on requested requirements
    const [logoImg, welcomeBg, poppersImg, poppersBottomImg] = await Promise.all([
        loadImage('kudometrics-logo.svg'),
        loadImage('welcome-background.png'),
        loadImage('poppers.png'),
        loadImage('poppers-bottom.png')
    ]);

    state.bgImage = welcomeBg;
    state.logoImage = logoImg;
    state.poppersImg = poppersImg;
    state.poppersBottomImg = poppersBottomImg;

    async function drawCanvas() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 1. Background
        if (state.bgImage) {
            ctx.drawImage(state.bgImage, 0, 0, canvas.width, canvas.height);
        } else {
            // Fallback gradient to match a very light blue theme
            const grd = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
            grd.addColorStop(0, '#ebf6fd');
            grd.addColorStop(1, '#f6f9fc');
            ctx.fillStyle = grd;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        // 2. Decorative Top Right Poppers
        if (state.poppersImg) {
            const ratio = state.poppersImg.height / state.poppersImg.width;
            const pWidth = 90;
            ctx.save();
            ctx.translate(canvas.width - pWidth - 129 + pWidth / 2, 64 + (pWidth * ratio) / 2);
            ctx.rotate(5.01 * Math.PI / 180);
            ctx.drawImage(state.poppersImg, -pWidth / 2, -(pWidth * ratio) / 2, pWidth, pWidth * ratio);
            ctx.restore();
        }

        // (Moved Decorative Bottom Left Poppers to after user image)

        // 4. Logo (Bottom Right)
        if (state.logoImage) {
            const logoRatio = state.logoImage.height / state.logoImage.width;
            const logoWidth = 38;
            ctx.drawImage(state.logoImage, canvas.width - logoWidth - 77, canvas.height - (logoWidth * logoRatio) - 52, logoWidth, logoWidth * logoRatio);
        }

        // 5. Left Side Dark Frame shape
        const frameX = 58;
        const frameY = 71;
        const frameW = 401;
        const frameH = 440;
        const radius = 33;

        // Base Dark Purple Block
        ctx.fillStyle = "#190230";
        ctx.beginPath();
        ctx.roundRect(frameX, frameY, frameW, frameH, radius);
        ctx.fill();

        // Underlaying shifted highlight/shadow block (from design)
        ctx.save();
        ctx.fillStyle = "#B0A08F";
        ctx.globalAlpha = 0.4;
        ctx.beginPath();
        // Translate to center point for correct pivot rotation
        ctx.translate(156 + 236 / 2, 130 + 320 / 2);
        ctx.rotate(2.5 * Math.PI / 180);
        ctx.roundRect(-236 / 2, -320 / 2, 236, 320, radius);
        ctx.fill();
        ctx.restore();

        // White Photo Frame wrapper
        ctx.fillStyle = "#F8F8F8";
        ctx.beginPath();
        ctx.roundRect(133, 120, 236, 342, radius);
        ctx.fill();

        // 6. User Image Area
        const imgX = 133;
        const imgY = 120;
        const imgW = 236;
        const imgH = 342;

        if (state.userImage) {
            ctx.save();
            ctx.beginPath();
            ctx.roundRect(imgX, imgY, imgW, imgH, radius);
            ctx.clip();

            // Transformations for sizing and offseting
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

        // Decorative Bottom Left Poppers (moved to overlay image)
        if (state.poppersBottomImg) {
            const ratio = state.poppersBottomImg.height / state.poppersBottomImg.width;
            const pbWidth = 120;
            ctx.drawImage(state.poppersBottomImg, 24, canvas.height - (pbWidth * ratio) - 20, pbWidth, pbWidth * ratio);
        }

        // 7. Right Side Content Texts
        const textStartX = 520;

        // Let us Welcome Heading
        ctx.font = '39px KittenSwashMonolineTrial';
        ctx.fillStyle = '#190230';
        ctx.textAlign = 'left';
        ctx.fillText(state.heading, textStartX, 110);

        // Body Text Setting
        ctx.font = '20px JetBrainsMono';
        ctx.fillStyle = '#190230';
        const lineHeight = 40;
        const maxTextWidth = 600;

        let currentY = 180;

        // Draw the Greeting Paragraph
        currentY = wrapTextReturnsY(ctx, state.greeting, textStartX, currentY, maxTextWidth, lineHeight);
        currentY += 70; // gap before next section

        // Draw Experience Paragraph
        currentY = wrapTextReturnsY(ctx, state.experience, textStartX, currentY, maxTextWidth, lineHeight);
        currentY += 70; // gap before email

        // Draw Email
        ctx.font = '18px JetBrainsMono';
        wrapTextReturnsY(ctx, "Her email id : " + state.email, textStartX, currentY, maxTextWidth, lineHeight);
    }

    // Function to update the view when controls change
    function updateState() {
        state.heading = inputHeading.value;
        state.greeting = inputGreeting.value;
        state.experience = inputExperience.value;
        state.email = inputEmail.value;
        drawCanvas();
    }

    [inputHeading, inputGreeting, inputExperience, inputEmail].forEach(el =>
        el.addEventListener('input', updateState)
    );

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
        link.download = `Welcome_Poster.png`;
        link.href = canvas.toDataURL('image/png', 1.0);
        link.click();
    });

    // Image Editing Control Listeners
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

    // Handle preview resizing functionality
    function resizePreview() {
        const scale = 0.8; // Scale changed to 1 as requested
        canvas.style.transform = `scale(${scale})`;
        const container = document.getElementById('canvas-container');
        container.style.width = `${canvas.width * scale}px`;
        container.style.height = `${canvas.height * scale}px`;
    }

    window.addEventListener('resize', resizePreview);
    resizePreview();
    drawCanvas();

    // Attempt redraw shortly in case external assets finished loading
    setTimeout(drawCanvas, 1000);
});

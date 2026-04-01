document.addEventListener('DOMContentLoaded', async () => {

    // --- Asset Loading & Helpers ---

    // Function to load image
    function loadImage(src) {
        return new Promise((resolve, reject) => {
            if (!src) return resolve(null);
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => resolve(img);
            img.onerror = (e) => {
                console.warn(`Failed to load image: ${src}`, e);
                resolve(null); // Resolve null so we can continue
            };
            img.src = src;
        });
    }

    // Function to load fonts
    async function loadFonts() {
        console.log("Starting font loading...");

        // 1. Wait for document fonts initially
        try {
            await document.fonts.ready;
        } catch (e) {
            console.warn("Initial fonts ready wait failed", e);
        }

        // 2. Define local fonts
        const fontsToLoad = [
            { family: 'Scriptina', url: 'font/scriptin.ttf' },
            { family: 'Fredoka', url: 'font/fredoka-regular.ttf', weight: '400' },
            { family: 'Fredoka', url: 'font/fredoka-bold.ttf', weight: '700' },
            { family: 'FredokaSemiExpanded', url: 'font/fredoka_semiexpanded-regular.ttf' }
        ];

        // 3. Load all explicitly
        for (const fontInfo of fontsToLoad) {
            try {
                const font = new FontFace(fontInfo.family, `url(${fontInfo.url})`, { weight: fontInfo.weight || '400' });
                const loadedFont = await font.load();
                document.fonts.add(loadedFont);
                console.log(`Loaded font: ${fontInfo.family}`);
            } catch (err) {
                console.error(`Failed to load font ${fontInfo.family}:`, err);
            }
        }

        // 4. Final synchronization
        await document.fonts.ready;
        console.log("All fonts synchronized.");

        // 5. "Warm up" draw - sometimes needed for Canvas to recognize newly added fonts
        const warmUpCtx = document.createElement('canvas').getContext('2d');
        warmUpCtx.font = "10px Scriptina";
        warmUpCtx.fillText("a", 0, 0);
        warmUpCtx.font = "10px Fredoka";
        warmUpCtx.fillText("a", 0, 0);
        warmUpCtx.font = "10px FredokaSemiExpanded";
        warmUpCtx.fillText("a", 0, 0);
        warmUpCtx.font = "10px Poppins";
        warmUpCtx.fillText("a", 0, 0);
    }

    // Wrap text function
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

    // Helper for rounded rectangle (if needed, though polaroid is straight)
    function roundRect(ctx, x, y, w, h, r) {
        if (w < 2 * r) r = w / 2;
        if (h < 2 * r) r = h / 2;
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }

    // --- Initialization ---

    await loadFonts();

    // DOM Elements
    const inputYear = document.getElementById('input-year');
    const inputSuffix = document.getElementById('input-suffix');
    const inputQuote = document.getElementById('input-quote');
    const inputName = document.getElementById('input-name');
    const inputDesignation = document.getElementById('input-designation');
    const inputDepartment = document.getElementById('input-department');
    const inputDoj = document.getElementById('input-doj');
    const inputImage = document.getElementById('input-image');
    const hiddenImageInput = document.getElementById('hidden-image-input');
    const btnDownload = document.getElementById('btn-download');

    // Canvas
    const canvas = document.getElementById('image-canvas');
    if (!canvas) {
        console.error("Canvas element #image-canvas not found!");
        return;
    }
    const ctx = canvas.getContext('2d');

    // Set Canvas Size (Fixed 1080x1080)
    canvas.width = 1080;
    canvas.height = 1080;
    // Hide it from view if you only want the preview scaled
    // canvas.style.display = 'none'; 

    // Re-use logic to show preview? 
    // Actually, let's make the canvas THE preview.
    // But existing CSS layout is nice. Let's keep existing HTML preview for "Visual" 
    // and use Canvas purely for generation OR update canvas to be visible.
    // For now, let's update the existing HTML preview AND draw to canvas silently 
    // so it's ready for download.
    // OR: Replace #card content with <img src=canvas>? 
    // Let's stick to "Draw to hidden canvas, user sees HTML preview" for smooth editing speed, 
    // unless user specifically asked to "create image in canva using js" implying the RESULT should be canvas.
    // The specific request "create the design with js draw function" implies generation.

    // State
    let state = {
        year: inputYear.value,
        suffix: inputSuffix.value,
        quote: inputQuote.value,
        name: inputName.value,
        designation: inputDesignation.value,
        department: inputDepartment.value,
        doj: inputDoj.value,
        userImage: null, // Image Object
        bgImage: null,   // Image Object
        logoImage: null,  // Image Object
        // Image adjustments
        brightness: 0,
        contrast: 100,
        saturation: 100,
        rotation: 0,
        zoom: 1,
        offsetX: 0,
        offsetY: 0
    };

    // Load static assets
    const logoImg = await loadImage('kudometrics-logo.svg'); // Make sure this path is correct relative to index.html
    const defaultBg = await loadImage('background.png');
    state.bgImage = defaultBg;
    state.logoImage = logoImg;

    // --- Drawing Logic ---

    async function drawCanvas() {
        // 1. Clear
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 2. Background
        if (state.bgImage) {
            // Draw Cover
            const bgRatio = state.bgImage.width / state.bgImage.height;
            const canvasRatio = canvas.width / canvas.height;
            let dw, dh, dx, dy;

            if (bgRatio > canvasRatio) {
                dh = canvas.height;
                dw = dh * bgRatio;
                dy = 0;
                dx = (canvas.width - dw) / 2;
            } else {
                dw = canvas.width;
                dh = dw / bgRatio;
                dx = 0;
                dy = (canvas.height - dh) / 2;
            }
            ctx.drawImage(state.bgImage, dx, dy, dw, dh);
        } else {
            // Fallback Gradient
            const grd = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
            grd.addColorStop(0, '#f0f0f0');
            grd.addColorStop(1, '#0047AB');
            ctx.fillStyle = grd;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        // 3. Logo (Top Left)
        // CSS: width 74px, margin 48px padding?
        // Let's place it at x=48, y=48 approx
        if (state.logoImage) {
            ctx.drawImage(state.logoImage, 48, 48, 74, 82); // Aspect ratio approx from SVG viewbox
        }

        // 4. "Happy" Text
        // CSS: left-content padding 48px. 
        // Text is below logo.
        // font-family: 'Scriptina'; font-size: 78px; color: #707070;
        ctx.font = '78px Scriptina';
        ctx.fillStyle = '#707070';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        // Approximate position based on CSS
        ctx.fillText('Happy', 48, 250);

        // 5. Anniversary Title
        // "1st Work Anniversary"
        // Year: 73px Bold, Suffix: 60px Reg, Text: 60px SemiBold
        // Gradient: #0A6BC0 to #069EE1
        const titleX = 48;
        const titleY = 380;

        // Gradient for text
        const textGrad = ctx.createLinearGradient(titleX, titleY, titleX + 400, titleY);
        textGrad.addColorStop(0, '#0A6BC0');
        textGrad.addColorStop(1, '#069EE1');
        ctx.fillStyle = textGrad;

        // Draw Year
        ctx.font = '700 73px "Poppins", sans-serif';
        const yearText = state.year;
        ctx.fillText(yearText, titleX, titleY);
        const yearWidth = ctx.measureText(yearText).width;

        // Draw Suffix
        ctx.font = '400 60px "Poppins", sans-serif';
        const suffixText = state.suffix;
        ctx.fillText(suffixText, titleX + yearWidth, titleY + 10); // slightly lower baseline align? or same

        // Draw "Work Anniversary"
        // CSS says block display, so new line
        ctx.font = '600 60px "Poppins", sans-serif';
        ctx.fillText("Work", titleX, titleY + 80);
        ctx.fillText("Anniversary", titleX, titleY + 140);

        // 6. Quote
        // CSS: margin-top 10px, max-width 370px, font 26px Poppins, color #8D8D8D
        ctx.font = '26px "Poppins", sans-serif';
        ctx.fillStyle = '#707070';
        const quoteY = titleY + 230;
        wrapText(ctx, state.quote, titleX, quoteY, 340, 36);

        // 7. Right Side - Polaroid & Details
        // We need to rotate context for polaroid
        // Center of rotation?
        // Shifted right to avoid text overlap (was 700)

        ctx.save();

        // Setup Polaroid Transform
        const px = 760; // Pivot X (Moved right)
        const py = 440; // Pivot Y (Moved down slightly to center vertically)
        ctx.translate(px, py);
        ctx.rotate(12.43 * Math.PI / 180);

        // Draw Shadow
        ctx.shadowColor = "rgba(3, 32, 83, 0.45)";
        ctx.shadowBlur = 30;
        ctx.shadowOffsetX = -30;
        ctx.shadowOffsetY = 30;

        // Draw Frame
        // Calculated height based on CSS padding: 24(top) + 500(img) + 88(bottom) + border?
        // Let's use 640px height to be close to CSS visual
        const pWidth = 552;
        const pHeight = 640;
        const frameX = -pWidth / 2;
        const frameY = -pHeight / 2;

        // White Frame
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(frameX, frameY, pWidth, pHeight);

        // Reset Shadow for inner content
        ctx.shadowColor = "transparent";

        // Draw Image Area
        const imgW = pWidth - 48; // 24px padding each side
        const imgH = 500;
        const imgX = frameX + 24;
        const imgY = frameY + 24;

        ctx.fillStyle = "#eeeeee";
        ctx.fillRect(imgX, imgY, imgW, imgH);

        if (state.userImage) {
            // Save context for image transformations
            ctx.save();

            // Apply filters
            const brightnessFilter = 100 + (state.brightness * 2); // Convert -50 to 50 range to percentage
            const contrastFilter = state.contrast;
            const saturationFilter = state.saturation;

            ctx.filter = `brightness(${brightnessFilter}%) contrast(${contrastFilter}%) saturate(${saturationFilter}%)`;

            // 1. Define and apply clipping mask FIRST
            // This ensures the "window" stays fixed relative to the polaroid frame
            ctx.beginPath();
            ctx.rect(imgX, imgY, imgW, imgH);
            ctx.clip();

            // 2. Apply transformations (Rotation, then draw)
            // Calculate center point for rotation
            const centerX = imgX + imgW / 2;
            const centerY = imgY + imgH / 2;

            // Apply rotation
            ctx.translate(centerX, centerY);
            ctx.rotate((state.rotation * Math.PI) / 180);
            ctx.translate(-centerX, -centerY);

            // formatting: object-fit cover equivalent with zoom and pan
            const iRatio = state.userImage.width / state.userImage.height;
            const aRatio = imgW / imgH;
            let sx, sy, sWidth, sHeight;

            if (iRatio > aRatio) {
                sHeight = state.userImage.height;
                sWidth = sHeight * aRatio;
            } else {
                sWidth = state.userImage.width;
                sHeight = sWidth / aRatio;
            }

            // Apply zoom (reduce source window size)
            const zoom = state.zoom || 1;
            sWidth = sWidth / zoom;
            sHeight = sHeight / zoom;

            // Base center coordinates
            sx = (state.userImage.width - sWidth) / 2;
            sy = (state.userImage.height - sHeight) / 2;

            // Apply offsets (Panning)
            // Normalized to some extent so the slider feels intuitive
            sx -= (state.offsetX || 0);
            sy -= (state.offsetY || 0);

            ctx.drawImage(state.userImage, sx, sy, sWidth, sHeight, imgX, imgY, imgW, imgH);

            // Restore context
            ctx.restore();
        } else {
            // Placeholder text
            ctx.fillStyle = "#aaaaaa";
            ctx.font = '30px "Poppins", sans-serif';
            ctx.textAlign = "center";
            ctx.fillText("Upload Image", 0, -50); // relative to center due to translate
        }

        // Draw Name
        // Bottom area
        ctx.fillStyle = "#707070";
        ctx.font = '400 38px "FredokaSemiExpanded", sans-serif';
        ctx.textAlign = "center";

        // Center text in the bottom whitespace
        // Bottom space Y start = imgY + imgH
        // Bottom space height = pHeight - 24 - 500 = 116px
        // Center Y = imgY + imgH + (116/2) = imgY + imgH + 58
        // Need to add text baseline adjustment (~10px) if textBaseline is alphabetic (default)
        const nameY = imgY + imgH + 40;

        // Auto-scale text to fit imgW
        const allowedWidth = imgW; // 24px padding each side already accounted for in imgW

        ctx.font = '400 38px "FredokaSemiExpanded", sans-serif';
        let textMetrics = ctx.measureText(state.name);

        if (textMetrics.width > allowedWidth) {
            // Reduce to 28px if too wide
            ctx.font = '400 28px "FredokaSemiExpanded", sans-serif';
        }

        ctx.fillText(state.name, 0, nameY);

        ctx.restore();

        // 8. Details (Designation, Dept, DOJ)
        // Moved up to avoid cutoff and aligned right since polaroid moved right
        const detailsX = 520;
        const detailsY = 820;
        const maxDetailsWidth = 480; // Fixed max width for designation and department

        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "left";

        // Designation - with auto-scaling
        ctx.font = '800 36px "Poppins", sans-serif';
        if (ctx.measureText(state.designation).width > maxDetailsWidth) {
            ctx.font = '800 32px "Poppins", sans-serif';
            if (ctx.measureText(state.designation).width > maxDetailsWidth) {
                ctx.font = '800 28px "Poppins", sans-serif';
            }
        }
        ctx.fillText(state.designation, detailsX, detailsY);

        // Department - with auto-scaling
        ctx.font = '200 30px "Poppins", sans-serif';
        if (ctx.measureText(state.department).width > maxDetailsWidth) {
            ctx.font = '200 28px "Poppins", sans-serif';
            if (ctx.measureText(state.department).width > maxDetailsWidth) {
                ctx.font = '200 24px "Poppins", sans-serif';
            }
        }
        ctx.fillText(state.department, detailsX, detailsY + 50);

        // DOJ
        ctx.font = '500 20px "Poppins", sans-serif';
        ctx.fillText("DOJ : " + state.doj, detailsX, detailsY + 100);

        // 9. Footer
        // Bottom right
        ctx.font = '24px "Poppins", sans-serif';
        ctx.fillStyle = "#707070"; // or white depending on bg
        ctx.textAlign = "right";
        ctx.fillText("www.kudometrics.com", 1020, 1020);
    }

    // --- Interaction Listeners ---

    function updateState() {
        state.year = inputYear.value;
        state.suffix = inputSuffix.value;
        state.quote = inputQuote.value;
        state.name = inputName.value;
        state.designation = inputDesignation.value;
        state.department = inputDepartment.value;
        state.doj = inputDoj.value;

        drawCanvas();
    }

    // specific listeners
    const inputs = [inputYear, inputSuffix, inputQuote, inputName, inputDesignation, inputDepartment, inputDoj];
    inputs.forEach(el => el.addEventListener('input', updateState));

    // Image Uploads
    function handleFile(file, type) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                if (type === 'user') {
                    state.userImage = img;
                    toggleImageEditingSection();
                }
                drawCanvas();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    inputImage.addEventListener('change', (e) => {
        if (e.target.files[0]) handleFile(e.target.files[0], 'user');
    });
    hiddenImageInput.addEventListener('change', (e) => {
        if (e.target.files[0]) handleFile(e.target.files[0], 'user');
    });
    document.getElementById('photo-area').addEventListener('click', () => hiddenImageInput.click());

    // Scale Preview
    function resizePreview() {
        const canvas = document.getElementById('image-canvas');
        const container = document.getElementById('canvas-container');
        const previewArea = document.querySelector('.preview-area');

        if (!canvas || !container || !previewArea) return;

        const availableWidth = previewArea.clientWidth - 40; // padding
        const availableHeight = previewArea.clientHeight - 40;

        const scale = 0.75;

        // Apply scale via CSS transform for smooth rendering
        canvas.style.transform = `scale(${scale})`;

        // Set container size to match scaled canvas
        container.style.width = `${canvas.width * scale}px`;
        container.style.height = `${canvas.height * scale}px`;
    }

    window.addEventListener('resize', resizePreview);
    resizePreview(); // Initial call

    // --- Download ---
    btnDownload.addEventListener('click', () => {
        // Redraw one last time to be sure
        drawCanvas().then(() => {
            const link = document.createElement('a');
            link.download = `Anniversary_${state.name.replace(/\s+/g, '_')}.png`;
            // Get high quality blob
            // canvas.toBlob... or toDataURL
            link.href = canvas.toDataURL('image/png', 1.0);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    });

    // --- Image Editing Controls ---
    const imageEditingSection = document.getElementById('image-editing-section');
    const brightnessSlider = document.getElementById('brightness-slider');
    const contrastSlider = document.getElementById('contrast-slider');
    const saturationSlider = document.getElementById('saturation-slider');
    const rotationSlider = document.getElementById('rotation-slider');
    const zoomSlider = document.getElementById('zoom-slider');
    const offsetXSlider = document.getElementById('offset-x-slider');
    const offsetYSlider = document.getElementById('offset-y-slider');
    const resetBtn = document.getElementById('reset-adjustments');

    const brightnessValue = document.getElementById('brightness-value');
    const contrastValue = document.getElementById('contrast-value');
    const saturationValue = document.getElementById('saturation-value');
    const rotationValue = document.getElementById('rotation-value');
    const zoomValue = document.getElementById('zoom-value');
    const offsetXValue = document.getElementById('offset-x-value');
    const offsetYValue = document.getElementById('offset-y-value');

    // Brightness slider
    brightnessSlider.addEventListener('input', (e) => {
        state.brightness = parseInt(e.target.value);
        brightnessValue.textContent = state.brightness;
        drawCanvas();
    });

    // Contrast slider
    contrastSlider.addEventListener('input', (e) => {
        state.contrast = parseInt(e.target.value);
        contrastValue.textContent = state.contrast + '%';
        drawCanvas();
    });

    // Saturation slider
    saturationSlider.addEventListener('input', (e) => {
        state.saturation = parseInt(e.target.value);
        saturationValue.textContent = state.saturation + '%';
        drawCanvas();
    });

    // Rotation slider
    rotationSlider.addEventListener('input', (e) => {
        state.rotation = parseInt(e.target.value);
        rotationValue.textContent = state.rotation + '°';
        drawCanvas();
    });

    // Zoom slider
    zoomSlider.addEventListener('input', (e) => {
        state.zoom = parseFloat(e.target.value);
        zoomValue.textContent = state.zoom.toFixed(2) + 'x';
        drawCanvas();
    });

    // Offset X slider
    offsetXSlider.addEventListener('input', (e) => {
        state.offsetX = parseInt(e.target.value);
        offsetXValue.textContent = state.offsetX;
        drawCanvas();
    });

    // Offset Y slider
    offsetYSlider.addEventListener('input', (e) => {
        state.offsetY = parseInt(e.target.value);
        offsetYValue.textContent = state.offsetY;
        drawCanvas();
    });

    // Reset button
    resetBtn.addEventListener('click', () => {
        state.brightness = 0;
        state.contrast = 100;
        state.saturation = 100;
        state.rotation = 0;
        state.zoom = 1;
        state.offsetX = 0;
        state.offsetY = 0;

        brightnessSlider.value = 0;
        contrastSlider.value = 100;
        saturationSlider.value = 100;
        rotationSlider.value = 0;
        zoomSlider.value = 1;
        offsetXSlider.value = 0;
        offsetYSlider.value = 0;

        brightnessValue.textContent = '0';
        contrastValue.textContent = '100%';
        saturationValue.textContent = '100%';
        rotationValue.textContent = '0°';
        zoomValue.textContent = '1.0x';
        offsetXValue.textContent = '0';
        offsetYValue.textContent = '0';

        drawCanvas();
    });

    // Show/hide image editing section based on image upload
    function toggleImageEditingSection() {
        if (state.userImage) {
            imageEditingSection.style.display = 'flex';
        } else {
            imageEditingSection.style.display = 'none';
        }
    }

    // Initial Draw
    drawCanvas();
    toggleImageEditingSection();

    // Final defensive redraw after assets definitely loaded
    setTimeout(drawCanvas, 1000);
});

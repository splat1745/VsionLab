// Annotation Canvas Logic

export function initAnnotationCanvas(project) {
    const canvas = document.getElementById('annotation-canvas');
    const wrapper = document.getElementById('canvas-wrapper');
    if (!canvas || !wrapper) return;

    const ctx = canvas.getContext('2d');
    let isDrawing = false;
    let startX, startY;
    let currentTool = 'select';
    let annotations = []; // { x, y, w, h, label }
    let scale = 1;
    let offset = { x: 0, y: 0 };

    // Resize Canvas
    function resize() {
        canvas.width = wrapper.clientWidth;
        canvas.height = wrapper.clientHeight;
        draw();
    }
    window.addEventListener('resize', resize);
    resize();

    // Drawing Loop
    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        ctx.save();
        ctx.translate(offset.x, offset.y);
        ctx.scale(scale, scale);

        // Draw Image (Placeholder for now)
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(100, 100, 600, 400);
        ctx.strokeStyle = '#333';
        ctx.strokeRect(100, 100, 600, 400);
        
        // Draw Annotations
        annotations.forEach(ann => {
            ctx.strokeStyle = '#0070f3';
            ctx.lineWidth = 2;
            ctx.strokeRect(ann.x, ann.y, ann.w, ann.h);
            
            ctx.fillStyle = 'rgba(0, 112, 243, 0.2)';
            ctx.fillRect(ann.x, ann.y, ann.w, ann.h);
        });

        // Draw current selection
        if (isDrawing) {
            // Logic for drawing current box
        }

        ctx.restore();
    }

    // Event Listeners
    canvas.addEventListener('mousedown', (e) => {
        if (currentTool === 'bbox') {
            isDrawing = true;
            const rect = canvas.getBoundingClientRect();
            startX = (e.clientX - rect.left - offset.x) / scale;
            startY = (e.clientY - rect.top - offset.y) / scale;
        }
    });

    canvas.addEventListener('mousemove', (e) => {
        if (isDrawing) {
            const rect = canvas.getBoundingClientRect();
            const currentX = (e.clientX - rect.left - offset.x) / scale;
            const currentY = (e.clientY - rect.top - offset.y) / scale;
            
            draw();
            
            // Draw preview
            ctx.save();
            ctx.translate(offset.x, offset.y);
            ctx.scale(scale, scale);
            ctx.strokeStyle = '#00ff00';
            ctx.strokeRect(startX, startY, currentX - startX, currentY - startY);
            ctx.restore();
        }
    });

    canvas.addEventListener('mouseup', (e) => {
        if (isDrawing) {
            isDrawing = false;
            const rect = canvas.getBoundingClientRect();
            const endX = (e.clientX - rect.left - offset.x) / scale;
            const endY = (e.clientY - rect.top - offset.y) / scale;
            
            const w = endX - startX;
            const h = endY - startY;

            if (Math.abs(w) > 5 && Math.abs(h) > 5) {
                annotations.push({
                    x: startX,
                    y: startY,
                    w: w,
                    h: h,
                    label: 'Object'
                });
            }
            draw();
        }
    });

    // Tool Selection
    document.querySelectorAll('[data-tool]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('[data-tool]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentTool = btn.dataset.tool;
        });
    });

    console.log('Canvas initialized for project:', project.name);
}

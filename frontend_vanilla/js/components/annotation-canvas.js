// Annotation Canvas Logic
// Annotation Canvas Logic
(function() {
    function initAnnotationCanvas(project, image) {
        const canvas = document.getElementById('annotation-canvas');
        const wrapper = document.getElementById('canvas-wrapper');
        if (!canvas || !wrapper) return;

        const ctx = canvas.getContext('2d');
        let isDrawing = false;
        let startX, startY;
        let currentTool = 'select';
        let annotations = []; 
        let scale = 1;
        let offset = { x: 0, y: 0 };
        let imgObj = null;

        // Load Image
        if (image) {
            imgObj = new Image();
            imgObj.src = `http://localhost:8000/api/images/${image.id}/file`; // Direct backend URL for now
            imgObj.onload = () => {
                // Fit image to canvas
                const scaleX = wrapper.clientWidth / imgObj.width;
                const scaleY = wrapper.clientHeight / imgObj.height;
                scale = Math.min(scaleX, scaleY) * 0.9;
                
                // Center image
                offset.x = (wrapper.clientWidth - imgObj.width * scale) / 2;
                offset.y = (wrapper.clientHeight - imgObj.height * scale) / 2;
                
                draw();
            };
        }

        function resize() {
            canvas.width = wrapper.clientWidth;
            canvas.height = wrapper.clientHeight;
            draw();
        }
        window.addEventListener('resize', resize);
        resize();

        function draw() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            ctx.save();
            ctx.translate(offset.x, offset.y);
            ctx.scale(scale, scale);

            if (imgObj) {
                ctx.drawImage(imgObj, 0, 0);
            } else {
                // Placeholder if no image
                ctx.fillStyle = '#1a1a1a';
                ctx.fillRect(0, 0, 800, 600);
                ctx.fillStyle = '#666';
                ctx.font = '24px Inter';
                ctx.fillText('No image selected', 300, 300);
            }
            
            annotations.forEach(ann => {
                ctx.strokeStyle = '#0070f3';
                ctx.lineWidth = 2 / scale; // Keep line width constant visually
                ctx.strokeRect(ann.x, ann.y, ann.w, ann.h);
                
                ctx.fillStyle = 'rgba(0, 112, 243, 0.2)';
                ctx.fillRect(ann.x, ann.y, ann.w, ann.h);
            });

            ctx.restore();
        }

        canvas.addEventListener('mousedown', (e) => {
            if (currentTool === 'bbox' && imgObj) {
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
                
                ctx.save();
                ctx.translate(offset.x, offset.y);
                ctx.scale(scale, scale);
                ctx.strokeStyle = '#00ff00';
                ctx.lineWidth = 2 / scale;
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
                    const newAnn = {
                        x: startX,
                        y: startY,
                        w: w,
                        h: h,
                        label: 'Object'
                    };
                    annotations.push(newAnn);
                    saveAnnotation(newAnn);
                }
                draw();
            }
        });

        async function saveAnnotation(ann) {
            if (!image) return;
            try {
                // Convert to backend format (normalized or pixel)
                // Assuming pixel for now based on previous context
                const data = {
                    image_id: image.id,
                    label: ann.label,
                    bbox: [ann.x, ann.y, ann.w, ann.h]
                };
                // await window.VisionLab.api.post(`/annotations`, data);
                console.log('Annotation saved (mock):', data);
            } catch (error) {
                console.error('Failed to save annotation:', error);
            }
        }

        document.querySelectorAll('[data-tool]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('[data-tool]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentTool = btn.dataset.tool;
            });
        });

        console.log('Canvas initialized for project:', project.name);
    }

    window.VisionLab.components.initAnnotationCanvas = initAnnotationCanvas;
})();

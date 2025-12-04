// Universe View
(function() {
    async function renderUniverse() {
        const main = document.getElementById('main-view');
        
        main.innerHTML = `
            <div class="view-container">
                <div class="flex justify-between items-center mb-6">
                    <div>
                        <h1>Model Universe</h1>
                        <p>Explore and download pre-trained models</p>
                    </div>
                    <div class="flex gap-2">
                        <input type="text" class="form-control" placeholder="Search models..." style="width: 250px;">
                    </div>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" id="universe-grid">
                    <!-- Mock Data for now -->
                    <div class="card">
                        <div class="card-header">
                            <div class="flex justify-between items-start">
                                <div class="badge badge-success mb-2">YOLOv8</div>
                                <i class="fas fa-star text-warning"></i>
                            </div>
                            <h3 class="card-title">YOLOv8n-COCO</h3>
                            <p class="card-description">Pre-trained YOLOv8 nano model on COCO dataset. Fast and efficient.</p>
                        </div>
                        <div class="card-content">
                            <div class="flex justify-between text-sm text-muted mb-2">
                                <span>mAP: 37.3</span>
                                <span>Size: 6.2MB</span>
                            </div>
                        </div>
                        <div class="card-footer">
                            <button class="btn btn-secondary w-full">Download</button>
                        </div>
                    </div>

                    <div class="card">
                        <div class="card-header">
                            <div class="flex justify-between items-start">
                                <div class="badge badge-success mb-2">YOLOv8</div>
                            </div>
                            <h3 class="card-title">YOLOv8s-COCO</h3>
                            <p class="card-description">Small version of YOLOv8. Better accuracy than nano.</p>
                        </div>
                        <div class="card-content">
                            <div class="flex justify-between text-sm text-muted mb-2">
                                <span>mAP: 44.9</span>
                                <span>Size: 22.5MB</span>
                            </div>
                        </div>
                        <div class="card-footer">
                            <button class="btn btn-secondary w-full">Download</button>
                        </div>
                    </div>

                    <div class="card">
                        <div class="card-header">
                            <div class="flex justify-between items-start">
                                <div class="badge badge-primary mb-2">ResNet</div>
                            </div>
                            <h3 class="card-title">ResNet50</h3>
                            <p class="card-description">Standard backbone for classification tasks.</p>
                        </div>
                        <div class="card-content">
                            <div class="flex justify-between text-sm text-muted mb-2">
                                <span>Acc: 76.1%</span>
                                <span>Size: 98MB</span>
                            </div>
                        </div>
                        <div class="card-footer">
                            <button class="btn btn-secondary w-full">Download</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    window.VisionLab.views.universe = renderUniverse;
})();

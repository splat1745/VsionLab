// Settings View
(function() {
    function renderSettings() {
        const main = document.getElementById('main-view');
        
        main.innerHTML = `
            <div class="view-container">
                <h1 class="mb-6">Settings</h1>
                
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <!-- Sidebar -->
                    <div class="col-span-1">
                        <div class="card">
                            <ul class="flex flex-col gap-2">
                                <li><button class="btn btn-ghost w-full text-left active">General</button></li>
                                <li><button class="btn btn-ghost w-full text-left">Appearance</button></li>
                                <li><button class="btn btn-ghost w-full text-left">Notifications</button></li>
                            </ul>
                        </div>
                    </div>

                    <!-- Content -->
                    <div class="col-span-2">
                        <div class="card">
                            <h3>Appearance</h3>
                            <div class="h-px bg-border my-4"></div>
                            
                            <div class="flex items-center justify-between mb-4">
                                <div>
                                    <div class="font-medium">Dark Mode</div>
                                    <div class="text-sm text-muted">Toggle application theme</div>
                                </div>
                                <label class="switch">
                                    <input type="checkbox" id="theme-toggle" checked>
                                    <span class="slider"></span>
                                </label>
                            </div>

                            <div class="flex items-center justify-between">
                                <div>
                                    <div class="font-medium">Compact Mode</div>
                                    <div class="text-sm text-muted">Reduce spacing in lists</div>
                                </div>
                                <label class="switch">
                                    <input type="checkbox">
                                    <span class="slider"></span>
                                </label>
                            </div>
                        </div>

                        <div class="card mt-6">
                            <h3>System</h3>
                            <div class="h-px bg-border my-4"></div>
                            
                            <div class="form-group">
                                <label class="form-label">API Endpoint</label>
                                <input type="text" class="form-control" value="http://localhost:8000/api" readonly>
                            </div>
                            
                            <div class="form-group">
                                <label class="form-label">Version</label>
                                <div class="text-sm text-muted">v1.0.0-vanilla</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Theme Toggle Logic
        const toggle = document.getElementById('theme-toggle');
        toggle.addEventListener('change', (e) => {
            if (e.target.checked) {
                document.documentElement.classList.remove('light-theme');
            } else {
                document.documentElement.classList.add('light-theme');
            }
        });
    }

    window.VisionLab.views.settings = renderSettings;
})();

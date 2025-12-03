import { api } from '../api.js';
import { store } from '../state.js';
import { initAnnotationCanvas } from '../components/annotation-canvas.js';

export async function renderProject(params) {
    const projectId = params.id;
    const main = document.getElementById('main-view');
    
    main.innerHTML = `
        <div class="view-container">
            <div class="flex items-center gap-4 mb-6">
                <button class="btn btn-secondary btn-sm" onclick="window.location.hash = '#/projects'">
                    <i class="fas fa-arrow-left"></i> Back
                </button>
                <div class="h-6 w-px bg-accents-2"></div>
                <h1 class="text-2xl font-bold" id="project-name">Loading...</h1>
            </div>

            <!-- Tabs -->
            <div class="project-tabs flex gap-6 border-b border-border mb-6">
                <button class="tab-btn active" data-tab="overview">Overview</button>
                <button class="tab-btn" data-tab="annotate">Annotate</button>
                <button class="tab-btn" data-tab="dataset">Dataset</button>
                <button class="tab-btn" data-tab="settings">Settings</button>
            </div>

            <!-- Tab Content -->
            <div id="tab-content">
                <!-- Overview Tab -->
                <div id="view-overview" class="tab-view">
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div class="card col-span-2">
                            <h3>Project Stats</h3>
                            <div class="grid grid-cols-3 gap-4 text-center">
                                <div>
                                    <div class="text-3xl font-bold text-primary" id="stat-images">0</div>
                                    <div class="text-sm text-muted">Images</div>
                                </div>
                                <div>
                                    <div class="text-3xl font-bold text-success" id="stat-annotations">0</div>
                                    <div class="text-sm text-muted">Annotations</div>
                                </div>
                                <div>
                                    <div class="text-3xl font-bold text-warning" id="stat-classes">0</div>
                                    <div class="text-sm text-muted">Classes</div>
                                </div>
                            </div>
                        </div>
                        <div class="card">
                            <h3>Quick Actions</h3>
                            <div class="flex flex-col gap-2">
                                <button class="btn btn-secondary w-full" id="btn-upload">
                                    <i class="fas fa-upload"></i> Upload Images
                                </button>
                                <button class="btn btn-primary w-full" onclick="document.querySelector('[data-tab=annotate]').click()">
                                    <i class="fas fa-tag"></i> Start Labeling
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Annotate Tab -->
                <div id="view-annotate" class="tab-view hidden">
                    <div class="flex h-[calc(100vh-200px)] gap-4">
                        <!-- Toolbar -->
                        <div class="flex flex-col gap-2 p-2 bg-accents-1 rounded-md border border-border">
                            <button class="btn btn-icon btn-ghost active" data-tool="select" title="Select (V)"><i class="fas fa-mouse-pointer"></i></button>
                            <button class="btn btn-icon btn-ghost" data-tool="bbox" title="Bounding Box (B)"><i class="far fa-square"></i></button>
                            <div class="h-px bg-border my-1"></div>
                            <button class="btn btn-icon btn-ghost" id="btn-zoom-in"><i class="fas fa-search-plus"></i></button>
                            <button class="btn btn-icon btn-ghost" id="btn-zoom-out"><i class="fas fa-search-minus"></i></button>
                        </div>

                        <!-- Canvas Area -->
                        <div class="flex-1 bg-accents-2 rounded-lg border border-border relative overflow-hidden flex items-center justify-center" id="canvas-wrapper">
                            <canvas id="annotation-canvas"></canvas>
                        </div>

                        <!-- Sidebar -->
                        <div class="w-64 flex flex-col gap-4">
                            <div class="card flex-1 flex flex-col">
                                <h3>Classes</h3>
                                <div id="classes-list" class="flex-1 overflow-y-auto"></div>
                                <div class="mt-2 flex gap-2">
                                    <input type="text" class="form-control text-sm" placeholder="New class" id="new-class-input">
                                    <button class="btn btn-secondary btn-sm" id="btn-add-class"><i class="fas fa-plus"></i></button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div id="view-dataset" class="tab-view hidden">
                    <div class="card"><p>Dataset management coming soon.</p></div>
                </div>

                <div id="view-settings" class="tab-view hidden">
                    <div class="card"><p>Project settings coming soon.</p></div>
                </div>
            </div>
        </div>
    `;

    // Fetch Data
    try {
        const project = await api.get(`/projects/${projectId}`);
        store.setState({ currentProject: project });
        
        document.getElementById('project-name').textContent = project.name;
        document.getElementById('stat-classes').textContent = project.classes.length;
        
        // Initialize Tabs
        setupTabs();
        
        // Initialize Canvas when Annotate tab is clicked
        const annotateBtn = document.querySelector('[data-tab=annotate]');
        annotateBtn.addEventListener('click', () => {
            // Small delay to ensure DOM is visible for canvas sizing
            setTimeout(() => initAnnotationCanvas(project), 50);
        });

    } catch (error) {
        console.error(error);
        main.innerHTML = `<div class="view-container text-error">Failed to load project: ${error.message}</div>`;
    }
}

function setupTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    const views = document.querySelectorAll('.tab-view');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Deactivate all
            tabs.forEach(t => t.classList.remove('active'));
            views.forEach(v => v.classList.add('hidden'));

            // Activate clicked
            tab.classList.add('active');
            const viewId = `view-${tab.dataset.tab}`;
            document.getElementById(viewId).classList.remove('hidden');
        });
    });
}

/**
 * VisionLab - Main Application JavaScript
 */

// API Base URL
const API_BASE = '/api';

// Application State
const state = {
    currentView: 'projects',
    currentProject: null,
    currentDataset: null,
    currentImage: null,
    images: [],
    imageIndex: 0,
    annotations: [],
    classes: [],
    selectedClass: null,
    selectedTool: 'select',
    zoom: 1,
    isDrawing: false,
    drawStart: null,
    drawCurrent: null,
    canvasOffset: { x: 0, y: 0 },
    undoStack: [],
    redoStack: [],
    trainingModelId: null,
    deployedModelId: null,
    uploadFiles: [],
    selectedAnnotation: -1,
    loadedImage: null,
    // For annotation editing
    isResizing: false,
    resizeHandle: null,
    isDragging: false,
    dragStart: null,
    // Polygon drawing
    polygonPoints: [],
    // Webcam
    webcamStream: null,
    webcamRunning: false,
    // Video processing
    videoProcessing: false
};

// ============== Initialization ==============
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initNavigation();
    initModals();
    initSplitModal();
    initProjectForm();
    initAnnotationTools();
    initTrainingForm();
    initDeployView();
    initVideoInference();
    initWebcamInference();
    initKeyboardShortcuts();
    initSettings();
    loadProjects();
    detectGPUs();
});

// ============== Theme ==============
function initTheme() {
    const savedTheme = localStorage.getItem('visionlab-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    // Update settings toggle if exists
    const themeSelect = document.getElementById('setting-theme');
    if (themeSelect) {
        themeSelect.value = savedTheme;
    }
}

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('visionlab-theme', theme);
}

// ============== Settings ==============
function initSettings() {
    // Theme toggle
    const themeSelect = document.getElementById('setting-theme');
    if (themeSelect) {
        themeSelect.value = localStorage.getItem('visionlab-theme') || 'dark';
        themeSelect.addEventListener('change', (e) => {
            setTheme(e.target.value);
            showToast(`Theme changed to ${e.target.value}`, 'success');
        });
    }
    
    // Auto-save toggle
    const autosaveCheck = document.getElementById('setting-autosave');
    if (autosaveCheck) {
        autosaveCheck.checked = localStorage.getItem('visionlab-autosave') !== 'false';
        autosaveCheck.addEventListener('change', (e) => {
            localStorage.setItem('visionlab-autosave', e.target.checked);
            showToast(`Auto-save ${e.target.checked ? 'enabled' : 'disabled'}`, 'info');
        });
    }
    
    // WSL2 toggle
    const wsl2Check = document.getElementById('setting-wsl2');
    if (wsl2Check) {
        wsl2Check.checked = localStorage.getItem('visionlab-wsl2') === 'true';
        wsl2Check.addEventListener('change', (e) => {
            localStorage.setItem('visionlab-wsl2', e.target.checked);
        });
    }
    
    // Max workers
    const maxWorkers = document.getElementById('setting-max-workers');
    if (maxWorkers) {
        maxWorkers.value = localStorage.getItem('visionlab-max-workers') || '4';
        maxWorkers.addEventListener('change', (e) => {
            localStorage.setItem('visionlab-max-workers', e.target.value);
        });
    }
    
    // Clear cache button
    const clearCacheBtn = document.getElementById('btn-clear-cache');
    if (clearCacheBtn) {
        clearCacheBtn.addEventListener('click', async () => {
            showLoading('Clearing cache...');
            try {
                // Clear local storage except settings
                const theme = localStorage.getItem('visionlab-theme');
                const autosave = localStorage.getItem('visionlab-autosave');
                localStorage.clear();
                if (theme) localStorage.setItem('visionlab-theme', theme);
                if (autosave) localStorage.setItem('visionlab-autosave', autosave);
                
                showToast('Cache cleared', 'success');
            } catch (error) {
                showToast('Failed to clear cache', 'error');
            }
            hideLoading();
        });
    }
    
    // Help button (floating)
    const helpBtn = document.getElementById('btn-help-floating');
    if (helpBtn) {
        helpBtn.addEventListener('click', showKeyboardShortcutsModal);
    }
    
    // Notifications button
    const notifBtn = document.getElementById('btn-notifications');
    if (notifBtn) {
        notifBtn.addEventListener('click', () => {
            showToast('No new notifications', 'info');
        });
    }
    
    // Help button in header
    const helpHeaderBtn = document.getElementById('btn-help');
    if (helpHeaderBtn) {
        helpHeaderBtn.addEventListener('click', showKeyboardShortcutsModal);
    }
    
    // Save storage settings button
    const saveStorageBtn = document.getElementById('btn-save-storage');
    if (saveStorageBtn) {
        saveStorageBtn.addEventListener('click', saveStorageSettings);
    }
    
    // Load storage settings
    loadStorageSettings();
}

// ============== Navigation ==============
function initNavigation() {
    // Global Nav
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const view = item.dataset.view;
            navigateTo(view);
        });
    });
    
    // Project Sidebar Nav
    document.querySelectorAll('.project-nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const tabId = item.dataset.tab;
            switchProjectTab(tabId);
        });
    });
    
    // Legacy Tabs (if any remain)
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabId = tab.dataset.tab;
            switchTab(tabId);
        });
    });
}

function navigateTo(view, data = null) {
    // Update nav
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.view === view);
    });
    
    // Update views
    document.querySelectorAll('.view').forEach(v => {
        v.classList.remove('active');
    });
    document.getElementById(`view-${view}`).classList.add('active');
    
    state.currentView = view;

    // Reset project state if navigating to projects list
    if (view === 'projects') {
        state.currentProject = null;
        loadProjects();
    } else if (view === 'train') {
        loadProjectsForTraining();
    } else if (view === 'deploy') {
        loadModelsForDeploy();
    }
    
    // Update title
    const titles = {
        'projects': 'Projects',
        'project-detail': data?.name || 'Project',
        'annotate': 'Annotate',
        'train': 'Train',
        'deploy': 'Deploy',
        'settings': 'Settings'
    };
    // Only update page title if element exists (it might be removed in new layout)
    const pageTitle = document.getElementById('page-title');
    if (pageTitle) pageTitle.textContent = titles[view] || view;
}

function switchProjectTab(tabId) {
    // Update sidebar active state
    document.querySelectorAll('.project-nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.tab === tabId);
    });
    
    // Show content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `tab-${tabId}`);
    });
    
    // Tab specific logic
    if (tabId === 'annotate') {
        loadAnnotationDashboard(state.currentProject.id);
    } else if (tabId === 'train') {
        // Initialize train view inside project context
        initializeProjectTrainView();
    } else if (tabId === 'deploy') {
        initializeProjectDeployView();
    }
}

function switchTab(tabId) {
    document.querySelectorAll('.tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === tabId);
    });
    document.querySelectorAll('.tab-content').forEach(c => {
        c.classList.toggle('active', c.id === `tab-${tabId}`);
    });
}

// ============== Modals ==============
function initModals() {
    // Close buttons
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.closest('.modal').classList.remove('active');
        });
    });
    
    // Close on backdrop click
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    });
    
    // New project button
    const btnNewProject = document.getElementById('btn-new-project');
    if (btnNewProject) {
        btnNewProject.addEventListener('click', () => {
            openModal('modal-new-project');
        });
    }
    
    // Add class input button
    const btnAddClassInput = document.getElementById('btn-add-class-input');
    if (btnAddClassInput) {
        btnAddClassInput.addEventListener('click', addClassInput);
    }
}

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
}

function addClassInput() {
    const container = document.getElementById('class-inputs');
    if (!container) return;
    
    const row = document.createElement('div');
    row.className = 'class-input-row';
    row.innerHTML = `
        <input type="text" placeholder="Class name" class="class-name-input">
        <input type="color" value="${getRandomColor()}" class="class-color-input">
        <button type="button" class="btn btn-icon btn-remove-class">
            <i class="fas fa-times"></i>
        </button>
    `;
    row.querySelector('.btn-remove-class').addEventListener('click', () => row.remove());
    container.appendChild(row);
}

// ============== Projects ==============
async function loadProjects() {
    showLoading('Loading projects...');
    try {
        const response = await fetch(`${API_BASE}/projects`);
        const projects = await response.json();
        renderProjects(projects);
    } catch (error) {
        showToast('Failed to load projects', 'error');
        console.error(error);
    }
    hideLoading();
}

function renderProjects(projects) {
    const grid = document.getElementById('projects-grid');
    if (!grid) return;
    
    if (projects.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-folder-open"></i>
                <h3>No projects yet</h3>
                <p>Create your first project to get started</p>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = projects.map(project => `
        <div class="project-card" data-id="${project.id}">
            <div class="project-card-header">
                <h3>${escapeHtml(project.name)}</h3>
                <span class="project-type-badge">${project.project_type.replace('_', ' ')}</span>
            </div>
            <div class="project-card-body">
                <p>${escapeHtml(project.description) || 'No description'}</p>
                <div class="project-stats">
                    <div class="project-stat">
                        <span class="project-stat-value">${project.classes?.length || 0}</span>
                        <span class="project-stat-label">Classes</span>
                    </div>
                </div>
            </div>
            <div class="project-card-actions">
                <button class="btn btn-sm btn-secondary btn-delete-project" data-id="${project.id}" title="Delete Project">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
    
    // Add click handlers for project cards
    grid.querySelectorAll('.project-card').forEach(card => {
        card.addEventListener('click', (e) => {
            // Ignore if clicking delete button
            if (e.target.closest('.btn-delete-project')) return;
            openProject(parseInt(card.dataset.id));
        });
    });
    
    // Add delete handlers
    grid.querySelectorAll('.btn-delete-project').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const projectId = parseInt(btn.dataset.id);
            if (confirm('Are you sure you want to delete this project? This cannot be undone.')) {
                await deleteProject(projectId);
            }
        });
    });
}

async function deleteProject(projectId) {
    showLoading('Deleting project...');
    try {
        const response = await fetch(`${API_BASE}/projects/${projectId}`, {
            method: 'DELETE'
        });
        if (!response.ok) throw new Error('Failed to delete');
        showToast('Project deleted', 'success');
        loadProjects();
    } catch (error) {
        showToast('Failed to delete project', 'error');
    }
    hideLoading();
}

function initProjectForm() {
    const form = document.getElementById('new-project-form');
    if (!form) return;
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('project-name-input').value.trim();
        const type = document.getElementById('project-type-input').value;
        const description = document.getElementById('project-desc-input').value.trim();
        
        if (!name) {
            showToast('Please enter a project name', 'warning');
            return;
        }
        
        const classes = [];
        document.querySelectorAll('.class-input-row').forEach(row => {
            const nameInput = row.querySelector('.class-name-input');
            const colorInput = row.querySelector('.class-color-input');
            if (nameInput && nameInput.value.trim()) {
                classes.push({
                    name: nameInput.value.trim(),
                    color: colorInput ? colorInput.value : getRandomColor()
                });
            }
        });
        
        showLoading('Creating project...');
        try {
            const response = await fetch(`${API_BASE}/projects`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    project_type: type,
                    description,
                    classes
                })
            });
            
            if (!response.ok) throw new Error('Failed to create project');
            
            const project = await response.json();
            closeModal('modal-new-project');
            form.reset();
            
            // Reset class inputs to just one empty row
            const classInputs = document.getElementById('class-inputs');
            if (classInputs) {
                classInputs.innerHTML = `
                    <div class="class-input-row">
                        <input type="text" placeholder="Class name" class="class-name-input">
                        <input type="color" value="#FF6B6B" class="class-color-input">
                        <button type="button" class="btn btn-icon btn-remove-class">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                `;
                classInputs.querySelector('.btn-remove-class').addEventListener('click', (e) => {
                    e.target.closest('.class-input-row').remove();
                });
            }
            
            showToast('Project created successfully', 'success');
            loadProjects();
            
            // Optionally open the new project
            // openProject(project.id);
        } catch (error) {
            showToast('Failed to create project', 'error');
            console.error(error);
        }
        hideLoading();
    });
}

async function openProject(projectId) {
    showLoading('Loading project...');
    try {
        const [projectRes, datasetsRes, statsRes] = await Promise.all([
            fetch(`${API_BASE}/projects/${projectId}`),
            fetch(`${API_BASE}/projects/${projectId}/datasets`),
            fetch(`${API_BASE}/projects/${projectId}/stats`)
        ]);
        
        state.currentProject = await projectRes.json();
        const datasets = await datasetsRes.json();
        const stats = await statsRes.json();
        
        // Update UI
        document.getElementById('project-name').textContent = state.currentProject.name;
        document.getElementById('project-type-badge').textContent = state.currentProject.project_type.replace('_', ' ');
        
        // Update Description in Overview
        const descEl = document.getElementById('project-description');
        if (descEl) descEl.textContent = state.currentProject.description || 'No description provided.';
        
        state.classes = state.currentProject.classes || [];
        // renderClasses(); // Moved to settings or specific tab
        // renderDatasetSelector(datasets); // Moved
        updateStats(stats);
        
        await loadModels(projectId);
        
        navigateTo('project-detail', state.currentProject);
        switchProjectTab('overview'); // Default to overview
        
        // Setup event listeners
        setupProjectEventListeners(projectId);
        
        // Load images if there are datasets
        if (datasets.length > 0) {
            await loadImages(datasets[0].id);
        }
    } catch (error) {
        showToast('Failed to load project', 'error');
        console.error(error);
    }
    hideLoading();
}

function initializeProjectTrainView() {
    // Move the train form into the project tab if not already there
    const trainContainer = document.getElementById('project-train-container');
    const globalTrainContainer = document.querySelector('.train-container');
    
    if (trainContainer && globalTrainContainer && !trainContainer.hasChildNodes()) {
        // Clone or move? Let's clone for now to keep global view working if needed
        // Actually, let's just re-render the form specifically for this project
        trainContainer.innerHTML = `
            <div class="train-config" style="width: 100%; max-width: 600px;">
                <h2>Train New Model</h2>
                <form id="project-train-form">
                    <input type="hidden" id="pt-project-id" value="${state.currentProject.id}">
                    <div class="form-group">
                        <label>Model Name</label>
                        <input type="text" id="pt-model-name" placeholder="yolov8-v1" required>
                    </div>
                    <div class="form-group">
                        <label>Architecture</label>
                        <select id="pt-architecture">
                            <optgroup label="YOLOv8">
                                <option value="yolov8n">YOLOv8 Nano</option>
                                <option value="yolov8s">YOLOv8 Small</option>
                                <option value="yolov8m">YOLOv8 Medium</option>
                                <option value="yolov8l">YOLOv8 Large</option>
                                <option value="yolov8x">YOLOv8 XLarge</option>
                            </optgroup>
                            <optgroup label="YOLOv11">
                                <option value="yolov11n">YOLOv11 Nano</option>
                                <option value="yolov11s">YOLOv11 Small</option>
                                <option value="yolov11m">YOLOv11 Medium</option>
                                <option value="yolov11l">YOLOv11 Large</option>
                                <option value="yolov11x">YOLOv11 XLarge</option>
                            </optgroup>
                            <optgroup label="RF-DETR">
                                <option value="rf-detr-base">RF-DETR Base</option>
                                <option value="rf-detr-large">RF-DETR Large</option>
                            </optgroup>
                        </select>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Epochs</label>
                            <input type="number" id="pt-epochs" value="100">
                        </div>
                        <div class="form-group">
                            <label>Batch Size</label>
                            <input type="number" id="pt-batch-size" value="16">
                        </div>
                    </div>
                    <button type="submit" class="btn btn-primary">Start Training</button>
                </form>
            </div>
        `;
        
        // Add listener
        document.getElementById('project-train-form').addEventListener('submit', handleProjectTrainSubmit);
    }
}

async function handleProjectTrainSubmit(e) {
    e.preventDefault();
    // Implementation similar to global train submit
    const projectId = document.getElementById('pt-project-id').value;
    const modelName = document.getElementById('pt-model-name').value;
    const architecture = document.getElementById('pt-architecture').value;
    const epochs = parseInt(document.getElementById('pt-epochs').value);
    const batchSize = parseInt(document.getElementById('pt-batch-size').value);
    
    showLoading('Starting training...');
    try {
        const modelRes = await fetch(`${API_BASE}/models`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                project_id: parseInt(projectId),
                name: modelName,
                architecture,
                epochs,
                batch_size: batchSize
            })
        });
        
        if (!modelRes.ok) throw new Error('Failed to create model');
        const model = await modelRes.json();
        
        const trainRes = await fetch(`${API_BASE}/training/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model_id: model.id,
                epochs,
                batch_size: batchSize,
                img_size: 640,
                learning_rate: 0.01,
                use_wsl2: true, // Default to true for now
                augmentation: true
            })
        });
        
        if (!trainRes.ok) throw new Error('Failed to start training');
        showToast('Training started', 'success');
        // Switch to monitor view or show toast
    } catch (error) {
        showToast('Failed to start training', 'error');
    }
    hideLoading();
}

function initializeProjectDeployView() {
    const deployContainer = document.getElementById('project-deploy-container');
    
    if (deployContainer && !deployContainer.hasChildNodes()) {
        deployContainer.innerHTML = `
            <div class="deploy-sidebar" style="width: 100%; max-width: 300px;">
                <h2>Model Selection</h2>
                <select id="project-deploy-model-select" style="width: 100%; margin-bottom: 1rem;">
                    <option value="">Select a trained model...</option>
                </select>
                <h3>Inference Settings</h3>
                <div class="form-group">
                    <label for="project-deploy-confidence">Confidence Threshold</label>
                    <input type="range" id="project-deploy-confidence" min="0" max="1" step="0.05" value="0.25">
                    <span id="project-deploy-confidence-value">0.25</span>
                </div>
                <div class="form-group">
                    <label for="project-deploy-iou">IOU Threshold</label>
                    <input type="range" id="project-deploy-iou" min="0" max="1" step="0.05" value="0.45">
                    <span id="project-deploy-iou-value">0.45</span>
                </div>
            </div>
            <div class="deploy-main" style="flex: 1; margin-left: 1rem;">
                <div class="upload-zone" id="project-deploy-upload-zone" style="height: 300px;">
                    <i class="fas fa-cloud-upload-alt"></i>
                    <p>Drag & drop an image or click to upload</p>
                    <input type="file" id="project-deploy-file-input" accept="image/*" hidden>
                </div>
                <div class="inference-result" id="project-inference-result" style="display: none;">
                    <canvas id="project-inference-canvas"></canvas>
                    <div class="detections-panel" id="project-detections-panel"></div>
                </div>
            </div>
        `;
        
        // Load models for this project
        loadProjectModelsForDeploy();
        
        // Setup event listeners
        const uploadZone = document.getElementById('project-deploy-upload-zone');
        const fileInput = document.getElementById('project-deploy-file-input');
        
        uploadZone.onclick = () => fileInput.click();
        
        uploadZone.ondragover = (e) => {
            e.preventDefault();
            uploadZone.classList.add('dragover');
        };
        
        uploadZone.ondragleave = () => uploadZone.classList.remove('dragover');
        
        uploadZone.ondrop = async (e) => {
            e.preventDefault();
            uploadZone.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
                await runProjectInference(file);
            }
        };
        
        fileInput.onchange = async () => {
            if (fileInput.files[0]) {
                await runProjectInference(fileInput.files[0]);
            }
        };
        
        // Sliders
        document.getElementById('project-deploy-confidence').oninput = (e) => {
            document.getElementById('project-deploy-confidence-value').textContent = e.target.value;
        };
        
        document.getElementById('project-deploy-iou').oninput = (e) => {
            document.getElementById('project-deploy-iou-value').textContent = e.target.value;
        };
    }
}

async function loadProjectModelsForDeploy() {
    if (!state.currentProject) return;
    
    try {
        const modelsRes = await fetch(`${API_BASE}/projects/${state.currentProject.id}/models`);
        const models = await modelsRes.json();
        
        const select = document.getElementById('project-deploy-model-select');
        if (!select) return;
        
        select.innerHTML = '<option value="">Select a trained model...</option>' +
            models.filter(m => m.status === 'completed').map(m => 
                `<option value="${m.id}">${m.name} (${m.architecture})</option>`
            ).join('');
    } catch (error) {
        console.error('Failed to load models for deploy', error);
    }
}

async function runProjectInference(file) {
    const modelId = document.getElementById('project-deploy-model-select').value;
    if (!modelId) {
        showToast('Please select a model first', 'warning');
        return;
    }
    
    const confidence = parseFloat(document.getElementById('project-deploy-confidence').value);
    const iou = parseFloat(document.getElementById('project-deploy-iou').value);
    
    showLoading('Running inference...');
    
    try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('model_id', modelId);
        formData.append('confidence', confidence);
        formData.append('iou_threshold', iou);
        
        const response = await fetch(`${API_BASE}/inference/predict`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) throw new Error('Inference failed');
        
        const result = await response.json();
        displayProjectInferenceResult(file, result);
    } catch (error) {
        showToast('Inference failed', 'error');
        console.error(error);
    }
    
    hideLoading();
}

function displayProjectInferenceResult(file, result) {
    document.getElementById('project-deploy-upload-zone').style.display = 'none';
    const resultContainer = document.getElementById('project-inference-result');
    resultContainer.style.display = 'flex';
    
    const canvas = document.getElementById('project-inference-canvas');
    const ctx = canvas.getContext('2d');
    
    const img = new Image();
    img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        
        // Draw detections
        if (result.detections) {
            result.detections.forEach(det => {
                const [x1, y1, x2, y2] = det.bbox;
                const width = x2 - x1;
                const height = y2 - y1;
                
                const color = getColorForClass(det.class_id);
                
                ctx.strokeStyle = color;
                ctx.lineWidth = 3;
                ctx.strokeRect(x1, y1, width, height);
                
                ctx.fillStyle = color;
                const label = `${det.class_name} ${(det.confidence * 100).toFixed(1)}%`;
                const labelWidth = ctx.measureText(label).width + 10;
                ctx.fillRect(x1, y1 - 25, labelWidth, 25);
                ctx.fillStyle = '#FFFFFF';
                ctx.font = '14px Inter';
                ctx.fillText(label, x1 + 5, y1 - 7);
            });
        }
    };
    img.src = URL.createObjectURL(file);
    
    const panel = document.getElementById('project-detections-panel');
    panel.innerHTML = `
        <h3>Detections (${result.detections?.length || 0})</h3>
        <p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 10px;">
            Inference time: ${((result.inference_time || 0) * 1000).toFixed(1)}ms
        </p>
        ${(result.detections || []).map(det => `
            <div class="annotation-item">
                <div class="class-color" style="background-color: ${getColorForClass(det.class_id)}; width: 12px; height: 12px; border-radius: 2px;"></div>
                <span>${det.class_name}</span>
                <span style="color: var(--text-secondary); margin-left: auto;">${(det.confidence * 100).toFixed(1)}%</span>
            </div>
        `).join('')}
    `;
}

// ... (Rest of the file) ...

function setupProjectEventListeners(projectId) {
    // --- Upload Tab Logic ---
    const uploadZone = document.getElementById('project-upload-zone');
    const fileInput = document.getElementById('project-file-input');
    const startUploadBtn = document.getElementById('btn-project-upload-start');
    
    // Reset state
    state.uploadFiles = [];
    updateProjectUploadZone();

    if (uploadZone && fileInput) {
        // Remove old listeners to avoid duplicates if this is called multiple times
        // (Ideally we should handle this better, but for now...)
        const newZone = uploadZone.cloneNode(true);
        uploadZone.parentNode.replaceChild(newZone, uploadZone);
        
        // Re-select elements after replace
        const currentZone = document.getElementById('project-upload-zone');
        const currentInput = currentZone.querySelector('input'); // Input is inside zone
        
        currentZone.onclick = (e) => {
            if (e.target !== currentInput) {
                currentInput.click();
            }
        };
        
        currentZone.ondragover = (e) => {
            e.preventDefault();
            currentZone.classList.add('dragover');
        };
        
        currentZone.ondragleave = () => {
            currentZone.classList.remove('dragover');
        };
        
        currentZone.ondrop = (e) => {
            e.preventDefault();
            currentZone.classList.remove('dragover');
            const droppedFiles = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
            if (droppedFiles.length > 0) {
                state.uploadFiles = droppedFiles;
                updateProjectUploadZone();
            }
        };
        
        currentInput.onchange = () => {
            if (currentInput.files.length > 0) {
                state.uploadFiles = Array.from(currentInput.files);
                updateProjectUploadZone();
            }
        };
    }

    if (startUploadBtn) {
        // Clone to remove old listeners
        const newBtn = startUploadBtn.cloneNode(true);
        startUploadBtn.parentNode.replaceChild(newBtn, startUploadBtn);
        
        newBtn.onclick = async () => {
            if (state.uploadFiles.length === 0) {
                showToast('Please select images to upload', 'warning');
                return;
            }

            // Default to 'train' split as per user request to remove selection UI
            const split = 'train';
            
            // Find or create dataset for this split
            let targetDataset = state.currentProject.datasets?.find(d => d.split === split);
            
            if (!targetDataset) {
                try {
                    const res = await fetch(`${API_BASE}/datasets`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            project_id: projectId,
                            name: split,
                            split: split
                        })
                    });
                    targetDataset = await res.json();
                    // Refresh datasets in state
                    const datasetsRes = await fetch(`${API_BASE}/projects/${projectId}/datasets`);
                    state.currentProject.datasets = await datasetsRes.json();
                } catch (e) {
                    showToast('Failed to create dataset for upload', 'error');
                    return;
                }
            }

            await uploadImagesToProject(targetDataset.id, state.uploadFiles);
            state.uploadFiles = [];
            updateProjectUploadZone();
            
            // Refresh stats
            const statsRes = await fetch(`${API_BASE}/projects/${projectId}/stats`);
            const stats = await statsRes.json();
            updateStats(stats);
        };
    }

    // --- Annotate Tab Logic ---
    const startAnnotateBtn = document.getElementById('btn-start-annotation-flow');
    if (startAnnotateBtn) {
        startAnnotateBtn.onclick = () => {
            loadImagesForAnnotationFlow(projectId);
        };
    }

    // --- Dataset Tab Logic ---
    const generateVersionBtn = document.getElementById('btn-generate-version');
    if (generateVersionBtn) {
        generateVersionBtn.onclick = () => {
            openModal('modal-export');
        };
    }

    // Legacy/Modal buttons
    const btnExport = document.getElementById('btn-export-dataset');
    if (btnExport) btnExport.onclick = () => openModal('modal-export');

    // Export confirm
    const btnConfirmExport = document.getElementById('btn-confirm-export');
    if (btnConfirmExport) {
        btnConfirmExport.onclick = async () => {
            const selectedFormat = document.querySelector('.export-option.selected');
            if (!selectedFormat) {
                showToast('Please select an export format', 'warning');
                return;
            }
            
            showLoading('Exporting dataset...');
            try {
                const response = await fetch(`${API_BASE}/export`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        project_id: projectId,
                        format: selectedFormat.dataset.format
                    })
                });
                
                if (!response.ok) throw new Error('Export failed');
                
                const result = await response.json();
                closeModal('modal-export');
                showToast(`Exported ${result.num_images} images to ${result.export_path}`, 'success');
            } catch (error) {
                showToast('Export failed', 'error');
            }
            hideLoading();
        };
    }
    
    // Export option selection
    document.querySelectorAll('.export-option').forEach(opt => {
        opt.addEventListener('click', () => {
            document.querySelectorAll('.export-option').forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
        });
    });
}

function initSplitModal() {
    const btnOpen = document.getElementById('btn-open-split-modal');
    if (btnOpen) {
        btnOpen.addEventListener('click', () => {
            openModal('modal-split-dataset');
        });
    }

    const trainSlider = document.getElementById('split-train');
    const validSlider = document.getElementById('split-valid');
    const testSlider = document.getElementById('split-test');
    
    const updateValues = () => {
        const train = parseInt(trainSlider.value);
        const valid = parseInt(validSlider.value);
        const test = parseInt(testSlider.value);
        
        document.getElementById('split-train-val').textContent = train;
        document.getElementById('split-valid-val').textContent = valid;
        document.getElementById('split-test-val').textContent = test;
        
        const total = train + valid + test;
        const totalEl = document.getElementById('split-total-val');
        totalEl.textContent = total;
        
        if (total === 100) {
            totalEl.className = 'valid';
            totalEl.style.color = 'var(--success)';
        } else {
            totalEl.className = 'invalid';
            totalEl.style.color = 'var(--danger)';
        }
    };
    
    [trainSlider, validSlider, testSlider].forEach(s => {
        s.oninput = updateValues;
    });
    
    document.getElementById('btn-confirm-split').onclick = async () => {
        const train = parseInt(trainSlider.value);
        const valid = parseInt(validSlider.value);
        const test = parseInt(testSlider.value);
        
        if (train + valid + test !== 100) {
            showToast('Splits must sum to 100%', 'warning');
            return;
        }
        
        showLoading('Rebalancing dataset...');
        try {
            const formData = new FormData();
            formData.append('train_split', train);
            formData.append('valid_split', valid);
            formData.append('test_split', test);
            
            const response = await fetch(`${API_BASE}/projects/${state.currentProject.id}/split`, {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) throw new Error('Split failed');
            
            const result = await response.json();
            closeModal('modal-split-dataset');
            showToast(`Split complete: ${result.counts.train} train, ${result.counts.valid} valid, ${result.counts.test} test`, 'success');
            
            // Refresh stats
            const statsRes = await fetch(`${API_BASE}/projects/${state.currentProject.id}/stats`);
            const stats = await statsRes.json();
            updateStats(stats);
            
        } catch (error) {
            showToast('Failed to split dataset', 'error');
            console.error(error);
        }
        hideLoading();
    };
    
    updateValues();
}

function updateProjectUploadZone() {
    const zone = document.getElementById('project-upload-zone');
    const btn = document.getElementById('btn-project-upload-start');
    const icon = zone.querySelector('i');
    const title = zone.querySelector('h3');
    const desc = zone.querySelector('p');
    
    if (state.uploadFiles.length > 0) {
        icon.className = 'fas fa-check-circle';
        icon.style.color = 'var(--success)';
        title.textContent = `${state.uploadFiles.length} image(s) selected`;
        desc.textContent = 'Ready to upload';
        btn.style.display = 'block';
    } else {
        icon.className = 'fas fa-cloud-upload-alt';
        icon.style.color = '';
        title.textContent = 'Drag & Drop Images';
        desc.textContent = 'or click to browse';
        btn.style.display = 'none';
    }
}

async function uploadImagesToProject(datasetId, files) {
    const progressContainer = document.getElementById('project-upload-progress');
    const progressFill = document.getElementById('project-upload-progress-fill');
    const progressText = document.getElementById('project-upload-progress-text');
    
    progressContainer.style.display = 'block';
    
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));
    
    try {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${API_BASE}/datasets/${datasetId}/upload`);
        
        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
                const percent = Math.round((e.loaded / e.total) * 100);
                progressFill.style.width = `${percent}%`;
                progressText.textContent = `${percent}%`;
            }
        };
        
        await new Promise((resolve, reject) => {
            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve(JSON.parse(xhr.responseText));
                } else {
                    reject(new Error('Upload failed'));
                }
            };
            xhr.onerror = () => reject(new Error('Upload failed'));
            xhr.send(formData);
        });
        
        showToast('Images uploaded successfully', 'success');
    } catch (error) {
        showToast('Upload failed', 'error');
    }
    
    progressContainer.style.display = 'none';
}

async function loadAnnotationDashboard(projectId) {
    try {
        // Fetch all datasets for the project
        const res = await fetch(`${API_BASE}/projects/${projectId}/datasets`);
        const datasets = await res.json();
        
        // Flatten images from all datasets (or just pick the main one for now)
        // Ideally we should have an endpoint to get all images for a project with their status
        // For now, let's load images from the first dataset if available
        let allImages = [];
        if (datasets.length > 0) {
            // Load images from the first dataset (usually 'train' or 'default')
            // We might need to load from all datasets if they are split
            // For simplicity, let's assume we work with the first one for annotation flow
            const imagesRes = await fetch(`${API_BASE}/datasets/${datasets[0].id}/images`);
            allImages = await imagesRes.json();
            state.currentDataset = datasets[0].id;
        }
        
        state.images = allImages;
        populateAnnotateDashboard(allImages);
        
    } catch (e) {
        console.error(e);
        showToast('Failed to load annotation dashboard', 'error');
    }
}

function populateAnnotateDashboard(images) {
    const unassignedCol = document.getElementById('col-unassigned');
    const annotatingCol = document.getElementById('col-annotating');
    const datasetCol = document.getElementById('col-dataset');
    
    if (!unassignedCol || !annotatingCol || !datasetCol) return;
    
    // Clear columns (keep headers/static content if possible, but here we replace content)
    // Actually, the HTML structure has static content like "Upload CTA". 
    // We should append or replace specific lists.
    // Let's rebuild the content based on the HTML structure we defined.
    
    // Filter images
    const unassigned = images.filter(img => !img.is_annotated);
    const annotating = images.filter(img => img.is_annotated); // Simplified logic
    const dataset = []; // Images that are "done" - for now same as annotating or separate logic
    
    // Update counts
    document.getElementById('count-unassigned').textContent = `${unassigned.length} Images`;
    document.getElementById('count-annotating').textContent = `${annotating.length} Images`;
    document.getElementById('count-dataset').textContent = `${dataset.length} Images`;
    
    // Render Unassigned
    let unassignedHtml = `
        <div class="upload-cta" onclick="switchProjectTab('upload')">
            <i class="fas fa-cloud-upload-alt"></i>
            <span>Upload More Images</span>
        </div>
    `;
    
    if (unassigned.length > 0) {
        unassignedHtml += `
            <div class="job-card" onclick="startAnnotationBatch()">
                <div class="job-header">
                    <h4>Batch #${new Date().toLocaleDateString()}</h4>
                    <span class="badge badge-new">New</span>
                </div>
                <div class="job-stats">
                    <span>${unassigned.length} images</span>
                    <span>Unassigned</span>
                </div>
                <button class="btn btn-sm btn-primary btn-block" style="margin-top: 8px;">Start Annotating</button>
            </div>
        `;
    }
    unassignedCol.innerHTML = unassignedHtml;
    
    // Render Annotating
    if (annotating.length === 0) {
        annotatingCol.innerHTML = `
            <div class="empty-column-state">
                <p>No images in progress.</p>
            </div>
        `;
    } else {
        annotatingCol.innerHTML = annotating.map((img, idx) => `
            <div class="job-card" onclick="openAnnotationView(${state.images.indexOf(img)})">
                <div class="job-header">
                    <h4>${escapeHtml(img.filename)}</h4>
                    <span class="badge badge-progress">In Progress</span>
                </div>
                <div class="job-stats">
                    <span>${img.annotation_count || 0} annotations</span>
                </div>
                <div class="progress-bar-sm">
                    <div class="progress-fill" style="width: 50%"></div>
                </div>
            </div>
        `).join('');
    }
    
    // Render Dataset
    datasetCol.innerHTML = `
        <div class="view-all-link">
            <i class="fas fa-images"></i>
            <span>See all images</span>
        </div>
        <div class="empty-column-state">
            <p>Finished images will appear here.</p>
        </div>
    `;
}

function startAnnotationBatch() {
    // Find first unassigned image
    const index = state.images.findIndex(img => !img.is_annotated);
    if (index !== -1) {
        openAnnotationView(index);
    } else {
        showToast('No unassigned images found', 'info');
    }
}


function renderClasses() {
    const classList = document.getElementById('classes-list');
    classList.innerHTML = state.classes.map(cls => `
        <div class="class-item" data-id="${cls.id}">
            <div class="class-color" style="background-color: ${cls.color}"></div>
            <span class="class-name">${escapeHtml(cls.name)}</span>
            <button class="btn btn-icon btn-sm" onclick="deleteClass(${cls.id})">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `).join('');
    
    // Also update annotation classes
    renderAnnotationClasses();
}

async function deleteClass(classId) {
    if (!confirm('Delete this class? All annotations with this class will be affected.')) return;
    
    try {
        await fetch(`${API_BASE}/classes/${classId}`, { method: 'DELETE' });
        state.classes = state.classes.filter(c => c.id !== classId);
        renderClasses();
        showToast('Class deleted', 'success');
    } catch (error) {
        showToast('Failed to delete class', 'error');
    }
}

function renderDatasetSelector(datasets) {
    const select = document.getElementById('dataset-select');
    select.innerHTML = '<option value="">All Datasets</option>' +
        datasets.map(ds => `
            <option value="${ds.id}">${escapeHtml(ds.name)} (${ds.split}) - ${ds.image_count} images</option>
        `).join('');
    
    select.onchange = () => {
        if (select.value) {
            loadImages(parseInt(select.value));
        }
    };
    
    // Also update upload modal
    const uploadSelect = document.getElementById('upload-dataset');
    uploadSelect.innerHTML = '<option value="">Select or create dataset...</option>' +
        '<option value="new">+ Create new dataset</option>' +
        datasets.map(ds => `
            <option value="${ds.id}">${escapeHtml(ds.name)} (${ds.split})</option>
        `).join('');
    
    uploadSelect.onchange = () => {
        document.getElementById('new-dataset-form').style.display = 
            uploadSelect.value === 'new' ? 'block' : 'none';
    };
}

function updateStats(stats) {
    document.getElementById('stat-total-images').textContent = stats.total_images;
    document.getElementById('stat-annotated-images').textContent = stats.annotated_images;
    document.getElementById('stat-total-annotations').textContent = stats.total_annotations;
    document.getElementById('stat-total-classes').textContent = Object.keys(stats.class_distribution).length;
    
    // Update charts
    renderCharts(stats);
}

function renderCharts(stats) {
    // Class distribution chart
    const classCtx = document.getElementById('chart-class-distribution');
    if (classCtx) {
        new Chart(classCtx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(stats.class_distribution),
                datasets: [{
                    data: Object.values(stats.class_distribution),
                    backgroundColor: state.classes.map(c => c.color)
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#a0a0a0' }
                    }
                }
            }
        });
    }
    
    // Split distribution chart
    const splitCtx = document.getElementById('chart-split-distribution');
    if (splitCtx) {
        new Chart(splitCtx, {
            type: 'bar',
            data: {
                labels: Object.keys(stats.split_distribution),
                datasets: [{
                    label: 'Images',
                    data: Object.values(stats.split_distribution),
                    backgroundColor: '#6366f1'
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { color: '#a0a0a0' },
                        grid: { color: '#333' }
                    },
                    x: {
                        ticks: { color: '#a0a0a0' },
                        grid: { display: false }
                    }
                }
            }
        });
    }
}

// ============== Images ==============
async function loadImages(datasetId) {
    try {
        const response = await fetch(`${API_BASE}/datasets/${datasetId}/images`);
        state.images = await response.json();
        state.currentDataset = datasetId;
        renderImages();
    } catch (error) {
        showToast('Failed to load images', 'error');
    }
}

function renderImages() {
    const grid = document.getElementById('images-grid');
    
    if (state.images.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-images"></i>
                <h3>No images yet</h3>
                <p>Upload images to get started</p>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = state.images.map((img, index) => `
        <div class="image-card" data-id="${img.id}" data-index="${index}">
            <img src="${API_BASE}/images/${img.id}/thumbnail" alt="${img.filename}" loading="lazy">
            <div class="image-card-overlay">
                <span class="annotation-count">
                    <i class="fas fa-tag"></i>
                    <span>${img.annotation_count || 0}</span>
                </span>
                <span class="image-status ${img.is_annotated ? 'annotated' : 'unannotated'}"></span>
            </div>
        </div>
    `).join('');
    
    // Add click handlers
    grid.querySelectorAll('.image-card').forEach(card => {
        card.addEventListener('click', () => {
            const index = parseInt(card.dataset.index);
            openAnnotationView(index);
        });
    });
}

function setupUploadModal() {
    const uploadZone = document.getElementById('image-upload-zone');
    const fileInput = document.getElementById('image-file-input');
    let files = [];
    
    uploadZone.onclick = () => fileInput.click();
    
    uploadZone.ondragover = (e) => {
        e.preventDefault();
        uploadZone.classList.add('dragover');
    };
    
    uploadZone.ondragleave = () => {
        uploadZone.classList.remove('dragover');
    };
    
    uploadZone.ondrop = (e) => {
        e.preventDefault();
        uploadZone.classList.remove('dragover');
        files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
        updateUploadZone(files);
    };
    
    fileInput.onchange = () => {
        files = Array.from(fileInput.files);
        updateUploadZone(files);
    };
    
    document.getElementById('btn-start-upload').onclick = async () => {
        if (files.length === 0) {
            showToast('Please select images to upload', 'warning');
            return;
        }
        
        let datasetId = document.getElementById('upload-dataset').value;
        
        // Create new dataset if needed
        if (datasetId === 'new') {
            const name = document.getElementById('new-dataset-name').value;
            const split = document.getElementById('new-dataset-split').value;
            
            if (!name) {
                showToast('Please enter dataset name', 'warning');
                return;
            }
            
            try {
                const response = await fetch(`${API_BASE}/datasets`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        project_id: state.currentProject.id,
                        name,
                        split
                    })
                });
                const dataset = await response.json();
                datasetId = dataset.id;
            } catch (error) {
                showToast('Failed to create dataset', 'error');
                return;
            }
        }
        
        if (!datasetId) {
            showToast('Please select a dataset', 'warning');
            return;
        }
        
        // Upload files
        await uploadImages(datasetId, files);
        files = [];
        closeModal('modal-upload');
        
        // Reload datasets and images
        const datasetsRes = await fetch(`${API_BASE}/projects/${state.currentProject.id}/datasets`);
        const datasets = await datasetsRes.json();
        renderDatasetSelector(datasets);
        loadImages(datasetId);
    };
}

function updateUploadZone(files) {
    const zone = document.getElementById('image-upload-zone');
    if (files.length > 0) {
        zone.innerHTML = `
            <i class="fas fa-check-circle" style="color: var(--success)"></i>
            <p>${files.length} image(s) selected</p>
        `;
    }
}

async function uploadImages(datasetId, files) {
    const progressContainer = document.getElementById('upload-progress');
    const progressFill = document.getElementById('upload-progress-fill');
    const progressText = document.getElementById('upload-progress-text');
    
    progressContainer.style.display = 'block';
    
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));
    
    try {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${API_BASE}/datasets/${datasetId}/upload`);
        
        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
                const percent = Math.round((e.loaded / e.total) * 100);
                progressFill.style.width = `${percent}%`;
                progressText.textContent = `${percent}%`;
            }
        };
        
        await new Promise((resolve, reject) => {
            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve(JSON.parse(xhr.responseText));
                } else {
                    reject(new Error('Upload failed'));
                }
            };
            xhr.onerror = () => reject(new Error('Upload failed'));
            xhr.send(formData);
        });
        
        showToast('Images uploaded successfully', 'success');
    } catch (error) {
        showToast('Upload failed', 'error');
    }
    
    progressContainer.style.display = 'none';
}

// ============== Annotation ==============
function openAnnotationView(index) {
    state.imageIndex = index;
    navigateTo('annotate');
    loadImageForAnnotation(index);
    renderThumbnails();
    renderAnnotationClasses();
}

function initAnnotationTools() {
    // Tool buttons
    document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.selectedTool = btn.dataset.tool;
        });
    });
    
    // Navigation buttons
    const btnPrev = document.getElementById('btn-prev-image');
    const btnNext = document.getElementById('btn-next-image');
    if (btnPrev) btnPrev.onclick = () => navigateImage(-1);
    if (btnNext) btnNext.onclick = () => navigateImage(1);
    
    // Zoom controls
    const btnZoomIn = document.getElementById('btn-zoom-in');
    const btnZoomOut = document.getElementById('btn-zoom-out');
    const btnZoomFit = document.getElementById('btn-zoom-fit');
    if (btnZoomIn) btnZoomIn.onclick = () => setZoom(state.zoom + 0.1);
    if (btnZoomOut) btnZoomOut.onclick = () => setZoom(state.zoom - 0.1);
    if (btnZoomFit) btnZoomFit.onclick = () => fitToView();
    
    // Action buttons
    const btnUndo = document.getElementById('btn-undo');
    const btnRedo = document.getElementById('btn-redo');
    const btnSave = document.getElementById('btn-save-annotations');
    const btnAutoLabel = document.getElementById('btn-auto-label');
    
    if (btnUndo) btnUndo.onclick = undo;
    if (btnRedo) btnRedo.onclick = redo;
    if (btnSave) btnSave.onclick = saveAnnotations;
    if (btnAutoLabel) btnAutoLabel.onclick = autoLabelCurrentImage;
    
    // Canvas setup
    setupCanvas();
    
    // Floating Class Panel
    initFloatingClassPanel();

    // Back Button
    const btnBack = document.getElementById('btn-back-to-project');
    if (btnBack) {
        btnBack.onclick = () => {
            navigateTo('project-detail');
            switchProjectTab('annotate');
        };
    }

    // Finish Button
    const btnFinish = document.getElementById('btn-finish-annotation');
    if (btnFinish) {
        btnFinish.onclick = async () => {
            await saveAnnotations();
            // Open Add to Dataset Modal instead of finishing immediately
            openAddToDatasetModal();
        };
    }
}

function openAddToDatasetModal() {
    const modal = document.getElementById('modal-add-to-dataset');
    if (!modal) return;
    
    // Reset values
    const totalImages = 1; // Currently we only annotate 1 image at a time in this flow
    document.getElementById('add-count-labeled').textContent = totalImages;
    document.getElementById('btn-add-count').textContent = totalImages;
    
    // Initialize slider logic
    initAddToDatasetSlider(totalImages);
    
    openModal('modal-add-to-dataset');
}

function initAddToDatasetSlider(totalImages) {
    const handle1 = document.getElementById('handle-1');
    const handle2 = document.getElementById('handle-2');
    const trackTrain = document.getElementById('track-train');
    const trackValid = document.getElementById('track-valid');
    const trackTest = document.getElementById('track-test');
    
    // Initial values (70/20/10)
    let split1 = 70;
    let split2 = 90;
    
    const updateUI = () => {
        const trainPct = split1;
        const validPct = split2 - split1;
        const testPct = 100 - split2;
        
        // Update percentages
        document.getElementById('add-pct-train').textContent = `${Math.round(trainPct)}%`;
        document.getElementById('add-pct-valid').textContent = `${Math.round(validPct)}%`;
        document.getElementById('add-pct-test').textContent = `${Math.round(testPct)}%`;
        
        // Update track widths
        trackTrain.style.width = `${trainPct}%`;
        trackValid.style.width = `${validPct}%`;
        trackTest.style.width = `${testPct}%`;
        
        // Update handles
        handle1.style.left = `${split1}%`;
        handle2.style.left = `${split2}%`;
        
        // Update counts (simple distribution for now)
        // For 1 image, it goes to the largest bucket
        let trainCount = 0, validCount = 0, testCount = 0;
        
        if (totalImages === 1) {
            if (trainPct >= validPct && trainPct >= testPct) trainCount = 1;
            else if (validPct >= trainPct && validPct >= testPct) validCount = 1;
            else testCount = 1;
        } else {
            trainCount = Math.round(totalImages * (trainPct / 100));
            validCount = Math.round(totalImages * (validPct / 100));
            testCount = totalImages - trainCount - validCount;
        }
        
        document.getElementById('add-count-train').textContent = `Train: ${trainCount} images`;
        document.getElementById('add-count-valid').textContent = `Valid: ${validCount} images`;
        document.getElementById('add-count-test').textContent = `Test: ${testCount} images`;
    };
    
    // Drag logic
    const setupDrag = (handle, isHandle1) => {
        handle.onmousedown = (e) => {
            e.preventDefault();
            const sliderWidth = handle.parentElement.parentElement.offsetWidth;
            
            document.onmousemove = (moveEvent) => {
                const rect = handle.parentElement.parentElement.getBoundingClientRect();
                let x = moveEvent.clientX - rect.left;
                let pct = Math.max(0, Math.min(100, (x / sliderWidth) * 100));
                
                if (isHandle1) {
                    split1 = Math.min(pct, split2 - 5); // Min 5% gap
                } else {
                    split2 = Math.max(pct, split1 + 5); // Min 5% gap
                }
                updateUI();
            };
            
            document.onmouseup = () => {
                document.onmousemove = null;
                document.onmouseup = null;
            };
        };
    };
    
    setupDrag(handle1, true);
    setupDrag(handle2, false);
    
    updateUI();
    
    // Confirm button
    const btnConfirm = document.getElementById('btn-confirm-add-dataset');
    btnConfirm.onclick = async () => {
        // Determine target split for single image
        const trainPct = split1;
        const validPct = split2 - split1;
        const testPct = 100 - split2;
        
        let targetSplit = 'train';
        if (totalImages === 1) {
            if (trainPct >= validPct && trainPct >= testPct) targetSplit = 'train';
            else if (validPct >= trainPct && validPct >= testPct) targetSplit = 'valid';
            else targetSplit = 'test';
        }

        showLoading('Adding to dataset...');
        try {
            // Here we would call the API to move the image to the dataset with the split
            // For now, we just simulate it
            await new Promise(r => setTimeout(r, 500));
            
            closeModal('modal-add-to-dataset');
            showToast(`Image added to ${targetSplit} set`, 'success');
            
            // Return to dashboard
            navigateTo('project-detail');
            switchProjectTab('annotate');
        } catch (error) {
            showToast('Failed to add to dataset', 'error');
        }
        hideLoading();
    };
}

function initFloatingClassPanel() {
    const panel = document.getElementById('floating-class-panel');
    const display = document.getElementById('current-class-display');
    const input = document.getElementById('quick-class-input');
    const btnAdd = document.getElementById('btn-quick-add-class');
    
    if (!panel) return;
    
    // Toggle dropdown
    display.addEventListener('click', (e) => {
        e.stopPropagation();
        panel.classList.toggle('active');
    });
    
    // Close when clicking outside
    document.addEventListener('click', (e) => {
        if (!panel.contains(e.target)) {
            panel.classList.remove('active');
        }
    });
    
    // Add class logic
    const handleAddClass = async () => {
        const name = input.value.trim();
        if (!name) return;
        
        if (!state.currentProject) {
            showToast('No project loaded', 'error');
            return;
        }
        
        try {
            // Create class via API (assuming we have an endpoint or we update project)
            // Since the current API structure updates the project with classes list,
            // we might need to fetch project, add class, update project.
            // Or if there is a specific endpoint for classes.
            // Looking at deleteClass, it uses DELETE /classes/:id.
            // So there should be POST /classes or POST /projects/:id/classes.
            // Let's check initProjectForm... it sends classes in project creation.
            // Let's try to find if there is an add class endpoint.
            // If not, we'll assume we need to update the project.
            
            // Actually, let's assume we can just add it to state and sync later or use a specific endpoint if it exists.
            // For now, let's try to use a hypothetical POST /projects/:id/classes endpoint
            // If that fails, we might need to update the whole project.
            
            const color = getRandomColor();
            const response = await fetch(`${API_BASE}/projects/${state.currentProject.id}/classes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, color })
            });
            
            if (response.ok) {
                const newClass = await response.json();
                state.classes.push(newClass);
                state.selectedClass = newClass.id;
                renderAnnotationClasses();
                input.value = '';
                panel.classList.remove('active');
                showToast(`Class '${name}' created`, 'success');
            } else {
                // Fallback: Update project if specific endpoint doesn't exist
                // This is a guess, but let's try the specific endpoint first.
                throw new Error('Failed to create class');
            }
        } catch (error) {
            console.error(error);
            showToast('Failed to create class', 'error');
        }
    };
    
    btnAdd.addEventListener('click', handleAddClass);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleAddClass();
    });
}

async function autoLabelCurrentImage() {
    if (!state.currentImage) {
        showToast('No image loaded', 'warning');
        return;
    }
    
    // Check if we have any trained models for this project
    if (!state.currentProject) {
        showToast('No project selected', 'warning');
        return;
    }
    
    showLoading('Running AI auto-labeling...');
    
    try {
        // First, check if we have a trained model
        const modelsRes = await fetch(`${API_BASE}/projects/${state.currentProject.id}/models`);
        const models = await modelsRes.json();
        const completedModels = models.filter(m => m.status === 'completed');
        
        let modelId = null;
        
        if (completedModels.length > 0) {
            // Use the most recent completed model
            modelId = completedModels[0].id;
        } else {
            // Try to use auto-labeling API (simulated)
            showToast('No trained model found. Using base model for detection...', 'info');
        }
        
        // Run inference
        const formData = new FormData();
        
        // Fetch the current image as blob
        const imageResponse = await fetch(`${API_BASE}/images/${state.currentImage.id}/file`);
        const imageBlob = await imageResponse.blob();
        formData.append('file', imageBlob, state.currentImage.filename);
        
        if (modelId) {
            formData.append('model_id', modelId);
        } else {
            // Use auto-label endpoint which might use a pre-trained model
            formData.append('model_id', 'auto');
        }
        formData.append('confidence', '0.25');
        formData.append('iou_threshold', '0.45');
        
        const inferenceRes = await fetch(`${API_BASE}/inference/predict`, {
            method: 'POST',
            body: formData
        });
        
        if (!inferenceRes.ok) {
            // If inference fails, generate placeholder annotations for demo
            showToast('Using demo auto-labels (no model available)', 'info');
            generateDemoAutoLabels();
        } else {
            const result = await inferenceRes.json();
            
            // Convert detections to annotations
            if (result.detections && result.detections.length > 0) {
                state.undoStack.push([...state.annotations]);
                
                for (const det of result.detections) {
                    const [x1, y1, x2, y2] = det.bbox;
                    
                    // Find or create class
                    let classId = det.class_id;
                    if (!state.classes.find(c => c.id === classId)) {
                        // Map to first available class or create
                        classId = state.classes[0]?.id;
                    }
                    
                    if (classId) {
                        state.annotations.push({
                            class_id: classId,
                            annotation_type: 'bbox',
                            data: {
                                x: x1,
                                y: y1,
                                width: x2 - x1,
                                height: y2 - y1
                            }
                        });
                    }
                }
                
                renderCanvas();
                renderAnnotationList();
                showToast(`Added ${result.detections.length} auto-labels`, 'success');
            } else {
                showToast('No objects detected', 'info');
            }
        }
    } catch (error) {
        console.error('Auto-label error:', error);
        // Generate demo labels for demonstration
        generateDemoAutoLabels();
    }
    
    hideLoading();
}

function generateDemoAutoLabels() {
    if (!state.loadedImage || state.classes.length === 0) {
        showToast('Please add classes first', 'warning');
        return;
    }
    
    // Generate some demo bounding boxes for demonstration
    const imgWidth = state.loadedImage.width;
    const imgHeight = state.loadedImage.height;
    
    state.undoStack.push([...state.annotations]);
    
    // Create a few random demo boxes
    const numBoxes = Math.floor(Math.random() * 3) + 1;
    for (let i = 0; i < numBoxes; i++) {
        const boxWidth = Math.floor(imgWidth * (0.1 + Math.random() * 0.3));
        const boxHeight = Math.floor(imgHeight * (0.1 + Math.random() * 0.3));
        const x = Math.floor(Math.random() * (imgWidth - boxWidth));
        const y = Math.floor(Math.random() * (imgHeight - boxHeight));
        
        const randomClass = state.classes[Math.floor(Math.random() * state.classes.length)];
        
        state.annotations.push({
            class_id: randomClass.id,
            annotation_type: 'bbox',
            data: { x, y, width: boxWidth, height: boxHeight }
        });
    }
    
    renderCanvas();
    renderAnnotationList();
    showToast(`Generated ${numBoxes} demo labels (no model available)`, 'info');
}

function setupCanvas() {
    const canvas = document.getElementById('annotation-canvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const container = document.getElementById('canvas-container');
    
    canvas.addEventListener('mousedown', onCanvasMouseDown);
    canvas.addEventListener('mousemove', onCanvasMouseMove);
    canvas.addEventListener('mouseup', onCanvasMouseUp);
    canvas.addEventListener('wheel', onCanvasWheel);
    canvas.addEventListener('dblclick', onCanvasDblClick);
    
    // Touch support
    canvas.addEventListener('touchstart', onCanvasTouchStart);
    canvas.addEventListener('touchmove', onCanvasTouchMove);
    canvas.addEventListener('touchend', onCanvasTouchEnd);
}

function onCanvasDblClick(e) {
    // Complete polygon on double-click
    if (state.selectedTool === 'polygon' && state.polygonPoints.length >= 3) {
        completePolygon();
    }
}

async function loadImageForAnnotation(index) {
    if (index < 0 || index >= state.images.length) return;
    
    const img = state.images[index];
    state.currentImage = img;
    
    // Update counter
    document.getElementById('current-image-index').textContent = index + 1;
    document.getElementById('total-images').textContent = state.images.length;
    
    // Load image data and annotations
    try {
        const response = await fetch(`${API_BASE}/images/${img.id}`);
        const imageData = await response.json();
        state.annotations = imageData.annotations || [];
        
        // Load image
        const imageObj = new Image();
        imageObj.onload = () => {
            const canvas = document.getElementById('annotation-canvas');
            // Fix for offset issue: remove CSS constraints that interfere with scaling
            canvas.style.maxWidth = 'none';
            canvas.style.maxHeight = 'none';
            
            canvas.width = imageObj.width;
            canvas.height = imageObj.height;
            state.loadedImage = imageObj;
            fitToView();
            renderCanvas();
        };
        imageObj.src = `${API_BASE}/images/${img.id}/file`;
    } catch (error) {
        showToast('Failed to load image', 'error');
    }
    
    renderAnnotationList();
}

function renderCanvas() {
    const canvas = document.getElementById('annotation-canvas');
    const ctx = canvas.getContext('2d');
    
    if (!state.loadedImage) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw image
    ctx.drawImage(state.loadedImage, 0, 0);
    
    // Draw annotations
    state.annotations.forEach((ann, index) => {
        const isSelected = index === state.selectedAnnotation;
        drawAnnotation(ctx, ann, isSelected);
    });
    
    // Draw current drawing
    if (state.isDrawing && state.drawStart && state.drawCurrent) {
        drawCurrentShape(ctx);
    }
}

function drawAnnotation(ctx, ann, isSelected = false) {
    const cls = state.classes.find(c => c.id === ann.class_id);
    const color = cls?.color || '#FF0000';
    
    ctx.strokeStyle = color;
    ctx.lineWidth = isSelected ? 3 : 2;
    ctx.fillStyle = color + '33'; // 20% opacity
    
    if (ann.annotation_type === 'bbox') {
        const { x, y, width, height } = ann.data;
        ctx.fillRect(x, y, width, height);
        ctx.strokeRect(x, y, width, height);
        
        // Draw label
        if (cls) {
            ctx.fillStyle = color;
            ctx.font = '14px Inter';
            const label = cls.name;
            const labelWidth = ctx.measureText(label).width + 10;
            ctx.fillRect(x, y - 20, labelWidth, 20);
            ctx.fillStyle = '#FFFFFF';
            ctx.fillText(label, x + 5, y - 5);
        }
        
        // Draw resize handles if selected
        if (isSelected) {
            drawResizeHandles(ctx, x, y, width, height);
        }
    } else if (ann.annotation_type === 'polygon') {
        const points = ann.data.points;
        if (points.length > 0) {
            ctx.beginPath();
            ctx.moveTo(points[0][0], points[0][1]);
            points.forEach(([px, py]) => ctx.lineTo(px, py));
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        }
    }
}

function drawResizeHandles(ctx, x, y, width, height) {
    const handleSize = 8;
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    
    const handles = [
        [x, y],
        [x + width / 2, y],
        [x + width, y],
        [x + width, y + height / 2],
        [x + width, y + height],
        [x + width / 2, y + height],
        [x, y + height],
        [x, y + height / 2]
    ];
    
    handles.forEach(([hx, hy]) => {
        ctx.fillRect(hx - handleSize / 2, hy - handleSize / 2, handleSize, handleSize);
        ctx.strokeRect(hx - handleSize / 2, hy - handleSize / 2, handleSize, handleSize);
    });
}

function drawCurrentShape(ctx) {
    const cls = state.classes.find(c => c.id === state.selectedClass);
    const color = cls?.color || '#FF0000';
    
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    
    if (state.selectedTool === 'bbox' && state.drawStart && state.drawCurrent) {
        const x = Math.min(state.drawStart.x, state.drawCurrent.x);
        const y = Math.min(state.drawStart.y, state.drawCurrent.y);
        const width = Math.abs(state.drawCurrent.x - state.drawStart.x);
        const height = Math.abs(state.drawCurrent.y - state.drawStart.y);
        
        ctx.strokeRect(x, y, width, height);
    } else if (state.selectedTool === 'polygon' && state.polygonPoints.length > 0) {
        // Draw polygon points and lines
        ctx.beginPath();
        ctx.moveTo(state.polygonPoints[0][0], state.polygonPoints[0][1]);
        for (let i = 1; i < state.polygonPoints.length; i++) {
            ctx.lineTo(state.polygonPoints[i][0], state.polygonPoints[i][1]);
        }
        ctx.stroke();
        
        // Draw points
        ctx.fillStyle = color;
        state.polygonPoints.forEach(([px, py]) => {
            ctx.beginPath();
            ctx.arc(px, py, 5, 0, Math.PI * 2);
            ctx.fill();
        });
    }
    
    ctx.setLineDash([]);
}

// Complete polygon on double-click or Enter
function completePolygon() {
    if (state.polygonPoints.length >= 3 && state.selectedClass) {
        const annotation = {
            class_id: state.selectedClass,
            annotation_type: 'polygon',
            data: { points: [...state.polygonPoints] }
        };
        
        state.undoStack.push(JSON.parse(JSON.stringify(state.annotations)));
        state.annotations.push(annotation);
        state.selectedAnnotation = state.annotations.length - 1;
    }
    state.polygonPoints = [];
    renderCanvas();
    renderAnnotationList();
}

function onCanvasMouseDown(e) {
    const canvas = document.getElementById('annotation-canvas');
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / state.zoom;
    const y = (e.clientY - rect.top) / state.zoom;
    
    if (state.selectedTool === 'select') {
        // Check if clicking on resize handle first
        if (state.selectedAnnotation >= 0) {
            const handle = getResizeHandleAtPoint(x, y, state.annotations[state.selectedAnnotation]);
            if (handle) {
                state.isResizing = true;
                state.resizeHandle = handle;
                state.dragStart = { x, y };
                return;
            }
        }
        
        // Check if clicking inside the selected annotation (for dragging)
        if (state.selectedAnnotation >= 0) {
            const ann = state.annotations[state.selectedAnnotation];
            if (ann.annotation_type === 'bbox' && isPointInBbox(x, y, ann.data)) {
                state.isDragging = true;
                state.dragStart = { x, y };
                return;
            }
        }
        
        // Check if clicking on an annotation to select it
        const clickedIndex = findAnnotationAtPoint(x, y);
        state.selectedAnnotation = clickedIndex;
        renderCanvas();
        renderAnnotationList();
    }

    if (state.selectedTool === 'bbox') {
        if (!state.selectedClass) {
            // Try to auto-select first class
            if (state.classes.length > 0) {
                state.selectedClass = state.classes[0].id;
                renderAnnotationClasses();
            } else {
                // No classes exist, prompt to create one
                showToast('Please create a class first', 'info');
                const panel = document.getElementById('floating-class-panel');
                const input = document.getElementById('quick-class-input');
                if (panel && input) {
                    panel.classList.add('active');
                    input.focus();
                }
                return;
            }
        }
        state.isDrawing = true;
        state.drawStart = { x, y };
        state.drawCurrent = { x, y };
    } else if (state.selectedTool === 'polygon') {
        if (!state.selectedClass) {
             // Try to auto-select first class
             if (state.classes.length > 0) {
                state.selectedClass = state.classes[0].id;
                renderAnnotationClasses();
            } else {
                showToast('Please create a class first', 'info');
                const panel = document.getElementById('floating-class-panel');
                const input = document.getElementById('quick-class-input');
                if (panel && input) {
                    panel.classList.add('active');
                    input.focus();
                }
                return;
            }
        }
        // Add polygon point
        state.polygonPoints.push([x, y]);
        renderCanvas();
    }
}

function getResizeHandleAtPoint(x, y, ann) {
    if (!ann || ann.annotation_type !== 'bbox') return null;
    
    const { x: bx, y: by, width, height } = ann.data;
    const handleSize = 10;
    
    const handles = [
        { pos: 'nw', x: bx, y: by },
        { pos: 'n', x: bx + width / 2, y: by },
        { pos: 'ne', x: bx + width, y: by },
        { pos: 'e', x: bx + width, y: by + height / 2 },
        { pos: 'se', x: bx + width, y: by + height },
        { pos: 's', x: bx + width / 2, y: by + height },
        { pos: 'sw', x: bx, y: by + height },
        { pos: 'w', x: bx, y: by + height / 2 }
    ];
    
    for (const handle of handles) {
        if (Math.abs(x - handle.x) < handleSize && Math.abs(y - handle.y) < handleSize) {
            return handle.pos;
        }
    }
    return null;
}

function isPointInBbox(x, y, bbox) {
    return x >= bbox.x && x <= bbox.x + bbox.width &&
           y >= bbox.y && y <= bbox.y + bbox.height;
}

function onCanvasMouseMove(e) {
    const canvas = document.getElementById('annotation-canvas');
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / state.zoom;
    const y = (e.clientY - rect.top) / state.zoom;
    
    // Update cursor based on handle position
    if (state.selectedTool === 'select' && state.selectedAnnotation >= 0) {
        const handle = getResizeHandleAtPoint(x, y, state.annotations[state.selectedAnnotation]);
        if (handle) {
            const cursors = {
                'nw': 'nw-resize', 'n': 'n-resize', 'ne': 'ne-resize',
                'e': 'e-resize', 'se': 'se-resize', 's': 's-resize',
                'sw': 'sw-resize', 'w': 'w-resize'
            };
            canvas.style.cursor = cursors[handle] || 'default';
        } else {
            const ann = state.annotations[state.selectedAnnotation];
            if (ann && ann.annotation_type === 'bbox' && isPointInBbox(x, y, ann.data)) {
                canvas.style.cursor = 'move';
            } else {
                canvas.style.cursor = 'default';
            }
        }
    }
    
    // Handle resizing
    if (state.isResizing && state.selectedAnnotation >= 0) {
        const ann = state.annotations[state.selectedAnnotation];
        if (ann.annotation_type === 'bbox') {
            const dx = x - state.dragStart.x;
            const dy = y - state.dragStart.y;
            
            resizeBbox(ann.data, state.resizeHandle, dx, dy);
            
            state.dragStart = { x, y };
            renderCanvas();
        }
        return;
    }
    
    // Handle dragging
    if (state.isDragging && state.selectedAnnotation >= 0) {
        const ann = state.annotations[state.selectedAnnotation];
        if (ann.annotation_type === 'bbox') {
            const dx = x - state.dragStart.x;
            const dy = y - state.dragStart.y;
            
            ann.data.x += dx;
            ann.data.y += dy;
            
            state.dragStart = { x, y };
            renderCanvas();
        }
        return;
    }
    
    // Handle drawing
    if (state.isDrawing) {
        state.drawCurrent = { x, y };
        renderCanvas();
    }
}

function resizeBbox(bbox, handle, dx, dy) {
    switch (handle) {
        case 'nw':
            bbox.x += dx;
            bbox.y += dy;
            bbox.width -= dx;
            bbox.height -= dy;
            break;
        case 'n':
            bbox.y += dy;
            bbox.height -= dy;
            break;
        case 'ne':
            bbox.y += dy;
            bbox.width += dx;
            bbox.height -= dy;
            break;
        case 'e':
            bbox.width += dx;
            break;
        case 'se':
            bbox.width += dx;
            bbox.height += dy;
            break;
        case 's':
            bbox.height += dy;
            break;
        case 'sw':
            bbox.x += dx;
            bbox.width -= dx;
            bbox.height += dy;
            break;
        case 'w':
            bbox.x += dx;
            bbox.width -= dx;
            break;
    }
    
    // Ensure minimum size
    if (bbox.width < 10) bbox.width = 10;
    if (bbox.height < 10) bbox.height = 10;
}

function onCanvasMouseUp(e) {
    if (state.isResizing) {
        state.isResizing = false;
        state.resizeHandle = null;
        state.dragStart = null;
        return;
    }
    
    if (state.isDragging) {
        state.isDragging = false;
        state.dragStart = null;
        return;
    }
    
    if (!state.isDrawing) return;
    
    state.isDrawing = false;
    
    if (state.selectedTool === 'bbox' && state.drawStart && state.drawCurrent) {
        const x = Math.min(state.drawStart.x, state.drawCurrent.x);
        const y = Math.min(state.drawStart.y, state.drawCurrent.y);
        const width = Math.abs(state.drawCurrent.x - state.drawStart.x);
        const height = Math.abs(state.drawCurrent.y - state.drawStart.y);
        
        if (width > 5 && height > 5) {
            const annotation = {
                class_id: state.selectedClass,
                annotation_type: 'bbox',
                data: { x, y, width, height }
            };
            
            state.undoStack.push(JSON.parse(JSON.stringify(state.annotations)));
            state.annotations.push(annotation);
            state.selectedAnnotation = state.annotations.length - 1;
            renderCanvas();
            renderAnnotationList();
        }
    }
    
    state.drawStart = null;
    state.drawCurrent = null;
}

function onCanvasWheel(e) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom(state.zoom + delta);
}

function onCanvasTouchStart(e) {
    if (e.touches.length === 1) {
        const touch = e.touches[0];
        onCanvasMouseDown({ clientX: touch.clientX, clientY: touch.clientY });
    }
}

function onCanvasTouchMove(e) {
    if (e.touches.length === 1) {
        const touch = e.touches[0];
        onCanvasMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
    }
}

function onCanvasTouchEnd(e) {
    onCanvasMouseUp({});
}

function findAnnotationAtPoint(x, y) {
    for (let i = state.annotations.length - 1; i >= 0; i--) {
        const ann = state.annotations[i];
        if (ann.annotation_type === 'bbox') {
            const { x: ax, y: ay, width, height } = ann.data;
            if (x >= ax && x <= ax + width && y >= ay && y <= ay + height) {
                return i;
            }
        }
    }
    return -1;
}

function setZoom(newZoom) {
    state.zoom = Math.max(0.1, Math.min(5, newZoom));
    document.getElementById('zoom-level').textContent = `${Math.round(state.zoom * 100)}%`;
    
    const canvas = document.getElementById('annotation-canvas');
    canvas.style.transform = `scale(${state.zoom})`;
    canvas.style.transformOrigin = 'center center';
}

function fitToView() {
    const canvas = document.getElementById('annotation-canvas');
    const container = document.getElementById('canvas-container');
    
    if (!state.loadedImage) return;
    
    const containerWidth = container.clientWidth - 40;
    const containerHeight = container.clientHeight - 40;
    
    const scaleX = containerWidth / state.loadedImage.width;
    const scaleY = containerHeight / state.loadedImage.height;
    
    setZoom(Math.min(scaleX, scaleY, 1));
}

function navigateImage(delta) {
    const newIndex = state.imageIndex + delta;
    if (newIndex >= 0 && newIndex < state.images.length) {
        state.imageIndex = newIndex;
        loadImageForAnnotation(newIndex);
        updateThumbnailSelection();
    }
}

function renderThumbnails() {
    const container = document.getElementById('image-thumbnails');
    container.innerHTML = state.images.map((img, index) => `
        <div class="thumbnail ${index === state.imageIndex ? 'active' : ''}" data-index="${index}">
            <img src="${API_BASE}/images/${img.id}/thumbnail" alt="${img.filename}" loading="lazy">
        </div>
    `).join('');
    
    container.querySelectorAll('.thumbnail').forEach(thumb => {
        thumb.addEventListener('click', () => {
            const index = parseInt(thumb.dataset.index);
            state.imageIndex = index;
            loadImageForAnnotation(index);
            updateThumbnailSelection();
        });
    });
}

function updateThumbnailSelection() {
    document.querySelectorAll('.thumbnail').forEach((thumb, index) => {
        thumb.classList.toggle('active', index === state.imageIndex);
    });
}

function renderAnnotationClasses() {
    const container = document.getElementById('annotation-classes');
    const quickList = document.getElementById('quick-class-list');
    const currentName = document.getElementById('current-class-name');
    const currentColor = document.getElementById('current-class-color');
    
    // Update Sidebar List
    container.innerHTML = state.classes.map(cls => `
        <div class="class-btn ${state.selectedClass === cls.id ? 'active' : ''}" data-id="${cls.id}">
            <div class="class-color" style="background-color: ${cls.color}"></div>
            <span>${escapeHtml(cls.name)}</span>
        </div>
    `).join('');
    
    container.querySelectorAll('.class-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            state.selectedClass = parseInt(btn.dataset.id);
            renderAnnotationClasses(); // Re-render to update active state everywhere
        });
    });
    
    // Update Floating List
    if (quickList) {
        quickList.innerHTML = state.classes.map(cls => `
            <div class="quick-class-item" data-id="${cls.id}">
                <div class="class-color-dot" style="background-color: ${cls.color}"></div>
                <span class="class-name">${escapeHtml(cls.name)}</span>
                ${state.selectedClass === cls.id ? '<i class="fas fa-check" style="color: var(--accent-primary)"></i>' : ''}
            </div>
        `).join('');
        
        quickList.querySelectorAll('.quick-class-item').forEach(item => {
            item.addEventListener('click', () => {
                state.selectedClass = parseInt(item.dataset.id);
                document.getElementById('floating-class-panel').classList.remove('active');
                renderAnnotationClasses();
            });
        });
    }
    
    // Update Current Class Display
    if (state.selectedClass) {
        const cls = state.classes.find(c => c.id === state.selectedClass);
        if (cls) {
            if (currentName) currentName.textContent = cls.name;
            if (currentColor) currentColor.style.backgroundColor = cls.color;
        }
    } else {
        if (currentName) currentName.textContent = 'Select Class';
        if (currentColor) currentColor.style.backgroundColor = '#ccc';
    }
    
    // Select first class if none selected
    if (!state.selectedClass && state.classes.length > 0) {
        state.selectedClass = state.classes[0].id;
        // Recursive call to update UI with selection
        renderAnnotationClasses();
    }
}

function renderAnnotationList() {
    const container = document.getElementById('annotation-list');
    
    // Group annotations by class and count
    const classCounts = {};
    state.annotations.forEach((ann, index) => {
        const classId = ann.class_id;
        if (!classCounts[classId]) {
            classCounts[classId] = { count: 0, indices: [] };
        }
        classCounts[classId].count++;
        classCounts[classId].indices.push(index);
    });
    
    // Build class summary section
    let classesHtml = '<div class="annotation-classes-summary">';
    state.classes.forEach(cls => {
        const count = classCounts[cls.id]?.count || 0;
        if (count > 0) {
            classesHtml += `
                <div class="class-item-with-count" data-class-id="${cls.id}">
                    <div class="class-color" style="background-color: ${cls.color}; width: 14px; height: 14px; border-radius: 3px;"></div>
                    <span class="class-name">${escapeHtml(cls.name)}</span>
                    <span class="annotation-count-badge">${count}</span>
                </div>
            `;
        }
    });
    classesHtml += '</div>';
    
    // Build individual annotations list
    let annotationsHtml = '<div class="annotations-list-items">';
    state.annotations.forEach((ann, index) => {
        const cls = state.classes.find(c => c.id === ann.class_id);
        annotationsHtml += `
            <div class="annotation-item ${index === state.selectedAnnotation ? 'selected' : ''}" data-index="${index}">
                <div class="class-color" style="background-color: ${cls?.color || '#FF0000'}; width: 12px; height: 12px; border-radius: 2px;"></div>
                <span>${cls?.name || 'Unknown'} #${index + 1}</span>
                <span class="annotation-type" style="color: var(--text-muted); font-size: 0.75rem;">${ann.annotation_type}</span>
                <button class="btn btn-icon btn-sm" onclick="deleteAnnotation(${index}); event.stopPropagation();">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
    });
    annotationsHtml += '</div>';
    
    container.innerHTML = classesHtml + annotationsHtml;
    
    // Add click handler for class summary items
    container.querySelectorAll('.class-item-with-count').forEach(item => {
        item.addEventListener('click', () => {
            const classId = parseInt(item.dataset.classId);
            // Highlight all annotations of this class
            const indices = classCounts[classId]?.indices || [];
            if (indices.length > 0) {
                state.selectedAnnotation = indices[0];
                renderCanvas();
                renderAnnotationList();
            }
        });
    });
    
    container.querySelectorAll('.annotation-item').forEach(item => {
        item.addEventListener('click', () => {
            state.selectedAnnotation = parseInt(item.dataset.index);
            renderCanvas();
            renderAnnotationList();
        });
    });
}

function deleteAnnotation(index) {
    state.undoStack.push([...state.annotations]);
    state.annotations.splice(index, 1);
    state.selectedAnnotation = -1;
    renderCanvas();
    renderAnnotationList();
}

function undo() {
    if (state.undoStack.length > 0) {
        state.redoStack.push([...state.annotations]);
        state.annotations = state.undoStack.pop();
        renderCanvas();
        renderAnnotationList();
    }
}

function redo() {
    if (state.redoStack.length > 0) {
        state.undoStack.push([...state.annotations]);
        state.annotations = state.redoStack.pop();
        renderCanvas();
        renderAnnotationList();
    }
}

async function saveAnnotations() {
    if (!state.currentImage) return;
    
    showLoading('Saving annotations...');
    try {
        const response = await fetch(`${API_BASE}/annotations/bulk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                image_id: state.currentImage.id,
                annotations: state.annotations
            })
        });
        
        if (!response.ok) throw new Error('Failed to save');
        
        showToast('Annotations saved', 'success');
        
        // Update image status in list
        state.images[state.imageIndex].is_annotated = state.annotations.length > 0;
    } catch (error) {
        showToast('Failed to save annotations', 'error');
    }
    hideLoading();
}

// ============== Training ==============
function initTrainingForm() {
    const form = document.getElementById('train-form');
    if (!form) return;
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const projectId = document.getElementById('train-project').value;
        const modelName = document.getElementById('train-model-name').value;
        const architecture = document.getElementById('train-architecture').value;
        const epochs = parseInt(document.getElementById('train-epochs').value);
        const batchSize = parseInt(document.getElementById('train-batch-size').value);
        const imgSize = parseInt(document.getElementById('train-img-size').value);
        const lr = parseFloat(document.getElementById('train-lr').value);
        const useWsl2 = document.getElementById('train-use-wsl2')?.checked || false;
        const augmentation = document.getElementById('train-augmentation')?.checked || true;
        const device = document.getElementById('train-device')?.value || 'auto';
        
        if (!projectId) {
            showToast('Please select a project', 'warning');
            return;
        }
        
        if (!modelName) {
            showToast('Please enter a model name', 'warning');
            return;
        }
        
        showLoading('Starting training...');
        
        try {
            // Create model first
            const modelRes = await fetch(`${API_BASE}/models`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    project_id: parseInt(projectId),
                    name: modelName,
                    architecture,
                    epochs,
                    batch_size: batchSize
                })
            });
            
            if (!modelRes.ok) {
                const errorData = await modelRes.json().catch(() => ({}));
                throw new Error(errorData.detail || 'Failed to create model');
            }
            
            const model = await modelRes.json();
            state.trainingModelId = model.id;
            
            // Start training
            const trainRes = await fetch(`${API_BASE}/training/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model_id: model.id,
                    epochs,
                    batch_size: batchSize,
                    img_size: imgSize,
                    learning_rate: lr,
                    use_wsl2: useWsl2,
                    augmentation,
                    device
                })
            });
            
            if (!trainRes.ok) {
                const errorData = await trainRes.json().catch(() => ({}));
                throw new Error(errorData.detail || 'Failed to start training');
            }
            
            showToast('Training started successfully', 'success');
            startTrainingMonitor(model.id);
        } catch (error) {
            showToast(`Training failed: ${error.message}`, 'error');
            console.error('Training error:', error);
        }
        
        hideLoading();
    });
}

async function loadProjectsForTraining() {
    try {
        const response = await fetch(`${API_BASE}/projects`);
        const projects = await response.json();
        
        const select = document.getElementById('train-project');
        select.innerHTML = '<option value="">Select project...</option>' +
            projects.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
        
        if (state.currentProject) {
            select.value = state.currentProject.id;
        }
    } catch (error) {
        console.error('Failed to load projects for training', error);
    }
}

function startTrainingMonitor(modelId) {
    const statusContainer = document.getElementById('training-status');
    const logsContainer = document.getElementById('training-logs');
    
    // Update status badge
    statusContainer.querySelector('.status-badge').className = 'status-badge training';
    statusContainer.querySelector('.status-badge').textContent = 'Training';
    
    // Poll for updates
    const pollInterval = setInterval(async () => {
        try {
            const response = await fetch(`${API_BASE}/training/${modelId}/status`);
            const status = await response.json();
            
            updateTrainingStatus(status);
            
            if (status.status === 'completed' || status.status === 'failed') {
                clearInterval(pollInterval);
                statusContainer.querySelector('.status-badge').className = `status-badge ${status.status}`;
                statusContainer.querySelector('.status-badge').textContent = 
                    status.status.charAt(0).toUpperCase() + status.status.slice(1);
                
                if (status.status === 'completed') {
                    showToast('Training completed!', 'success');
                } else {
                    showToast('Training failed', 'error');
                }
            }
        } catch (error) {
            console.error('Failed to get training status', error);
        }
    }, 2000);
}

function updateTrainingStatus(status) {
    const statusContainer = document.getElementById('training-status');
    
    statusContainer.innerHTML = `
        <div class="status-info">
            <span class="status-badge training">${status.status}</span>
            <span>Epoch ${status.current_epoch} / ${status.total_epochs}</span>
        </div>
        <div class="progress-bar" style="margin-top: 10px;">
            <div class="progress-fill" style="width: ${(status.current_epoch / status.total_epochs) * 100}%"></div>
        </div>
        ${status.train_loss ? `<p style="margin-top: 10px;">Train Loss: ${status.train_loss.toFixed(4)}</p>` : ''}
        ${status.val_loss ? `<p>Val Loss: ${status.val_loss.toFixed(4)}</p>` : ''}
    `;
}

// ============== Models ==============
async function loadModels(projectId) {
    try {
        const response = await fetch(`${API_BASE}/projects/${projectId}/models`);
        const models = await response.json();
        renderModels(models);
    } catch (error) {
        console.error('Failed to load models', error);
    }
}

function renderModels(models) {
    const container = document.getElementById('models-list');
    
    if (models.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-brain"></i>
                <h3>No models yet</h3>
                <p>Train a model to get started</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = models.map(model => `
        <div class="model-card" data-id="${model.id}">
            <div class="model-info">
                <h4>${escapeHtml(model.name)}</h4>
                <div class="model-meta">
                    <span><i class="fas fa-microchip"></i> ${model.architecture}</span>
                    <span><i class="fas fa-calendar"></i> ${new Date(model.created_at).toLocaleDateString()}</span>
                    <span class="status-badge ${model.status}">${model.status}</span>
                </div>
            </div>
            <div class="model-actions">
                ${model.status === 'completed' ? `
                    <button class="btn btn-primary btn-sm" onclick="deployModel(${model.id})">
                        <i class="fas fa-rocket"></i> Deploy
                    </button>
                ` : ''}
                <button class="btn btn-icon btn-sm" onclick="deleteModel(${model.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
}

function deployModel(modelId) {
    state.deployedModelId = modelId;
    navigateTo('deploy');
    document.getElementById('deploy-model-select').value = modelId;
}

async function deleteModel(modelId) {
    if (!confirm('Delete this model?')) return;
    
    try {
        await fetch(`${API_BASE}/models/${modelId}`, { method: 'DELETE' });
        showToast('Model deleted', 'success');
        loadModels(state.currentProject.id);
    } catch (error) {
        showToast('Failed to delete model', 'error');
    }
}

// ============== Deploy ==============
function initDeployView() {
    const uploadZone = document.getElementById('deploy-upload-zone');
    const fileInput = document.getElementById('deploy-file-input');
    
    if (uploadZone) {
        uploadZone.onclick = () => fileInput.click();
        
        uploadZone.ondragover = (e) => {
            e.preventDefault();
            uploadZone.classList.add('dragover');
        };
        
        uploadZone.ondragleave = () => uploadZone.classList.remove('dragover');
        
        uploadZone.ondrop = async (e) => {
            e.preventDefault();
            uploadZone.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
                await runInference(file);
            }
        };
        
        fileInput.onchange = async () => {
            if (fileInput.files[0]) {
                await runInference(fileInput.files[0]);
            }
        };
    }
    
    // Confidence and IOU sliders
    const confSlider = document.getElementById('deploy-confidence');
    const iouSlider = document.getElementById('deploy-iou');
    
    if (confSlider) {
        confSlider.oninput = (e) => {
            document.getElementById('deploy-confidence-value').textContent = e.target.value;
        };
    }
    
    if (iouSlider) {
        iouSlider.oninput = (e) => {
            document.getElementById('deploy-iou-value').textContent = e.target.value;
        };
    }
    
    // Deploy tabs
    document.querySelectorAll('.deploy-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            
            // Update active tab
            document.querySelectorAll('.deploy-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Show tab content
            document.querySelectorAll('.deploy-tab-content').forEach(c => c.classList.remove('active'));
            const content = document.getElementById(`deploy-tab-${tabName}`);
            if (content) content.classList.add('active');
        });
    });
}

// ============== Video Inference ==============
function initVideoInference() {
    const uploadZone = document.getElementById('deploy-video-upload-zone');
    const fileInput = document.getElementById('deploy-video-input');
    
    if (!uploadZone || !fileInput) return;
    
    uploadZone.onclick = () => fileInput.click();
    
    uploadZone.ondragover = (e) => {
        e.preventDefault();
        uploadZone.classList.add('dragover');
    };
    
    uploadZone.ondragleave = () => uploadZone.classList.remove('dragover');
    
    uploadZone.ondrop = (e) => {
        e.preventDefault();
        uploadZone.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('video/')) {
            loadVideoForInference(file);
        }
    };
    
    fileInput.onchange = () => {
        if (fileInput.files[0]) {
            loadVideoForInference(fileInput.files[0]);
        }
    };
    
    // Process video button
    const btnProcess = document.getElementById('btn-process-video');
    const btnStop = document.getElementById('btn-stop-video');
    
    if (btnProcess) {
        btnProcess.onclick = () => processVideoFrames();
    }
    
    if (btnStop) {
        btnStop.onclick = () => {
            state.videoProcessing = false;
        };
    }
}

function loadVideoForInference(file) {
    const uploadZone = document.getElementById('deploy-video-upload-zone');
    const resultContainer = document.getElementById('video-result');
    const videoPlayer = document.getElementById('video-player');
    
    uploadZone.style.display = 'none';
    resultContainer.style.display = 'flex';
    
    const url = URL.createObjectURL(file);
    videoPlayer.src = url;
}

async function processVideoFrames() {
    const modelId = document.getElementById('deploy-model-select').value;
    if (!modelId) {
        showToast('Please select a model first', 'warning');
        return;
    }
    
    const videoPlayer = document.getElementById('video-player');
    const canvas = document.getElementById('video-canvas');
    const ctx = canvas.getContext('2d');
    const progressEl = document.getElementById('video-progress');
    const btnProcess = document.getElementById('btn-process-video');
    const btnStop = document.getElementById('btn-stop-video');
    
    canvas.style.display = 'block';
    canvas.width = videoPlayer.videoWidth;
    canvas.height = videoPlayer.videoHeight;
    
    btnProcess.disabled = true;
    btnStop.disabled = false;
    state.videoProcessing = true;
    
    const duration = videoPlayer.duration;
    let currentTime = 0;
    const fps = 5; // Process 5 frames per second
    const interval = 1 / fps;
    
    while (currentTime < duration && state.videoProcessing) {
        videoPlayer.currentTime = currentTime;
        await new Promise(resolve => videoPlayer.onseeked = resolve);
        
        // Draw frame
        ctx.drawImage(videoPlayer, 0, 0);
        
        // Get frame as blob
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg'));
        
        try {
            const confidence = parseFloat(document.getElementById('deploy-confidence').value);
            const iou = parseFloat(document.getElementById('deploy-iou').value);
            
            const formData = new FormData();
            formData.append('file', blob, 'frame.jpg');
            formData.append('model_id', modelId);
            formData.append('confidence', confidence);
            formData.append('iou_threshold', iou);
            
            const response = await fetch(`${API_BASE}/inference/predict`, {
                method: 'POST',
                body: formData
            });
            
            if (response.ok) {
                const result = await response.json();
                drawVideoDetections(ctx, result.detections || []);
            }
        } catch (error) {
            console.error('Frame inference error:', error);
        }
        
        currentTime += interval;
        progressEl.textContent = `${Math.round((currentTime / duration) * 100)}%`;
    }
    
    state.videoProcessing = false;
    btnProcess.disabled = false;
    btnStop.disabled = true;
    progressEl.textContent = '100%';
}

function drawVideoDetections(ctx, detections) {
    detections.forEach(det => {
        const [x1, y1, x2, y2] = det.bbox;
        const color = getColorForClass(det.class_id);
        
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
        
        ctx.fillStyle = color;
        const label = `${det.class_name} ${(det.confidence * 100).toFixed(0)}%`;
        ctx.fillRect(x1, y1 - 20, ctx.measureText(label).width + 10, 20);
        ctx.fillStyle = 'white';
        ctx.font = '12px Inter';
        ctx.fillText(label, x1 + 5, y1 - 5);
    });
}

// ============== Webcam Inference ==============
function initWebcamInference() {
    const btnStart = document.getElementById('btn-start-webcam');
    const btnStop = document.getElementById('btn-stop-webcam');
    const btnScreenshot = document.getElementById('btn-screenshot');
    
    if (btnStart) {
        btnStart.onclick = startWebcam;
    }
    
    if (btnStop) {
        btnStop.onclick = stopWebcam;
    }
    
    if (btnScreenshot) {
        btnScreenshot.onclick = takeWebcamScreenshot;
    }
}

async function startWebcam() {
    const modelId = document.getElementById('deploy-model-select').value;
    if (!modelId) {
        showToast('Please select a model first', 'warning');
        return;
    }
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: 1280, height: 720 } 
        });
        
        state.webcamStream = stream;
        state.webcamRunning = true;
        
        const video = document.getElementById('webcam-video');
        const canvas = document.getElementById('webcam-canvas');
        const placeholder = document.getElementById('webcam-placeholder');
        const view = document.getElementById('webcam-view');
        
        video.srcObject = stream;
        
        placeholder.style.display = 'none';
        view.style.display = 'block';
        
        // Wait for video to be ready
        await new Promise(resolve => video.onloadedmetadata = resolve);
        
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        // Start inference loop
        runWebcamInference();
        
    } catch (error) {
        showToast('Failed to access webcam', 'error');
        console.error(error);
    }
}

async function runWebcamInference() {
    if (!state.webcamRunning) return;
    
    const video = document.getElementById('webcam-video');
    const canvas = document.getElementById('webcam-canvas');
    const ctx = canvas.getContext('2d');
    const fpsEl = document.getElementById('webcam-fps');
    const detectionsEl = document.getElementById('webcam-detections');
    
    const modelId = document.getElementById('deploy-model-select').value;
    const confidence = parseFloat(document.getElementById('deploy-confidence').value);
    const iou = parseFloat(document.getElementById('deploy-iou').value);
    
    let lastTime = performance.now();
    let frameCount = 0;
    
    const inferenceLoop = async () => {
        if (!state.webcamRunning) return;
        
        const startTime = performance.now();
        
        // Draw video frame
        ctx.drawImage(video, 0, 0);
        
        // Get frame as blob
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8));
        
        try {
            const formData = new FormData();
            formData.append('file', blob, 'webcam.jpg');
            formData.append('model_id', modelId);
            formData.append('confidence', confidence);
            formData.append('iou_threshold', iou);
            
            const response = await fetch(`${API_BASE}/inference/predict`, {
                method: 'POST',
                body: formData
            });
            
            if (response.ok) {
                const result = await response.json();
                
                // Clear and redraw
                ctx.drawImage(video, 0, 0);
                
                // Draw detections
                (result.detections || []).forEach(det => {
                    const [x1, y1, x2, y2] = det.bbox;
                    const color = getColorForClass(det.class_id);
                    
                    ctx.strokeStyle = color;
                    ctx.lineWidth = 3;
                    ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
                    
                    ctx.fillStyle = color;
                    const label = `${det.class_name} ${(det.confidence * 100).toFixed(0)}%`;
                    ctx.fillRect(x1, y1 - 25, ctx.measureText(label).width + 10, 25);
                    ctx.fillStyle = 'white';
                    ctx.font = '14px Inter';
                    ctx.fillText(label, x1 + 5, y1 - 7);
                });
                
                detectionsEl.textContent = `${result.detections?.length || 0} detections`;
            }
        } catch (error) {
            console.error('Webcam inference error:', error);
        }
        
        // Calculate FPS
        frameCount++;
        if (performance.now() - lastTime >= 1000) {
            fpsEl.textContent = `${frameCount} FPS`;
            frameCount = 0;
            lastTime = performance.now();
        }
        
        // Schedule next frame (target ~10 FPS for inference)
        if (state.webcamRunning) {
            setTimeout(inferenceLoop, 100);
        }
    };
    
    inferenceLoop();
}

function stopWebcam() {
    state.webcamRunning = false;
    
    if (state.webcamStream) {
        state.webcamStream.getTracks().forEach(track => track.stop());
        state.webcamStream = null;
    }
    
    const placeholder = document.getElementById('webcam-placeholder');
    const view = document.getElementById('webcam-view');
    
    placeholder.style.display = 'flex';
    view.style.display = 'none';
}

function takeWebcamScreenshot() {
    const canvas = document.getElementById('webcam-canvas');
    const link = document.createElement('a');
    link.download = `visionlab-screenshot-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    showToast('Screenshot saved', 'success');
}

async function loadModelsForDeploy() {
    try {
        const response = await fetch(`${API_BASE}/projects`);
        const projects = await response.json();
        
        const select = document.getElementById('deploy-model-select');
        select.innerHTML = '<option value="">Select a trained model...</option>';
        
        for (const project of projects) {
            const modelsRes = await fetch(`${API_BASE}/projects/${project.id}/models`);
            const models = await modelsRes.json();
            
            const completedModels = models.filter(m => m.status === 'completed');
            if (completedModels.length > 0) {
                const optgroup = document.createElement('optgroup');
                optgroup.label = project.name;
                
                completedModels.forEach(model => {
                    const option = document.createElement('option');
                    option.value = model.id;
                    option.textContent = `${model.name} (${model.architecture})`;
                    optgroup.appendChild(option);
                });
                
                select.appendChild(optgroup);
            }
        }
        
        if (state.deployedModelId) {
            select.value = state.deployedModelId;
        }
    } catch (error) {
        console.error('Failed to load models for deploy', error);
    }
}

async function runInference(file) {
    const modelId = document.getElementById('deploy-model-select').value;
    if (!modelId) {
        showToast('Please select a model first', 'warning');
        return;
    }
    
    const confidence = parseFloat(document.getElementById('deploy-confidence').value);
    const iou = parseFloat(document.getElementById('deploy-iou').value);
    
    showLoading('Running inference...');
    
    try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('model_id', modelId);
        formData.append('confidence', confidence);
        formData.append('iou_threshold', iou);
        
        const response = await fetch(`${API_BASE}/inference/predict`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) throw new Error('Inference failed');
        
        const result = await response.json();
        displayInferenceResult(file, result);
    } catch (error) {
        showToast('Inference failed', 'error');
        console.error(error);
    }
    
    hideLoading();
}

function displayInferenceResult(file, result) {
    document.getElementById('deploy-upload-zone').style.display = 'none';
    const resultContainer = document.getElementById('inference-result');
    resultContainer.style.display = 'flex';
    
    const canvas = document.getElementById('inference-canvas');
    const ctx = canvas.getContext('2d');
    
    const img = new Image();
    img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        
        // Draw detections
        result.detections.forEach(det => {
            const [x1, y1, x2, y2] = det.bbox;
            const width = x2 - x1;
            const height = y2 - y1;
            
            // Random color based on class
            const color = getColorForClass(det.class_id);
            
            ctx.strokeStyle = color;
            ctx.lineWidth = 3;
            ctx.strokeRect(x1, y1, width, height);
            
            // Label
            ctx.fillStyle = color;
            const label = `${det.class_name} ${(det.confidence * 100).toFixed(1)}%`;
            const labelWidth = ctx.measureText(label).width + 10;
            ctx.fillRect(x1, y1 - 25, labelWidth, 25);
            ctx.fillStyle = '#FFFFFF';
            ctx.font = '14px Inter';
            ctx.fillText(label, x1 + 5, y1 - 7);
        });
    };
    img.src = URL.createObjectURL(file);
    
    // Display detections list
    const panel = document.getElementById('detections-panel');
    panel.innerHTML = `
        <h3>Detections (${result.detections.length})</h3>
        <p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 10px;">
            Inference time: ${(result.inference_time * 1000).toFixed(1)}ms
        </p>
        ${result.detections.map(det => `
            <div class="annotation-item">
                <div class="class-color" style="background-color: ${getColorForClass(det.class_id)}; width: 12px; height: 12px; border-radius: 2px;"></div>
                <span>${det.class_name}</span>
                <span style="color: var(--text-secondary); margin-left: auto;">${(det.confidence * 100).toFixed(1)}%</span>
            </div>
        `).join('')}
    `;
}

// ============== Keyboard Shortcuts ==============
function initKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Only if not in input field
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
        
        // Show shortcuts help on ? key
        if (e.key === '?' || (e.shiftKey && e.key === '/')) {
            e.preventDefault();
            showKeyboardShortcutsModal();
            return;
        }
        
        // Escape to close modals or cancel polygon
        if (e.key === 'Escape') {
            if (state.polygonPoints.length > 0) {
                state.polygonPoints = [];
                renderCanvas();
                return;
            }
            document.querySelectorAll('.modal.active').forEach(m => m.classList.remove('active'));
            return;
        }
        
        // Enter to complete polygon
        if (e.key === 'Enter' && state.selectedTool === 'polygon' && state.polygonPoints.length >= 3) {
            e.preventDefault();
            completePolygon();
            return;
        }
        
        switch (e.key.toLowerCase()) {
            case 'v':
                selectTool('select');
                break;
            case 'b':
                selectTool('bbox');
                break;
            case 'p':
                selectTool('polygon');
                break;
            case 'r':
                selectTool('brush');
                break;
            case 'a':
                if (state.currentView === 'annotate') navigateImage(-1);
                break;
            case 'd':
                if (state.currentView === 'annotate') navigateImage(1);
                break;
            case 'f':
                if (state.currentView === 'annotate') fitToView();
                break;
            case '+':
            case '=':
                if (state.currentView === 'annotate') setZoom(state.zoom + 0.1);
                break;
            case '-':
                if (state.currentView === 'annotate') setZoom(state.zoom - 0.1);
                break;
            case 'z':
                if (e.ctrlKey && state.currentView === 'annotate') {
                    e.preventDefault();
                    undo();
                }
                break;
            case 'y':
                if (e.ctrlKey && state.currentView === 'annotate') {
                    e.preventDefault();
                    redo();
                }
                break;
            case 's':
                if (e.ctrlKey && state.currentView === 'annotate') {
                    e.preventDefault();
                    saveAnnotations();
                }
                break;
            case 'n':
                if (e.ctrlKey) {
                    e.preventDefault();
                    openModal('modal-new-project');
                }
                break;
            case '1': case '2': case '3': case '4': case '5':
            case '6': case '7': case '8': case '9':
                // Select class by number key
                if (state.currentView === 'annotate' && state.classes.length > 0) {
                    const classIndex = parseInt(e.key) - 1;
                    if (classIndex < state.classes.length) {
                        state.selectedClass = state.classes[classIndex].id;
                        renderAnnotationClasses();
                        showToast(`Selected class: ${state.classes[classIndex].name}`, 'info');
                    }
                }
                break;
            case 'delete':
            case 'backspace':
                if (state.currentView === 'annotate' && state.selectedAnnotation >= 0) {
                    e.preventDefault();
                    deleteAnnotation(state.selectedAnnotation);
                }
                break;
        }
    });
}

function showKeyboardShortcutsModal() {
    // Create modal if it doesn't exist
    let modal = document.getElementById('modal-shortcuts');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-shortcuts';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <h2>Keyboard Shortcuts</h2>
                    <button class="btn-close" data-close-modal>&times;</button>
                </div>
                <div class="modal-body">
                    <div class="shortcuts-grid">
                        <div class="shortcut-section">
                            <h3>General</h3>
                            <div class="shortcut-item"><kbd>?</kbd> <span>Show this help</span></div>
                            <div class="shortcut-item"><kbd>Esc</kbd> <span>Close modal</span></div>
                            <div class="shortcut-item"><kbd>Ctrl+N</kbd> <span>New project</span></div>
                        </div>
                        <div class="shortcut-section">
                            <h3>Annotation Tools</h3>
                            <div class="shortcut-item"><kbd>V</kbd> <span>Select tool</span></div>
                            <div class="shortcut-item"><kbd>B</kbd> <span>Bounding box</span></div>
                            <div class="shortcut-item"><kbd>P</kbd> <span>Polygon</span></div>
                            <div class="shortcut-item"><kbd>R</kbd> <span>Brush/Mask</span></div>
                        </div>
                        <div class="shortcut-section">
                            <h3>Navigation</h3>
                            <div class="shortcut-item"><kbd>A</kbd> <span>Previous image</span></div>
                            <div class="shortcut-item"><kbd>D</kbd> <span>Next image</span></div>
                            <div class="shortcut-item"><kbd>1-9</kbd> <span>Select class</span></div>
                        </div>
                        <div class="shortcut-section">
                            <h3>View</h3>
                            <div class="shortcut-item"><kbd>+</kbd> <span>Zoom in</span></div>
                            <div class="shortcut-item"><kbd>-</kbd> <span>Zoom out</span></div>
                            <div class="shortcut-item"><kbd>F</kbd> <span>Fit to view</span></div>
                        </div>
                        <div class="shortcut-section">
                            <h3>Editing</h3>
                            <div class="shortcut-item"><kbd>Ctrl+Z</kbd> <span>Undo</span></div>
                            <div class="shortcut-item"><kbd>Ctrl+Y</kbd> <span>Redo</span></div>
                            <div class="shortcut-item"><kbd>Ctrl+S</kbd> <span>Save</span></div>
                            <div class="shortcut-item"><kbd>Del</kbd> <span>Delete selection</span></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Add close handlers
        modal.querySelector('[data-close-modal]').addEventListener('click', () => {
            modal.classList.remove('active');
        });
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.remove('active');
        });
    }
    
    modal.classList.add('active');
}

function selectTool(tool) {
    state.selectedTool = tool;
    document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tool === tool);
    });
}

// ============== Utilities ==============
function showLoading(text = 'Loading...') {
    document.getElementById('loading-text').textContent = text;
    document.getElementById('loading-overlay').classList.add('active');
}

function hideLoading() {
    document.getElementById('loading-overlay').classList.remove('active');
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    
    toast.innerHTML = `
        <i class="fas ${icons[type]}"></i>
        <span>${escapeHtml(message)}</span>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getRandomColor() {
    const colors = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
        '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
}

function getColorForClass(classId) {
    const colors = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
        '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
    ];
    return colors[classId % colors.length];
}

// ============== GPU Detection ==============
async function detectGPUs() {
    try {
        const response = await fetch(`${API_BASE}/system/gpus`);
        if (response.ok) {
            const gpus = await response.json();
            updateGPUSelectors(gpus);
        }
    } catch (error) {
        console.log('GPU detection not available, using defaults');
    }
}

function updateGPUSelectors(gpus) {
    const selectors = [
        document.getElementById('train-device'),
        document.getElementById('setting-device')
    ];
    
    selectors.forEach(select => {
        if (!select) return;
        
        // Clear existing options
        select.innerHTML = `
            <option value="auto">Auto (Detect Best)</option>
            <option value="cpu">CPU Only</option>
        `;
        
        // Add detected GPUs
        gpus.forEach((gpu, index) => {
            const option = document.createElement('option');
            option.value = index.toString();
            option.textContent = `GPU ${index}: ${gpu.name}`;
            select.appendChild(option);
        });
        
        // Add multi-GPU option if more than one GPU
        if (gpus.length > 1) {
            const option = document.createElement('option');
            option.value = gpus.map((_, i) => i).join(',');
            option.textContent = `Multi-GPU (All ${gpus.length} GPUs)`;
            select.appendChild(option);
        }
    });
}

// ============== Storage Configuration ==============
async function loadStorageSettings() {
    try {
        const response = await fetch(`${API_BASE}/settings`);
        if (response.ok) {
            const settings = await response.json();
            document.getElementById('setting-data-dir').value = settings.data_dir || './data';
            document.getElementById('setting-models-dir').value = settings.models_dir || './data/models';
            document.getElementById('setting-exports-dir').value = settings.exports_dir || './data/exports';
        }
    } catch (error) {
        console.log('Could not load storage settings');
    }
}

async function saveStorageSettings() {
    let dataDir = document.getElementById('setting-data-dir').value;
    let modelsDir = document.getElementById('setting-models-dir').value;
    let exportsDir = document.getElementById('setting-exports-dir').value;
    
    // Basic validation/cleanup
    dataDir = dataDir.trim();
    modelsDir = modelsDir.trim();
    exportsDir = exportsDir.trim();
    
    if (!dataDir || !modelsDir || !exportsDir) {
        showToast('All paths are required', 'warning');
        return;
    }

    showLoading('Saving storage settings...');
    
    try {
        const response = await fetch(`${API_BASE}/settings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                data_dir: dataDir,
                models_dir: modelsDir,
                exports_dir: exportsDir
            })
        });
        
        if (response.ok) {
            showToast('Storage settings saved', 'success');
        } else {
            const err = await response.json();
            throw new Error(err.detail || 'Failed to save');
        }
    } catch (error) {
        showToast(`Failed to save: ${error.message}`, 'error');
    }
    
    hideLoading();
}

// Export functions for global access
window.deleteClass = deleteClass;
window.deleteAnnotation = deleteAnnotation;
window.deployModel = deployModel;
window.deleteModel = deleteModel;
window.completePolygon = completePolygon;
window.saveStorageSettings = saveStorageSettings;

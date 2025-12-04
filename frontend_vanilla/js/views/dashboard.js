// Dashboard View
(function() {
    async function renderDashboard() {
        const main = document.getElementById('main-view');
        
        main.innerHTML = `
            <div class="view-container">
                <div class="flex justify-between items-center mb-4">
                    <div>
                        <h1>Projects</h1>
                        <p>Manage your computer vision projects</p>
                    </div>
                    <button class="btn btn-primary" id="btn-create-project">
                        <i class="fas fa-plus"></i> New Project
                    </button>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" id="projects-grid">
                    <div class="card"><p>Loading projects...</p></div>
                </div>
            </div>
        `;

        try {
            const projects = await window.VisionLab.api.get('/projects');
            window.VisionLab.store.setState({ projects });
            renderProjectList(projects);
        } catch (error) {
            document.getElementById('projects-grid').innerHTML = `
                <div class="card text-error">Failed to load projects: ${error.message}</div>
            `;
        }

        document.getElementById('btn-create-project').addEventListener('click', () => {
            window.VisionLab.components.modals.open('createProject');
        });
    }

    function renderProjectList(projects) {
        const grid = document.getElementById('projects-grid');
        
        if (projects.length === 0) {
            grid.innerHTML = `
                <div class="card empty-state col-span-full text-center p-6">
                    <i class="fas fa-folder-open" style="font-size: 3rem; color: var(--color-accents-3); margin-bottom: 1rem;"></i>
                    <h3>No Projects Yet</h3>
                    <p>Create your first project to get started.</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = projects.map(project => `
            <div class="card project-card" onclick="window.location.hash = '#/projects/${project.id}'">
                <div class="card-header">
                    <div class="flex justify-between items-start">
                        <div class="badge badge-default mb-2">${project.project_type}</div>
                        <i class="fas fa-ellipsis-v text-muted"></i>
                    </div>
                    <h3 class="card-title">${project.name}</h3>
                    <p class="card-description">${project.description || 'No description'}</p>
                </div>
                <div class="card-footer text-sm text-muted">
                    <span>${new Date(project.created_at).toLocaleDateString()}</span>
                    <span>${project.classes?.length || 0} Classes</span>
                </div>
            </div>
        `).join('');
    }

    window.VisionLab.views.dashboard = renderDashboard;
})();

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
            <div class="card project-card" onclick="if(!event.target.closest('.dropdown')) window.location.hash = '#/projects/${project.id}'">
                <div class="card-header">
                    <div class="flex justify-between items-start">
                        <div class="badge badge-default mb-2">${project.project_type}</div>
                        <div class="dropdown relative">
                            <button class="btn btn-icon btn-ghost btn-sm" onclick="event.stopPropagation(); this.nextElementSibling.classList.toggle('hidden')">
                                <i class="fas fa-ellipsis-v text-muted"></i>
                            </button>
                            <div class="dropdown-menu hidden absolute right-0 mt-1 w-32 bg-card-bg border border-border rounded-md shadow-lg z-10">
                                <button class="w-full text-left px-4 py-2 text-sm hover:bg-accents-2 text-error" onclick="event.stopPropagation(); window.VisionLab.views.deleteProject(${project.id})">
                                    <i class="fas fa-trash-alt mr-2"></i> Delete
                                </button>
                            </div>
                        </div>
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

        // Close dropdowns when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.dropdown')) {
                document.querySelectorAll('.dropdown-menu').forEach(el => el.classList.add('hidden'));
            }
        });
    }

    window.VisionLab.views.deleteProject = async (id) => {
        if (confirm('Are you sure you want to delete this project?')) {
            try {
                await window.VisionLab.api.delete(`/projects/${id}`);
                // Refresh
                window.VisionLab.views.dashboard();
            } catch (error) {
                alert('Failed to delete project: ' + error.message);
            }
        }
    };

    window.VisionLab.views.dashboard = renderDashboard;
})();

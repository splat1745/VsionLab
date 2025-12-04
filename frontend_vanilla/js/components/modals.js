// Modal Component Logic
(function() {
    const modals = {
        createProject: `
            <div id="modal-create-project" class="modal">
                <div class="modal-content">
                    <h2>Create New Project</h2>
                    <form id="create-project-form">
                        <div class="form-group">
                            <label class="form-label">Project Name</label>
                            <input type="text" name="name" class="form-control" placeholder="My Awesome Project" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Description</label>
                            <textarea name="description" class="form-control" placeholder="What's this project about?"></textarea>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Project Type</label>
                            <select name="project_type" class="form-control">
                                <option value="object_detection">Object Detection</option>
                                <option value="classification">Classification</option>
                                <option value="segmentation">Segmentation</option>
                            </select>
                        </div>
                        <div class="flex justify-end gap-2 mt-6">
                            <button type="button" class="btn btn-secondary" onclick="window.VisionLab.components.modals.close('createProject')">Cancel</button>
                            <button type="submit" class="btn btn-primary">Create Project</button>
                        </div>
                    </form>
                </div>
            </div>
        `,
        uploadImage: `
            <div id="modal-upload-image" class="modal">
                <div class="modal-content">
                    <h2>Upload Images</h2>
                    <form id="upload-image-form">
                        <div class="form-group">
                            <label class="form-label">Select Images</label>
                            <input type="file" name="files" class="form-control" multiple accept="image/*" required>
                        </div>
                        <div class="flex justify-end gap-2 mt-6">
                            <button type="button" class="btn btn-secondary" onclick="window.VisionLab.components.modals.close('uploadImage')">Cancel</button>
                            <button type="submit" class="btn btn-primary">Upload</button>
                        </div>
                    </form>
                </div>
            </div>
        `
    };

    function initModals() {
        // Inject modals into body
        const modalContainer = document.createElement('div');
        modalContainer.id = 'modal-container';
        modalContainer.innerHTML = Object.values(modals).join('');
        document.body.appendChild(modalContainer);

        // Event Listeners
        document.getElementById('create-project-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData.entries());
            data.classes = []; // Initialize with empty classes

            try {
                btn.disabled = true;
                btn.textContent = 'Creating...';
                
                await window.VisionLab.api.post('/projects', data);
                
                close('createProject');
                e.target.reset();
                
                // Refresh Dashboard
                if (window.VisionLab.views.dashboard) {
                    window.VisionLab.views.dashboard();
                }
            } catch (error) {
                alert('Failed to create project: ' + error.message);
            } finally {
                btn.disabled = false;
                btn.textContent = 'Create Project';
            }
        });

        document.getElementById('upload-image-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            const formData = new FormData(e.target);
            const projectId = window.VisionLab.store.getState().currentProject.id;

            try {
                btn.disabled = true;
                btn.textContent = 'Uploading...';
                
                await window.VisionLab.api.postForm(`/projects/${projectId}/images`, formData);
                
                close('uploadImage');
                e.target.reset();
                
                // Refresh Project View
                if (window.VisionLab.views.project) {
                    window.VisionLab.views.project({ id: projectId });
                }
            } catch (error) {
                alert('Failed to upload images: ' + error.message);
            } finally {
                btn.disabled = false;
                btn.textContent = 'Upload';
            }
        });
    }

    function open(modalName) {
        const modal = document.getElementById(`modal-${modalName.replace(/([A-Z])/g, '-$1').toLowerCase()}`);
        if (modal) {
            modal.classList.add('active');
            modal.style.display = 'flex';
        }
    }

    function close(modalName) {
        const modal = document.getElementById(`modal-${modalName.replace(/([A-Z])/g, '-$1').toLowerCase()}`);
        if (modal) {
            modal.classList.remove('active');
            modal.style.display = 'none';
        }
    }

    window.VisionLab.components.modals = {
        init: initModals,
        open,
        close
    };
})();

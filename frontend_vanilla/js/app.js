// Main Application Entry Point
(function() {
    const app = {
        init: async () => {
            console.log('VisionLab Initializing...');
            
            // Initialize Router
            const Router = window.VisionLab.Router;
            const views = window.VisionLab.views;

            // Initialize Modals
            if (window.VisionLab.components.modals) {
                window.VisionLab.components.modals.init();
            }

            function renderPlaceholder(title) {
                const main = document.getElementById('main-view');
                main.innerHTML = `
                    <div class="view-container">
                        <h1>${title}</h1>
                        <p>This view is under construction.</p>
                    </div>
                `;
            }

            app.router = new Router({
                '/': views.dashboard,
                '/projects': views.dashboard,
                '/universe': views.universe,
                '/settings': views.settings,
                '/login': views.login,
                '/projects/:id': (params) => views.project(params)
            });

            // Force initial route handling
            app.router.handleRoute();
        }
    };

    window.VisionLab.app = app;
    
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', app.init);
    } else {
        app.init();
    }
})();

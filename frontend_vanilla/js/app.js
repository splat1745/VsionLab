import { Router } from './router.js';
import { api } from './api.js';
import { store } from './state.js';

import { renderLogin } from './views/login.js';
import { renderDashboard } from './views/dashboard.js';
import { renderProject } from './views/project.js';

const app = {
    init: async () => {
        console.log('VisionLab Initializing...');
        
        // Check Auth
        const token = localStorage.getItem('access_token');
        if (!token && window.location.hash !== '#/login' && window.location.hash !== '#/register') {
            window.location.hash = '#/login';
        }

        // Initialize Router
        app.router = new Router({
            '/': renderDashboard,
            '/projects': renderDashboard,
            '/universe': () => renderPlaceholder('Universe'),
            '/settings': () => renderPlaceholder('Settings'),
            '/login': renderLogin,
            '/projects/:id': (params) => renderProject(params)
        });
    }
};

// Temporary placeholder renderer
function renderPlaceholder(title) {
    const main = document.getElementById('main-view');
    main.innerHTML = `
        <div class="view-container">
            <h1>${title}</h1>
            <p>This view is under construction.</p>
        </div>
    `;
}

window.app = app;
app.init();

// Hash-based Router
(function() {
    class Router {
        constructor(routes) {
            this.routes = routes;
            this.currentRoute = null;
            
            window.addEventListener('hashchange', () => this.handleRoute());
        }

        async handleRoute() {
            const hash = window.location.hash.slice(1) || '/';
            console.log('Route changed to:', hash);

            let match = null;
            let params = {};

            for (const route in this.routes) {
                if (route === hash) {
                    match = route;
                    break;
                }
                if (route.includes(':')) {
                    const routeParts = route.split('/');
                    const hashParts = hash.split('/');
                    
                    if (routeParts.length === hashParts.length) {
                        let isMatch = true;
                        const tempParams = {};
                        
                        for (let i = 0; i < routeParts.length; i++) {
                            if (routeParts[i].startsWith(':')) {
                                tempParams[routeParts[i].slice(1)] = hashParts[i];
                            } else if (routeParts[i] !== hashParts[i]) {
                                isMatch = false;
                                break;
                            }
                        }
                        
                        if (isMatch) {
                            match = route;
                            params = tempParams;
                            break;
                        }
                    }
                }
            }

            if (match) {
                this.currentRoute = match;
                const view = this.routes[match];
                await view(params);
                this.updateActiveNav(hash);
            } else {
                console.log('404 Not Found');
                if (hash !== '/') window.location.hash = '/';
            }
        }

        navigate(path) {
            window.location.hash = path;
        }

        updateActiveNav(path) {
            document.querySelectorAll('.nav-item').forEach(el => {
                el.classList.remove('active');
                const onclick = el.getAttribute('onclick');
                if (onclick && path.includes(onclick.split("'")[1])) {
                    el.classList.add('active');
                }
            });
        }
    }

    window.VisionLab.Router = Router;
})();

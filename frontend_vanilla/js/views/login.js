// Login View
(function() {
    async function renderLogin() {
        const main = document.getElementById('main-view');
        main.innerHTML = `
            <div class="flex items-center justify-center" style="height: 80vh;">
                <div class="card card-glass" style="width: 100%; max-width: 400px;">
                    <div class="text-center mb-4">
                        <div class="logo-icon" style="margin: 0 auto 1rem; width: 48px; height: 48px; font-size: 1.5rem;">V</div>
                        <h2>Welcome Back</h2>
                        <p>Enter your credentials to access VisionLab</p>
                    </div>
                    
                    <form id="login-form">
                        <div class="form-group">
                            <label class="form-label">Username</label>
                            <input type="text" name="username" class="form-control" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Password</label>
                            <input type="password" name="password" class="form-control" required>
                        </div>
                        <div id="login-error" class="text-error text-sm mb-4 hidden"></div>
                        <button type="submit" class="btn btn-primary" style="width: 100%;">Sign In</button>
                    </form>
                </div>
            </div>
        `;

        document.getElementById('login-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const errorEl = document.getElementById('login-error');
            const btn = e.target.querySelector('button');
            
            try {
                btn.disabled = true;
                btn.textContent = 'Signing in...';
                errorEl.classList.add('hidden');

                const response = await window.VisionLab.api.postForm('/token', formData);
                window.VisionLab.api.setToken(response.access_token);
                
                window.location.hash = '#/';
            } catch (error) {
                errorEl.textContent = 'Invalid credentials. Please try again.';
                errorEl.classList.remove('hidden');
            } finally {
                btn.disabled = false;
                btn.textContent = 'Sign In';
            }
        });
    }

    window.VisionLab.views.login = renderLogin;
})();

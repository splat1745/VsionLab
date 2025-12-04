// API Client Wrapper
(function() {
    const API_BASE_URL = 'http://localhost:8000/api';

    class ApiClient {
        constructor() {
            this.token = localStorage.getItem('access_token');
        }

        setToken(token) {
            this.token = token;
            localStorage.setItem('access_token', token);
        }

        clearToken() {
            this.token = null;
            localStorage.removeItem('access_token');
        }

        async request(endpoint, options = {}) {
            const headers = {
                'Content-Type': 'application/json',
                ...options.headers
            };

            if (this.token) {
                headers['Authorization'] = `Bearer ${this.token}`;
            }

            const config = {
                ...options,
                headers
            };

            try {
                const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
                
                if (response.status === 401) {
                    console.warn('Unauthorized request - proceeding without token');
                }

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.detail || 'API Request Failed');
                }

                return await response.json();
            } catch (error) {
                console.warn('API Error or Offline Mode:', error);
                console.log('Falling back to mock data for:', endpoint);
                return this.getMockData(endpoint);
            }
        }

        getMockData(endpoint) {
            // Mock Projects
            if (endpoint === '/projects') {
                return [
                    {
                        id: 1,
                        name: 'Traffic Detection',
                        description: 'Detecting cars and pedestrians in city traffic.',
                        project_type: 'object_detection',
                        created_at: new Date().toISOString(),
                        classes: ['car', 'person', 'bus', 'traffic_light']
                    },
                    {
                        id: 2,
                        name: 'Defect Detection',
                        description: 'Identifying manufacturing defects on PCB boards.',
                        project_type: 'object_detection',
                        created_at: new Date(Date.now() - 86400000).toISOString(),
                        classes: ['scratch', 'dent', 'missing_component']
                    }
                ];
            }
            
            // Mock Project Details
            if (endpoint.match(/^\/projects\/\d+$/)) {
                return {
                    id: 1,
                    name: 'Traffic Detection',
                    description: 'Detecting cars and pedestrians in city traffic.',
                    project_type: 'object_detection',
                    created_at: new Date().toISOString(),
                    classes: ['car', 'person', 'bus', 'traffic_light']
                };
            }

            // Mock Project Images
            if (endpoint.match(/^\/projects\/\d+\/images$/)) {
                return []; // Return empty array or mock images if needed
            }

            // Mock Token (Login)
            if (endpoint === '/token') {
                return { access_token: 'mock_token_123', token_type: 'bearer' };
            }

            // Mock Delete
            if (endpoint.match(/^\/projects\/\d+$/)) {
                return { success: true };
            }

            throw error; // Rethrow if no mock data
        }

        get(endpoint) {
            return this.request(endpoint, { method: 'GET' });
        }

        post(endpoint, data) {
            return this.request(endpoint, {
                method: 'POST',
                body: JSON.stringify(data)
            });
        }

        postForm(endpoint, formData) {
            return this.request(endpoint, {
                method: 'POST',
                headers: {}, // Let browser set Content-Type for FormData
                body: formData
            });
        }

        put(endpoint, data) {
            return this.request(endpoint, {
                method: 'PUT',
                body: JSON.stringify(data)
            });
        }

        delete(endpoint) {
            return this.request(endpoint, { method: 'DELETE' });
        }
    }

    window.VisionLab.api = new ApiClient();
})();

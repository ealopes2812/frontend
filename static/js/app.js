// WifiMaxx Monitor Web - JavaScript utilities and helpers

// Global application state
window.WifiMaxxApp = {
    currentData: [],
    charts: {},
    config: {
        refreshInterval: 30000, // 30 seconds
        apiTimeout: 10000, // 10 seconds
    }
};

// Utility functions
const Utils = {
    /**
     * Format date to Brazilian format
     */
    formatDate: (date) => {
        if (!date) return '';
        return new Date(date).toLocaleDateString('pt-BR');
    },

    /**
     * Format datetime to Brazilian format
     */
    formatDateTime: (datetime) => {
        if (!datetime) return '';
        return new Date(datetime).toLocaleString('pt-BR');
    },

    /**
     * Format number with thousands separator
     */
    formatNumber: (number) => {
        if (typeof number !== 'number') return number;
        return number.toLocaleString('pt-BR');
    },

    /**
     * Debounce function to limit API calls
     */
    debounce: (func, wait) => {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /**
     * Show toast notification
     */
    showToast: (message, type = 'success', duration = 5000) => {
        const toastContainer = document.getElementById('toastContainer') || createToastContainer();
        
        const toast = document.createElement('div');
        toast.className = `toast align-items-center text-white bg-${type} border-0`;
        toast.setAttribute('role', 'alert');
        toast.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">
                    ${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        `;
        
        toastContainer.appendChild(toast);
        
        const bsToast = new bootstrap.Toast(toast, { autohide: true, delay: duration });
        bsToast.show();
        
        // Remove toast from DOM after it's hidden
        toast.addEventListener('hidden.bs.toast', () => {
            toast.remove();
        });
    },

    /**
     * Copy text to clipboard
     */
    copyToClipboard: async (text) => {
        try {
            await navigator.clipboard.writeText(text);
            Utils.showToast('Texto copiado para a área de transferência!');
        } catch (err) {
            console.error('Erro ao copiar texto:', err);
            Utils.showToast('Erro ao copiar texto', 'danger');
        }
    },

    /**
     * Download data as CSV
     */
    downloadCSV: (data, filename) => {
        if (!data || data.length === 0) {
            Utils.showToast('Nenhum dado para exportar', 'warning');
            return;
        }

        const headers = Object.keys(data[0]);
        const csvContent = [
            headers.join(','),
            ...data.map(row => 
                headers.map(header => {
                    const value = row[header] || '';
                    // Escape quotes and wrap in quotes if contains comma
                    return `"${String(value).replace(/"/g, '""')}"`;
                }).join(',')
            )
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(url);
        Utils.showToast('Dados exportados com sucesso!');
    },

    /**
     * Get status badge class
     */
    getStatusBadgeClass: (status) => {
        if (!status) return 'bg-secondary';
        
        const statusLower = status.toLowerCase();
        if (statusLower.includes('operação') || statusLower.includes('online')) {
            return 'bg-success';
        } else if (statusLower.includes('atenção') || statusLower.includes('atencao')) {
            return 'bg-warning text-dark';
        } else if (statusLower.includes('inativo')) {
            return 'bg-danger';
        } else if (statusLower.includes('manutenção') || statusLower.includes('manutencao')) {
            return 'bg-info';
        }
        return 'bg-secondary';
    },

    /**
     * Format status text
     */
    formatStatus: (status) => {
        if (!status) return '';
        
        const statusMap = {
            'EM OPERAÇÃO': 'Online',
            'ATENCAO': 'Atenção',
            'INATIVO': 'Inativo',
            'MANUT': 'Manutenção'
        };
        
        return statusMap[status] || status;
    }
};

// API helper functions
const API = {
    /**
     * Generic fetch wrapper with error handling
     */
    fetch: async (url, options = {}) => {
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
            },
            ...options
        };

        try {
            const response = await fetch(url, defaultOptions);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            Utils.showToast(`Erro na API: ${error.message}`, 'danger');
            throw error;
        }
    },

    /**
     * Get dashboard data
     */
    getData: async (filters = {}) => {
        const params = new URLSearchParams(filters);
        return await API.fetch(`/api/data?${params}`);
    },

    /**
     * Get error data
     */
    getErrors: async (filters = {}) => {
        const params = new URLSearchParams(filters);
        return await API.fetch(`/api/errors?${params}`);
    },

    /**
     * Add new garage
     */
    addGaragem: async (formData) => {
        return await API.fetch('/api/garagem', {
            method: 'POST',
            body: formData,
            headers: {} // Remove Content-Type for FormData
        });
    },

    /**
     * Add new technician
     */
    addTecnico: async (formData) => {
        return await API.fetch('/api/tecnico', {
            method: 'POST',
            body: formData,
            headers: {} // Remove Content-Type for FormData
        });
    },

    /**
     * Generate RAT
     */
    generateRAT: async (formData) => {
        return await API.fetch('/api/generate-rat', {
            method: 'POST',
            body: formData,
            headers: {} // Remove Content-Type for FormData
        });
    }
};

// Chart utilities
const ChartUtils = {
    /**
     * Create responsive chart configuration
     */
    getResponsiveConfig: () => ({
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top',
            },
            tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                titleColor: '#fff',
                bodyColor: '#fff',
                borderColor: '#667eea',
                borderWidth: 1,
                cornerRadius: 8,
            }
        }
    }),

    /**
     * Status chart colors
     */
    statusColors: {
        online: '#28a745',
        atencao: '#ffc107',
        inativo: '#dc3545',
        manutencao: '#17a2b8'
    },

    /**
     * Create status distribution data
     */
    createStatusData: (data) => {
        const statusCounts = {
            online: 0,
            atencao: 0,
            inativo: 0,
            manutencao: 0
        };

        data.forEach(item => {
            const status = (item.Status || '').toLowerCase();
            if (status.includes('operação') || status.includes('online')) {
                statusCounts.online++;
            } else if (status.includes('atenção') || status.includes('atencao')) {
                statusCounts.atencao++;
            } else if (status.includes('inativo')) {
                statusCounts.inativo++;
            } else if (status.includes('manutenção') || status.includes('manutencao')) {
                statusCounts.manutencao++;
            }
        });

        return statusCounts;
    }
};

// Form utilities
const FormUtils = {
    /**
     * Serialize form data to object
     */
    serializeForm: (form) => {
        const formData = new FormData(form);
        const data = {};
        
        for (let [key, value] of formData.entries()) {
            if (data[key]) {
                // Convert to array if multiple values
                if (Array.isArray(data[key])) {
                    data[key].push(value);
                } else {
                    data[key] = [data[key], value];
                }
            } else {
                data[key] = value;
            }
        }
        
        return data;
    },

    /**
     * Reset form and hide modal
     */
    resetAndHideModal: (formId, modalId) => {
        document.getElementById(formId).reset();
        const modal = bootstrap.Modal.getInstance(document.getElementById(modalId));
        if (modal) {
            modal.hide();
        }
    },

    /**
     * Validate form fields
     */
    validateForm: (form) => {
        const inputs = form.querySelectorAll('input[required], select[required], textarea[required]');
        let isValid = true;
        
        inputs.forEach(input => {
            if (!input.value.trim()) {
                input.classList.add('is-invalid');
                isValid = false;
            } else {
                input.classList.remove('is-invalid');
            }
        });
        
        return isValid;
    }
};

// Event listeners setup
const EventListeners = {
    /**
     * Setup global event listeners
     */
    init: () => {
        // Global error handler
        window.addEventListener('error', (event) => {
            console.error('Global error:', event.error);
            Utils.showToast('Ocorreu um erro inesperado', 'danger');
        });

        // Handle unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
            Utils.showToast('Erro de conexão ou processamento', 'danger');
        });

        // Handle page visibility change for data refresh
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && typeof refreshData === 'function') {
                refreshData();
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (event) => {
            // Ctrl+R or F5 for refresh
            if ((event.ctrlKey && event.key === 'r') || event.key === 'F5') {
                event.preventDefault();
                if (typeof refreshData === 'function') {
                    refreshData();
                }
            }
        });
    }
};

// Auto-refresh functionality
const AutoRefresh = {
    intervalId: null,
    
    start: (callback, interval = 30000) => {
        AutoRefresh.stop(); // Clear any existing interval
        AutoRefresh.intervalId = setInterval(callback, interval);
    },
    
    stop: () => {
        if (AutoRefresh.intervalId) {
            clearInterval(AutoRefresh.intervalId);
            AutoRefresh.intervalId = null;
        }
    }
};

// Helper function to create toast container if it doesn't exist
function createToastContainer() {
    const container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container position-fixed top-0 end-0 p-3';
    container.style.zIndex = '1055';
    document.body.appendChild(container);
    return container;
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    EventListeners.init();
    
    // Add fade-in animation to main content
    const mainContent = document.querySelector('main');
    if (mainContent) {
        mainContent.classList.add('fade-in');
    }
    
    // Initialize tooltips
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));
    
    // Initialize popovers
    const popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'));
    popoverTriggerList.map(popoverTriggerEl => new bootstrap.Popover(popoverTriggerEl));
});

// Export utilities for global use
window.Utils = Utils;
window.API = API;
window.ChartUtils = ChartUtils;
window.FormUtils = FormUtils;
window.AutoRefresh = AutoRefresh;

/**
 * Script de paginação simplificado
 * Arquivo: table-pagination.js
 * Data: 04/09/2025
 */

document.addEventListener('DOMContentLoaded', function() {
    console.log('🔄 Inicializando script de paginação da tabela');
    
    // Forçar a configuração da tabela com scroll horizontal
    function setupResponsiveTable() {
        const tableContainer = document.getElementById('tableContainer');
        const dataTable = document.getElementById('dataTable');
        const scrollIndicator = document.getElementById('scrollIndicator');
        
        if (tableContainer && dataTable) {
            console.log('📊 Configurando tabela responsiva');
            
            // Garantir larguras corretas
            if (window.innerWidth <= 768) {
                // Mobile
                dataTable.style.width = '1200px';
                dataTable.style.minWidth = '1200px';
                
                // Mostrar indicador
                if (scrollIndicator) {
                    scrollIndicator.style.display = 'block';
                }
                
                // Indicar com um pequeno scroll que há mais conteúdo
                if (tableContainer.scrollWidth > tableContainer.clientWidth) {
                    setTimeout(() => {
                        tableContainer.scrollLeft = 5;
                    }, 500);
                }
            } else {
                // Desktop
                dataTable.style.width = '100%';
                
                // Esconder indicador
                if (scrollIndicator) {
                    scrollIndicator.style.display = 'none';
                }
            }
        }
    }
    
    // Aplicar ao carregar
    setupResponsiveTable();
    
    // Aplicar ao redimensionar
    window.addEventListener('resize', setupResponsiveTable);
    
    // Garantir que é aplicado após o carregamento completo
    window.addEventListener('load', function() {
        setupResponsiveTable();
        setTimeout(setupResponsiveTable, 500);
    });
});

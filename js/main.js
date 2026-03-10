// Gran Caffè L'Aquila - Digital Wine List JavaScript

// Get base path for the current page directory
function getBasePath() {
    const pathname = window.location.pathname || '';
    if (pathname === '/' || pathname === '') {
        return '';
    }

    // If the path ends with '/', it's already a directory path.
    if (pathname.endsWith('/')) {
        return pathname.slice(0, -1);
    }

    // Treat paths without a file extension as directories (e.g., "/repo")
    const looksLikeFile = pathname.includes('.') && !pathname.endsWith('/');
    if (!looksLikeFile) {
        return pathname;
    }

    // Otherwise, strip the file name to get the directory
    const lastSlash = pathname.lastIndexOf('/');
    return lastSlash > 0 ? pathname.slice(0, lastSlash) : '';
}

// Helper function to get correct path for GitHub Pages
function getPath(relativePath) {
    const basePath = getBasePath();
    // Remove leading ./ if present
    const cleanPath = relativePath.replace(/^\.\//, '');
    // Ensure path starts with /
    const normalizedPath = cleanPath.startsWith('/') ? cleanPath : '/' + cleanPath;
    return basePath + normalizedPath;
}

// Log base path for debugging
const BASE_PATH = getBasePath();
console.log('📍 Base Path:', BASE_PATH || '(root)');
console.log('📍 Wines JSON Path:', getPath('./data/wines.json'));

// Inizializza il tema day/night mode all'avvio
(function initTheme() {
    const dayMode = localStorage.getItem('dayMode');
    // Default a 'day' (light mode) se non è stato salvato alcun valore
    const isDayMode = dayMode === null ? true : dayMode === 'true';
    document.documentElement.setAttribute('data-theme', isDayMode ? 'day' : 'night');
    // Salva il valore di default se non esiste
    if (dayMode === null) {
        localStorage.setItem('dayMode', 'true');
    }
})();

class WineListApp {
    constructor() {
        this.wines = [];
        this.filteredWines = [];
        this.currentView = 'grid';
        this.foodPairingsData = null;
        this.currentFilters = {
            type: null,
            region: null,
            search: ''
        };
        
        this.init();
    }

    async init() {
        try {
            await this.loadWineData();
            this.setupEventListeners();
            this.handleURLParameters();
            this.renderCurrentPage();
        } catch (error) {
            console.error('Error initializing wine list app:', error);
            this.showError('Failed to load wine data. Please refresh the page.');
        }
    }

    async loadWineData() {
        let winesPath;
        try {
            // Use getPath to ensure correct path for GitHub Pages
            winesPath = getPath('./data/wines.json');
            console.log('🍷 Loading wines from:', winesPath);
            
            // Remove cache busting to allow browser caching for faster loads
            // Only add cache busting in development mode if needed
            const cacheBuster = window.location.hostname === 'localhost' ? '?v=' + Date.now() : '';
            const response = await fetch(winesPath + cacheBuster);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            
            // Filter out corrupted wines with invalid regions
            const validRegions = [
                'SICILIA', 'PIEMONTE', 'TOSCANA', 'VENETO', 'LOMBARDIA', 'EMILIA-ROMAGNA',
                'LAZIO', 'CAMPANIA', 'PUGLIA', 'CALABRIA', 'BASILICATA', 'MOLISE',
                'ABRUZZO', 'UMBRIA', 'LE MARCHE', 'FRIULI-VENEZIA GIULIA', 'FRIULI', 'TRENTINO ALTO-ADIGE',
                'VALLE D\'AOSTA', 'LIGURIA', 'SARDEGNA', 'TOSCANA (BOLGHERI)', 'LUGANA DOC (VENETO)',
                'TARANTO IGT (PUGLIA)', 'MATERA DOC (BASILICATA)'
            ];
            
            this.wines = (data.wines || []).filter(wine => {
                // Filter out wines with corrupted data
                const hasValidRegion = wine.region && validRegions.includes(wine.region);
                const hasValidName = wine.wine_name && wine.wine_name !== 'WINE NAME' && wine.wine_name !== 'WINE PRICE' && wine.wine_name !== 'VINTAGE';
                const hasValidProducer = wine.wine_producer && wine.wine_producer !== 'UNKNOWN PRODUCER';
                const hasValidPrice = (wine.wine_price && wine.wine_price !== '0') || 
                                     (wine.wine_price_bottle && wine.wine_price_bottle !== '0') ||
                                     (wine.wine_price_glass && wine.wine_price_glass !== '0');
                
                // Filter out sangria and cocktail wines
                const isNotSangriaOrCocktail = wine.wine_type && 
                    !wine.wine_type.toUpperCase().includes('SANGRIA') && 
                    !wine.wine_type.toUpperCase().includes('COCKTAIL');
                
                return hasValidRegion && hasValidName && hasValidProducer && hasValidPrice && isNotSangriaOrCocktail;
            });
            
            this.filteredWines = [...this.wines];
            console.log(`Loaded ${this.wines.length} valid wines (filtered out corrupted data)`);
            
            if (this.wines.length === 0) {
                this.showError('No wines found in database. Please check the data file.');
                return;
            }
            
            // Load wine images mapping and food pairings data in parallel for faster loading
            await Promise.all([
                this.loadWineImages(),
                this.loadFoodPairingsData()
            ]);
            
            // Postpone debug operations to avoid blocking initial render
            // Run them asynchronously after a short delay
            setTimeout(() => {
                // Debug: Log wine family distribution
                this.logWineFamilyDistribution();
                
                // General checkup
                this.performGeneralCheckup();
                
                // Test all regions
                this.testAllRegions();
            }, 100);
        } catch (error) {
            // #region agent log
            (function(){
              var p = {location:'main.js:loadWineData:catch',message:'wines load error',data:{errorMessage:error.message,winesPath,hostname:window.location.hostname,basePath:BASE_PATH,pageHref:window.location.href,swControlled:!!(typeof navigator!=='undefined'&&navigator.serviceWorker&&navigator.serviceWorker.controller)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'h1'};
              console.log('[DEBUG]', JSON.stringify(p));
              fetch('http://127.0.0.1:7247/ingest/fe36653c-3e53-480d-b7e2-efd99bb3957a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(p)}).catch(()=>{});
            })();
            // #endregion
            console.error('❌ Error loading wine data:', error);
            console.error('📍 Attempted path:', winesPath);
            console.error('📍 Base path:', BASE_PATH);
            console.error('📍 Current URL:', window.location.href);
            
            // Show detailed error message
            const errorMsg = `Failed to load wine data: ${error.message}. ` +
                           `Path: ${winesPath}. ` +
                           `Please check the console for details.`;
            this.showError(errorMsg);
            
            // Fallback to empty array if data loading fails
            this.wines = [];
            this.filteredWines = [];
        }
    }

    async loadWineImages() {
        // Wine images mapping integrated directly in the code
        this.wineImages = {
            "LAMBRUSCO": "https://www.agraria.org/vini/lambrusco.jpg",
            "MONTEPULCIANO D'ABRUZZO": "https://www.agraria.org/vini/montepulciano-d-abruzzo.jpg",
            "CHIANTI CLASSICO": "https://www.agraria.org/vini/chianti-classico.jpg",
            "BAROLO": "https://www.agraria.org/vini/barolo.jpg",
            "BRUNELLO DI MONTALCINO": "https://www.agraria.org/vini/brunello-di-montalcino.jpg"
        };
        console.log(`Loaded ${Object.keys(this.wineImages).length} wine images`);
    }

    async loadFoodPairingsData() {
        try {
            const pairingsPath = getPath('./data/FoodParingWineDetails.json');
            // Remove cache busting to allow browser caching for faster loads
            const cacheBuster = window.location.hostname === 'localhost' ? '?v=' + Date.now() : '';
            const response = await fetch(pairingsPath + cacheBuster);
            if (!response.ok) {
                console.warn('Food pairings data not available');
                return;
            }
            this.foodPairingsData = await response.json();
            console.log(`Loaded ${this.foodPairingsData.length} dish pairings from Gran Caffè`);
        } catch (error) {
            console.warn('Error loading food pairings data:', error);
            this.foodPairingsData = null;
        }
    }

    setupEventListeners() {
        // Search functionality
        const searchInputs = document.querySelectorAll('.luxury-search-input');
        searchInputs.forEach(input => {
            input.addEventListener('input', (e) => {
                this.currentFilters.search = e.target.value.toLowerCase();
                if (this.getCurrentPage() === 'regions') {
                    this.filterRegions();
                } else if (this.getCurrentPage() === 'index') {
                    this.applyIndexSearch();
                } else {
                    this.applyFilters();
                }
            });
        });

        // Filter buttons
        const filterButtons = document.querySelectorAll('.luxury-filter-btn, .filter-button');
        filterButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                this.showFilterOptions(button);
            });
        });

        // Varietal select on wines page
        const varietalSelect = document.getElementById('varietalSelect');
        if (varietalSelect) {
            varietalSelect.addEventListener('change', (e) => {
                const value = e.target.value || '';
                this.currentFilters.varietal = value;
                if (this.getCurrentPage() === 'wines') {
                    this.applyFilters();
                }
            });
        }

        // View toggle
        const gridViewBtn = document.getElementById('gridViewBtn');
        const tableViewBtn = document.getElementById('tableViewBtn');
        
        if (gridViewBtn && tableViewBtn) {
            gridViewBtn.addEventListener('click', () => this.toggleView('grid'));
            tableViewBtn.addEventListener('click', () => this.toggleView('table'));
        }

        // Explore wine buttons
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('explore-wine') || e.target.classList.contains('table-explore-btn')) {
                e.preventDefault();
                this.exploreWine(e.target);
            }
        });

        // Explore region buttons
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('explore-region') || e.target.classList.contains('table-explore-region-btn')) {
                e.preventDefault();
                this.exploreRegion(e.target);
            }
        });

        // Set skipIntro when clicking logo or navigating to index
        document.addEventListener('click', (e) => {
            const anchor = e.target.closest('a');
            const logo = e.target.closest('.luxury-logo, .logo-image');
            if (anchor && anchor.getAttribute('href') && anchor.getAttribute('href').includes('index.html')) {
                try { sessionStorage.setItem('skipIntro', 'true'); } catch (_) {}
            }
            if (logo) {
                try { sessionStorage.setItem('skipIntro', 'true'); } catch (_) {}
            }
        });

        // Wine card hover effects
        this.setupHoverEffects();
    }

    handleURLParameters() {
        const urlParams = new URLSearchParams(window.location.search);
        const type = urlParams.get('type');
        const region = urlParams.get('region');
        const wineId = urlParams.get('id');
        const search = urlParams.get('search');

        if (type) {
            this.currentFilters.type = type;
        }
        if (region) {
            // Decode URL-encoded region names
            this.currentFilters.region = decodeURIComponent(region);
            console.log(`Region from URL: ${region} -> decoded: ${this.currentFilters.region}`);
        }
        if (search) {
            this.currentFilters.search = decodeURIComponent(search).toLowerCase();
        }
        if (wineId) {
            this.loadWineDetails(wineId);
        }
    }

    renderCurrentPage() {
        const currentPage = this.getCurrentPage();
        
        switch (currentPage) {
            case 'index':
                this.renderHomePage();
                // Check if we're returning from wine-details (back navigation)
                // This works for both back button clicks and browser back button
                const skipLoading = sessionStorage.getItem('skipHomeLoading') === 'true' || 
                                   performance.navigation?.type === 2 || // Back/forward navigation
                                   (performance.getEntriesByType('navigation')[0]?.type === 'back_forward');
                if (skipLoading) {
                    // Remove the flag and skip loading
                    sessionStorage.removeItem('skipHomeLoading');
                    // Hide overlay immediately if it exists
                    const overlay = document.getElementById('loadingOverlay');
                    if (overlay) {
                        overlay.classList.add('is-hidden');
                        setTimeout(() => {
                            overlay.remove();
                            document.body.dataset.overlayDone = 'true';
                        }, 100);
                    }
                    // Setup hero animation without loading
                    this.setupHomeHeroAnimation();
                } else {
                    this.setupHomeLoadingOverlay().then(() => {
                        this.setupHomeHeroAnimation();
                    });
                }
                break;
            case 'regions':
                this.renderRegionsPage();
                break;
            case 'wines':
                this.renderWinesPage();
                break;
            case 'wine-details':
                // Set flag to skip loading when returning to index
                sessionStorage.setItem('skipHomeLoading', 'true');
                this.renderWineDetailsPage();
                // Fallback retry: re-apply wine details after short delay (fixes tasting notes on first load)
                const wineIdFromUrl = new URLSearchParams(window.location.search).get('id');
                if (wineIdFromUrl) {
                    setTimeout(() => this.loadWineDetails(wineIdFromUrl), 200);
                }
                break;
        }
    }

    setupHomeLoadingOverlay() {
        return new Promise((resolve) => {
            const root = document.body;
            if (!root.classList.contains('home-page')) {
                resolve();
                return;
            }
            const overlay = document.getElementById('loadingOverlay');
            const messageEl = document.getElementById('loadingMessage');
            const ring = document.getElementById('ringProgress');
            const skipBtn = document.getElementById('skipLoadingBtn');
            if (!overlay) {
                resolve();
                return;
            }

            // Remove skip functionality entirely if present
            if (skipBtn) { try { skipBtn.remove(); } catch (_) {} }

            // Ensure gradient for ring
            const ensureGrad = () => {
                if (!ring) return;
                const svg = ring.closest('svg');
                if (!svg) return;
                let defs = svg.querySelector('defs');
                if (!defs) { defs = document.createElementNS('http://www.w3.org/2000/svg','defs'); svg.prepend(defs); }
                if (!svg.querySelector('#goldGrad')) {
                    const lg = document.createElementNS('http://www.w3.org/2000/svg','linearGradient');
                    lg.setAttribute('id','goldGrad'); lg.setAttribute('x1','0%'); lg.setAttribute('x2','100%');
                    const s1 = document.createElementNS('http://www.w3.org/2000/svg','stop'); s1.setAttribute('offset','0%'); s1.setAttribute('stop-color','#D4AF37');
                    const s2 = document.createElementNS('http://www.w3.org/2000/svg','stop'); s2.setAttribute('offset','100%'); s2.setAttribute('stop-color','#B8860B');
                    lg.appendChild(s1); lg.appendChild(s2); defs.appendChild(lg);
                    ring.setAttribute('stroke','url(#goldGrad)');
                }
            };
            ensureGrad();

            const durationSec = 4; // total ring animation time
            if (messageEl) messageEl.textContent = 'Loading…';

            // Perimetro del quadrato 108x108 con border-radius 12px
            // Lati retti: 4 * (108 - 2*12) = 336
            // Archi (4 quarti di cerchio con raggio 12): 4 * (π * 12 / 2) = 75.4
            // Totale: ~411.4
            const circumference = 4 * (108 - 24) + 4 * (Math.PI * 12 / 2); // ~411.4
            const updateRing = (t) => {
                if (!ring) return;
                const ratio = 1 - (t / durationSec);
                const offset = circumference * ratio;
                ring.style.strokeDasharray = `${circumference}`;
                ring.style.strokeDashoffset = `${offset}`;
            };

            const start = performance.now();
            let raf;
            const animate = (now) => {
                const elapsed = (now - start) / 1000; // sec
                const t = Math.min(durationSec, elapsed);
                updateRing(t);
                if (t < durationSec) { raf = requestAnimationFrame(animate); }
            };
            raf = requestAnimationFrame(animate);

            // After ring completes, show Benvenuti then fade
            setTimeout(() => {
                if (messageEl) {
                    messageEl.textContent = 'Benvenuti';
                    messageEl.classList.add('is-welcome');
                }
                setTimeout(() => {
                    overlay.classList.add('is-hidden');
                    setTimeout(() => {
                        overlay.remove();
                        document.body.dataset.overlayDone = 'true';
                        resolve();
                    }, 500);
                }, 1000);
            }, durationSec * 1000);
        });
    }

    setupHomeHeroAnimation() {
        const root = document.body;
        if (!root.classList.contains('home-page')) return;
        // Respect reduced motion: reveal instantly without animations
        if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            root.classList.add('search-reveal', 'cards-revealed');
            return;
        }

        // If overlay just closed, reveal immediately with collapse; if intro skipped, reveal without collapsing hero
        try {
            if (root.dataset.overlayDone === 'true') {
                root.classList.add('search-reveal', 'cards-revealed');
                const input = document.querySelector('.luxury-search-input');
                if (input) {
                    try { input.focus({ preventScroll: true }); } catch (_) { input.focus(); }
                }
                return;
            }
        } catch (_) {}

        let cancelled = false;
        const cancel = () => {
            if (cancelled) return;
            cancelled = true;
            root.classList.add('search-reveal', 'cards-revealed');
        };
        ['scroll','keydown','mousemove','touchstart'].forEach(e => window.addEventListener(e, cancel, { once: true }));

        setTimeout(() => {
            if (cancelled) return;
            root.classList.add('search-reveal', 'cards-revealed');
            const input = document.querySelector('.luxury-search-input');
            if (input) {
                try { input.focus({ preventScroll: true }); } catch (_) { input.focus(); }
            }
        }, 4000);
    }

    getCurrentPage() {
        const path = window.location.pathname;
        if (path.includes('regions')) return 'regions';
        if (path.includes('wines')) return 'wines';
        if (path.includes('wine-details')) return 'wine-details';
        return 'index';
    }

    renderHomePage() {
        // Update wine type cards with actual wine counts
        const wineTypes = ['ROSSO', 'BIANCO', 'ROSATO', 'ARANCIONE', 'BOLLICINE', 'NON ALCOLICO'];
        const wineCards = document.querySelectorAll('.luxury-wine-card');
        
        wineCards.forEach((card, index) => {
            if (wineTypes[index]) {
                const count = this.wines.filter(wine => this.wineMatchesFamily(wine, wineTypes[index])).length;
                const countElement = card.querySelector('.wine-count');
                if (countElement) {
                    countElement.textContent = `${count} wines`;
                }
            }
        });
        
        // Update breadcrumb for home page
        this.updateBreadcrumb('Home', 'Wine Collection');
    }

    renderRegionsPage() {
        const regionsContainer = document.querySelector('.regions-container');
        if (!regionsContainer) {
            console.error('Regions container not found');
            return;
        }

        // Update breadcrumb for regions page
        if (this.currentFilters.type) {
            const typeName = this.getWineTypeName(this.currentFilters.type);
            this.updateBreadcrumb('Home', `${typeName} Regions`);
        } else {
            this.updateBreadcrumb('Home', 'Wine Regions');
        }

        // Get all unique regions from wines (filtered by type if specified)
        let winesToUse = this.wines;
        if (this.currentFilters.type) {
            winesToUse = this.wines.filter(wine => this.wineMatchesFamily(wine, this.currentFilters.type));
        }
        
        // Get unique regions using normalized names to avoid duplicates
        const regionSet = new Set();
        winesToUse
            .filter(wine => wine.region && wine.region.trim() !== '')
            .forEach(wine => {
                const normalizedRegion = this.normalizeRegionName(wine.region);
                regionSet.add(normalizedRegion);
            });
        
        this.allRegions = [...regionSet].sort();

        console.log(`Found ${this.allRegions.length} regions for type: ${this.currentFilters.type || 'all'}`);

        // Update page title based on filter
        this.updatePageTitle();

        // Update breadcrumb
        this.updateBreadcrumb();

        // Render region cards
        this.filterRegions();
    }

    updatePageTitle() {
        const subtitles = document.querySelectorAll('.luxury-subtitle');
        if (subtitles.length >= 2) {
            // Keep the "present" subtitle as is
            // Update the second subtitle with the appropriate title
            if (this.currentFilters.type) {
                subtitles[1].textContent = `${this.getWineTypeName(this.currentFilters.type)} - REGIONS`;
            } else {
                subtitles[1].textContent = 'WINE REGIONS';
            }
        } else if (subtitles.length === 1) {
            // Fallback if only one subtitle exists
            const title = subtitles[0];
            if (this.currentFilters.type) {
                title.textContent = `${this.getWineTypeName(this.currentFilters.type)} - REGIONS`;
            } else {
                title.textContent = 'WINE REGIONS';
            }
        }
    }

    updateBreadcrumb(currentPage = 'Wine Collection', currentItem = null) {
        // Update desktop breadcrumb
        const breadcrumb = document.querySelector('.breadcrumb');
        const breadcrumbCurrent = document.getElementById('breadcrumbCurrent');
        
        // Update mobile breadcrumb
        const mobileBreadcrumb = document.querySelector('.mobile-breadcrumb');
        const mobileBreadcrumbCurrent = document.getElementById('mobileBreadcrumbCurrent');
        
        if (breadcrumbCurrent) {
            if (currentItem) {
                breadcrumbCurrent.textContent = currentItem;
            } else {
                breadcrumbCurrent.textContent = currentPage;
            }
        }
        
        if (mobileBreadcrumbCurrent) {
            if (currentItem) {
                mobileBreadcrumbCurrent.textContent = currentItem;
            } else {
                mobileBreadcrumbCurrent.textContent = currentPage;
            }
        }
        
        if (breadcrumb) {
            if (this.currentFilters.type) {
                const typeName = this.getWineTypeName(this.currentFilters.type);
                breadcrumb.innerHTML = `
                    <a href="index.html">Home</a>
                    <span class="breadcrumb-separator">/</span>
                    <span class="breadcrumb-current">${typeName} Regions</span>
                `;
                
                if (mobileBreadcrumbCurrent) {
                    mobileBreadcrumbCurrent.textContent = `${typeName} Regions`;
                }
            } else {
                breadcrumb.innerHTML = `
                    <a href="index.html">Home</a>
                    <span class="breadcrumb-separator">/</span>
                    <span class="breadcrumb-current">Wine Regions</span>
                `;
                
                if (mobileBreadcrumbCurrent) {
                    mobileBreadcrumbCurrent.textContent = 'Wine Regions';
                }
            }
        }
    }

    filterRegions() {
        const regionsGrid = document.querySelector('.regions-grid');
        if (!regionsGrid || !this.allRegions) return;

        const filteredRegions = this.allRegions.filter(region => 
            !this.currentFilters.search || region.toLowerCase().includes(this.currentFilters.search)
        );

        regionsGrid.innerHTML = filteredRegions.map(region => {
            // Count wines in this region, considering wine type filter if active
            // Use normalized region comparison for accurate counting
            let count = this.wines.filter(wine => {
                const normalizedWineRegion = this.normalizeRegionName(wine.region);
                const normalizedFilterRegion = this.normalizeRegionName(region);
                return normalizedWineRegion === normalizedFilterRegion;
            }).length;
            
            if (this.currentFilters.type) {
                count = this.wines.filter(wine => {
                    const normalizedWineRegion = this.normalizeRegionName(wine.region);
                    const normalizedFilterRegion = this.normalizeRegionName(region);
                    return normalizedWineRegion === normalizedFilterRegion && this.wineMatchesFamily(wine, this.currentFilters.type);
                }).length;
            }
            
            const icon = this.getRegionIcon(region);
            const normalizedRegion = this.normalizeRegionName(region);
            
            // Add type parameter to URL if filtering by wine type
            // Navigate to index.html with region and type filters
            let url = `index.html?region=${encodeURIComponent(normalizedRegion)}`;
            if (this.currentFilters.type) {
                url += `&type=${encodeURIComponent(this.currentFilters.type)}`;
            }
            
            return `
                <a href="${url}" class="region-card">
                    <div class="region-icon">
                        <i class="${icon}"></i>
                    </div>
                    <h3 class="region-title">${normalizedRegion}</h3>
                    <p class="wine-count">${count} wines</p>
                </a>
            `;
        }).join('');

        // Also render the table view
        this.renderRegionsTable(filteredRegions);
        
        // Update regions count
        this.updateRegionsCount(filteredRegions.length);
    }

    renderRegionsTable(regions) {
        const regionsTable = document.getElementById('regionsTable');
        if (!regionsTable) return;

        const tbody = regionsTable.querySelector('tbody');
        if (!tbody) return;

        tbody.innerHTML = regions.map(region => {
            // Count wines in this region, considering wine type filter if active
            // Use normalized region comparison for accurate counting
            let count = this.wines.filter(wine => {
                const normalizedWineRegion = this.normalizeRegionName(wine.region);
                const normalizedFilterRegion = this.normalizeRegionName(region);
                return normalizedWineRegion === normalizedFilterRegion;
            }).length;
            
            if (this.currentFilters.type) {
                count = this.wines.filter(wine => {
                    const normalizedWineRegion = this.normalizeRegionName(wine.region);
                    const normalizedFilterRegion = this.normalizeRegionName(region);
                    return normalizedWineRegion === normalizedFilterRegion && this.wineMatchesFamily(wine, this.currentFilters.type);
                }).length;
            }
            
            const normalizedRegion = this.normalizeRegionName(region);
            const description = this.getRegionDescription(region);
            
            // Add type parameter to URL if filtering by wine type
            // Navigate to index.html with region and type filters
            let url = `index.html?region=${encodeURIComponent(normalizedRegion)}`;
            if (this.currentFilters.type) {
                url += `&type=${encodeURIComponent(this.currentFilters.type)}`;
            }
            
            return `
                <tr>
                    <td class="table-region-name">${normalizedRegion}</td>
                    <td class="table-region-count">${count} wines</td>
                    <td class="table-region-description">${description}</td>
                    <td><a href="${url}" class="table-explore-region-btn">Explore</a></td>
                </tr>
            `;
        }).join('');
    }

    updateRegionsCount(count) {
        const regionsCount = document.querySelector('.regions-count');
        if (regionsCount) {
            regionsCount.textContent = `${count} regions`;
        }
    }

    getRegionDescription(region) {
        // Add some basic descriptions for major regions
        const descriptions = {
            'TOSCANA': 'Famous for Chianti and Brunello wines',
            'PIEMONTE': 'Home of Barolo and Barbaresco',
            'VENETO': 'Known for Amarone and Prosecco',
            'SICILIA': 'Mediterranean climate, diverse terroir',
            'LOMBARDIA': 'Northern region with Alpine influences',
            'EMILIA-ROMAGNA': 'Rich culinary tradition, Lambrusco',
            'LAZIO': 'Central Italy, Frascati and Est! Est!! Est!!!',
            'CAMPANIA': 'Ancient winemaking traditions',
            'PUGLIA': 'Southern Italy, Primitivo and Negroamaro',
            'SARDEGNA': 'Island wines with unique character'
        };
        
        return descriptions[region] || 'Explore the wines of this region';
    }

    renderWinesPage() {
        // If no region is specified, show all wines (filtered by type and search if present)
        if (!this.currentFilters.region) {
            console.log('No region specified for wines page, showing all wines');
        } else {
            console.log(`Rendering wines page for region: ${this.currentFilters.region}, type: ${this.currentFilters.type || 'all'}`);
        }

        // Filter wines by region (if specified), type (if specified), and search (if present)
        this.filteredWines = this.wines.filter(wine => {
            // Use normalized region comparison to handle variations
            let matchesRegion = true;
            if (this.currentFilters.region) {
                const normalizedWineRegion = this.normalizeRegionName(wine.region);
                const normalizedFilterRegion = this.normalizeRegionName(this.currentFilters.region);
                matchesRegion = normalizedWineRegion === normalizedFilterRegion;
            }
            
            const matchesType = !this.currentFilters.type || this.wineMatchesFamily(wine, this.currentFilters.type);
            const matchesSearch = !this.currentFilters.search || (
                (wine.wine_name && wine.wine_name.toLowerCase().includes(this.currentFilters.search)) ||
                (wine.region && wine.region.toLowerCase().includes(this.currentFilters.search)) ||
                (wine.varietals && wine.varietals.toLowerCase().includes(this.currentFilters.search)) ||
                (wine.wine_producer && wine.wine_producer.toLowerCase().includes(this.currentFilters.search))
            );
            
            return matchesRegion && matchesType && matchesSearch;
        });

        if (this.currentFilters.region) {
            console.log(`Found ${this.filteredWines.length} wines for ${this.currentFilters.region}`);
        } else {
            console.log(`Found ${this.filteredWines.length} wines (all regions)`);
        }

        // Add wine type badge if filtering by type
        if (this.currentFilters.type) {
            const header = document.querySelector('.luxury-header');
            if (header) {
                this.addWineTypeBadge(this.currentFilters.type, header);
            }
        }

        // Update page title
        this.updateWinesPageTitle();

        // Update HTML page title
        this.updateHTMLPageTitle();

        // Update section title
        this.updateWinesSectionTitle();

        // Update wine count
        const countElement = document.querySelector('.wines-count');
        if (countElement) {
            countElement.textContent = `${this.filteredWines.length} wines`;
        }

        // Update breadcrumb
        this.updateWinesBreadcrumb();

        // Populate varietal dropdown based on current region (and type if present)
        this.populateVarietalSelect();

        // Render wines
        this.renderWines();
    }

    populateVarietalSelect() {
        const select = document.getElementById('varietalSelect');
        if (!select) return;
        // Build varietal set scoped to region and type
        const regionNorm = this.currentFilters.region ? this.normalizeRegionName(this.currentFilters.region) : null;
        const varietalSet = new Set();
        this.wines.forEach(w => {
            if (!w.varietals || !w.varietals.trim()) return;
            if (regionNorm && this.normalizeRegionName(w.region) !== regionNorm) return;
            if (this.currentFilters.type && !this.wineMatchesFamily(w, this.currentFilters.type)) return;
            varietalSet.add(w.varietals);
        });
        const varietals = Array.from(varietalSet).sort();
        select.innerHTML = '<option value="">All Grapes</option>' +
            varietals.map(v => `<option value="${v}">${v}</option>`).join('');
        // Preserve current selection if present
        if (this.currentFilters.varietal) {
            select.value = this.currentFilters.varietal;
        }
    }

    updateWinesPageTitle() {
        const subtitles = document.querySelectorAll('.luxury-subtitle');
        if (subtitles.length >= 2) {
            // Keep the "present" subtitle as is
            // Update the second subtitle with the appropriate title
            if (this.currentFilters.type) {
                subtitles[1].textContent = `${this.currentFilters.region} ${this.getWineTypeName(this.currentFilters.type)}`;
            } else {
                subtitles[1].textContent = `${this.currentFilters.region} WINES`;
            }
        } else if (subtitles.length === 1) {
            // Fallback if only one subtitle exists
            const title = subtitles[0];
            if (this.currentFilters.type) {
                title.textContent = `${this.currentFilters.region} ${this.getWineTypeName(this.currentFilters.type)}`;
            } else {
                title.textContent = `${this.currentFilters.region} WINES`;
            }
        }
    }

    updateHTMLPageTitle() {
        // Update the HTML page title
        let pageTitle = `${this.currentFilters.region} Wines`;
        if (this.currentFilters.type) {
            const typeName = this.getWineTypeName(this.currentFilters.type);
            pageTitle = `${this.currentFilters.region} ${typeName}`;
        }
        document.title = `${pageTitle} - Gran Caffè L'Aquila`;
    }

    updateWinesSectionTitle() {
        // Update the wines section title
        const winesTitle = document.querySelector('.wines-title');
        if (winesTitle) {
            let sectionTitle = `${this.currentFilters.region} SELECTION`;
            if (this.currentFilters.type) {
                const typeName = this.getWineTypeName(this.currentFilters.type);
                sectionTitle = `${this.currentFilters.region} ${typeName.toUpperCase()}`;
            }
            winesTitle.textContent = sectionTitle;
        }
    }

    updateWinesBreadcrumb() {
        const breadcrumb = document.querySelector('.breadcrumb');
        if (breadcrumb) {
            // Navigate to index.html with type filter
            let regionUrl = 'index.html';
            if (this.currentFilters.type) {
                regionUrl += `?type=${encodeURIComponent(this.currentFilters.type)}`;
            }
            
            breadcrumb.innerHTML = `
                <a href="index.html">Home</a>
                <span class="breadcrumb-separator">/</span>
                <a href="${regionUrl}">Wine Regions</a>
                <span class="breadcrumb-separator">/</span>
                <span class="breadcrumb-current">${this.currentFilters.region}</span>
            `;
        }
        
        // Update mobile breadcrumb
        if (mobileBreadcrumbCurrent) {
            mobileBreadcrumbCurrent.textContent = this.currentFilters.region;
        }
    }

    renderWines() {
        const winesGrid = document.getElementById('winesGrid');
        const wineTable = document.getElementById('wineTable');
        
        console.log(`Rendering ${this.filteredWines.length} wines`);
        
        if (winesGrid) {
            winesGrid.innerHTML = this.filteredWines.map(wine => this.createWineCard(wine)).join('');
            console.log(`Updated wines grid with ${this.filteredWines.length} cards`);
        }
        
        if (wineTable) {
            const tbody = wineTable.querySelector('tbody');
            if (tbody) {
                tbody.innerHTML = this.filteredWines.map(wine => this.createWineTableRow(wine)).join('');
                console.log(`Updated wines table with ${this.filteredWines.length} rows`);
            }
        }
    }

    createWineCard(wine) {
        const wineFamily = this.getWineFamily(wine.wine_type, wine.subcategory);
        
        const wineTypeNames = {
            'ROSSO': 'Red',
            'BIANCO': 'White',
            'ROSATO': 'Rosé',
            'ARANCIONE': 'Orange',
            'BOLLICINE': 'Sparkling',
            'NON ALCOLICO': 'Non-Alcoholic'
        };

        const wineFamilyClasses = {
            'ROSSO': 'wine-family-rosso',
            'BIANCO': 'wine-family-bianco',
            'ROSATO': 'wine-family-rosato',
            'ARANCIONE': 'wine-family-arancione',
            'BOLLICINE': 'wine-family-bollicine',
            'NON ALCOLICO': 'wine-family-nonalco'
        };

        const wineImageUrl = this.findWineImage(wine);
        const backgroundImageStyle = wineImageUrl ? `background-image: url('${wineImageUrl}'); background-size: cover; background-position: center; background-repeat: no-repeat;` : '';
        
        return `
            <div class="wine-card" style="${backgroundImageStyle}">
                <div class="wine-header">
                    <h3 class="wine-name">${wine.wine_name}</h3>
                    <div class="wine-price">$${wine.wine_price || wine.wine_price_bottle || wine.wine_price_glass || 'N/A'}</div>
                </div>
                <div class="wine-details">
                    <p class="wine-producer">${wine.wine_producer || 'Producer not specified'}</p>
                    <p class="wine-region">${wine.region}</p>
                    <p class="wine-grape">${wine.varietals || 'N/A'}</p>
                    <p class="wine-description">${wine.wine_description || 'A fine wine selection.'}</p>
                </div>
                <div class="wine-actions">
                    <span class="wine-year">${this.extractYear(wine.wine_vintage)}</span>
                    <span class="wine-family-indicator ${wineFamilyClasses[wineFamily] || 'wine-family-rosso'}">${wineTypeNames[wineFamily] || 'Wine'}</span>
                    <a href="wine-details.html?id=${wine.wine_number}${this.currentFilters.type ? '&type=' + encodeURIComponent(this.currentFilters.type) : ''}" class="explore-wine">Explore Wine</a>
                </div>
            </div>
        `;
    }

    createWineTableRow(wine) {
        return `
            <tr>
                <td class="table-wine-name">${wine.wine_name}</td>
                <td class="table-wine-producer">${wine.wine_producer || 'Producer not specified'}</td>
                <td class="table-wine-region">${wine.region}</td>
                <td>${wine.varietals || 'N/A'}</td>
                <td>${this.extractYear(wine.wine_vintage)}</td>
                <td class="table-wine-price">$${wine.wine_price || wine.wine_price_bottle || wine.wine_price_glass || 'N/A'}</td>
                <td><a href="wine-details.html?id=${wine.wine_number}${this.currentFilters.type ? '&type=' + encodeURIComponent(this.currentFilters.type) : ''}" class="table-explore-btn">Explore</a></td>
            </tr>
        `;
    }

    renderWineDetailsPage() {
        const urlParams = new URLSearchParams(window.location.search);
        const wineId = urlParams.get('id');
        
        if (wineId) {
            this.loadWineDetails(wineId);
        }
    }

    loadWineDetails(wineId) {
        // Try to find wine by wine_number (string or number comparison)
        const wine = this.wines.find(w => 
            w.wine_number === wineId || 
            w.wine_number === String(wineId) || 
            String(w.wine_number) === String(wineId)
        );
        
        if (!wine) {
            console.error(`Wine not found with ID: ${wineId}`);
            this.showError('Wine not found');
            return;
        }

        // Update wine details
        this.updateWineDetails(wine);
    }

    updateWineDetails(wine) {
        if (!wine) {
            console.error('Cannot update wine details: wine is null or undefined');
            this.showError('Wine data is invalid');
            return;
        }

        // Removed wine family indicator from wine details page per request

        // Add wine type badge to header
        const header = document.querySelector('.luxury-header');
        if (header) {
            this.addWineTypeBadge(wine.wine_type, header);
        }

        // Update wine name
        const wineName = document.getElementById('wineName');
        if (wineName) {
            wineName.textContent = wine.wine_name || 'Unknown Wine';
        }

        // Mobile footer removed - price is shown in wine-meta section

        // Update page title
        if (wine.wine_name) {
            document.title = `${wine.wine_name} - Gran Caffè L'Aquila`;
        }

        // Update meta information
        this.updateMetaInfo(wine);

        // Update wine image
        this.updateWineImage(wine);

        // Update wine description (DESCRIPTION section)
        this.updateWineDescription(wine);

        // Format line under title (Formato: from wine_name or wine_description)
        this.updateWineFormatLine(wine);

        // Update tasting notes popup content (no button; Tasting Notes shown inline in wineMeta)
        requestAnimationFrame(() => {
            this.updateTastingNotes(wine);
        });

        // Update wine information (for popup)
        this.updateWineInformation(wine);

        // Update food pairings (async, but don't block)
        this.updateFoodPairings(wine).catch(err => {
            console.error('Error updating food pairings:', err);
        });

        // Update producer information (for popup)
        this.updateProducerInfo(wine);

        // Setup popup handlers
        this.setupInfoPopup();

        // Initialize Wine Lab card builder
        this.setupWineLab(wine);

        // Update breadcrumb
        this.updateBreadcrumb(wine);

        // Update back button
        this.updateBackButton(wine);
    }

    /** Derive format (e.g. 375ml) from wine_name or wine_description */
    deriveFormat(wine) {
        if (!wine) return '';
        const fromName = (wine.wine_name || '').match(/(\d+)\s*ml/i);
        if (fromName) return fromName[1] + 'ml';
        const desc = (wine.wine_description || '').trim();
        const fromDesc = desc.match(/^(\d+)\s*ml$/i);
        if (fromDesc) return fromDesc[1] + 'ml';
        return '';
    }

    updateMetaInfo(wine) {
        // Show key information: Producer, Region, Grape, Vintage, Alcohol (layout come in figura)
        const vintage = this.extractYear(wine.wine_vintage) || 'N/A';
        const alcohol = wine.alcohol ? `${wine.alcohol}%` : 'N/A';
        
        // Extract denomination from vintage string or use classification/appellation
        const extractDenomination = (vintageStr) => {
            if (!vintageStr) return '';
            const match = vintageStr.match(/\b(DOCG|DOC|IGT)\b/i);
            return match ? match[1].toUpperCase() : '';
        };
        const denomination = extractDenomination(wine.wine_vintage) || wine.wine_classification || wine.wine_appellation || '';
        
        const displayPrice = wine.wine_price || wine.wine_price_bottle || wine.wine_price_glass || 'N/A';
        const priceValue = displayPrice !== 'N/A' ? `$${displayPrice}` : 'N/A';
        
        const bodyDisplay = wine.body && String(wine.body).trim() ? this.formatTastingText(wine.body) : null;
        const formatDisplay = this.deriveFormat(wine);
        const metaItems = [
            { label: 'Producer', value: wine.wine_producer || 'N/A', show: true },
            { label: 'Region', value: wine.region || 'N/A', show: true },
            { label: 'Grape', value: wine.varietals || 'N/A', show: !!wine.varietals },
            { label: 'Vintage', value: vintage, show: true },
            { label: 'Denomination', value: denomination, show: !!denomination },
            { label: 'Formato', value: formatDisplay, show: !!formatDisplay },
            { label: 'Body', value: bodyDisplay, show: !!bodyDisplay },
            { label: 'Alcohol', value: alcohol, show: !!wine.alcohol },
            { label: 'Price', value: priceValue, show: true }
        ].filter(item => item.show);

        const metaContainer = document.getElementById('wineMeta');
        if (metaContainer) {
            if (metaItems.length > 0) {
                metaContainer.innerHTML = metaItems.map(item => `
                    <div class="meta-item">
                        <span class="meta-label">${item.label}</span>
                        <span class="meta-value">${item.value}</span>
                    </div>
                `).join('');
                metaContainer.style.display = 'block';
            } else {
                metaContainer.innerHTML = '<div class="meta-item"><span class="meta-label">Information</span><span class="meta-value">Details coming soon</span></div>';
                metaContainer.style.display = 'block';
            }
        }
    }

    updateWineDescription(wine) {
        const descriptionContainer = document.getElementById('wineDescription');
        if (descriptionContainer) {
            const description = wine.wine_description || wine.wine_description_short || '';
            if (description && description.trim()) {
                descriptionContainer.innerHTML = `<p>${this.escapeHtml(this.formatTastingText(description))}</p>`;
                descriptionContainer.style.display = 'block';
            } else {
                descriptionContainer.style.display = 'none';
            }
        }
    }

    updateWineFormatLine(wine) {
        const formatEl = document.getElementById('wineFormatLine');
        if (!formatEl) return;
        const format = this.deriveFormat(wine);
        if (format) {
            formatEl.textContent = `Formato: ${format}`;
            formatEl.style.display = '';
        } else {
            formatEl.textContent = '';
            formatEl.style.display = 'none';
        }
    }

    updateWineImage(wine) {
        const wineBottleIcon = document.getElementById('wineBottleIcon');
        const wineBottleImage = document.getElementById('wineBottleImage');
        
        if (!wineBottleIcon || !wineBottleImage) return;
        
        // Try to find a matching image for this wine
        const wineImageUrl = this.findWineImage(wine);
        
        if (wineImageUrl) {
            // Show image and hide icon
            wineBottleImage.src = wineImageUrl;
            wineBottleImage.style.display = 'block';
            wineBottleIcon.style.display = 'none';
            
            // Add error handling for image loading
            wineBottleImage.onerror = () => {
                console.log('Failed to load wine image, falling back to icon');
                wineBottleImage.style.display = 'none';
                wineBottleIcon.style.display = 'block';
            };
        } else {
            // No image found, show icon
            wineBottleImage.style.display = 'none';
            wineBottleIcon.style.display = 'block';
        }
    }

    findWineImage(wine) {
        // First, check if wine has bottle_image_url directly (from wines.json)
        if (wine.bottle_image_url) {
            console.log(`Found bottle_image_url for wine: ${wine.wine_name} by ${wine.wine_producer}`);
            return wine.bottle_image_url;
        }
        
        if (!this.wineImages) return null;
        
        console.log(`Looking for image for wine: ${wine.wine_name} by ${wine.wine_producer}`);
        
        // Try exact match first
        if (this.wineImages[wine.wine_name]) {
            console.log(`Found exact match for wine name: ${wine.wine_name}`);
            return this.wineImages[wine.wine_name];
        }
        
        // Try matching by producer (clean up producer name)
        if (wine.wine_producer) {
            const producerName = wine.wine_producer.replace(/[*]/g, '').trim();
            if (this.wineImages[producerName]) {
                console.log(`Found match for producer: ${producerName}`);
                return this.wineImages[producerName];
            }
        }
        
        // Try partial matches for wine name (more flexible)
        for (const [wineName, imageUrl] of Object.entries(this.wineImages)) {
            const wineNameLower = wine.wine_name.toLowerCase();
            const mappingNameLower = wineName.toLowerCase();
            
            // Check if wine name is contained in mapping name or vice versa
            if (mappingNameLower.includes(wineNameLower) || wineNameLower.includes(mappingNameLower)) {
                console.log(`Found partial match for wine name: ${wine.wine_name} -> ${wineName}`);
                return imageUrl;
            }
        }
        
        // Try partial matches for producer (more flexible)
        if (wine.wine_producer) {
            const producerName = wine.wine_producer.replace(/[*]/g, '').trim();
            const producerNameLower = producerName.toLowerCase();
            
            for (const [wineName, imageUrl] of Object.entries(this.wineImages)) {
                const mappingNameLower = wineName.toLowerCase();
                
                // Check if producer name is contained in mapping name or vice versa
                if (mappingNameLower.includes(producerNameLower) || producerNameLower.includes(mappingNameLower)) {
                    console.log(`Found partial match for producer: ${producerName} -> ${wineName}`);
                    return imageUrl;
                }
            }
        }
        
        // Try matching by key words in wine name
        const wineNameWords = wine.wine_name.toLowerCase().split(' ');
        for (const [wineName, imageUrl] of Object.entries(this.wineImages)) {
            const mappingNameLower = wineName.toLowerCase();
            
            // Check if any word from wine name appears in mapping name
            for (const word of wineNameWords) {
                if (word.length > 2 && mappingNameLower.includes(word)) {
                    console.log(`Found keyword match: ${word} in ${wineName}`);
                    return imageUrl;
                }
            }
        }
        
        console.log(`No image found for wine: ${wine.wine_name}`);
        return null;
    }

    /** Escape HTML for safe insertion into DOM */
    escapeHtml(str) {
        if (str == null) return '';
        const s = String(str);
        return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    /** Format text: title-case if all uppercase, else leave as-is */
    formatTastingText(text) {
        if (!text || !text.trim()) return '';
        const t = text.trim();
        if (t === t.toUpperCase() && t !== t.toLowerCase()) {
            return t.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
        }
        return t;
    }

    /** Populate the quick-info div next to wine name (tagline only; body is shown in Tasting Notes). */
    updateWineQuickInfo(wine) {
        const el = document.getElementById('wineQuickInfo');
        if (!el) return;
        const notes = wine.tasting_notes;
        const source = (notes && (notes.visual || notes.olfactory)) ? (notes.visual || notes.olfactory) : (wine.wine_description || '');
        const firstSentence = source.trim().split(/[.!?]/)[0];
        const taglineFormatted = firstSentence ? this.formatTastingText(firstSentence.trim()) : '';
        if (taglineFormatted) {
            el.innerHTML = `<span class="quick-info-tagline">${this.escapeHtml(taglineFormatted)}</span>`;
            el.style.display = '';
        } else {
            el.innerHTML = '';
            el.style.display = 'none';
        }
    }

    updateTastingNotes(wine) {
        const notes = wine.tasting_notes;
        const hasStructuredNotes = notes && (notes.visual || notes.olfactory || notes.gustatory);
        const body = wine.body && String(wine.body).trim() ? this.formatTastingText(wine.body) : null;

        let panelHtml = '';
        if (hasStructuredNotes || body) {
            if (body) {
                panelHtml += `<div class="tasting-category"><span class="tasting-label">Body</span><span class="tasting-value">${this.escapeHtml(body)}</span></div>`;
            }
            if (hasStructuredNotes) {
                const visual = notes.visual ? this.formatTastingText(notes.visual) : '';
                const olfactory = notes.olfactory ? this.formatTastingText(notes.olfactory) : '';
                const gustatory = notes.gustatory ? this.formatTastingText(notes.gustatory) : '';
                if (visual) panelHtml += `<div class="tasting-category"><span class="tasting-label">Visual</span><span class="tasting-value">${this.escapeHtml(visual)}</span></div>`;
                if (olfactory) panelHtml += `<div class="tasting-category"><span class="tasting-label">Olfactory</span><span class="tasting-value">${this.escapeHtml(olfactory)}</span></div>`;
                if (gustatory) panelHtml += `<div class="tasting-category"><span class="tasting-label">Gustatory</span><span class="tasting-value">${this.escapeHtml(gustatory)}</span></div>`;
            }
        } else {
            const wineDescription = wine.wine_description || 'A fine wine selection from our curated collection.';
            const descFormatted = this.formatTastingText(wineDescription);
            if (descFormatted && descFormatted !== 'A fine wine selection from our curated collection.') {
                panelHtml = `<div class="tasting-category elegant-message"><span class="tasting-value">${this.escapeHtml(descFormatted)}</span></div>`;
            }
        }

        // Inline Tasting Notes in the page (sempre visibili)
        const inlineEl = document.getElementById('wineTastingNotesContent');
        if (inlineEl) {
            if (panelHtml) {
                inlineEl.innerHTML = panelHtml;
                inlineEl.style.display = '';
            } else {
                inlineEl.innerHTML = '';
                inlineEl.style.display = 'none';
            }
        }

        // Popup (per eventuale uso futuro)
        const tastingNotesPopupBody = document.getElementById('tastingNotesPopupBody');
        if (tastingNotesPopupBody && panelHtml) {
            tastingNotesPopupBody.innerHTML = `<div class="tasting-notes-panel-inner">${panelHtml}</div>`;
        }
    }

    setupTastingNotesPopup() {
        const btn = document.getElementById('tastingNotesToggle');
        const popup = document.getElementById('tastingNotesPopup');
        const popupClose = document.getElementById('tastingNotesPopupClose');
        if (!btn || !popup || !popupClose) return;

        const openPopup = () => {
            popup.classList.add('active');
            popup.setAttribute('aria-hidden', 'false');
            document.body.style.overflow = 'hidden';
        };

        const closePopup = () => {
            popup.classList.remove('active');
            popup.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = '';
        };

        btn.addEventListener('click', openPopup);

        if (!this.tastingNotesPopupSetup) {
            this.tastingNotesPopupSetup = true;
            popupClose.addEventListener('click', closePopup);
            popup.addEventListener('click', (e) => {
                if (e.target === popup) closePopup();
            });
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && popup.classList.contains('active')) closePopup();
            });
        }
    }

    setupWineLab(wine) {
        const section = document.getElementById('wineLabSection');
        if (!section) return;

        if (!this.wineLab) {
            this.wineLab = {
                initialized: false,
                editMode: false,
                data: null,
                defaults: null,
                elements: {}
            };
        }

        if (!this.wineLab.initialized) {
            const elements = {
                section,
                panel: document.getElementById('wineLabPanel'),
                toggleBtn: document.getElementById('wineLabToggle'),
                editBtn: document.getElementById('wineLabEditBtn'),
                saveBtn: document.getElementById('wineLabSaveBtn'),
                downloadBtn: document.getElementById('wineLabDownloadBtn'),
                resetBtn: document.getElementById('wineLabResetBtn'),
                indicator: document.getElementById('wineLabIndicator'),
                card: document.getElementById('wineLabCard'),
                editables: section.querySelectorAll('.wine-lab-editable'),
                chartClickables: section.querySelectorAll('.wine-lab-chart-clickable'),
                radarEditor: document.getElementById('wineLabRadarEditor'),
                aromaEditor: document.getElementById('wineLabAromaEditor'),
                radarLegend: document.getElementById('wineLabRadarLegend')
            };
            this.wineLab.elements = elements;

            this.wineLab.setEditMode = (nextState) => {
                const isEditing = typeof nextState === 'boolean' ? nextState : !this.wineLab.editMode;
                this.wineLab.editMode = isEditing;
                if (isEditing) {
                    elements.indicator?.classList.add('active');
                    elements.saveBtn && (elements.saveBtn.style.display = 'inline-block');
                    elements.editBtn && (elements.editBtn.textContent = '❌ Exit Edit');
                } else {
                    elements.indicator?.classList.remove('active');
                    elements.saveBtn && (elements.saveBtn.style.display = 'none');
                    elements.editBtn && (elements.editBtn.textContent = '✏️ Edit Mode');
                    elements.radarEditor?.classList.remove('active');
                    elements.aromaEditor?.classList.remove('active');
                }

                const wineLabRef = this.wineLab;
                elements.editables.forEach(el => {
                    if (isEditing) {
                        el.setAttribute('contenteditable', 'true');
                        el.classList.add('editing');
                        // Aggiungi event listener per salvare i valori quando vengono modificati
                        if (!el.hasAttribute('data-has-listener')) {
                            el.addEventListener('blur', function(e) {
                                const field = e.target.getAttribute('data-field');
                                if (field && wineLabRef && wineLabRef.data) {
                                    // Salva il valore nel data object se necessario
                                    if (!wineLabRef.data.fields) {
                                        wineLabRef.data.fields = {};
                                    }
                                    wineLabRef.data.fields[field] = e.target.textContent.trim();
                                }
                            });
                            el.addEventListener('keydown', function(e) {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    e.target.blur();
                                }
                            });
                            el.setAttribute('data-has-listener', 'true');
                        }
                    } else {
                        el.removeAttribute('contenteditable');
                        el.classList.remove('editing');
                    }
                });
            };

            this.wineLab.togglePanel = () => {
                if (!elements.panel || !elements.toggleBtn) return;
                const isOpen = !elements.panel.hasAttribute('hidden');
                if (isOpen) {
                    elements.panel.setAttribute('hidden', '');
                    elements.toggleBtn.setAttribute('aria-expanded', 'false');
                    elements.toggleBtn.textContent = 'Create Your Wine Card';
                } else {
                    elements.panel.removeAttribute('hidden');
                    elements.toggleBtn.setAttribute('aria-expanded', 'true');
                    elements.toggleBtn.textContent = 'Hide Wine Card Builder';
                }
            };

            elements.toggleBtn?.addEventListener('click', this.wineLab.togglePanel);
            elements.editBtn?.addEventListener('click', () => this.wineLab.setEditMode());
            elements.saveBtn?.addEventListener('click', () => this.wineLab.setEditMode(false));
            elements.downloadBtn?.addEventListener('click', () => this.wineLab.downloadCard());
            elements.resetBtn?.addEventListener('click', () => this.wineLab.resetCard());

            elements.chartClickables.forEach(clickable => {
                clickable.addEventListener('click', () => {
                    if (!this.wineLab.editMode) return;
                    const editor = clickable.nextElementSibling;
                    if (editor && editor.classList.contains('wine-lab-chart-editor')) {
                        editor.classList.toggle('active');
                    }
                });
            });

            this.wineLab.radarMetrics = ['body', 'tannins', 'alcohol', 'persistence', 'acidity', 'complexity'];
            this.wineLab.aromaMetrics = ['redFruit', 'blackFruit', 'floral', 'vanilla', 'spice', 'earth', 'coffee'];

            this.wineLab.updateRadarChart = () => {
                if (!this.wineLab.data) return;
                const values = this.wineLab.radarMetrics.map(metric => this.wineLab.data.radar[metric]);
                const centerX = 200;
                const centerY = 150;
                const radius = 80;
                const angleIncrement = (Math.PI * 2) / 6;

                const points = [];
                values.forEach((value, i) => {
                    const angle = i * angleIncrement - Math.PI / 2;
                    const r = (value / 10) * radius;
                    const x = centerX + r * Math.cos(angle);
                    const y = centerY + r * Math.sin(angle);
                    points.push(`${x},${y}`);
                    const point = document.getElementById(`wineLabRadarPoint${i + 1}`);
                    if (point) {
                        point.setAttribute('cx', x);
                        point.setAttribute('cy', y);
                    }
                });

                const polygon = document.getElementById('wineLabRadarPolygon');
                if (polygon) {
                    polygon.setAttribute('points', points.join(' '));
                }

                // Update radar labels
                if (this.wineLab.data.radarLabels) {
                    const labelPositions = [
                        { id: 'wineLabRadarLabel1', x: 200, y: 65, anchor: 'middle' }, // Body
                        { id: 'wineLabRadarLabel2', x: 280, y: 110, anchor: 'start' }, // Tannins
                        { id: 'wineLabRadarLabel3', x: 280, y: 190, anchor: 'start' }, // Alcohol
                        { id: 'wineLabRadarLabel4', x: 200, y: 240, anchor: 'middle' }, // Persistence
                        { id: 'wineLabRadarLabel5', x: 120, y: 190, anchor: 'end' }, // Acidity
                        { id: 'wineLabRadarLabel6', x: 120, y: 110, anchor: 'end' }  // Complexity
                    ];
                    
                    this.wineLab.radarMetrics.forEach((metric, i) => {
                        const labelEl = document.getElementById(labelPositions[i].id);
                        if (labelEl && this.wineLab.data.radarLabels[metric]) {
                            labelEl.textContent = this.wineLab.data.radarLabels[metric];
                        }
                    });
                }

                if (elements.radarLegend) {
                    elements.radarLegend.textContent = this.wineLab.data.legend;
                }
            };

            this.wineLab.updateAromaChart = () => {
                if (!this.wineLab.data) return;
                this.wineLab.aromaMetrics.forEach((aroma, index) => {
                    const bar = document.getElementById(`wineLab${aroma.charAt(0).toUpperCase() + aroma.slice(1)}Bar`);
                    const label = document.getElementById(`wineLabAromaLabel${index + 1}`);
                    if (bar) {
                        bar.setAttribute('width', this.wineLab.data.aroma[aroma]);
                    }
                    if (label) {
                        label.textContent = this.wineLab.data.aromaNames[aroma];
                    }
                });
            };

            this.wineLab.syncControls = () => {
                if (!this.wineLab.data) return;
                this.wineLab.radarMetrics.forEach(metric => {
                    const slider = document.getElementById(`wineLab${metric.charAt(0).toUpperCase() + metric.slice(1)}Slider`);
                    const valueSpan = document.getElementById(`wineLab${metric.charAt(0).toUpperCase() + metric.slice(1)}Value`);
                    const nameInput = document.getElementById(`wineLab${metric.charAt(0).toUpperCase() + metric.slice(1)}Name`);
                    if (slider) slider.value = this.wineLab.data.radar[metric];
                    if (valueSpan) valueSpan.textContent = this.wineLab.data.radar[metric];
                    if (nameInput && this.wineLab.data.radarLabels) {
                        nameInput.value = this.wineLab.data.radarLabels[metric] || metric.charAt(0).toUpperCase() + metric.slice(1);
                    }
                });
                this.wineLab.aromaMetrics.forEach(aroma => {
                    const slider = document.getElementById(`wineLab${aroma.charAt(0).toUpperCase() + aroma.slice(1)}Slider`);
                    const valueSpan = document.getElementById(`wineLab${aroma.charAt(0).toUpperCase() + aroma.slice(1)}Value`);
                    const nameInput = document.getElementById(`wineLab${aroma.charAt(0).toUpperCase() + aroma.slice(1)}Name`);
                    if (slider) slider.value = this.wineLab.data.aroma[aroma];
                    if (valueSpan) valueSpan.textContent = Math.round(this.wineLab.data.aroma[aroma] / 20);
                    if (nameInput) nameInput.value = this.wineLab.data.aromaNames[aroma];
                });
            };

            this.wineLab.applyFields = (fields) => {
                if (!fields) return;
                Object.entries(fields).forEach(([key, value]) => {
                    if (typeof value === 'object') return;
                    const el = section.querySelector(`[data-field="${key}"]`);
                    if (el) {
                        el.textContent = value;
                    }
                });
            };

            this.wineLab.downloadCard = async () => {
                if (!elements.card || !window.html2canvas) return;
                
                // Verifica se jsPDF è disponibile (può essere window.jspdf.jsPDF o window.jsPDF)
                let jsPDFClass;
                if (window.jspdf && window.jspdf.jsPDF) {
                    jsPDFClass = window.jspdf.jsPDF;
                } else if (window.jsPDF) {
                    jsPDFClass = window.jsPDF;
                } else {
                    console.error('jsPDF library not loaded');
                    alert('PDF library not available. Please refresh the page.');
                    return;
                }

                const wasEditing = this.wineLab.editMode;
                if (wasEditing) {
                    this.wineLab.setEditMode(false);
                }
                elements.section.querySelector('.wine-lab-controls')?.classList.add('wine-lab-hidden');
                elements.section.querySelector('.wine-lab-indicator')?.classList.remove('active');

                try {
                    // Genera canvas ad alta risoluzione
                    const canvas = await window.html2canvas(elements.card, {
                        scale: 3,
                        useCORS: true,
                        logging: false,
                        allowTaint: false,
                        backgroundColor: '#1A1A1A',
                        windowWidth: elements.card.scrollWidth,
                        windowHeight: elements.card.scrollHeight
                    });

                    // Converti pixel a mm (1 pixel = 0.264583 mm a 96 DPI)
                    const pxToMm = 0.264583;
                    const imgWidthMM = canvas.width * pxToMm;
                    const imgHeightMM = canvas.height * pxToMm;

                    // Crea PDF con dimensione personalizzata per adattarsi perfettamente all'immagine (una pagina unica)
                    const pdf = new jsPDFClass({
                        orientation: imgHeightMM > imgWidthMM ? 'portrait' : 'landscape',
                        unit: 'mm',
                        format: [imgWidthMM, imgHeightMM]
                    });

                    // Aggiungi immagine al PDF con qualità massima
                    const imgData = canvas.toDataURL('image/png', 1.0);
                    pdf.addImage(imgData, 'PNG', 0, 0, imgWidthMM, imgHeightMM, undefined, 'FAST');

                    // Scarica il PDF
                    const filename = `${(this.wineLab.data?.filename || 'wine-card').toLowerCase().replace(/\s+/g, '-')}.pdf`;
                    pdf.save(filename);
                } catch (error) {
                    console.error('Error generating Wine Lab PDF:', error);
                    alert('Error generating PDF. Please try again.');
                } finally {
                    elements.section.querySelector('.wine-lab-controls')?.classList.remove('wine-lab-hidden');
                    if (wasEditing) {
                        this.wineLab.setEditMode(true);
                        elements.section.querySelector('.wine-lab-indicator')?.classList.add('active');
                    }
                }
            };

            this.wineLab.resetCard = () => {
                if (!this.wineLab.defaults) return;
                this.wineLab.data = {
                    radar: { ...this.wineLab.defaults.radar },
                    radarLabels: { ...this.wineLab.defaults.radarLabels },
                    aroma: { ...this.wineLab.defaults.aroma },
                    aromaNames: { ...this.wineLab.defaults.aromaNames },
                    legend: this.wineLab.defaults.chartLegend,
                    filename: this.wineLab.defaults.fileName
                };
                this.wineLab.applyFields(this.wineLab.defaults);
                this.wineLab.syncControls();
                this.wineLab.updateRadarChart();
                this.wineLab.updateAromaChart();
            };

            this.wineLab.radarMetrics.forEach(metric => {
                const slider = document.getElementById(`wineLab${metric.charAt(0).toUpperCase() + metric.slice(1)}Slider`);
                const valueSpan = document.getElementById(`wineLab${metric.charAt(0).toUpperCase() + metric.slice(1)}Value`);
                const nameInput = document.getElementById(`wineLab${metric.charAt(0).toUpperCase() + metric.slice(1)}Name`);
                
                if (slider) {
                    slider.addEventListener('input', () => {
                        this.wineLab.data.radar[metric] = parseInt(slider.value, 10);
                        if (valueSpan) valueSpan.textContent = slider.value;
                        this.wineLab.updateRadarChart();
                    });
                }

                if (nameInput) {
                    nameInput.addEventListener('input', () => {
                        if (!this.wineLab.data.radarLabels) {
                            this.wineLab.data.radarLabels = {};
                        }
                        this.wineLab.data.radarLabels[metric] = nameInput.value;
                        this.wineLab.updateRadarChart();
                    });
                }
            });

            this.wineLab.aromaMetrics.forEach(aroma => {
                const slider = document.getElementById(`wineLab${aroma.charAt(0).toUpperCase() + aroma.slice(1)}Slider`);
                const valueSpan = document.getElementById(`wineLab${aroma.charAt(0).toUpperCase() + aroma.slice(1)}Value`);
                const nameInput = document.getElementById(`wineLab${aroma.charAt(0).toUpperCase() + aroma.slice(1)}Name`);

                if (slider) {
                    slider.addEventListener('input', () => {
                        this.wineLab.data.aroma[aroma] = parseInt(slider.value, 10);
                        if (valueSpan) valueSpan.textContent = Math.round(slider.value / 20);
                        this.wineLab.updateAromaChart();
                    });
                }

                if (nameInput) {
                    nameInput.addEventListener('input', () => {
                        this.wineLab.data.aromaNames[aroma] = nameInput.value;
                        this.wineLab.updateAromaChart();
                    });
                }
            });

            this.wineLab.initialized = true;
        }

        const defaults = this.getWineLabDefaults(wine);
        this.wineLab.defaults = defaults;
        this.wineLab.data = {
            radar: { ...defaults.radar },
            radarLabels: { ...defaults.radarLabels },
            aroma: { ...defaults.aroma },
            aromaNames: { ...defaults.aromaNames },
            legend: defaults.chartLegend,
            filename: defaults.fileName
        };

        this.wineLab.applyFields(defaults);
        this.wineLab.syncControls();
        this.applyWineLabTheme(wine);
        this.wineLab.updateRadarChart();
        this.wineLab.updateAromaChart();
    }

    getWineLabDefaults(wine) {
        const vintage = this.extractYear(wine.wine_vintage) || wine.wine_vintage || 'NV';
        const family = this.getWineFamily(wine.wine_type, wine.subcategory || wine.wine_subcategory);
        const typeLabelMap = {
            'ROSSO': 'Red',
            'BIANCO': 'White',
            'ROSATO': 'Rosé',
            'ARANCIONE': 'Orange',
            'BOLLICINE': 'Sparkling',
            'NON ALCOLICO': 'Non-Alcoholic'
        };
        const typeLabel = typeLabelMap[family] || 'Red';
        const description = wine.wine_description || wine.wine_description_short || 'Vintage notes and story.';
        const foodPairings = wine.food_pairings || wine.food_pairing || 'Add food pairings here.';
        const year = new Date().getFullYear();
        const wineName = wine.wine_name || 'Wine Name';
        const producer = wine.wine_producer || 'Producer';
        const fullWineName = `${wineName} ${vintage}`.trim();

        return {
            winery: producer,
            wineName,
            vintage,
            wineType: typeLabel,
            fullWineName,
            classification: wine.wine_classification || wine.wine_appellation || wine.region || 'Classification / Appellation',
            producer,
            grapes: wine.varietals || 'Grapes',
            vintageSpec: vintage,
            alcohol: wine.alcohol ? `${wine.alcohol}%` : 'N/A',
            aging: wine.aging || 'Aging details',
            servingTemp: wine.serving_temp || '16-18°C',
            cellaring: wine.cellaring || 'N/A',
            vintageYear: vintage,
            vintageDescription: description,
            foodPairings,
            visual: 'Visual notes.',
            olfactory: 'Aromatic notes.',
            gustatory: 'Palate notes.',
            author: 'Gran Caffè L\'Aquila',
            year: year,
            footerWinery: producer,
            footerWine: wineName,
            chartLegend: fullWineName,
            fileName: fullWineName,
            radar: {
                body: 6,
                tannins: 6,
                alcohol: 6,
                persistence: 6,
                acidity: 6,
                complexity: 6
            },
            radarLabels: {
                body: 'Body',
                tannins: 'Tannins',
                alcohol: 'Alcohol',
                persistence: 'Persistence',
                acidity: 'Acidity',
                complexity: 'Complexity'
            },
            aroma: {
                redFruit: 80,
                blackFruit: 80,
                floral: 60,
                vanilla: 60,
                spice: 60,
                earth: 40,
                coffee: 40
            },
            aromaNames: {
                redFruit: 'Red Fruit',
                blackFruit: 'Black Fruit',
                floral: 'Floral',
                vanilla: 'Vanilla',
                spice: 'Spice',
                earth: 'Earth',
                coffee: 'Coffee'
            }
        };
    }

    applyWineLabTheme(wine) {
        const section = document.getElementById('wineLabSection');
        if (!section) return;
        const family = this.getWineFamily(wine.wine_type, wine.subcategory || wine.wine_subcategory);
        const themes = {
            'ROSSO': { primary: '#6b1a1a', accent: '#C5A059', dark: '#2b0f10', lightBg: '#FDFBF7', rgb: '107,26,26' },
            'BIANCO': { primary: '#84702d', accent: '#EBD89A', dark: '#4d4520', lightBg: '#FFFCF2', rgb: '132,112,45' },
            'ROSATO': { primary: '#b35d72', accent: '#F3C9D3', dark: '#6e3845', lightBg: '#FFF5F7', rgb: '179,93,114' },
            'ARANCIONE': { primary: '#b6682a', accent: '#F0C28B', dark: '#6f3f1a', lightBg: '#FFF8F0', rgb: '182,104,42' },
            'BOLLICINE': { primary: '#6b6e7a', accent: '#D3D6E4', dark: '#3d3f46', lightBg: '#F7F8FB', rgb: '107,110,122' },
            'NON ALCOLICO': { primary: '#2f6f64', accent: '#A8D5C8', dark: '#1b3f39', lightBg: '#F5FBF8', rgb: '47,111,100' }
        };
        const theme = themes[family] || themes.ROSSO;

        section.style.setProperty('--wine-lab-primary', theme.primary);
        section.style.setProperty('--wine-lab-accent', theme.accent);
        section.style.setProperty('--wine-lab-dark', theme.dark);
        section.style.setProperty('--wine-lab-light-bg', theme.lightBg);
        section.style.setProperty('--wine-lab-rgb-primary', theme.rgb);
    }

    updateWineInformation(wine) {
        // Store wine info for popup (will be used when popup opens)
        this.currentWineInfo = wine;
        
        // Check if there's information to show
        const vintage = this.extractYear(wine.wine_vintage) || (wine.wine_vintage || 'N/A');
        const hasInfo = wine.varietals || vintage !== 'N/A' || wine.alcohol || wine.wine_type || wine.aging || wine.soil || wine.elevation || wine.organic !== undefined;
        
        // Show/hide info trigger
        const infoTrigger = document.getElementById('infoTrigger');
        if (infoTrigger) {
            infoTrigger.style.display = hasInfo ? 'inline' : 'none';
        }
    }

    populateInfoPopup(type) {
        const popup = document.getElementById('infoPopup');
        const popupTitle = document.getElementById('infoPopupTitle');
        const popupBody = document.getElementById('infoPopupBody');
        
        if (!popup || !popupTitle || !popupBody || !this.currentWineInfo) return;
        
        const wine = this.currentWineInfo;
        
        if (type === 'information') {
            popupTitle.textContent = 'Information';
            const vintage = this.extractYear(wine.wine_vintage) || (wine.wine_vintage || 'N/A');
            
            const infoItems = [
                { label: 'Grape Variety', value: wine.varietals || 'N/A', icon: 'fas fa-seedling', show: !!wine.varietals },
                { label: 'Vintage', value: vintage, icon: 'fas fa-calendar', show: true },
                { label: 'Alcohol', value: wine.alcohol || 'N/A', icon: 'fas fa-percent', show: !!wine.alcohol },
                { label: 'Wine Type', value: this.getWineTypeName(wine.wine_type) || 'N/A', icon: 'fas fa-wine-glass', show: true },
                { label: 'Aging', value: wine.aging || 'N/A', icon: 'fas fa-hourglass-half', show: !!wine.aging },
                { label: 'Soil', value: wine.soil || 'N/A', icon: 'fas fa-mountain', show: !!wine.soil },
                { label: 'Elevation', value: wine.elevation || 'N/A', icon: 'fas fa-mountain', show: !!wine.elevation },
                { label: 'Organic', value: wine.organic ? 'Certified Organic' : (wine.organic === false ? 'Conventional' : 'N/A'), icon: 'fas fa-leaf', show: wine.organic !== undefined }
            ].filter(item => item.show);

            if (infoItems.length > 0) {
                popupBody.innerHTML = `
                    <div class="info-grid">
                        ${infoItems.map(item => `
                            <div class="info-item">
                                <div class="info-head"><i class="${item.icon} info-icon elegant"></i><span class="info-label">${item.label}</span></div>
                                <div class="info-value">${item.value}</div>
                            </div>
                        `).join('')}
                    </div>
                `;
            } else {
                popupBody.innerHTML = '<div class="info-item"><div class="info-head"><i class="fas fa-info-circle info-icon elegant"></i><span class="info-label">Information</span></div><div class="info-value">Details coming soon</div></div>';
            }
        } else if (type === 'producer') {
            popupTitle.textContent = 'Producer';
            const producerName = wine.wine_producer || 'N/A';
            const producerDescription = this.getProducerDescription(wine) || wine.wine_description || 'No description available.';
            
            popupBody.innerHTML = `
                <div>
                    <h3 class="producer-name" style="margin-bottom: 1rem;">${producerName}</h3>
                    <p class="producer-description">${producerDescription}</p>
                </div>
            `;
        }
    }

    setupInfoPopup() {
        // Only setup once to avoid duplicate event listeners
        if (this.infoPopupSetup) return;
        this.infoPopupSetup = true;
        
        const infoTrigger = document.getElementById('infoTrigger');
        const producerTrigger = document.getElementById('producerTrigger');
        const popup = document.getElementById('infoPopup');
        const popupClose = document.getElementById('infoPopupClose');
        
        if (infoTrigger && popup) {
            infoTrigger.addEventListener('click', (e) => {
                e.preventDefault();
                this.populateInfoPopup('information');
                popup.classList.add('active');
            });
        }
        
        if (producerTrigger && popup) {
            producerTrigger.addEventListener('click', (e) => {
                e.preventDefault();
                this.populateInfoPopup('producer');
                popup.classList.add('active');
            });
        }
        
        if (popupClose && popup) {
            popupClose.addEventListener('click', () => {
                popup.classList.remove('active');
            });
        }
        
        // Close on overlay click
        if (popup) {
            popup.addEventListener('click', (e) => {
                if (e.target === popup) {
                    popup.classList.remove('active');
                }
            });
        }
        
        // Close on ESC key
        const escHandler = (e) => {
            if (e.key === 'Escape' && popup && popup.classList.contains('active')) {
                popup.classList.remove('active');
            }
        };
        document.addEventListener('keydown', escHandler);
    }

    async updateFoodPairings(wine) {
        const pairingList = document.getElementById('pairingList');
        if (pairingList) {
            // Ensure food pairings data is loaded
            if (!this.foodPairingsData) {
                console.log('📥 Loading food pairings data...');
                await this.loadFoodPairingsData();
            }
            
            // Generate food pairings: generic first, then GCA personalized
            const allPairings = this.getFoodPairings(wine);
            const genericPairings = allPairings.filter(p => !p.isPersonalized);
            const gcaPairings = allPairings.filter(p => p.isPersonalized);
            
            // Build HTML: generic pairings first
            let html = genericPairings.map(pairing => `
                <div class="pairing-item" 
                     ${pairing.reason ? `title="${pairing.reason}"` : ''}>
                    <i class="${pairing.icon} pairing-icon"></i>
                    <h3 class="pairing-name">${pairing.name}</h3>
                </div>
            `).join('');
            
            // Then add GCA pairings with label
            if (gcaPairings.length > 0) {
                html += gcaPairings.map(pairing => `
                    <div class="pairing-item personalized-pairing" 
                         ${pairing.reason ? `title="${pairing.reason}"` : ''}>
                        <span class="gca-food-pairing-badge">GCA Food Pairing</span>
                        <i class="${pairing.icon} pairing-icon"></i>
                        <h3 class="pairing-name">${pairing.name}</h3>
                        ${pairing.gcaScore ? `<span class="pairing-score">GCA Score ${pairing.gcaScore}</span>` : ''}
                    </div>
                `).join('');
            }
            
            pairingList.innerHTML = html;
        }
    }

    getFoodPairings(wine) {
        const personalizedPairings = [];
        
        // Check for personalized pairings from Gran Caffè dishes
        if (this.foodPairingsData && wine && wine.wine_name) {
            const wineNameNormalized = wine.wine_name.toLowerCase().trim();
            const wineProducerNormalized = wine.wine_producer ? wine.wine_producer.toLowerCase().trim() : '';
            
            console.log('🔍 Searching pairings for:', {
                wineName: wine.wine_name,
                producer: wine.wine_producer,
                normalizedName: wineNameNormalized,
                normalizedProducer: wineProducerNormalized
            });
            
            // Find dishes that recommend this wine
            this.foodPairingsData.forEach(dish => {
                if (dish.wines && Array.isArray(dish.wines)) {
                    const matchingWine = dish.wines.find(rec => {
                        const recNameNormalized = rec.name.toLowerCase().trim();
                        
                        // Simple check: does the recommendation contain the wine name?
                        const nameInRec = recNameNormalized.includes(wineNameNormalized);
                        const recInName = wineNameNormalized.includes(recNameNormalized.split('–')[0].trim().split(' ')[0]);
                        
                        // Check producer match if both exist
                        let producerInRec = false;
                        if (wineProducerNormalized) {
                            producerInRec = recNameNormalized.includes(wineProducerNormalized);
                        }
                        
                        // Match if: name is found in recommendation OR (name matches AND producer matches if available)
                        const matches = nameInRec || recInName || (nameInRec && producerInRec);
                        
                        if (matches) {
                            console.log('✅ Match found!', {
                                recommendation: rec.name,
                                dish: dish.dish,
                                wineName: wine.wine_name,
                                producer: wine.wine_producer
                            });
                        }
                        
                        return matches;
                    });
                    
                    if (matchingWine) {
                        personalizedPairings.push({
                            name: dish.dish,
                            icon: 'fas fa-utensils',
                            isPersonalized: true,
                            gcaScore: matchingWine['GCA score'],
                            reason: matchingWine.reason
                        });
                    }
                }
            });
            
            console.log('🍽️ Found personalized pairings:', personalizedPairings.length, personalizedPairings);
        } else {
            console.warn('⚠️ Cannot search pairings:', {
                hasData: !!this.foodPairingsData,
                hasWine: !!wine,
                hasWineName: !!(wine && wine.wine_name)
            });
        }
        
        // Get generic pairings as fallback/supplement
        const genericPairings = {
            'ROSSO': [
                { name: 'Roasted Meats', icon: 'fas fa-drumstick-bite' },
                { name: 'Aged Cheeses', icon: 'fas fa-cheese' },
                { name: 'Pasta with Red Sauce', icon: 'fas fa-utensils' },
                { name: 'Dark Chocolate', icon: 'fas fa-cookie-bite' }
            ],
            'BIANCO': [
                { name: 'Seafood', icon: 'fas fa-fish' },
                { name: 'Light Pasta', icon: 'fas fa-utensils' },
                { name: 'Fresh Salads', icon: 'fas fa-leaf' },
                { name: 'Soft Cheeses', icon: 'fas fa-cheese' }
            ],
            'ROSATO': [
                { name: 'Grilled Fish', icon: 'fas fa-fish' },
                { name: 'Light Appetizers', icon: 'fas fa-cookie-bite' },
                { name: 'Summer Salads', icon: 'fas fa-leaf' },
                { name: 'Fresh Fruits', icon: 'fas fa-apple-alt' }
            ],
            'ARANCIONE': [
                { name: 'Aged Cheeses', icon: 'fas fa-cheese' },
                { name: 'Spiced Dishes', icon: 'fas fa-pepper-hot' },
                { name: 'Roasted Vegetables', icon: 'fas fa-carrot' },
                { name: 'Cured Meats', icon: 'fas fa-bacon' }
            ],
            'BOLLICINE': [
                { name: 'Appetizers', icon: 'fas fa-cookie-bite' },
                { name: 'Celebration Foods', icon: 'fas fa-birthday-cake' },
                { name: 'Light Desserts', icon: 'fas fa-ice-cream' },
                { name: 'Fresh Oysters', icon: 'fas fa-fish' }
            ],
            'NON ALCOLICO': [
                { name: 'Fruit Platters', icon: 'fas fa-apple-alt' },
                { name: 'Light Appetizers', icon: 'fas fa-cookie-bite' },
                { name: 'Salads', icon: 'fas fa-leaf' },
                { name: 'Desserts', icon: 'fas fa-ice-cream' }
            ]
        };
        
        // Get generic pairings first
        const genericList = genericPairings[wine.wine_type] || genericPairings['ROSSO'];
        
        // Then add personalized GCA pairings below (up to 4)
        const gcaPairings = personalizedPairings.slice(0, 4);
        
        // Combine: generic first, then GCA pairings
        return [...genericList, ...gcaPairings];
    }

    updateProducerInfo(wine) {
        // Store producer info for popup
        this.currentWineInfo = wine;
        
        // Show/hide producer trigger if producer info exists
        const producerTrigger = document.getElementById('producerTrigger');
        if (producerTrigger) {
            const hasProducerInfo = wine.wine_producer || wine.producer_description;
            producerTrigger.style.display = hasProducerInfo ? 'inline' : 'none';
        }
        
        // Old code kept for reference but elements are now in popup
        const producerInfo = document.getElementById('producerInfo');
        const producerName = document.getElementById('producerName');
        const producerDescription = document.getElementById('producerDescription');
        
        if (producerInfo) {
            if (wine.wine_producer && wine.wine_producer.trim()) {
                producerInfo.style.display = 'block';
                
                if (producerName) {
                    producerName.textContent = wine.wine_producer;
                }
                
                if (producerDescription) {
                    const description = this.getProducerDescription(wine);
                    producerDescription.textContent = description;
                }
            } else {
                producerInfo.style.display = 'none';
            }
        }
    }

    getProducerDescription(wine) {
        // Try to get winery information from WineriesDB
        if (window.WineriesDB && wine.wine_producer) {
            const winery = window.WineriesDB.findWinery(wine.wine_producer);
            if (winery) {
                const description = window.WineriesDB.getDescription(winery);
                if (description) {
                    return description;
                }
            }
        }
        
        // Fallback to generic description
        const region = wine.region || 'this region';
        const wineType = this.getWineTypeName(wine.wine_type);
        const organic = wine.organic ? ' This wine is produced using organic methods.' : '';
        
        return `This ${wineType.toLowerCase()} is crafted in ${region}, showcasing the unique terroir and winemaking traditions of the area.${organic} The producer focuses on quality and authenticity, bringing you an exceptional wine experience.`;
    }

    updateBackButton(wine) {
        const backButton = document.getElementById('backButton');
        const backButtonText = document.getElementById('backButtonText');
        
        if (backButton) {
            // Remove href to prevent default navigation
            backButton.removeAttribute('href');
            
            // Check if handler already added to avoid duplicates
            if (!backButton.hasAttribute('data-back-handler')) {
                // Mark as handler added
                backButton.setAttribute('data-back-handler', 'true');
                
                // Use history.back() to return to previous page
                backButton.addEventListener('click', (e) => {
                    e.preventDefault();
                    
                    // Check if there's a referrer from the same origin (user came from another page)
                    const referrer = document.referrer;
                    const currentOrigin = window.location.origin;
                    const referrerOrigin = referrer ? new URL(referrer).origin : null;
                    
                    // Try to go back to previous page if:
                    // 1. There's a referrer
                    // 2. Referrer is from the same origin
                    // 3. Referrer is different from current page
                    if (referrer && referrerOrigin === currentOrigin && referrer !== window.location.href) {
                        // Go back to previous page
                        window.history.back();
                    } else {
                        // Fallback: return to index.html if no valid referrer
                        const urlParams = new URLSearchParams(window.location.search);
                        const type = urlParams.get('type');
                        
                        let backUrl = `index.html`;
                        const params = new URLSearchParams();
                        
                        if (wine.region) {
                            params.set('region', wine.region);
                        }
                        if (type) {
                            params.set('type', type);
                        }
                        
                        if (params.toString()) {
                            backUrl += `?${params.toString()}`;
                        }
                        
                        window.location.href = backUrl;
                    }
                });
            }
            
            // Update button text if element exists
            if (backButtonText) {
                const urlParams = new URLSearchParams(window.location.search);
                const type = urlParams.get('type');
                
                if (wine.region) {
                    if (type) {
                        const wineFamily = this.getWineFamily(wine.wine_type, wine.subcategory);
                        const typeName = this.getWineTypeName(wineFamily);
                        backButtonText.textContent = `Back to ${wine.region} ${typeName}`;
                    } else {
                        backButtonText.textContent = `Back to ${wine.region} Wines`;
                    }
                } else {
                    backButtonText.textContent = `Back`;
                }
            }
        }
    }

    updateBreadcrumb(wine) {
        // Update desktop breadcrumb
        const breadcrumb = document.getElementById('breadcrumb');
        const breadcrumbCurrent = document.getElementById('breadcrumbCurrent');
        
        // Update mobile breadcrumb
        const mobileBreadcrumb = document.querySelector('.mobile-breadcrumb');
        const mobileBreadcrumbCurrent = document.getElementById('mobileBreadcrumbCurrent');
        
        if (breadcrumb) {
            // Check if there's a wine type filter in the URL parameters
            const urlParams = new URLSearchParams(window.location.search);
            const type = urlParams.get('type');
            
            // Build URL to index.html with region and type filters
            let regionUrl = `index.html`;
            const regionParams = new URLSearchParams();
            if (wine.region) {
                regionParams.set('region', wine.region);
            }
            if (type) {
                regionParams.set('type', type);
            }
            if (regionParams.toString()) {
                regionUrl += `?${regionParams.toString()}`;
            }
            
            // Build URL for home with type filter
            let homeUrl = `index.html`;
            if (type) {
                homeUrl += `?type=${encodeURIComponent(type)}`;
            }
            
            breadcrumb.innerHTML = `
                <a href="${homeUrl}">Home</a>
                <span class="breadcrumb-separator">/</span>
                <a href="${regionUrl}">${wine.region || 'Wine Regions'}</a>
                <span class="breadcrumb-separator">/</span>
                <span class="breadcrumb-current">${wine.wine_name}</span>
            `;
        }
        
        // Update mobile breadcrumb
        if (mobileBreadcrumbCurrent) {
            mobileBreadcrumbCurrent.textContent = wine.wine_name;
        }
    }

    applyFilters() {
        // Helper function to check if a wine contains the varietal as a complete varietal
        const wineContainsVarietal = (wine, searchVarietal) => {
            if (!wine.varietals || !searchVarietal) return false;
            const wineVarietals = wine.varietals.split(',').map(v => v.trim().toLowerCase());
            const searchLower = searchVarietal.toLowerCase();
            // Check if the varietal appears as a complete varietal (exact match after splitting by comma)
            return wineVarietals.some(v => v === searchLower);
        };
        
        this.filteredWines = this.wines.filter(wine => {
            const matchesType = !this.currentFilters.type || this.wineMatchesFamily(wine, this.currentFilters.type);
            const matchesRegion = !this.currentFilters.region || wine.region === this.currentFilters.region;
            const matchesVarietal = !this.currentFilters.varietal || wineContainsVarietal(wine, this.currentFilters.varietal);
            const matchesSearch = !this.currentFilters.search || 
                wine.wine_name.toLowerCase().includes(this.currentFilters.search) ||
                wine.region.toLowerCase().includes(this.currentFilters.search) ||
                (wine.varietals && wine.varietals.toLowerCase().includes(this.currentFilters.search));
            
            return matchesType && matchesRegion && matchesVarietal && matchesSearch;
        });

        this.renderWines();
    }

    toggleView(view) {
        this.currentView = view;
        const winesGrid = document.getElementById('winesGrid');
        const wineTable = document.getElementById('wineTable');
        const regionsGrid = document.getElementById('regionsGrid');
        const regionsTable = document.getElementById('regionsTable');
        const gridBtn = document.getElementById('gridViewBtn');
        const tableBtn = document.getElementById('tableViewBtn');

        if (view === 'grid') {
            if (winesGrid) winesGrid.style.display = 'grid';
            if (wineTable) wineTable.style.display = 'none';
            if (regionsGrid) regionsGrid.style.display = 'grid';
            if (regionsTable) regionsTable.style.display = 'none';
            if (gridBtn) gridBtn.classList.add('active');
            if (tableBtn) tableBtn.classList.remove('active');
        } else {
            if (winesGrid) winesGrid.style.display = 'none';
            if (wineTable) wineTable.style.display = 'block';
            if (regionsGrid) regionsGrid.style.display = 'none';
            if (regionsTable) regionsTable.style.display = 'block';
            if (gridBtn) gridBtn.classList.remove('active');
            if (tableBtn) tableBtn.classList.add('active');
        }
    }

    exploreWine(button) {
        const wineCard = button.closest('.wine-card');
        const tableRow = button.closest('tr');
        
        let wineName = '';
        if (wineCard) {
            wineName = wineCard.querySelector('.wine-name').textContent;
        } else if (tableRow) {
            wineName = tableRow.querySelector('.table-wine-name').textContent;
        }

        // Find the wine in our data
        const wine = this.wines.find(w => w.wine_name === wineName);
        if (wine) {
            let url = `wine-details.html?id=${wine.wine_number}`;
            if (this.currentFilters.type) {
                url += `&type=${encodeURIComponent(this.currentFilters.type)}`;
            }
            window.location.href = url;
        } else {
            this.showError('Wine details not available');
        }
    }

    exploreRegion(button) {
        const regionCard = button.closest('.region-card');
        const tableRow = button.closest('tr');
        
        let regionName = '';
        if (regionCard) {
            regionName = regionCard.querySelector('.region-title').textContent;
        } else if (tableRow) {
            regionName = tableRow.querySelector('.table-region-name').textContent;
        }

        // Navigate to wines page with region filter
        const urlParams = new URLSearchParams(window.location.search);
        const wineType = urlParams.get('type');
        
        // Build URL with proper parameters
        // Navigate to index.html with region and type filters
        let url = `index.html?region=${encodeURIComponent(regionName)}`;
        if (wineType) {
            url += `&type=${encodeURIComponent(wineType)}`;
        }
        
        window.location.href = url;
    }

    showFilterOptions(button) {
        const filterType = button.textContent.includes('Region') ? 'Region' : 'Varietal';
        
        if (filterType === 'Region') {
            this.showRegionFilter();
        } else if (filterType === 'Varietal') {
            this.showVarietalFilter();
        }
    }

    showRegionFilter() {
        // Get all unique regions
        const regions = [...new Set(
            this.wines
                .filter(wine => wine.region && wine.region.trim() !== '')
                .map(wine => wine.region)
        )].sort();

        // Create filter dropdown
        const filterContainer = document.createElement('div');
        filterContainer.className = 'filter-dropdown';
        filterContainer.innerHTML = `
            <div class="filter-dropdown-content">
                <h3>Filter by Region</h3>
                <div class="filter-options">
                    <button class="filter-option" data-region="">All Regions</button>
                    ${regions.map(region => `
                        <button class="filter-option" data-region="${region}">${region}</button>
                    `).join('')}
                </div>
                <div class="filter-actions">
                    <button class="clear-filters">Clear Filters</button>
                    <button class="close-filter">Close</button>
                </div>
            </div>
        `;

        // Add to page
        document.body.appendChild(filterContainer);

        // Add event listeners
        filterContainer.querySelectorAll('.filter-option').forEach(option => {
            option.addEventListener('click', (e) => {
                const region = e.target.getAttribute('data-region');
                this.applyRegionFilter(region);
                document.body.removeChild(filterContainer);
            });
        });

        filterContainer.querySelector('.close-filter').addEventListener('click', () => {
            document.body.removeChild(filterContainer);
        });

        filterContainer.querySelector('.clear-filters').addEventListener('click', () => {
            this.clearAllFilters();
            document.body.removeChild(filterContainer);
        });

        // Close on click outside
        filterContainer.addEventListener('click', (e) => {
            if (e.target === filterContainer) {
                document.body.removeChild(filterContainer);
            }
        });
    }

    showVarietalFilter() {
        // Build varietals list, scoped to region if present
        let winesScope = this.wines.filter(w => w.varietals && w.varietals.trim() !== '');
        if (this.currentFilters.region) {
            const normalized = this.normalizeRegionName(this.currentFilters.region);
            winesScope = winesScope.filter(w => this.normalizeRegionName(w.region) === normalized);
        }

        // Extract individual varietals from all wines and group them
        // Example: "Sangiovese, Merlot" becomes ["Sangiovese", "Merlot"]
        const varietalMap = new Map(); // varietal name -> { count, displayName }
        
        winesScope.forEach(wine => {
            if (wine.varietals) {
                // Split by comma and clean up each varietal
                const varietals = wine.varietals.split(',').map(v => v.trim()).filter(v => v);
                varietals.forEach(varietal => {
                    const normalized = varietal.toLowerCase();
                    if (!varietalMap.has(normalized)) {
                        varietalMap.set(normalized, {
                            displayName: varietal, // Keep original capitalization
                            count: 0
                        });
                    }
                    varietalMap.get(normalized).count++;
                });
            }
        });

        // Convert to sorted array
        const varietalsArray = Array.from(varietalMap.entries())
            .map(([normalized, data]) => ({
                normalized,
                displayName: data.displayName,
                count: data.count
            }))
            .sort((a, b) => a.displayName.localeCompare(b.displayName));

        // Create filter dropdown with search
        const filterContainer = document.createElement('div');
        filterContainer.className = 'filter-dropdown';
        filterContainer.innerHTML = `
            <div class="filter-dropdown-content">
                <h3>Filter by Varietal</h3>
                <div class="filter-search-wrapper" style="margin-bottom: 1rem;">
                    <input type="text" 
                           id="varietalSearchInput" 
                           class="filter-search-input" 
                           placeholder="Search varietals (e.g., sangiovese)" 
                           autocomplete="off"
                           style="width: 100%; padding: 0.75rem; border: 1px solid rgba(212, 175, 55, 0.3); background: rgba(0, 0, 0, 0.3); color: #F2F2F2; border-radius: 4px; font-family: var(--font-body, 'Cormorant', serif);">
                </div>
                <div class="filter-options" id="varietalFilterOptions" style="max-height: 400px; overflow-y: auto;">
                    <button class="filter-option" data-varietal="">All Varietals</button>
                    ${varietalsArray.map(v => `
                        <button class="filter-option" 
                                data-varietal="${v.displayName}" 
                                data-normalized="${v.normalized}"
                                title="${v.count} wine${v.count !== 1 ? 's' : ''}">
                            ${v.displayName} <span style="opacity: 0.7; font-size: 0.9em;">(${v.count})</span>
                        </button>
                    `).join('')}
                </div>
                <div class="filter-actions">
                    <button class="clear-filters">Clear Filters</button>
                    <button class="close-filter">Close</button>
                </div>
            </div>
        `;

        // Add to page
        document.body.appendChild(filterContainer);

        // Focus on search input
        const searchInput = filterContainer.querySelector('#varietalSearchInput');
        if (searchInput) {
            setTimeout(() => searchInput.focus(), 100);
        }

        // Filter varietals based on search
        const filterOptions = filterContainer.querySelector('#varietalFilterOptions');
        const allOptions = Array.from(filterOptions.querySelectorAll('.filter-option'));
        
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const searchTerm = e.target.value.toLowerCase().trim();
                const allVarietalsOption = allOptions.find(opt => opt.getAttribute('data-varietal') === '');
                
                if (!searchTerm) {
                    // Show all options
                    allOptions.forEach(opt => {
                        opt.style.display = 'block';
                    });
                } else {
                    // Hide "All Varietals" option when searching
                    if (allVarietalsOption) {
                        allVarietalsOption.style.display = 'none';
                    }
                    
                    // Filter options based on search
                    allOptions.forEach(opt => {
                        if (opt === allVarietalsOption) return;
                        
                        const normalized = opt.getAttribute('data-normalized') || '';
                        const displayName = opt.getAttribute('data-varietal') || '';
                        
                        // Show if search term matches normalized or display name
                        if (normalized.includes(searchTerm) || displayName.toLowerCase().includes(searchTerm)) {
                            opt.style.display = 'block';
                        } else {
                            opt.style.display = 'none';
                        }
                    });
                }
            });
        }

        // Add event listeners
        filterContainer.querySelectorAll('.filter-option').forEach(option => {
            option.addEventListener('click', (e) => {
                const varietal = e.target.getAttribute('data-varietal');
                this.applyVarietalFilter(varietal);
                document.body.removeChild(filterContainer);
            });
        });

        filterContainer.querySelector('.close-filter').addEventListener('click', () => {
            document.body.removeChild(filterContainer);
        });

        filterContainer.querySelector('.clear-filters').addEventListener('click', () => {
            this.clearAllFilters();
            document.body.removeChild(filterContainer);
        });

        // Close on click outside
        filterContainer.addEventListener('click', (e) => {
            if (e.target === filterContainer) {
                document.body.removeChild(filterContainer);
            }
        });

        // Close on Escape key
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                document.body.removeChild(filterContainer);
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
    }

    applyRegionFilter(region) {
        // Filter wine cards by region
        const wineCards = document.querySelectorAll('.luxury-wine-card');
        
        wineCards.forEach(card => {
            const link = card.getAttribute('href');
            const type = new URLSearchParams(link.split('?')[1]).get('type');
            // Ensure search param is propagated when present
            if (this.currentFilters.search) {
                const url = new URL(card.href, window.location.origin);
                url.searchParams.set('type', type);
                url.searchParams.set('search', encodeURIComponent(this.currentFilters.search));
                card.setAttribute('href', url.pathname + url.search);
            } else {
                const url = new URL(card.href, window.location.origin);
                url.searchParams.delete('search');
                card.setAttribute('href', url.pathname + url.search);
            }
            
            if (!region) {
                // Show all cards
                card.style.display = 'block';
                this.updateWineCounts();
            } else {
                // Count wines for this type and region
                const count = this.wines.filter(wine => 
                    this.wineMatchesFamily(wine, type) && wine.region === region
                ).length;
                
                if (count > 0) {
                    card.style.display = 'block';
                    // Update the count for this card
                    const countElement = card.querySelector('.wine-count');
                    if (countElement) {
                        countElement.textContent = `${count} wines`;
                    }
                } else {
                    card.style.display = 'none';
                }
            }
        });

        // Update search functionality to work with filtered results
        this.currentFilters.region = region;
    }

    applyVarietalFilter(varietal) {
        // Set varietal filter and re-apply list filtering (scoped by region if present)
        this.currentFilters.varietal = varietal || '';
        
        // Helper function to check if a wine contains the varietal
        const wineContainsVarietal = (wine, searchVarietal) => {
            if (!wine.varietals || !searchVarietal) return false;
            const wineVarietals = wine.varietals.split(',').map(v => v.trim().toLowerCase());
            const searchLower = searchVarietal.toLowerCase();
            // Check if the varietal appears as a complete varietal (exact match after splitting by comma)
            return wineVarietals.some(v => v === searchLower);
        };
        
        if (this.getCurrentPage() === 'index') {
            // On home, varietal filter affects counts/visibility of cards only
            const wineCards = document.querySelectorAll('.luxury-wine-card');
            wineCards.forEach(card => {
                const link = card.getAttribute('href');
                const type = new URLSearchParams(link.split('?')[1]).get('type');
                const count = this.wines.filter(wine => {
                    const matchesType = this.wineMatchesFamily(wine, type);
                    const matchesRegion = !this.currentFilters.region || wine.region === this.currentFilters.region;
                    const matchesVar = !this.currentFilters.varietal || wineContainsVarietal(wine, this.currentFilters.varietal);
                    return matchesType && matchesRegion && matchesVar;
                }).length;
                if (count > 0) {
                    card.style.display = 'block';
                    const countElement = card.querySelector('.wine-count');
                    if (countElement) countElement.textContent = `${count} wines`;
                } else {
                    card.style.display = 'none';
                }
            });
        } else {
            this.applyFilters();
        }
    }

    updateWineCounts() {
        // Reset wine counts to original values
        const wineTypes = ['ROSSO', 'BIANCO', 'ROSATO', 'BOLLICINE', 'NON ALCOLICO'];
        const wineCards = document.querySelectorAll('.luxury-wine-card');
        
        wineCards.forEach((card, index) => {
            if (wineTypes[index]) {
                const count = this.wines.filter(wine => this.wineMatchesFamily(wine, wineTypes[index])).length;
                const countElement = card.querySelector('.wine-count');
                if (countElement) {
                    countElement.textContent = `${count} wines`;
                }
            }
        });
    }

    applyIndexSearch() {
        // If we're on the index page with map, filter wines in the current region view
        const winesListContainer = document.getElementById('winesListContainer');
        const winesGridContainer = document.getElementById('winesGridContainer');
        
        // If wines list is visible, reload wines with search filter
        if (winesListContainer && winesListContainer.style.display !== 'none' && winesGridContainer) {
            const winesListTitle = document.getElementById('winesListTitle');
            if (winesListTitle) {
                // Extract region name from title (format: "Region Name Wines")
                const regionName = winesListTitle.textContent.replace(' Wines', '').trim();
                
                // Get current wine type from active sidebar card
                const activeCard = document.querySelector('.wine-card-sidebar.active');
                const wineType = activeCard ? activeCard.dataset.type : null;
                
                // Reload wines with search filter
                if (window.loadWinesIntoGrid) {
                    const searchTerm = this.currentFilters.search || '';
                    window.loadWinesIntoGrid(regionName, wineType, winesGridContainer, searchTerm);
                }
            }
        }
        
        // Also filter regions panel if visible
        const regionsPanel = document.getElementById('regionsPanel');
        if (regionsPanel && regionsPanel.classList.contains('active')) {
            const regionsList = document.getElementById('regionsList');
            if (regionsList) {
                const regionItems = regionsList.querySelectorAll('.region-item');
                const searchTerm = this.currentFilters.search ? this.currentFilters.search.toLowerCase() : '';
                
                regionItems.forEach(item => {
                    const regionName = item.querySelector('.region-item-name')?.textContent || '';
                    const regionCount = item.querySelector('.region-item-count')?.textContent || '';
                    
                    // Show/hide based on search term matching region name
                    if (!searchTerm || regionName.toLowerCase().includes(searchTerm)) {
                        item.style.display = 'flex';
                    } else {
                        item.style.display = 'none';
                    }
                });
            }
        }
    }

    clearAllFilters() {
        // Reset all filters
        this.currentFilters = {
            type: null,
            region: null,
            search: ''
        };
        
        // Clear search input
        const searchInput = document.querySelector('.luxury-search-input');
        if (searchInput) {
            searchInput.value = '';
        }
        
        // Show all wine cards and reset counts
        const wineCards = document.querySelectorAll('.luxury-wine-card');
        wineCards.forEach(card => {
            card.style.display = 'block';
        });
        
        this.updateWineCounts();
    }

    setupHoverEffects() {
        // Skip hover effects on touch-only devices to reduce listeners and layout work
        if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
            return;
        }
        // Add hover effects to wine cards
        document.addEventListener('mouseover', (e) => {
            const wineCard = e.target.closest('.wine-card, .region-card, .luxury-wine-card');
            if (wineCard) {
                wineCard.style.transform = 'translateY(-5px)';
            }
        });

        document.addEventListener('mouseout', (e) => {
            const wineCard = e.target.closest('.wine-card, .region-card, .luxury-wine-card');
            if (wineCard) {
                wineCard.style.transform = 'translateY(0)';
            }
        });
    }

    showError(message) {
        console.error(message);
        
        // Create elegant error notification
        const errorDiv = document.createElement('div');
        errorDiv.id = 'errorNotification';
        errorDiv.style.cssText = `
            position: fixed;
            top: 2rem;
            right: 2rem;
            background: linear-gradient(135deg, rgba(139, 0, 0, 0.95) 0%, rgba(139, 0, 0, 0.85) 100%);
            color: var(--ivory);
            padding: 1.5rem 2rem;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
            z-index: 10000;
            max-width: 400px;
            border: 2px solid rgba(212, 175, 55, 0.3);
            font-family: 'Cinzel', serif;
            animation: slideInRight 0.3s ease;
        `;
        
        errorDiv.innerHTML = `
            <div style="display: flex; align-items: center; gap: 1rem;">
                <i class="fas fa-exclamation-circle" style="font-size: 1.5rem; color: var(--gold);"></i>
                <div style="flex: 1;">
                    <h4 style="margin: 0 0 0.5rem 0; color: var(--gold); font-size: 1rem;">Error</h4>
                    <p style="margin: 0; font-size: 0.9rem; line-height: 1.4;">${message}</p>
                </div>
                <button onclick="this.parentElement.parentElement.remove()" style="
                    background: transparent;
                    border: none;
                    color: var(--ivory);
                    font-size: 1.2rem;
                    cursor: pointer;
                    padding: 0.25rem;
                    line-height: 1;
                ">&times;</button>
            </div>
        `;
        
        // Remove existing error notification if any
        const existing = document.getElementById('errorNotification');
        if (existing) {
            existing.remove();
        }
        
        document.body.appendChild(errorDiv);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (errorDiv.parentElement) {
                errorDiv.style.animation = 'slideOutRight 0.3s ease';
                setTimeout(() => errorDiv.remove(), 300);
            }
        }, 5000);
    }

    // Utility functions
    getWineTypeName(type) {
        const typeNames = {
            'ROSSO': 'Red Wines',
            'BIANCO': 'White Wines',
            'ROSATO': 'Rosé Wines',
            'ARANCIONE': 'Orange Wines',
            'BOLLICINE': 'Sparkling Wines',
            'NON ALCOLICO': 'Non-Alcoholic Wines'
        };
        return typeNames[type] || 'Wines';
    }

    // Helper function to determine wine family from wine_type and subcategory
    getWineFamily(wineType, subcategory = null) {
        // First check subcategory if wine_type is not clear
        if (subcategory) {
            const subcat = subcategory.toUpperCase();
            // Check for non-alcoholic first (priority) - handle both singular and plural
            if (subcat.includes('NON ALCOLICO') || subcat.includes('NON ALCOLICI') || 
                subcat.includes('NON-ALCOHOLIC') || subcat.includes("0.0")) {
                return 'NON ALCOLICO';
            }
            if (subcat.includes('BIANCO') || subcat === 'WHITE') {
                return 'BIANCO';
            }
            if (subcat.includes('ROSSO') || subcat === 'RED') {
                return 'ROSSO';
            }
            if (subcat.includes('ROSATO') || subcat === 'ROSE' || subcat === 'ROSY') {
                return 'ROSATO';
            }
            if (subcat.includes('ARANCIONE') || subcat === 'ORANGE') {
                return 'ARANCIONE';
            }
            if (subcat.includes('BOLLICINE') || subcat.includes('SPARKLING') || 
                subcat.includes('METODO CLASSICO') || subcat.includes('CHARMAT') || 
                subcat.includes('ANCESTRAL') || subcat.includes('MARTINOTTI')) {
                return 'BOLLICINE';
            }
        }
        
        if (!wineType) return 'ROSSO'; // Default fallback
        
        const type = wineType.toUpperCase();
        
        // Non-alcoholic wines (check first to avoid conflicts) - handle both singular and plural
        if (type.includes('NON ALCOLICO') || type.includes('NON ALCOLICI') || 
            type.includes('VINI NON ALCOLICI') || type.includes('NON-ALCOHOLIC') || type.includes("0.0")) {
            return 'NON ALCOLICO';
        }
        // Sparkling wine variations
        if (type.includes('BOLLICINE') || type.includes('SPARKLING')) {
            return 'BOLLICINE';
        }
        
        // Rosé wine variations
        if (type.includes('ROSATO') || type.includes('ROSE') || type.includes('ROSY')) {
            return 'ROSATO';
        }
        
        // White wine variations
        if (type.includes('ARANCIONE') || type.includes('ORANGE')) {
            return 'ARANCIONE';
        }
        if (type.includes('BIANCO') || type.includes('WHITE')) {
            return 'BIANCO';
        }
        
        // Red wine variations
        if (type.includes('ROSSO') || type.includes('RED') || type.includes('AMARONE') || type.includes('BAROLO') || 
            type.includes('SUPERTUSCAN') || type.includes('SUPERIORE') || type.includes('RIPASSO')) {
            return 'ROSSO';
        }
        
        // Default fallback
        return 'ROSSO';
    }

    // Helper function to check if wine matches a specific family
    wineMatchesFamily(wine, targetFamily) {
        // Special check for non-alcoholic wines: check alcohol field first
        if (targetFamily === 'NON ALCOLICO') {
            if (wine.alcohol && (wine.alcohol === '0.0%' || wine.alcohol === '0.0' || wine.alcohol === '0%' || wine.alcohol === '0')) {
                return true;
            }
        }
        const wineFamily = this.getWineFamily(wine.wine_type, wine.subcategory);
        return wineFamily === targetFamily;
    }

    // Debug function to log wine family distribution
    logWineFamilyDistribution() {
        const familyCounts = {
            'ROSSO': 0,
            'BIANCO': 0,
            'ROSATO': 0,
            'BOLLICINE': 0,
            'OTHER': 0
        };

        const typeMapping = {};

        this.wines.forEach(wine => {
            const family = this.getWineFamily(wine.wine_type, wine.subcategory);
            if (familyCounts.hasOwnProperty(family)) {
                familyCounts[family]++;
            } else {
                familyCounts['OTHER']++;
            }
            
            // Track type mappings for debugging
            if (!typeMapping[wine.wine_type]) {
                typeMapping[wine.wine_type] = family;
            }
        });

        console.log('Wine Family Distribution:', familyCounts);
        console.log('Wine Type Mappings:', typeMapping);
        
        // Log some examples of wine type mapping
        const examples = {};
        this.wines.slice(0, 20).forEach(wine => {
            const family = this.getWineFamily(wine.wine_type, wine.subcategory);
            if (!examples[family]) {
                examples[family] = [];
            }
            if (examples[family].length < 3) {
                examples[family].push(`${wine.wine_name} (${wine.wine_type} -> ${family})`);
            }
        });
        
        console.log('Wine Type Mapping Examples:', examples);
        
        // Log region distribution
        this.logRegionDistribution();
    }

    logRegionDistribution() {
        const regionCounts = {};
        this.wines.forEach(wine => {
            const region = wine.region;
            if (regionCounts[region]) {
                regionCounts[region]++;
            } else {
                regionCounts[region] = 1;
            }
        });

        console.log('Region Distribution:', regionCounts);
        
        // Check for potential data issues
        const suspiciousRegions = Object.keys(regionCounts).filter(region => 
            region.includes('WINE') || region.includes('UNKNOWN') || region.length < 3
        );
        
        if (suspiciousRegions.length > 0) {
            console.warn('Suspicious regions found:', suspiciousRegions);
        }
        
        // Log all unique regions for verification
        const allRegions = Object.keys(regionCounts).sort();
        console.log('All regions in database:', allRegions);
    }

    normalizeRegionName(regionName) {
        if (!regionName) return '';
        
        // First, normalize to uppercase for consistent comparison
        const upperName = regionName.toUpperCase();
        
        // Normalize region names to handle variations between GeoJSON and JSON
        // GeoJSON uses: "Abruzzo", "Sicilia", "Trentino-Alto Adige/Südtirol", "Valle d'Aosta/Vallée d'Aoste"
        // JSON uses: "ABRUZZO", "SICILIA", "TRENTINO ALTO-ADIGE", "VALLE D'AOSTA"
        const regionMap = {
            // Friuli-Venezia Giulia variations
            'FRIULI-VENEZIA GIULIA': 'FRIULI-VENEZIA GIULIA',
            'FRIULI VENEZIA GIULIA': 'FRIULI-VENEZIA GIULIA',
            'FRIULI VENEZIA': 'FRIULI-VENEZIA GIULIA',
            'FRIULI': 'FRIULI-VENEZIA GIULIA',
            // Marche variations
            'LE MARCHE': 'LE MARCHE',
            'MARCHE': 'LE MARCHE',
            // Trentino-Alto Adige variations (GeoJSON has "/Südtirol")
            'TRENTINO ALTO-ADIGE': 'TRENTINO ALTO-ADIGE',
            'TRENTINO-ALTO ADIGE': 'TRENTINO ALTO-ADIGE',
            'TRENTINO-ALTO ADIGE/SÜDTIROL': 'TRENTINO ALTO-ADIGE',
            'TRENTINO-ALTO ADIGE/SUDTIROL': 'TRENTINO ALTO-ADIGE',
            'TRENTINO': 'TRENTINO ALTO-ADIGE',
            'ALTO ADIGE': 'TRENTINO ALTO-ADIGE',
            // Valle d'Aosta variations (GeoJSON has "/Vallée d'Aoste")
            'VALLE D\'AOSTA': 'VALLE D\'AOSTA',
            'VALLE D\'AOSTA/VALLÉE D\'AOSTE': 'VALLE D\'AOSTA',
            'VALLE D\'AOSTA/VALLEE D\'AOSTE': 'VALLE D\'AOSTA',
            'AOSTA': 'VALLE D\'AOSTA',
            // Toscana variations
            'TOSCANA': 'TOSCANA',
            'TOSCANA (BOLGHERI)': 'TOSCANA',
            // Other regions (normalize case variations)
            'SICILIA': 'SICILIA',
            'PIEMONTE': 'PIEMONTE',
            'VENETO': 'VENETO',
            'LUGANA DOC (VENETO)': 'VENETO',
            'LOMBARDIA': 'LOMBARDIA',
            'EMILIA-ROMAGNA': 'EMILIA-ROMAGNA',
            'LAZIO': 'LAZIO',
            'CAMPANIA': 'CAMPANIA',
            'PUGLIA': 'PUGLIA',
            'TARANTO IGT (PUGLIA)': 'PUGLIA',
            'CALABRIA': 'CALABRIA',
            'BASILICATA': 'BASILICATA',
            'MATERA DOC (BASILICATA)': 'BASILICATA',
            'MOLISE': 'MOLISE',
            'ABRUZZO': 'ABRUZZO',
            'UMBRIA': 'UMBRIA',
            'SARDEGNA': 'SARDEGNA',
            'LIGURIA': 'LIGURIA'
        };
        
        // Check if we have a direct mapping
        if (regionMap[upperName]) {
            return regionMap[upperName];
        }
        
        // If no mapping found, return uppercase version for consistency
        return upperName;
    }

    performGeneralCheckup() {
        console.log('🔍 PERFORMING GENERAL CHECKUP...');
        
        // Check 1: Data integrity
        const totalWines = this.wines.length;
        const winesWithValidRegions = this.wines.filter(wine => wine.region && wine.region.trim() !== '').length;
        const winesWithValidNames = this.wines.filter(wine => wine.wine_name && wine.wine_name.trim() !== '').length;
        const winesWithValidProducers = this.wines.filter(wine => wine.wine_producer && wine.wine_producer.trim() !== '').length;
        const winesWithValidPrices = this.wines.filter(wine => wine.wine_price && wine.wine_price !== '0').length;
        
        console.log(`📊 Data Integrity Check:`);
        console.log(`  - Total wines: ${totalWines}`);
        console.log(`  - Wines with valid regions: ${winesWithValidRegions} (${Math.round(winesWithValidRegions/totalWines*100)}%)`);
        console.log(`  - Wines with valid names: ${winesWithValidNames} (${Math.round(winesWithValidNames/totalWines*100)}%)`);
        console.log(`  - Wines with valid producers: ${winesWithValidProducers} (${Math.round(winesWithValidProducers/totalWines*100)}%)`);
        console.log(`  - Wines with valid prices: ${winesWithValidPrices} (${Math.round(winesWithValidPrices/totalWines*100)}%)`);
        
        // Check 2: Region consistency
        const uniqueRegions = [...new Set(this.wines.map(wine => wine.region))].sort();
        console.log(`🗺️  Region Consistency Check:`);
        console.log(`  - Unique regions found: ${uniqueRegions.length}`);
        console.log(`  - Regions: ${uniqueRegions.join(', ')}`);
        
        // Check 3: Wine type distribution
        const wineTypeCounts = {};
        this.wines.forEach(wine => {
            const family = this.getWineFamily(wine.wine_type, wine.subcategory);
            wineTypeCounts[family] = (wineTypeCounts[family] || 0) + 1;
        });
        console.log(`🍷 Wine Type Distribution:`);
        Object.entries(wineTypeCounts).forEach(([type, count]) => {
            console.log(`  - ${type}: ${count} wines`);
        });
        
        // Check 4: Price range
        const prices = this.wines.map(wine => parseInt(wine.wine_price)).filter(price => !isNaN(price));
        if (prices.length > 0) {
            const minPrice = Math.min(...prices);
            const maxPrice = Math.max(...prices);
            const avgPrice = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
            console.log(`💰 Price Range Check:`);
            console.log(`  - Min price: $${minPrice}`);
            console.log(`  - Max price: $${maxPrice}`);
            console.log(`  - Average price: $${avgPrice}`);
        }
        
        // Check 5: Potential issues
        const issues = [];
        
        // Check for wines with missing critical data
        const winesWithMissingData = this.wines.filter(wine => 
            !wine.wine_name || !wine.region || !wine.wine_producer || !wine.wine_price
        );
        if (winesWithMissingData.length > 0) {
            issues.push(`${winesWithMissingData.length} wines with missing critical data`);
        }
        
        // Check for duplicate wine numbers
        const wineNumbers = this.wines.map(wine => wine.wine_number);
        const duplicateNumbers = wineNumbers.filter((number, index) => wineNumbers.indexOf(number) !== index);
        if (duplicateNumbers.length > 0) {
            issues.push(`${duplicateNumbers.length} duplicate wine numbers found`);
        }
        
        // Check for suspicious regions
        const suspiciousRegions = uniqueRegions.filter(region => 
            region.includes('WINE') || region.includes('UNKNOWN') || region.length < 3
        );
        if (suspiciousRegions.length > 0) {
            issues.push(`Suspicious regions found: ${suspiciousRegions.join(', ')}`);
        }
        
        if (issues.length > 0) {
            console.warn(`⚠️  Issues found:`);
            issues.forEach(issue => console.warn(`  - ${issue}`));
        } else {
            console.log(`✅ No issues found - all checks passed!`);
        }
        
        console.log('🔍 GENERAL CHECKUP COMPLETED');
    }

    testAllRegions() {
        console.log('🧪 TESTING ALL REGIONS...');
        
        const uniqueRegions = [...new Set(this.wines.map(wine => wine.region))].sort();
        
        uniqueRegions.forEach(region => {
            const winesInRegion = this.wines.filter(wine => wine.region === region);
            const redWines = winesInRegion.filter(wine => this.getWineFamily(wine.wine_type, wine.subcategory) === 'ROSSO');
            const whiteWines = winesInRegion.filter(wine => this.getWineFamily(wine.wine_type, wine.subcategory) === 'BIANCO');
            const roseWines = winesInRegion.filter(wine => this.getWineFamily(wine.wine_type, wine.subcategory) === 'ROSATO');
            const sparklingWines = winesInRegion.filter(wine => this.getWineFamily(wine.wine_type, wine.subcategory) === 'BOLLICINE');
            
            console.log(`📍 ${region}:`);
            console.log(`  - Total wines: ${winesInRegion.length}`);
            console.log(`  - Red wines: ${redWines.length}`);
            console.log(`  - White wines: ${whiteWines.length}`);
            console.log(`  - Rosé wines: ${roseWines.length}`);
            console.log(`  - Sparkling wines: ${sparklingWines.length}`);
            
            // Test URL encoding/decoding
            const encodedRegion = encodeURIComponent(region);
            const decodedRegion = decodeURIComponent(encodedRegion);
            console.log(`  - URL encoding test: "${region}" -> "${encodedRegion}" -> "${decodedRegion}" ${region === decodedRegion ? '✅' : '❌'}`);
        });
        
        console.log('🧪 REGION TESTING COMPLETED');
    }

    addWineFamilyIndicator(wineType, element) {
        if (!element || !wineType) return;

        // Remove existing indicators
        const existingIndicator = element.querySelector('.wine-family-indicator');
        if (existingIndicator) {
            existingIndicator.remove();
        }

        // Create wine family indicator
        const indicator = document.createElement('div');
        indicator.className = 'wine-family-indicator';
        
        const wineFamily = this.getWineFamily(wineType);
        
        const typeNames = {
            'ROSSO': 'Red',
            'BIANCO': 'White',
            'ROSATO': 'Rosé',
            'BOLLICINE': 'Sparkling'
        };

        const familyClass = {
            'ROSSO': 'wine-family-rosso',
            'BIANCO': 'wine-family-bianco',
            'ROSATO': 'wine-family-rosato',
            'ARANCIONE': 'wine-family-arancione',
            'BOLLICINE': 'wine-family-bollicine',
            'NON ALCOLICO': 'wine-family-nonalco'
        };

        indicator.textContent = typeNames[wineFamily] || 'Wine';
        indicator.classList.add(familyClass[wineFamily] || 'wine-family-rosso');
        
        // Make sure element has relative positioning
        if (getComputedStyle(element).position === 'static') {
            element.style.position = 'relative';
        }
        
        element.appendChild(indicator);
    }

    addWineTypeBadge(wineType, container) {
        if (!container || !wineType) return;

        // Remove existing badge
        const existingBadge = container.querySelector('.wine-type-badge');
        if (existingBadge) {
            existingBadge.remove();
        }

        // Create wine type badge
        const badge = document.createElement('span');
        badge.className = 'wine-type-badge';
        
        const wineFamily = this.getWineFamily(wineType);
        
        const typeNames = {
            'ROSSO': 'Red Wines',
            'BIANCO': 'White Wines',
            'ROSATO': 'Rosé Wines',
            'BOLLICINE': 'Sparkling Wines'
        };

        badge.textContent = typeNames[wineFamily] || 'Wines';
        
        // Add to subtitle
        const subtitle = container.querySelector('.luxury-subtitle');
        if (subtitle) {
            subtitle.appendChild(badge);
        }
    }

    getRegionIcon(region) {
        const iconMap = {
            // Tuscany regions
            'TOSCANA': 'fas fa-sun',
            'TOSCANA (BOLGHERI)': 'fas fa-sun',
            
            // Northern regions
            'PIEMONTE': 'fas fa-mountain',
            'TRENTINO ALTO-ADIGE': 'fas fa-mountain',
            'FRIULI-VENEZIA GIULIA': 'fas fa-mountain',
            'VALLE D\'AOSTA': 'fas fa-mountain',
            
            // Veneto regions
            'VENETO': 'fas fa-water',
            'LUGANA DOC (VENETO)': 'fas fa-water',
            
            // Central regions
            'EMILIA-ROMAGNA': 'fas fa-city',
            'LAZIO': 'fas fa-city',
            'LOMBARDIA': 'fas fa-water',
            'LE MARCHE': 'fas fa-mountain',
            'UMBRIA': 'fas fa-mountain',
            'MOLISE': 'fas fa-mountain',
            'ABRUZZO': 'fas fa-tree',
            
            // Southern regions
            'CAMPANIA': 'fas fa-volcano',
            'SICILIA': 'fas fa-volcano',
            'PUGLIA': 'fas fa-umbrella-beach',
            'TARANTO IGT (PUGLIA)': 'fas fa-umbrella-beach',
            'CALABRIA': 'fas fa-tree',
            'BASILICATA': 'fas fa-mountain',
            'MATERA DOC (BASILICATA)': 'fas fa-mountain',
            
            // Islands
            'SARDEGNA': 'fas fa-mountain',
            
            // Coastal regions
            'LIGURIA': 'fas fa-water'
        };
        
        return iconMap[region] || 'fas fa-map-marker-alt';
    }

    extractYear(vintage) {
        if (!vintage) return 'N/A';
        const yearMatch = vintage.match(/\b(19|20)\d{2}\b/);
        return yearMatch ? yearMatch[0] : 'N/A';
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Add page load animation
    const luxuryContainer = document.querySelector('.luxury-container');
    if (luxuryContainer) {
        luxuryContainer.style.opacity = '0';
        luxuryContainer.style.transition = 'opacity 1s ease';
        
        setTimeout(() => {
            luxuryContainer.style.opacity = '1';
        }, 100);
    }

    // Initialize the wine list app
    const wineAppInstance = new WineListApp();
    window.wineApp = wineAppInstance;
    
    // Wait for wineApp to be ready (data loaded) and dispatch event
    const checkWineAppReady = setInterval(() => {
        if (window.wineApp && window.wineApp.wines && window.wineApp.wines.length > 0) {
            clearInterval(checkWineAppReady);
            window.dispatchEvent(new CustomEvent('wineAppReady', { 
                detail: { wineApp: window.wineApp } 
            }));
        }
    }, 100);
    
    // Timeout after 10 seconds
    setTimeout(() => {
        clearInterval(checkWineAppReady);
        if (window.wineApp) {
            window.dispatchEvent(new CustomEvent('wineAppReady', { 
                detail: { wineApp: window.wineApp } 
            }));
        }
    }, 10000);
});

// Handle browser back/forward navigation (pageshow event)
window.addEventListener('pageshow', (event) => {
    // If page was loaded from cache (back/forward navigation)
    if (event.persisted) {
        const path = window.location.pathname;
        // If we're on index page and coming from wine-details, skip loading
        if (path.includes('index') || path.endsWith('/') || path === '') {
            const skipLoading = sessionStorage.getItem('skipHomeLoading') === 'true';
            if (skipLoading) {
                sessionStorage.removeItem('skipHomeLoading');
                const overlay = document.getElementById('loadingOverlay');
                if (overlay) {
                    overlay.classList.add('is-hidden');
                    setTimeout(() => {
                        overlay.remove();
                        if (document.body) {
                            document.body.dataset.overlayDone = 'true';
                        }
                    }, 100);
                }
                // Make sure hero animation is set up
                if (window.wineApp && typeof window.wineApp.setupHomeHeroAnimation === 'function') {
                    window.wineApp.setupHomeHeroAnimation();
                }
            }
        }
    }
});

// Add some utility functions for GitHub Pages compatibility
function updateWineIcons() {
    const wineCards = document.querySelectorAll('.luxury-wine-card');
    const iconMap = {
        'ROSSO': { webp: './image/glassRed.webp', png: './image/glassRed.png' },
        'BIANCO': { webp: './image/glassWhite.webp', png: './image/glassWhite.png' },
        'ROSATO': { webp: './image/glRose.webp', png: './image/glRose.png' },
        'ARANCIONE': { webp: './image/glArancione.webp', png: './image/glArancione.png' },
        'BOLLICINE': { webp: './image/glSparkling.webp', png: './image/glSparkling.png' },
        'NON ALCOLICO': { webp: './image/gl00.webp', png: './image/gl00.png' }
    };

    wineCards.forEach(card => {
        const link = card.getAttribute('href');
        if (link) {
            const type = new URLSearchParams(link.split('?')[1]).get('type');
            if (type && iconMap[type]) {
                const icon = card.querySelector('.wine-icon');
                if (icon) {
                    icon.innerHTML = `<img src="${iconMap[type].webp}" alt="${type} wine icon" loading="lazy" decoding="async" onerror="this.src='${iconMap[type].png}'">`;
                }
            }
        }
    });
}

// Update icons after page load
document.addEventListener('DOMContentLoaded', updateWineIcons);

// Share Wine Functionality
class ShareWineManager {
    constructor() {
        this.shareModal = document.getElementById('shareModal');
        this.shareBtn = document.getElementById('shareWineBtn');
        this.shareBtnTop = document.getElementById('shareWineBtnTop');
        this.closeBtn = document.getElementById('closeShareModal');
        this.shareUrl = document.getElementById('shareUrl');
        this.copyBtn = document.getElementById('copyUrlBtn');
        
        this.init();
    }
    
    init() {
        if (this.shareBtn) {
            this.shareBtn.addEventListener('click', () => this.openShareModal());
        }
        if (this.shareBtnTop) {
            this.shareBtnTop.addEventListener('click', () => this.openShareModal());
        }
        
        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', () => this.closeShareModal());
        }
        
        if (this.shareModal) {
            this.shareModal.addEventListener('click', (e) => {
                if (e.target === this.shareModal) {
                    this.closeShareModal();
                }
            });
        }
        
        if (this.copyBtn) {
            this.copyBtn.addEventListener('click', () => this.copyUrl());
        }
        
        // Social sharing options
        this.setupSocialSharing();
        
        // Set current URL
        this.setCurrentUrl();
    }
    
    openShareModal() {
        if (this.shareModal) {
            this.shareModal.classList.add('active');
            // Only disable scroll if not on home page (which already handles it)
            if (!document.body.classList.contains('home-page')) {
                document.body.style.overflow = 'hidden';
            }
        }
    }
    
    closeShareModal() {
        if (this.shareModal) {
            this.shareModal.classList.remove('active');
            // Restore scroll
            document.body.style.overflow = '';
        }
    }
    
    setCurrentUrl() {
        if (this.shareUrl) {
            this.shareUrl.value = window.location.href;
        }
    }
    
    async copyUrl() {
        if (this.shareUrl) {
            try {
                await navigator.clipboard.writeText(this.shareUrl.value);
                this.showCopySuccess();
            } catch (err) {
                // Fallback for older browsers
                this.shareUrl.select();
                document.execCommand('copy');
                this.showCopySuccess();
            }
        }
    }
    
    showCopySuccess() {
        const originalText = this.copyBtn.innerHTML;
        this.copyBtn.innerHTML = '<i class="fas fa-check"></i>';
        this.copyBtn.style.background = 'linear-gradient(135deg, #34A853 0%, #2E7D32 100%)';
        
        setTimeout(() => {
            this.copyBtn.innerHTML = originalText;
            this.copyBtn.style.background = '';
        }, 2000);
    }
    
    setupSocialSharing() {
        const shareOptions = [
            { id: 'shareFacebook', platform: 'facebook' },
            { id: 'shareInstagram', platform: 'instagram' },
            { id: 'shareTwitter', platform: 'twitter' },
            { id: 'shareWhatsApp', platform: 'whatsapp' },
            { id: 'shareEmail', platform: 'email' },
            { id: 'shareSMS', platform: 'sms' }
        ];
        
        shareOptions.forEach(option => {
            const element = document.getElementById(option.id);
            if (element) {
                element.addEventListener('click', () => this.shareToPlatform(option.platform));
            }
        });
    }
    
    shareToPlatform(platform) {
        const url = encodeURIComponent(window.location.href);
        const title = encodeURIComponent(document.title);
        const text = encodeURIComponent('Check out this amazing wine from Gran Caffè L\'Aquila!');
        
        let shareUrl = '';
        
        switch (platform) {
            case 'facebook':
                shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
                break;
            case 'twitter':
                shareUrl = `https://twitter.com/intent/tweet?url=${url}&text=${text}`;
                break;
            case 'whatsapp':
                shareUrl = `https://wa.me/?text=${text}%20${url}`;
                break;
            case 'email':
                shareUrl = `mailto:?subject=${title}&body=${text}%20${url}`;
                break;
            case 'sms':
                shareUrl = `sms:?body=${text}%20${url}`;
                break;
            case 'instagram':
                // Instagram doesn't support direct URL sharing, show instructions
                this.showInstagramInstructions();
                return;
        }
        
        if (shareUrl) {
            window.open(shareUrl, '_blank', 'width=600,height=400');
        }
    }
    
    showInstagramInstructions() {
        const instructions = `
            To share on Instagram:
            1. Copy the link below
            2. Open Instagram
            3. Create a new story or post
            4. Paste the link in your caption
        `;
        
        alert(instructions);
    }
}

// Initialize Share Wine Manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ShareWineManager();
});

/* ==================== WINE TYPE FILTERS INITIALIZATION ==================== */
// Initialize wine type filter buttons (works independently of map)
function initWineTypeFilters() {
    // Only initialize on pages that have wine cards (index.html, wine-map.html)
    // Skip on wine-details.html and other pages
    const currentPage = window.location.pathname;
    const isWineListPage = currentPage.includes('index.html') || 
                          currentPage.includes('wine-map.html') || 
                          currentPage === '/' || 
                          currentPage.endsWith('/');
    
    if (!isWineListPage) {
        // Silently skip initialization on pages without wine cards
        return;
    }
    
    // Wait for DOM to be ready
    const initFilters = () => {
        const wineCards = document.querySelectorAll('.wine-card-sidebar');
        if (wineCards.length === 0) {
            // Retry if elements not ready yet (max 10 attempts = 1 second)
            if (typeof initFilters.retryCount === 'undefined') {
                initFilters.retryCount = 0;
            }
            initFilters.retryCount++;
            if (initFilters.retryCount < 10) {
                setTimeout(initFilters, 100);
            } else {
                // Only warn if we're on a page that should have these elements
                if (isWineListPage) {
                    console.warn('⚠️ Wine type filter cards not found after 10 retries');
                }
            }
            return;
        }
        
        console.log('🔍 Initializing wine type filters, found', wineCards.length, 'cards');
        
        wineCards.forEach((card, index) => {
            // Check if card already has event listener (avoid duplicates)
            if (card.dataset.filterInitialized === 'true') {
                console.log('⏭️ Card', index, 'already initialized, skipping');
                return;
            }
            
            // Mark as initialized
            card.dataset.filterInitialized = 'true';
            
            card.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                const wineType = this.dataset.type;
                console.log('🍷 Wine category card clicked:', wineType, 'Card index:', index);
                
                if (wineType) {
                    // Update active state with visual feedback
                    document.querySelectorAll('.wine-card-sidebar').forEach(c => {
                        c.classList.remove('active');
                        c.style.opacity = '0.7';
                    });
                    this.classList.add('active');
                    this.style.opacity = '1';
                    
                    console.log('✅ Active state updated for wine type:', wineType);
                    
                    // Update map colors if map exists
                    const mapContainer = document.getElementById('map');
                    if (mapContainer && typeof updateMapColors === 'function') {
                        console.log('🎨 Updating map colors for wine type:', wineType);
                        updateMapColors(wineType);
                        
                        // Reset selected region
                        if (typeof selectedRegion !== 'undefined') {
                            selectedRegion = null;
                        }
                        // Note: updateMapColors already handles all layer styling, no need to do it manually here
                                } else {
                        console.warn('⚠️ Map container or updateMapColors function not available');
                    }
                    
                    // Hide region info and wines list, show map
                    const regionInfo = document.getElementById('regionInfo');
                    if (regionInfo) {
                        regionInfo.style.display = 'none';
                    }
                    
                    const mapWrapper = document.getElementById('mapWrapper');
                    const winesListContainer = document.getElementById('winesListContainer');
                    if (mapWrapper) {
                        mapWrapper.style.display = 'flex';
                    }
                    if (winesListContainer) {
                        winesListContainer.style.display = 'none';
                    }
                    
                    // Show regions panel and load regions for this wine type
                    if (typeof showRegionsPanel === 'function') {
                        console.log('📋 Calling showRegionsPanel for type:', wineType);
                        showRegionsPanel(wineType);
                    } else {
                        console.warn('⚠️ showRegionsPanel function not available');
                    }
                    
                    // Update active filters badge
                    if (typeof updateActiveFiltersBadge === 'function') {
                        setTimeout(updateActiveFiltersBadge, 100);
                    }
                    
                    // Force a visual update to ensure changes are visible
                    this.offsetHeight; // Trigger reflow
                } else {
                    console.warn('⚠️ No wineType found in card dataset');
                }
            });
        });
        
        console.log('✅ Wine type filters initialized successfully:', wineCards.length, 'filters');
    };
    
    // Start initialization
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initFilters);
    } else {
        initFilters();
    }
}

/* ==================== GLOBAL VARIABLES FOR MAP FUNCTIONALITY ==================== */
// Unified map configuration (works for all devices - Mobile First approach)
const mapConfig = {
    instance: null,
    geoJsonLayer: null,
    selectedRegion: null,
    currentWineType: null,
    currentSelectedRegion: null,
    originalMapZoom: null,
    originalMapCenter: null,
    currentColors: { border: '#D4AF37', fill: '#D4AF37' }
};

/* ==================== DEVICE DETECTION (Mobile-First Standard) ==================== */
// Device detection - Mobile First approach with industry standard breakpoints
const DeviceDetector = {
    // Standard breakpoints (mobile-first) - matching CSS variables
    breakpoints: {
        xs: 480,
        sm: 640,
        md: 768,
        lg: 1024,
        xl: 1280
    },
    
    // Get current device type based on viewport width
    getDeviceType() {
        const width = window.innerWidth || document.documentElement.clientWidth;
        
        if (width < this.breakpoints.md) return 'mobile';
        if (width < this.breakpoints.lg) return 'tablet';
        return 'desktop';
    },
    
    // Check if current device is tablet (iPad, Android tablets, etc.)
    isTablet() {
        const width = window.innerWidth || document.documentElement.clientWidth;
        const height = window.innerHeight || document.documentElement.clientHeight;
        
        // Tablet detection: 768px - 1023px (standard tablets)
        const isTabletViewport = width >= this.breakpoints.md && width < this.breakpoints.lg;
        
        // Check user agent for tablet (including iPad)
        const userAgent = navigator.userAgent || navigator.vendor || window.opera;
        const isTabletUA = /iPad|Android.*Tablet|Tablet/i.test(userAgent) && 
                          !/iPhone|iPod/i.test(userAgent);
        
        // Check for touch capability
        const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        
        // iPad detection (even in desktop mode)
        const isIPad = /iPad/i.test(userAgent) || 
                      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        
        // Return true if: tablet viewport + (tablet UA OR iPad OR touch device)
        return isTabletViewport && (isTabletUA || isIPad || (hasTouch && width >= this.breakpoints.md));
    },
    
    // Check if device is iPad specifically
    isIPad() {
        const userAgent = navigator.userAgent || navigator.vendor || window.opera;
        return /iPad/i.test(userAgent) || 
               (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    },
    
    // Check if device is touch-enabled (mobile or tablet)
    isTouchDevice() {
        return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    },
    
    // Check if mobile
    isMobile() {
        return this.getDeviceType() === 'mobile';
    },
    
    // Check if desktop
    isDesktop() {
        return this.getDeviceType() === 'desktop';
    }
};

// Initialize device detection
const currentDevice = DeviceDetector.getDeviceType();
const isTabletDevice = DeviceDetector.isTablet();

// Legacy support (for backward compatibility with existing code)
let mapInstance = mapConfig.instance;
let geoJsonLayer = mapConfig.geoJsonLayer;
let selectedRegion = mapConfig.selectedRegion;
let currentWineType = mapConfig.currentWineType;
let currentSelectedRegion = mapConfig.currentSelectedRegion;
let originalMapZoom = mapConfig.originalMapZoom;
let originalMapCenter = mapConfig.originalMapCenter;
let currentColors = mapConfig.currentColors;

// Mobile map variables (unified - same instance for all devices)
let mobileMapInstance = mapConfig.instance;
let mobileGeoJsonLayer = mapConfig.geoJsonLayer;
let mobileSelectedRegion = mapConfig.selectedRegion;
let mobileCurrentWineType = mapConfig.currentWineType;

/* ==================== GLOBAL HELPER FUNCTIONS ==================== */
// Helper function to wait for wineApp to be ready
function waitForWineApp(callback, maxWait = 10000) {
    if (window.wineApp && window.wineApp.wines && window.wineApp.wines.length > 0) {
        callback();
            return;
        }
    
    let resolved = false;
    const timeout = setTimeout(() => {
        if (!resolved) {
            resolved = true;
            console.error('WineApp not available after timeout');
            if (window.wineApp && window.wineApp.wines) {
                callback();
            } else {
                callback(); // Call anyway to show error message
            }
        }
    }, maxWait);
    
    const handler = () => {
        if (!resolved && window.wineApp && window.wineApp.wines && window.wineApp.wines.length > 0) {
            resolved = true;
            clearTimeout(timeout);
            window.removeEventListener('wineAppReady', handler);
            callback();
        }
    };
    
    window.addEventListener('wineAppReady', handler);
}

// Helper function to map normalized region names to map region names
function getMapRegionName(normalizedRegionName) {
    // Map normalized region names to map region names (from regionData)
    const regionMap = {
        'FRIULI-VENEZIA GIULIA': 'Friuli-Venezia Giulia',
        'LE MARCHE': 'Marche',
        'TRENTINO ALTO-ADIGE': 'Trentino-Alto Adige',
        'VALLE D\'AOSTA': 'Valle d\'Aosta',
        'TOSCANA': 'Toscana',
        'SICILIA': 'Sicilia',
        'PIEMONTE': 'Piemonte',
        'VENETO': 'Veneto',
        'LOMBARDIA': 'Lombardia',
        'EMILIA-ROMAGNA': 'Emilia-Romagna',
        'LAZIO': 'Lazio',
        'CAMPANIA': 'Campania',
        'PUGLIA': 'Puglia',
        'CALABRIA': 'Calabria',
        'BASILICATA': 'Basilicata',
        'MOLISE': 'Molise',
        'ABRUZZO': 'Abruzzo',
        'UMBRIA': 'Umbria',
        'SARDEGNA': 'Sardegna',
        'LIGURIA': 'Liguria'
    };
    return regionMap[normalizedRegionName] || normalizedRegionName;
}

// Helper function to check if a region has wines of the current type
function regionHasWines(regionName, wineType) {
    if (!window.wineApp || !window.wineApp.wines || !window.wineApp.wines.length) {
        return false;
    }
    
    const filteredWines = window.wineApp.wines.filter(wine => {
        if (!wine.region) return false;
        const normalizedWineRegion = window.wineApp.normalizeRegionName(wine.region);
        const normalizedFilterRegion = window.wineApp.normalizeRegionName(regionName);
        const matchesRegion = normalizedWineRegion === normalizedFilterRegion;
        
        if (!wineType) {
            // If no wine type selected, just check region
            return matchesRegion;
        }
        
        const matchesType = window.wineApp.wineMatchesFamily(wine, wineType);
        return matchesRegion && matchesType;
    });
    
    return filteredWines.length > 0;
}

// Helper function to get wine type colors (used by both mobile and desktop)
function getWineTypeColors(wineType) {
        const wineColors = {
            'ROSSO': { border: '#8B0000', fill: '#8B0000' },
            'BIANCO': { border: '#F0E68C', fill: '#F0E68C' },
            'ROSATO': { border: '#FFB6C1', fill: '#FFB6C1' },
            'ARANCIONE': { border: '#FF8C00', fill: '#FF8C00' },
            'BOLLICINE': { border: '#E0D5B7', fill: '#E0D5B7' },
            'NON ALCOLICO': { border: '#90EE90', fill: '#90EE90' }
        };
            if (wineType && wineColors[wineType]) {
                return wineColors[wineType];
            }
            // Default to gold if no type or type not found
            return { border: '#D4AF37', fill: '#D4AF37' };
        }

// Display helper: keep only the Italian region name.
// GeoJSON sometimes uses bilingual names (e.g. "Trentino-Alto Adige/Südtirol", "Valle d'Aosta/Vallée d'Aoste").
function getItalianRegionNameForDisplay(regionName) {
    if (!regionName) return '';
    const raw = String(regionName).trim();
    if (!raw) return '';
    return raw.split('/')[0].trim();
}

// Regions whose label is shifted 7px to the right (desktop + mobile)
const REGION_LABEL_OFFSET_RIGHT_KEYS = ['valle d\'aosta', 'piemonte', 'liguria'];

// Add region labels for desktop map
function addDesktopRegionLabels(geojson) {
    if (!mapInstance || !geojson) return;
    
    // Store labels layer
    if (!window.desktopRegionLabelsLayer) {
        window.desktopRegionLabelsLayer = L.layerGroup().addTo(mapInstance);
    }
    
    // Clear existing labels
    window.desktopRegionLabelsLayer.clearLayers();
    
    // Calculate label width based on text length
    const getLabelWidth = (text) => {
        return Math.max(80, text.length * 8 + 20);
    };
    
    // Position adjustments for desktop (same as mobile)
    const regionAdjustments = {
        'piemonte': { lat: -0.4, lng: -0.25 },
        'valle d\'aosta': { lat: 0.3, lng: -0.8 },
        'lombardia': { lat: 0.45, lng: 0.15 },
        'trentino-alto adige': { lat: 0.55, lng: -0.5 },
        'veneto': { lat: 0.35, lng: 0.6 },
        'friuli-venezia giulia': { lat: 0.55, lng: 1.0 },
        'liguria': { lat: -0.3, lng: -1.3 },
        'emilia-romagna': { lat: 0.05, lng: 0.1 },
        'toscana': { lat: -0.2, lng: -0.55 },
        'umbria': { lat: -0.15, lng: 0.05 },
        'marche': { lat: 0.15, lng: 0.55 },
        'lazio': { lat: -0.35, lng: -0.35 },
        'abruzzo': { lat: 0.2, lng: 0.5 },
        'molise': { lat: 0.1, lng: 0.75 },
        'campania': { lat: -0.45, lng: -0.25 },
        'puglia': { lat: 0.15, lng: 0.85 },
        'basilicata': { lat: 0.1, lng: 0.5 },
        'calabria': { lat: -0.35, lng: 0.2 },
        'sicilia': { lat: -0.25, lng: 0 },
        'sardegna': { lat: 0, lng: 0 }
    };
    
    // Process each region
    geojson.features.forEach(feature => {
        const regionName = feature.properties.reg_name || feature.properties.NAME || feature.properties.name || 'Unknown';
        const displayRegionName = getItalianRegionNameForDisplay(regionName) || regionName;
        const normalizedName = regionName.trim().toLowerCase();
        
        // Create temporary layer to get bounds
        const layer = L.geoJSON(feature);
        const bounds = layer.getBounds();
        const center = bounds.getCenter();
        
        // Get manual adjustment if exists
        let adjustment = { lat: 0, lng: 0 };
        for (const [key, value] of Object.entries(regionAdjustments)) {
            if (normalizedName.includes(key)) {
                adjustment = value;
                break;
            }
        }
        
        // Calculate final position
        const finalLat = center.lat + adjustment.lat;
        const finalLng = center.lng + adjustment.lng;
        
        // Calculate icon size
        const labelWidth = getLabelWidth(displayRegionName);
        const iconSize = [labelWidth, 30];
        
        // 7px a destra per Valle d'Aosta, Piemonte, Liguria
        const offsetRight = REGION_LABEL_OFFSET_RIGHT_KEYS.some(k => normalizedName.includes(k));
        const labelClassName = 'desktop-region-label' + (offsetRight ? ' region-label-offset-right' : '');
        const labelIcon = L.divIcon({
            className: labelClassName,
            html: `<div class="desktop-region-label-text">${displayRegionName}</div>`,
            iconSize: iconSize,
            iconAnchor: [iconSize[0] / 2, iconSize[1] / 2]
        });
        
        // Create marker for label
        const labelMarker = L.marker([finalLat, finalLng], {
            icon: labelIcon,
            interactive: false,
            zIndexOffset: 1000
        });
        
        // Add to labels layer
        window.desktopRegionLabelsLayer.addLayer(labelMarker);
    });
    
    console.log('✅ Desktop region labels added');
}

// Update map colors with animation and highlight regions with wines
function updateMapColors(wineType) {
    console.log('🎨 updateMapColors called with wineType:', wineType);
    console.log('🗺️ geoJsonLayer exists:', !!geoJsonLayer);
    
    // Use getWineTypeColors for consistency
    const colors = getWineTypeColors(wineType);
    currentColors = colors;
    currentWineType = wineType;
    
    console.log('🎨 Colors set to:', colors);
    
    const mapElement = document.getElementById('map');
    if (mapElement) {
        mapElement.classList.remove('map-animated');
        void mapElement.offsetWidth;
        mapElement.classList.add('map-animated');
    }
    
    if (geoJsonLayer) {
        console.log('✅ Updating geoJsonLayer with', geoJsonLayer.getLayers().length, 'layers');
        geoJsonLayer.eachLayer(function(layer) {
            const regionName = layer._regionName;
            const hasWines = regionName ? regionHasWines(regionName, wineType) : false;
            const isSelected = layer === selectedRegion;
            
            if (hasWines || !wineType) {
                // Region has wines - use normal colors with higher opacity when wine type is selected
                if (wineType && hasWines) {
                    // When a wine type is selected, highlight regions with that wine type
                    layer.setStyle({
                        color: colors.border,
                        fillColor: colors.fill,
                        weight: isSelected ? 4 : 2,
                        fillOpacity: isSelected ? 0.5 : 0.3,
                        opacity: isSelected ? 1 : 0.9,
                        dashArray: isSelected ? '10, 5' : null,
                        lineCap: 'round',
                        lineJoin: 'round'
                    });
                } else {
                    // No wine type selected - use default colors
                    layer.setStyle({
                        color: colors.border,
                        fillColor: colors.fill,
                        weight: isSelected ? 4 : 1.5,
                        fillOpacity: isSelected ? 0.5 : 0.08,
                        opacity: isSelected ? 1 : 0.8,
                        dashArray: isSelected ? '10, 5' : null,
                        lineCap: 'round',
                        lineJoin: 'round'
                    });
                }
                // Re-enable interactions
                layer.options.interactive = true;
            } else {
                // Region has no wines - show disabled state
                layer.setStyle({
                    color: '#666',
                    fillColor: '#333',
                    weight: 1.5,
                    fillOpacity: 0.05,
                    opacity: 0.5,
                    lineCap: 'round',
                    lineJoin: 'round',
                    dashArray: '5, 5'
                });
                // Disable interactions for regions without wines
                layer.options.interactive = false;
            }
        });
    } else {
        console.warn('⚠️ geoJsonLayer is null, map may not be initialized yet');
        // Try to wait for map initialization
        const mapElement = document.getElementById('map');
        if (mapElement && !mapElement._leaflet_id) {
            console.log('⏳ Map not initialized yet, will retry after map loads');
        }
    }
}

// Dashboard functionality - show regions panel
function showRegionsPanel(wineType) {
    currentWineType = wineType;
    const panel = document.getElementById('regionsPanel');
    const title = document.getElementById('regionsPanelTitle');
    const subtitle = document.getElementById('regionsPanelSubtitle');
    const list = document.getElementById('regionsList');
    
    if (!panel) return;
    
    // Get wine type name
    const wineTypeNames = {
        'ROSSO': 'Red Wines',
        'BIANCO': 'White Wines',
        'ROSATO': 'Rosé Wines',
        'ARANCIONE': 'Orange Wines',
        'BOLLICINE': 'Sparkling',
        'NON ALCOLICO': 'Non-Alcoholic'
    };
    
    title.textContent = wineTypeNames[wineType] || 'Regions';
    subtitle.textContent = 'Select a region';
    
    // Load regions using wineApp if available
    if (window.wineApp && window.wineApp.wines && window.wineApp.wines.length > 0) {
        loadRegionsForWineType(wineType, list);
    } else {
        waitForWineApp(() => {
            if (window.wineApp && window.wineApp.wines && window.wineApp.wines.length > 0) {
                loadRegionsForWineType(wineType, list);
            }
        });
    }
    
    panel.classList.add('active');
    
    // Close wines panel when opening regions
    const winesPanel = document.getElementById('winesPanel');
    if (winesPanel) {
        winesPanel.classList.remove('active');
    }
}

// Load regions for a specific wine type
function loadRegionsForWineType(wineType, listContainer) {
    if (!window.wineApp || !window.wineApp.wines) return;
    
    // Filter wines by type
    const filteredWines = window.wineApp.wines.filter(wine => {
        return window.wineApp.wineMatchesFamily(wine, wineType);
    });
    
    // Get unique regions
    const regionSet = new Set();
    filteredWines.forEach(wine => {
        if (wine.region && wine.region.trim() !== '') {
            const normalizedRegion = window.wineApp.normalizeRegionName(wine.region);
            regionSet.add(normalizedRegion);
        }
    });
    
    const regions = Array.from(regionSet).sort();
    
    // Clear and populate list
    listContainer.innerHTML = '';
    
    if (regions.length === 0) {
        listContainer.innerHTML = '<div style="color: rgba(245, 245, 240, 0.5); text-align: center; padding: 2rem;">No regions found</div>';
        return;
    }
    
    regions.forEach(region => {
        // Count wines in this region and type
        const count = filteredWines.filter(wine => {
            const normalizedWineRegion = window.wineApp.normalizeRegionName(wine.region);
            return normalizedWineRegion === region;
        }).length;
        
        const regionItem = document.createElement('div');
        regionItem.className = 'region-item';
        regionItem.innerHTML = `
            <div class="region-item-name">${region}</div>
            <div class="region-item-count">${count} wines</div>
        `;
        
        // Store region name for hover effect
        regionItem.dataset.regionName = region;
        
        // Add hover effect to highlight region on map
        regionItem.addEventListener('mouseenter', function() {
            if (geoJsonLayer) {
                // Convert normalized region name to map region name
                const mapRegionName = getMapRegionName(region);
                
                geoJsonLayer.eachLayer(function(layer) {
                    const mapRegion = layer.feature && layer.feature.properties.reg_name;
                    // Match both normalized and map region names
                    if (mapRegion === mapRegionName || mapRegion === region) {
                        // Use currentWineType from global scope
                        const hasWines = currentWineType ? regionHasWines(region, currentWineType) : true;
                        if (hasWines || !currentWineType) {
                            layer.setStyle({
                                weight: 3,
                                fillOpacity: 0.35,
                                fillColor: currentColors.fill,
                                color: currentColors.border,
                                opacity: 1,
                                dashArray: null
                            });
                            layer.bringToFront();
                            
                            // Show tooltip for sidebar hover
                            const tooltip = document.getElementById('regionTooltip');
                            if (tooltip && mapInstance) {
                                tooltip.textContent = getItalianRegionNameForDisplay(mapRegionName) || mapRegionName;
                                tooltip.style.display = 'block';
                                // Position tooltip near the region center
                                const bounds = layer.getBounds();
                                const center = bounds.getCenter();
                                const containerPoint = mapInstance.latLngToContainerPoint(center);
                                const mapWrapper = document.getElementById('mapWrapper');
                                if (mapWrapper) {
                                    const rect = mapWrapper.getBoundingClientRect();
                                    tooltip.style.left = (containerPoint.x) + 'px';
                                    tooltip.style.top = (containerPoint.y - tooltip.offsetHeight - 15) + 'px';
                                }
                            }
                        }
                    }
                });
            }
        });
        
        regionItem.addEventListener('mouseleave', function() {
            // Hide tooltip
            const tooltip = document.getElementById('regionTooltip');
            if (tooltip) tooltip.style.display = 'none';
            
            if (geoJsonLayer) {
                // Convert normalized region name to map region name
                const mapRegionName = getMapRegionName(region);
                
                geoJsonLayer.eachLayer(function(layer) {
                    const mapRegion = layer.feature && layer.feature.properties.reg_name;
                    // Match both normalized and map region names
                    if ((mapRegion === mapRegionName || mapRegion === region) && layer !== selectedRegion) {
                        // Use currentWineType from global scope
                        const hasWines = currentWineType ? regionHasWines(region, currentWineType) : true;
                        if (hasWines || !currentWineType) {
                            // Use highlighted opacity if wine type is selected, otherwise use default
                            if (currentWineType && hasWines) {
                                layer.setStyle({
                                    color: currentColors.border,
                                    fillColor: currentColors.fill,
                                    weight: 2,
                                    fillOpacity: 0.3,
                                    opacity: 0.9,
                                    dashArray: null,
                                    lineCap: 'round',
                                    lineJoin: 'round'
                            });
                        } else {
                            layer.setStyle({
                                weight: 1.5,
                                fillOpacity: 0.08,
                                fillColor: currentColors.fill,
                                color: currentColors.border,
                                opacity: 0.8,
                                dashArray: null
                            });
                            }
                        } else {
                            layer.setStyle({
                                weight: 1.5,
                                fillOpacity: 0.03,
                                color: '#666666',
                                fillColor: '#666666',
                                opacity: 0.5,
                                dashArray: '5, 5'
                            });
                        }
                    }
                });
            }
        });
        
        regionItem.addEventListener('click', function(e) {
            // Prevent event from bubbling up to parent elements that might interfere
            if (e) {
                e.stopPropagation();
                e.preventDefault();
            }
            
            // Get the actual region-item element (in case click was on a child)
            const clickedItem = e && e.currentTarget ? e.currentTarget : this;
            
            // Get region name from the clicked item or from closure
            const regionName = clickedItem.dataset.regionName || region;
            
            // Remove active class from all items
            document.querySelectorAll('.region-item').forEach(item => {
                item.classList.remove('active');
            });
            clickedItem.classList.add('active');
            
            // Show wines list directly
            // NOTE: don't rely on the closure `wineType` only (it can become stale if UI updates without rebuilding handlers)
            const effectiveWineType =
                (typeof currentWineType !== 'undefined' && currentWineType) ||
                (typeof mobileCurrentWineType !== 'undefined' && mobileCurrentWineType) ||
                wineType;
            
            console.log('🔵 Region item clicked:', regionName, 'showing wines list. type=', effectiveWineType);
            if (typeof showWinesListForRegion === 'function') {
                showWinesListForRegion(regionName, effectiveWineType);
            }
            
            // Also highlight the region on the map if it exists
            if (geoJsonLayer) {
                const mapRegionName = getMapRegionName(region);
                geoJsonLayer.eachLayer(function(layer) {
                    const mapRegion = layer.feature && layer.feature.properties.reg_name;
                    if (mapRegion === mapRegionName || mapRegion === region) {
                        selectedRegion = layer;
                        const regName = layer._regionName;
                        
                        // Reset all regions first
                        geoJsonLayer.eachLayer(function(l) {
                            const rName = l._regionName;
                            const hasWines = rName ? regionHasWines(rName, wineType) : false;
                            
                            if (hasWines || !wineType) {
                                // Use highlighted opacity if wine type is selected, otherwise use default
                                if (wineType && hasWines) {
                                    l.setStyle({
                                        color: currentColors.border,
                                        fillColor: currentColors.fill,
                                        weight: 2,
                                        fillOpacity: 0.3,
                                        opacity: 0.9,
                                        dashArray: null,
                                        lineCap: 'round',
                                        lineJoin: 'round'
                                    });
                                } else {
                                    l.setStyle({
                                        weight: 1.5,
                                        fillOpacity: 0.08,
                                        color: currentColors.border,
                                        fillColor: currentColors.fill,
                                        opacity: 0.8,
                                        dashArray: null
                                    });
                                }
                            } else {
                                l.setStyle({
                                    weight: 1.5,
                                    fillOpacity: 0.03,
                                    color: '#666666',
                                    fillColor: '#666666',
                                    opacity: 0.5,
                                    dashArray: '5, 5'
                                });
                            }
                        });
                        
                        // Highlight selected region
                        layer.setStyle({
                            weight: 2.5,
                            color: currentColors.border,
                            fillColor: currentColors.fill,
                            fillOpacity: 0.25,
                            opacity: 1,
                            dashArray: null
                        });
                    }
                });
            }
        });
        
        listContainer.appendChild(regionItem);
    });
}

/* ==================== INDEX PAGE INTERACTIVE MAP ==================== */
function initInteractiveMap() {
        // #region agent log
        // Disabled logging to avoid console errors when server is not available
        const logData = (hypothesisId, message, data) => {
            // Logging disabled - no-op function to prevent errors
            // Uncomment below to enable logging when server is available:
            /*
            const logEndpoint = 'http://127.0.0.1:7247/ingest/fe36653c-3e53-480d-b7e2-efd99bb3957a';
            fetch(logEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    location: 'main.js:initInteractiveMap',
                    message: message,
                    data: data,
                    timestamp: Date.now(),
                    sessionId: 'debug-session',
                    runId: 'run1',
                    hypothesisId: hypothesisId
                })
            }).catch(() => {});
            */
        };
        // #endregion
        
        const mapContainer = document.getElementById('map');
        if (!mapContainer) {
            // #region agent log
            logData('A', 'map container not found', { hasMapContainer: false });
            // #endregion
            return;
        }
        
        // #region agent log
        // Ensure tablet always uses desktop layout with golden map
        const isTablet = isTabletDevice || (window.innerWidth >= 768 && window.innerWidth < 1024);
        logData('E', 'tablet detection and layout enforcement', {
            isTabletDevice: isTabletDevice,
            windowWidth: window.innerWidth,
            isTablet: isTablet,
            shouldUseDesktopMap: isTablet,
            mapContainerId: mapContainer.id,
            mobileMapContainerExists: !!document.getElementById('mobileMap'),
            desktopMapContainerExists: !!document.getElementById('map')
        });
        
        // Check if service worker is active and serving from cache
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            logData('A', 'service worker active - checking cache strategy', {
                hasServiceWorker: true,
                serviceWorkerState: navigator.serviceWorker.controller.state,
                currentUrl: window.location.href
            });
        } else {
            logData('A', 'no service worker active', { hasServiceWorker: false });
        }
        
        // Check localStorage/sessionStorage for cached map configs
        const localStorageKeys = Object.keys(localStorage).filter(k => k.includes('map') || k.includes('Map'));
        const sessionStorageKeys = Object.keys(sessionStorage).filter(k => k.includes('map') || k.includes('Map'));
        logData('C', 'checking localStorage/sessionStorage for map configs', {
            localStorageKeys: localStorageKeys,
            sessionStorageKeys: sessionStorageKeys,
            localStorageValues: localStorageKeys.reduce((acc, k) => {
                try {
                    acc[k] = JSON.parse(localStorage.getItem(k));
                } catch {
                    acc[k] = localStorage.getItem(k);
                }
                return acc;
            }, {}),
            sessionStorageValues: sessionStorageKeys.reduce((acc, k) => {
                try {
                    acc[k] = JSON.parse(sessionStorage.getItem(k));
                } catch {
                    acc[k] = sessionStorage.getItem(k);
                }
                return acc;
            }, {})
        });
        
        // Check CSS file loading
        const styleSheets = Array.from(document.styleSheets);
        const cssFiles = styleSheets.map((sheet, idx) => {
            try {
                return {
                    index: idx,
                    href: sheet.href,
                    rules: sheet.cssRules ? sheet.cssRules.length : 0,
                    disabled: sheet.disabled
                };
            } catch (e) {
                return { index: idx, error: e.message };
            }
        });
        logData('B', 'CSS files loaded and order', {
            totalSheets: styleSheets.length,
            cssFiles: cssFiles,
            styleCssHref: cssFiles.find(f => f.href && f.href.includes('style.css'))?.href,
            leafletCssHref: cssFiles.find(f => f.href && f.href.includes('leaflet.css'))?.href
        });
        
        // Check JS file loading order
        const scripts = Array.from(document.scripts);
        const jsFiles = scripts.map((script, idx) => ({
            index: idx,
            src: script.src,
            async: script.async,
            defer: script.defer,
            type: script.type
        }));
        logData('D', 'JS files loaded and order', {
            totalScripts: scripts.length,
            jsFiles: jsFiles,
            mainJsIndex: jsFiles.findIndex(f => f.src && f.src.includes('main.js')),
            wineriesJsIndex: jsFiles.findIndex(f => f.src && f.src.includes('wineries.js'))
        });
        // #endregion
        
        // getWineTypeColors is now a global function (defined above)
        
        // Region data with detailed information
        const regionData = {
            "Abruzzo": { 
                population: "1.3M", 
                area: "10,763 km²", 
                capital: "L'Aquila",
                fact: "Known as the 'Green Region of Europe' with three national parks and one regional park.",
                wineFacts: "Famous for Montepulciano d'Abruzzo and Trebbiano d'Abruzzo wines."
            },
            "Basilicata": { 
                population: "563K", 
                area: "9,992 km²", 
                capital: "Potenza",
                fact: "The region with the lowest population density in Italy, rich in ancient history.",
                wineFacts: "Known for Aglianico del Vulture, one of Italy's oldest wine varieties."
            },
            "Calabria": { 
                population: "1.9M", 
                area: "15,080 km²", 
                capital: "Catanzaro",
                fact: "The 'toe' of Italy's boot, with stunning coastlines and ancient Greek heritage.",
                wineFacts: "Produces Cirò, one of Italy's oldest DOC wines dating back to ancient Greece."
            },
            "Campania": { 
                population: "5.8M", 
                area: "13,590 km²", 
                capital: "Napoli",
                fact: "Home to Mount Vesuvius, Pompeii, and the birthplace of pizza.",
                wineFacts: "Famous for Taurasi, Greco di Tufo, and Fiano di Avellino."
            },
            "Emilia-Romagna": { 
                population: "4.5M", 
                area: "22,446 km²", 
                capital: "Bologna",
                fact: "Italy's culinary heartland, known for Parmigiano-Reggiano, Prosciutto di Parma, and balsamic vinegar.",
                wineFacts: "Produces Lambrusco, Sangiovese di Romagna, and Albana di Romagna."
            },
            "Friuli-Venezia Giulia": { 
                population: "1.2M", 
                area: "7,862 km²", 
                capital: "Trieste",
                fact: "A cultural crossroads between Italian, Slavic, and Germanic influences.",
                wineFacts: "Renowned for white wines like Pinot Grigio, Sauvignon Blanc, and Ribolla Gialla."
            },
            "Lazio": { 
                population: "5.9M", 
                area: "17,232 km²", 
                capital: "Roma",
                fact: "The Eternal City region, home to Rome and the Vatican City.",
                wineFacts: "Known for Frascati, Est! Est!! Est!!!, and Cesanese del Piglio."
            },
            "Liguria": { 
                population: "1.6M", 
                area: "5,422 km²", 
                capital: "Genova",
                fact: "The Italian Riviera, famous for its dramatic coastline and colorful fishing villages.",
                wineFacts: "Produces Vermentino, Pigato, and Rossese di Dolceacqua."
            },
            "Lombardia": { 
                population: "10.1M", 
                area: "23,861 km²", 
                capital: "Milano",
                fact: "Italy's wealthiest and most industrialized region, home to fashion and finance.",
                wineFacts: "Known for Franciacorta sparkling wines, Valtellina Nebbiolo, and Oltrepò Pavese."
            },
            "Marche": { 
                population: "1.5M", 
                area: "9,694 km²", 
                capital: "Ancona",
                fact: "The region of a hundred cities, with rolling hills and medieval hilltop towns.",
                wineFacts: "Famous for Verdicchio dei Castelli di Jesi and Rosso Conero."
            },
            "Molise": { 
                population: "306K", 
                area: "4,438 km²", 
                capital: "Campobasso",
                fact: "Italy's second-smallest region, known for its unspoiled landscapes and traditions.",
                wineFacts: "Produces Biferno, Tintilia del Molise, and Pentro di Isernia."
            },
            "Piemonte": { 
                population: "4.4M", 
                area: "25,387 km²", 
                capital: "Torino",
                fact: "Home to the Italian Alps, the Slow Food movement, and legendary wine regions.",
                wineFacts: "World-famous for Barolo, Barbaresco, Barbera d'Asti, and Moscato d'Asti."
            },
            "Puglia": { 
                population: "4M", 
                area: "19,358 km²", 
                capital: "Bari",
                fact: "The 'heel' of Italy's boot, with over 800 km of coastline and unique trulli architecture.",
                wineFacts: "Known for Primitivo di Manduria, Negroamaro, and Salice Salentino."
            },
            "Sardegna": { 
                population: "1.6M", 
                area: "24,090 km²", 
                capital: "Cagliari",
                fact: "Italy's second-largest island, with pristine beaches and unique Nuragic civilization.",
                wineFacts: "Produces Cannonau, Vermentino di Sardegna, and Carignano del Sulcis."
            },
            "Sicilia": { 
                population: "5M", 
                area: "25,711 km²", 
                capital: "Palermo",
                fact: "Italy's largest island, home to Mount Etna and rich Greek, Arab, and Norman heritage.",
                wineFacts: "Famous for Marsala, Etna DOC wines, Nero d'Avola, and Grillo."
            },
            "Toscana": { 
                population: "3.7M", 
                area: "22,993 km²", 
                capital: "Firenze",
                fact: "The cradle of the Renaissance, with rolling hills, cypress trees, and medieval towns.",
                wineFacts: "World-renowned for Chianti, Brunello di Montalcino, Vino Nobile di Montepulciano, and Super Tuscans."
            },
            "Trentino-Alto Adige": { 
                population: "1.1M", 
                area: "13,607 km²", 
                capital: "Trento",
                fact: "A bilingual region in the Italian Alps, combining Italian and Austrian cultures.",
                wineFacts: "Produces Pinot Grigio, Gewürztraminer, Lagrein, and Teroldego Rotaliano."
            },
            "Umbria": { 
                population: "882K", 
                area: "8,456 km²", 
                capital: "Perugia",
                fact: "Italy's green heart, known as the 'green heart of Italy' with medieval hill towns.",
                wineFacts: "Famous for Orvieto, Sagrantino di Montefalco, and Torgiano Rosso Riserva."
            },
            "Valle d'Aosta": { 
                population: "126K", 
                area: "3,263 km²", 
                capital: "Aosta",
                fact: "Italy's smallest region, entirely in the Alps with stunning mountain peaks.",
                wineFacts: "Produces Petit Rouge, Fumin, and Nebbiolo-based wines at high altitudes."
            },
            "Veneto": { 
                population: "4.9M", 
                area: "18,399 km²", 
                capital: "Venezia",
                fact: "Home to Venice, Verona, and the Dolomites, rich in art and culture.",
                wineFacts: "Famous for Amarone della Valpolicella, Prosecco, Soave, and Valpolicella."
            }
        };
        // Use global variables declared above (geoJsonLayer, selectedRegion, currentColors, mapInstance, currentWineType, etc.)
        // Check URL parameters for region and type
        const urlParams = new URLSearchParams(window.location.search);
        const urlRegion = urlParams.get('region');
        const urlType = urlParams.get('type');
        
        // Set current wine type if provided in URL
        if (urlType) {
            currentWineType = urlType;
            // Update map colors for the wine type
            updateMapColors(urlType);
            // Activate corresponding wine card
            document.querySelectorAll('.wine-card-sidebar').forEach(card => {
                if (card.dataset.type === urlType) {
                    card.classList.add('active');
                } else {
                    card.classList.remove('active');
                }
            });
        }
        
        // Check if map is already initialized
        if (mapContainer._leaflet_id) {
            console.log('Map already initialized, updating colors if needed...');
            // Check for active wine card if no URL type is set
            if (!currentWineType) {
                const activeCard = document.querySelector('.wine-card-sidebar.active');
                if (activeCard && activeCard.dataset.type) {
                    currentWineType = activeCard.dataset.type;
                }
            }
            // If map is already initialized, still update colors if wine type is set
            if (currentWineType && typeof updateMapColors === 'function') {
                waitForWineApp(() => {
                    updateMapColors(currentWineType);
                });
            }
            // Also invalidate size to ensure map displays correctly
            if (mapInstance) {
                setTimeout(() => {
                    mapInstance.invalidateSize();
                }, 100);
            }
            return;
        }
        // Initialize map with uniform touch/mouse interactions
        // Limit max zoom to 5.8 (requested)
        const desktopMaxZoom = 5.8;
        const initialZoom = 5.8;
        
        // #region agent log
        logData('E', 'map initialization config BEFORE creation', {
            desktopMaxZoom: desktopMaxZoom,
            initialZoom: initialZoom,
            isTabletDevice: isTabletDevice,
            mapContainerExists: !!mapContainer,
            mapContainerId: mapContainer.id
        });
        // #endregion
        
        mapInstance = L.map('map', {
            zoomControl: false,
            zoomSnap: 0.1,
            minZoom: 5,
            maxZoom: desktopMaxZoom,
            maxBounds: [[35.5, 5.0], [48.0, 20.0]],
            maxBoundsViscosity: 0.5, // Reduced for smoother panning
            tap: true, // Enable tap on touch devices
            touchZoom: true, // Enable pinch zoom on touch devices
            doubleClickZoom: true, // Enable double-click zoom
            scrollWheelZoom: true, // Enable scroll wheel zoom on desktop
            boxZoom: true, // Enable box zoom
            dragging: true, // Enable dragging/panning
            keyboard: true, // Enable keyboard navigation
            inertia: true, // Enable inertia for smoother panning
            inertiaDeceleration: 3000, // Deceleration rate for inertia
            inertiaMaxSpeed: 1500, // Max speed for inertia
            worldCopyJump: false // Prevent map from jumping when panning
        }).setView([42.0, 12.5], initialZoom);
        
        // #region agent log
        logData('E', 'map initialization config AFTER creation', {
            mapInstanceExists: !!mapInstance,
            currentZoom: mapInstance.getZoom(),
            currentCenter: mapInstance.getCenter(),
            maxZoom: mapInstance.getMaxZoom(),
            minZoom: mapInstance.getMinZoom()
        });
        // #endregion
        
        // Add tile layer with HTTPS tiles - maxZoom 32+ for tablets
        const tileMaxZoom = isTabletDevice ? 32 : 19;
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: tileMaxZoom
        }).addTo(mapInstance);
        
        function updateMobileMapHeight() {
            const mobileContainer = document.getElementById('mobileMapWinesContainer');
            const mobileWrapper = document.getElementById('mobileMapWrapper');
            const topNav = document.querySelector('.top-nav');
            const searchBar = document.getElementById('mobileSearchBarContainer');
            if (topNav && searchBar && window.innerWidth < 1024) {
                const navH = topNav.offsetHeight;
                const searchH = window.getComputedStyle(searchBar).display !== 'none' ? searchBar.offsetHeight : 0;
                document.documentElement.style.setProperty('--mobile-nav-height', `${navH}px`);
                document.documentElement.style.setProperty('--mobile-search-height', `${searchH}px`);
            }
            if (!mobileContainer || !mobileWrapper) {
                return;
            }
            const viewport = window.visualViewport;
            const viewportHeight = viewport ? viewport.height : window.innerHeight;
            const wineSelector = document.querySelector('.mobile-wine-type-selector');
            let reservedHeight = 0;
            if (topNav && window.getComputedStyle(topNav).display !== 'none') {
                reservedHeight += topNav.offsetHeight;
            }
            if (wineSelector && window.getComputedStyle(wineSelector).display !== 'none') {
                reservedHeight += wineSelector.offsetHeight;
            }
            if (searchBar && (searchBar.classList.contains('visible') || window.getComputedStyle(searchBar).display !== 'none')) {
                reservedHeight += searchBar.offsetHeight;
            }
            const mapHeight = Math.max(320, viewportHeight - reservedHeight - 16);
            mobileWrapper.style.height = '100%';
            mobileWrapper.style.minHeight = `${mapHeight}px`;
            mobileWrapper.style.maxHeight = 'none';
            mobileContainer.style.setProperty('--mobile-map-height', `${mapHeight}px`);
        }
        if (window.innerWidth < 1024) {
            setTimeout(updateMobileMapHeight, 0);
        }
        
        // Update mobile wines cards container height for iPhone Safari - Responsive and Dynamic
        function updateMobileWinesCardsHeight() {
            const winesContainer = document.getElementById('mobileWinesCardsContainer');
            const winesHeader = document.querySelector('.mobile-wines-cards-header');
            if (!winesContainer || window.getComputedStyle(winesContainer).display === 'none') {
                return;
            }
            
            // Use visualViewport if available (better for mobile with virtual keyboards)
            const viewport = window.visualViewport || window;
            const viewportHeight = viewport.height || window.innerHeight;
            const viewportWidth = viewport.width || window.innerWidth;
            
            const topNav = document.querySelector('.top-nav');
            const wineSelector = document.querySelector('.mobile-wine-type-selector');
            const searchBar = document.getElementById('mobileSearchBarContainer');
            let reservedHeight = 0;
            
            if (topNav && window.getComputedStyle(topNav).display !== 'none') {
                reservedHeight += topNav.offsetHeight;
            }
            if (wineSelector && window.getComputedStyle(wineSelector).display !== 'none') {
                reservedHeight += wineSelector.offsetHeight;
            }
            if (searchBar && searchBar.classList.contains('visible')) {
                reservedHeight += searchBar.offsetHeight;
            }
            if (winesHeader) {
                reservedHeight += winesHeader.offsetHeight;
            }
            
            // Get safe area insets for iPhone
            const safeAreaTop = parseInt(getComputedStyle(document.documentElement).getPropertyValue('env(safe-area-inset-top)') || '0', 10) || 0;
            const safeAreaBottom = parseInt(getComputedStyle(document.documentElement).getPropertyValue('env(safe-area-inset-bottom)') || '0', 10) || 0;
            
            // Calculate available height using viewport units (dvh for dynamic viewport)
            const fullHeight = viewportHeight;
            const availableHeight = fullHeight - reservedHeight;
            
            // Set container to use full viewport height dynamically
            winesContainer.style.height = `${fullHeight}px`;
            winesContainer.style.minHeight = `${fullHeight}px`;
            winesContainer.style.maxHeight = `${fullHeight}px`;
            winesContainer.style.width = '100%';
            
            // Ensure grid container expands to fill available space
            const winesGrid = document.getElementById('mobileWinesCardsGrid');
            if (winesGrid) {
                // Calculate grid height (container height minus header)
                const gridHeight = availableHeight;
                
                winesGrid.style.height = `${gridHeight}px`;
                winesGrid.style.minHeight = `${gridHeight}px`;
                winesGrid.style.maxHeight = 'none';
                winesGrid.style.width = '100%';
                winesGrid.style.flex = '1';
                
                // Force recalculation on orientation change
                if (window.orientation !== undefined) {
                    winesGrid.style.display = 'none';
                    winesGrid.offsetHeight; // Trigger reflow
                    winesGrid.style.display = 'grid';
                }
            }
        }
        
        let viewportResizeTimer = null;
        function scheduleViewportRefresh(extraDelay = 0) {
            if (viewportResizeTimer) {
                clearTimeout(viewportResizeTimer);
            }
            viewportResizeTimer = setTimeout(() => {
                updateMobileMapHeight();
                updateMobileWinesCardsHeight();
                if (mapInstance) {
                    mapInstance.invalidateSize();
                }
                // Only initialize mobile map on actual mobile devices (< 768px), NOT on tablets
                // Tablets (768-1023px) should use desktop layout with #map, not #mobileMap
                if (window.innerWidth < 768) {
                    if (mobileMapInstance) {
                        mobileMapInstance.invalidateSize();
                    } else {
                        initializeMobileMap();
                    }
                }
            }, 200 + extraDelay);
        }
        // ResizeObserver su #map: quando il container cambia dimensione (es. riduzione larghezza),
        // Leaflet deve ricalcolare con invalidateSize() altrimenti la mappa non si adatta
        const mapEl = document.getElementById('map');
        if (mapEl && typeof ResizeObserver !== 'undefined') {
            const mapResizeObserver = new ResizeObserver(() => {
                if (mapInstance) {
                    mapInstance.invalidateSize();
                    if (geoJsonLayer) {
                        try {
                            const b = geoJsonLayer.getBounds();
                            if (b.isValid()) mapInstance.fitBounds(b, { paddingTopLeft: [24, 24], paddingBottomRight: [8, 24], maxZoom: 5.8, animate: false });
                        } catch (e) { /* ignore */ }
                    }
                }
            });
            mapResizeObserver.observe(mapEl);
        }

        // Enhanced responsive listeners for dynamic updates
        window.addEventListener('resize', () => scheduleViewportRefresh());
        window.addEventListener('orientationchange', () => {
            // Immediate update on orientation change
            setTimeout(() => {
                updateMobileWinesCardsHeight();
                scheduleViewportRefresh(300);
            }, 100);
        });
        
        // Listen to visualViewport changes (for mobile browsers with virtual keyboards)
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', () => {
                scheduleViewportRefresh();
            });
            window.visualViewport.addEventListener('scroll', () => {
                // Update on scroll to handle dynamic viewport changes
                scheduleViewportRefresh(100);
            });
        }
        
        // Listen to viewport changes on mobile devices
        window.addEventListener('focus', () => {
            scheduleViewportRefresh(100);
        });
        
        // Setup scroll listener to hide organic description when user scrolls
        window.setupOrganicDescriptionScrollListener = function() {
            const winesGrid = document.getElementById('mobileWinesCardsGrid');
            if (!winesGrid) return;
            
            // Remove existing listener if any (to avoid duplicates)
            const existingHandler = winesGrid._organicDescriptionScrollHandler;
            if (existingHandler) {
                winesGrid.removeEventListener('scroll', existingHandler);
            }
            
            // Create new scroll handler
            const scrollHandler = () => {
                const winesHeader = document.querySelector('.mobile-wines-cards-header');
                const organicDescription = winesHeader?.querySelector('.mobile-wines-cards-organic-description');
                
                if (organicDescription && winesGrid) {
                    const scrollTop = winesGrid.scrollTop;
                    const scrollThreshold = 10; // Hide after scrolling 10px
                    
                    if (scrollTop > scrollThreshold) {
                        organicDescription.style.opacity = '0';
                        organicDescription.style.transform = 'translateY(-10px)';
                        organicDescription.style.pointerEvents = 'none';
                        organicDescription.style.maxHeight = '0';
                        organicDescription.style.marginTop = '0';
                        organicDescription.style.marginBottom = '0';
                        organicDescription.style.paddingTop = '0';
                        organicDescription.style.paddingBottom = '0';
                        organicDescription.style.overflow = 'hidden';
                    } else {
                        organicDescription.style.opacity = '1';
                        organicDescription.style.transform = 'translateY(0)';
                        organicDescription.style.pointerEvents = 'auto';
                        organicDescription.style.maxHeight = 'none';
                        organicDescription.style.marginTop = '1rem';
                        organicDescription.style.marginBottom = '';
                        organicDescription.style.paddingTop = '1rem';
                        organicDescription.style.paddingBottom = '1rem';
                        organicDescription.style.overflow = 'visible';
                    }
                }
            };
            
            // Store handler reference for cleanup
            winesGrid._organicDescriptionScrollHandler = scrollHandler;
            
            // Add scroll listener
            winesGrid.addEventListener('scroll', scrollHandler, { passive: true });
        }
        
                // Setup scroll listener when grid becomes visible
        const observer = new MutationObserver(() => {
            const winesGrid = document.getElementById('mobileWinesCardsGrid');
            const winesContainer = document.getElementById('mobileWinesCardsContainer');
            if (winesGrid && winesContainer && window.getComputedStyle(winesContainer).display !== 'none') {
                setTimeout(() => {
                    if (window.setupOrganicDescriptionScrollListener) {
                        window.setupOrganicDescriptionScrollListener();
                    }
                }, 100);
            }
        });
        
        // Observe changes to the wines container
        const winesContainerObserver = document.getElementById('mobileWinesCardsContainer');
        if (winesContainerObserver) {
            observer.observe(winesContainerObserver, { 
                attributes: true, 
                attributeFilter: ['style'],
                childList: true,
                subtree: true
            });
        }
        
        // Listen for visualViewport changes (iPhone Safari address bar show/hide)
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', () => {
                scheduleViewportRefresh();
            }, { passive: true });
            window.visualViewport.addEventListener('scroll', () => {
                scheduleViewportRefresh();
            }, { passive: true });
        }
        
        // Load GeoJSON with error handling and fallback
        fetch('https://raw.githubusercontent.com/openpolis/geojson-italy/master/geojson/limits_IT_regions.geojson')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(geojson => {
                console.log('🗺️ GeoJSON loaded successfully');
                geoJsonLayer = L.geoJSON(geojson, {
                    style: function(feature) {
                        return {
                            color: currentColors.border,
                            weight: 1.5,
                            fillOpacity: 0.08,
                            fillColor: currentColors.fill,
                            lineCap: 'round',
                            lineJoin: 'round'
                        };
                    },
                    onEachFeature: onEachFeature
                }).addTo(mapInstance);
                console.log('✅ geoJsonLayer created and added to map');
                
                // Add region labels for desktop
                addDesktopRegionLabels(geojson);
                
                // Fit map to Italy, then force zoom 8 so user sees the requested zoom level
                const italyBounds = geoJsonLayer.getBounds();
                mapInstance.fitBounds(italyBounds, {
                    paddingTopLeft: [24, 24],
                    paddingBottomRight: [8, 24],
                    maxZoom: 5.8,
                    animate: false
                });
                // Force zoom to 5.8 (fitBounds may have chosen a lower zoom to fit Italy)
                const center = italyBounds.getCenter();
                mapInstance.setView([center.lat, center.lng], 5.8, { animate: false });
                // Store actual zoom and center for "back to map" restoration
                originalMapZoom = 5.8;
                originalMapCenter = mapInstance.getCenter();
                
                // Apply initial transform to leaflet-proxy after map is loaded
                const applyTransformToProxy = (selector, retries = 10) => {
                    const leafletProxy = document.querySelector(selector);
                    if (leafletProxy) {
                        leafletProxy.style.transform = 'translate3d(8761px, 6078px, 0px) scale(32)';
                        console.log('✅ Applied initial transform to leaflet-proxy');
                    } else if (retries > 0) {
                        setTimeout(() => applyTransformToProxy(selector, retries - 1), 100);
                    }
                };
                setTimeout(() => applyTransformToProxy('#map .leaflet-proxy.leaflet-zoom-animated'), 500);
                
                // Update map colors if wine type is selected (from URL or active card)
                // Check for active wine card if no URL type is set
                if (!currentWineType) {
                    const activeCard = document.querySelector('.wine-card-sidebar.active');
                    if (activeCard && activeCard.dataset.type) {
                        currentWineType = activeCard.dataset.type;
                    }
                }
                
                if (currentWineType && typeof updateMapColors === 'function') {
                    // Wait a bit for the map to fully render and wineApp to be ready
                    waitForWineApp(() => {
                        setTimeout(() => {
                            updateMapColors(currentWineType);
                        }, 100);
                    });
                }
                
                // Close region info on map click
                mapInstance.on('click', function(e) {
                    if (e.originalEvent.target.tagName === 'DIV') {
                        const regionInfo = document.getElementById('regionInfo');
                        if (regionInfo) {
                            regionInfo.style.display = 'none';
                        }
                    }
                });
                
                // Ensure map fills container and all regions visible after layout (full-screen map fix)
                const isMapPage = window.location.pathname.includes('wine-map') || window.location.href.includes('wine-map');
                if (isMapPage && mapInstance && geoJsonLayer) {
                    const refitMap = () => {
                        if (mapInstance && geoJsonLayer) {
                            mapInstance.invalidateSize();
                            const bounds = geoJsonLayer.getBounds();
                            mapInstance.fitBounds(bounds, {
                                paddingTopLeft: [24, 24],
                                paddingBottomRight: [8, 24],
                                maxZoom: 5.8,
                                animate: false
                            });
                            const center = bounds.getCenter();
                            mapInstance.setView([center.lat, center.lng], 5.8, { animate: false });
                        }
                    };
                    [100, 400, 800].forEach(delay => setTimeout(refitMap, delay));
                }
                
                // If URL has region parameter, select and show that region
                if (urlRegion && geoJsonLayer) {
                    waitForWineApp(() => {
                        // Find the region on the map
                        geoJsonLayer.eachLayer(function(layer) {
                            const mapRegionName = layer._regionName;
                            if (mapRegionName) {
                                // Normalize region names for comparison
                                const normalizedMapRegion = window.wineApp ? window.wineApp.normalizeRegionName(mapRegionName) : mapRegionName;
                                const normalizedUrlRegion = window.wineApp ? window.wineApp.normalizeRegionName(urlRegion) : urlRegion;
                                
                                if (normalizedMapRegion === normalizedUrlRegion || mapRegionName === urlRegion) {
                                    // Select this region
                                    selectRegion(layer, mapRegionName);
                                }
                            }
                        });
                    });
                }
            })
            .catch(error => {
                console.error('❌ Error loading GeoJSON:', error);
                console.error('📍 GeoJSON URL:', 'https://raw.githubusercontent.com/openpolis/geojson-italy/master/geojson/limits_IT_regions.geojson');
                console.error('📍 Current URL:', window.location.href);
                
                // Show error message to user
                mapContainer.innerHTML = `
                            <div style="
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                height: 100%;
                                flex-direction: column;
                                gap: 1rem;
                                color: rgba(245, 245, 240, 0.7);
                                text-align: center;
                                padding: 2rem;
                            ">
                                <i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: var(--gold);"></i>
                                <h3 style="font-family: 'Cinzel', serif; color: var(--gold); margin: 0;">Map Unavailable</h3>
                                <p style="margin: 0;">Unable to load map data. Please check your internet connection and try refreshing the page.</p>
                                <button onclick="location.reload()" style="
                                    background: var(--gold);
                                    color: var(--dark);
                                    border: none;
                                    padding: 0.75rem 1.5rem;
                                    border-radius: 8px;
                                    font-family: 'Cinzel', serif;
                                    font-weight: 600;
                                    cursor: pointer;
                                    margin-top: 1rem;
                                    transition: transform 0.2s ease;
                                " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">Retry</button>
                            </div>
                        `;
            });
        // Mobile Menu Management
        let currentMobileView = 'regions';
        let currentMobileWineType = null;
        let currentMobileRegion = null;
        
        // Mobile Menu Search Popup Management
        function openMobileMenuSearchPopup() {
            const popup = document.getElementById('mobileMenuSearchPopup');
            const popupInput = document.getElementById('mobileMenuSearchPopupInput');
            if (popup) {
                popup.style.display = 'flex';
                // Focus on input after animation
                setTimeout(() => {
                    if (popupInput) {
                        popupInput.focus();
                        // Trigger click to show any existing suggestions
                        popupInput.click();
                    }
                }, 300);
            }
        }
        
        function closeMobileMenuSearchPopup() {
            const popup = document.getElementById('mobileMenuSearchPopup');
            const popupInput = document.getElementById('mobileMenuSearchPopupInput');
            const autocomplete = document.getElementById('mobileMenuSearchPopupAutocomplete');
            if (popup) {
                popup.style.display = 'none';
                if (popupInput) {
                    popupInput.value = '';
                    popupInput.classList.remove('search-active');
                }
                // Hide autocomplete dropdown
                if (autocomplete) {
                    autocomplete.style.display = 'none';
                }
            }
        }
        // Mobile Menu Functions
        function openMobileMenu() {
            const menu = document.getElementById('mobileSideMenu');
            const overlay = document.getElementById('mobileOverlay');
            const menuCategories = document.getElementById('mobileMenuCategories');
            if (menu && overlay) {
                menu.classList.add('open');
                overlay.classList.add('visible');
                document.body.classList.add('mobile-menu-open');
                document.body.style.overflow = 'hidden';
                // Scroll categories down to show search bar
                if (menuCategories) {
                    setTimeout(() => {
                        menuCategories.scrollTop = 0;
                    }, 100);
                }
            }
        }
        function closeMobileMenu() {
            const menu = document.getElementById('mobileSideMenu');
            const overlay = document.getElementById('mobileOverlay');
            if (menu && overlay) {
                menu.classList.remove('open');
                overlay.classList.remove('visible');
                document.body.classList.remove('mobile-menu-open');
                document.body.style.overflow = '';
            }
        }
        function toggleMobileMenu() {
            const menu = document.getElementById('mobileSideMenu');
            if (menu && menu.classList.contains('open')) {
                closeMobileMenu();
            } else {
                openMobileMenu();
            }
        }
        function showMobileView(viewName) {
            const views = {
                'regions': document.getElementById('mobileRegionsView'),
                'wines': document.getElementById('mobileWinesView')
            };
            Object.values(views).forEach(view => {
                if (view) {
                    view.classList.remove('mobile-view-active');
                }
            });
            if (views[viewName]) {
                views[viewName].classList.add('mobile-view-active');
                currentMobileView = viewName;
            }
        }
        function loadMobileMenuCategories() {
            const menuCategories = document.getElementById('mobileMenuCategories');
            if (!menuCategories) {
                console.warn('mobileMenuCategories element not found');
                return;
            }
            menuCategories.innerHTML = '';
            
            // Rimuovi eventuale switch esistente per evitare duplicati
            const existingSwitch = document.getElementById('mobileMenuSwitchContainer');
            if (existingSwitch) {
                existingSwitch.remove();
            }
            
            // Placeholder invece dei filtri
            const placeholders = [
                { 
                    name: 'Riccardo Wine Cellar', 
                    action: null,
                    href: null
                },
                { 
                    name: '\u00C0 la Carte Menu', 
                    action: () => {
                        window.location.href = './Ala Carte 11-23-25.html';
                    },
                    href: './Ala Carte 11-23-25.html'
                },
                { 
                    name: 'Wine By The Glass', 
                    action: () => {
                        window.location.href = './WineByTheGlass.html';
                    },
                    href: './WineByTheGlass.html'
                },
                { 
                    name: 'Our Story', 
                    action: () => {
                        window.location.href = './OurStory.html';
                    },
                    href: './OurStory.html'
                },
                { 
                    name: 'Sparkling Wine Guide', 
                    action: () => {
                        window.location.href = './SparklingWineDoc.html';
                    },
                    href: './SparklingWineDoc.html'
                }
            ];
            
            placeholders.forEach((placeholder, index) => {
                const categoryItem = document.createElement('div');
                categoryItem.className = 'mobile-menu-category';
                categoryItem.innerHTML = `
                    <span class="mobile-menu-category-name">${placeholder.name}</span>
                    <div>
                        <i class="fas fa-chevron-right" style="color: var(--gold);"></i>
                    </div>
                `;
                if (placeholder.action) {
                    categoryItem.addEventListener('click', placeholder.action);
                    categoryItem.style.cursor = 'pointer';
                } else {
                    categoryItem.style.cursor = 'default';
                    categoryItem.style.opacity = '0.7';
                }
                menuCategories.appendChild(categoryItem);
                console.log(`Added menu item ${index + 1}: ${placeholder.name}`);
            });
            
            // Crea un container separato per lo switch day/night in fondo
            const switchContainer = document.createElement('div');
            switchContainer.id = 'mobileMenuSwitchContainer';
            
            // Aggiungi switch day/night mode in fondo
            addDayNightModeSwitch(switchContainer);
            
            // Aggiungi il container al menu principale (dopo le categorie)
            const mobileSideMenu = document.getElementById('mobileSideMenu');
            if (mobileSideMenu) {
                mobileSideMenu.appendChild(switchContainer);
            } else {
                // Fallback: aggiungi al container delle categorie se il menu principale non esiste
                menuCategories.appendChild(switchContainer);
            }
        }
        
        function addDayNightModeSwitch(container) {
            // Crea il separatore
            const separator = document.createElement('div');
            separator.style.cssText = 'height: 1px; background: rgba(212, 175, 55, 0.2); margin: 1rem 1.5rem;';
            container.appendChild(separator);
            
            // Crea il container dello switch
            const switchContainer = document.createElement('div');
            switchContainer.className = 'mobile-menu-category mobile-menu-switch-container';
            switchContainer.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 1.375rem 1.5rem; margin-top: auto;';
            
            const label = document.createElement('span');
            label.className = 'mobile-menu-category-name';
            label.textContent = 'Day Mode';
            label.style.cssText = 'font-weight: 500; color: var(--text-primary, rgba(245, 245, 240, 0.9));';
            
            // Crea lo switch
            const switchToggle = document.createElement('label');
            switchToggle.className = 'day-night-switch';
            switchToggle.style.cssText = 'position: relative; display: inline-block; width: 50px; height: 26px; cursor: pointer;';
            
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.className = 'day-night-switch-input';
            // Default a 'day' (light mode) se non è stato salvato alcun valore
            const dayMode = localStorage.getItem('dayMode');
            input.checked = dayMode === null ? true : dayMode === 'true';
            // Salva il valore di default se non esiste
            if (dayMode === null) {
                localStorage.setItem('dayMode', 'true');
            }
            
            const slider = document.createElement('span');
            slider.className = 'day-night-switch-slider';
            
            switchToggle.appendChild(input);
            switchToggle.appendChild(slider);
            
            switchContainer.appendChild(label);
            switchContainer.appendChild(switchToggle);
            container.appendChild(switchContainer);
            
            // Applica lo stato iniziale
            if (input.checked) {
                document.documentElement.setAttribute('data-theme', 'day');
            } else {
                document.documentElement.setAttribute('data-theme', 'night');
            }
            
            // Gestisci il cambio di tema
            input.addEventListener('change', function() {
                const isDayMode = this.checked;
                localStorage.setItem('dayMode', isDayMode);
                document.documentElement.setAttribute('data-theme', isDayMode ? 'day' : 'night');
            });
        }
        
        function loadMobileRegions(wineType) {
            const regionsList = document.getElementById('mobileRegionsList');
            const regionsTitle = document.getElementById('mobileRegionsTitle');
            const backBtn = document.getElementById('mobileBackToCategories');
            if (!regionsList || !window.wineApp) return;
            waitForWineApp(() => {
                if (!window.wineApp || !window.wineApp.wines) return;
                const wineTypeNames = {
                    'ROSSO': 'Red Wines',
                    'BIANCO': 'White Wines',
                    'ROSATO': 'Rosé Wines',
                    'ARANCIONE': 'Orange Wines',
                    'BOLLICINE': 'Sparkling',
                    'NON ALCOLICO': 'Non-Alcoholic'
                };
                if (regionsTitle) {
                    regionsTitle.textContent = wineTypeNames[wineType] || 'Wines';
                }
                if (backBtn) {
                    backBtn.style.display = 'flex';
                }
                // Filter wines by type
                const filteredWines = window.wineApp.wines.filter(wine => 
                    window.wineApp.wineMatchesFamily(wine, wineType)
                );
                // Get unique regions
                const regionSet = new Set();
                filteredWines.forEach(wine => {
                    const normalizedRegion = window.wineApp.normalizeRegionName(wine.region);
                    regionSet.add(normalizedRegion);
                });
                const regions = Array.from(regionSet).sort();
                regionsList.innerHTML = '';
                regions.forEach(region => {
                    const count = filteredWines.filter(wine => {
                        const normalizedWineRegion = window.wineApp.normalizeRegionName(wine.region);
                        return normalizedWineRegion === region;
                    }).length;
                    const regionCard = document.createElement('div');
                    regionCard.className = 'mobile-region-card';
                    regionCard.dataset.region = region;
                    regionCard.innerHTML = `
                        <span class="mobile-region-name">${region}</span>
                        <div>
                            <span class="mobile-region-count">${count} ${count === 1 ? 'wine' : 'wines'}</span>
                            <i class="fas fa-chevron-right" style="color: var(--gold);"></i>
                        </div>
                    `;
                    regionCard.addEventListener('click', () => {
                        currentMobileRegion = region;
                        loadMobileWines(region, wineType);
                        showMobileView('wines');
                    });
                    regionsList.appendChild(regionCard);
                });
            });
        }
        function loadMobileWines(region, wineType) {
            const winesList = document.getElementById('mobileWinesList');
            const winesTitle = document.getElementById('mobileWinesTitle');
            const background = document.getElementById('mobileRegionBackground');
            if (!winesList || !window.wineApp) return;
            waitForWineApp(() => {
                if (!window.wineApp || !window.wineApp.wines) return;
                if (winesTitle) {
                    winesTitle.textContent = `${region} Wines`;
                }
                // Set background image
                const regionImages = {
                    'TOSCANA': 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=1200',
                    'PIEMONTE': 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200',
                    'VENETO': 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200',
                    'SICILIA': 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=1200',
                    'LOMBARDIA': 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200',
                    'EMILIA-ROMAGNA': 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200',
                    'LAZIO': 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=1200',
                    'CAMPANIA': 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=1200',
                    'PUGLIA': 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=1200',
                    'SARDEGNA': 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=1200',
                    'FRIULI-VENEZIA GIULIA': 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200',
                    'TRENTINO ALTO-ADIGE': 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200',
                    'VALLE D\'AOSTA': 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200',
                    'LE MARCHE': 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=1200',
                    'UMBRIA': 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=1200',
                    'ABRUZZO': 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=1200',
                    'MOLISE': 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=1200',
                    'BASILICATA': 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=1200',
                    'CALABRIA': 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=1200',
                    'LIGURIA': 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=1200'
                };
                const normalizedRegion = window.wineApp.normalizeRegionName(region);
                const bgImage = regionImages[normalizedRegion] || 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200';
                if (background) {
                    const testImg = new Image();
                    testImg.onload = function() {
                        background.style.backgroundImage = `url('${bgImage}')`;
                        setTimeout(() => {
                            background.classList.add('visible');
                        }, 100);
                    };
                    testImg.onerror = function() {
                        background.classList.remove('visible');
                    };
                    testImg.src = bgImage;
                }
                // Filter wines
                const filteredWines = window.wineApp.wines.filter(wine => {
                    const normalizedWineRegion = window.wineApp.normalizeRegionName(wine.region);
                    const normalizedFilterRegion = window.wineApp.normalizeRegionName(region);
                    const matchesRegion = normalizedWineRegion === normalizedFilterRegion;
                    const matchesType = !wineType || window.wineApp.wineMatchesFamily(wine, wineType);
                    return matchesRegion && matchesType;
                });
                winesList.innerHTML = '';
                if (filteredWines.length === 0) {
                    winesList.innerHTML = '<div style="color: rgba(245, 245, 240, 0.5); text-align: center; padding: 2rem;">No wines found for this region and type</div>';
                    return;
                }
                filteredWines.forEach(wine => {
                    const wineCard = document.createElement('div');
                    wineCard.className = 'mobile-wine-card';
                    wineCard.dataset.wineId = wine.wine_number;
                    
                    const price = wine.wine_price || wine.wine_price_bottle || wine.wine_price_glass || 'N/A';
                    const vintage = wine.wine_vintage ? wine.wine_vintage.match(/\b(19|20)\d{2}\b/)?.[0] || 'N/A' : 'N/A';
                    const producer = wine.wine_producer || 'Unknown Producer';
                    const subcategory = wine.subcategory || '';
                    const subcategoryInfo = formatSubcategoryForDisplay(subcategory, wine);
                    wineCard.innerHTML = `
                        <div class="mobile-wine-info">
                            <div class="mobile-wine-name">${wine.wine_name || 'Unknown Wine'} <span class="mobile-wine-producer-inline">- ${producer}</span></div>
                            <div class="mobile-wine-vintage">${vintage !== 'N/A' ? vintage : ''}</div>
                            ${subcategoryInfo ? `
                                <div class="mobile-wine-card-subcategory-wrapper">
                                    <div class="mobile-wine-card-subcategory">${subcategoryInfo.name}</div>
                                    ${subcategoryInfo.description ? `<div class="mobile-wine-card-subcategory-desc">${subcategoryInfo.description}</div>` : ''}
                                </div>
                            ` : ''}
                        </div>
                        <span class="mobile-wine-price">$${price}</span>
                        <i class="fas fa-chevron-right" style="color: var(--gold);"></i>
                    `;
                    wineCard.addEventListener('click', () => {
                        const params = new URLSearchParams();
                        params.set('id', wine.wine_number);
                        if (wineType) {
                            params.set('type', wineType);
                        }
                        params.set('from', 'index');
                        window.location.href = `wine-details.html?${params.toString()}`;
                    });
                    winesList.appendChild(wineCard);
                });
            });
        }
        // Load Mobile Wine Type Chips as Text Buttons in Quick Search Section
        function loadMobileWineTypeChips() {
            const quickSearchButtons = document.querySelector('.mobile-quick-search-buttons');
            if (!quickSearchButtons || !window.wineApp) return;
            waitForWineApp(() => {
                if (!window.wineApp || !window.wineApp.wines) return;
                
                const wineTypes = [
                    { type: 'ROSSO', name: 'Red' },
                    { type: 'BIANCO', name: 'White' },
                    { type: 'ROSATO', name: 'Rosé' },
                    { type: 'ARANCIONE', name: 'Orange' },
                    { type: 'BOLLICINE', name: 'Sparkling' },
                    { type: 'NON ALCOLICO', name: 'Non-Alc' }
                ];
                
                wineTypes.forEach(({ type, name }) => {
                    const count = window.wineApp.wines.filter(wine => 
                        window.wineApp.wineMatchesFamily(wine, type)
                    ).length;
                    if (count > 0) {
                        // Create button with text only (no images)
                        const button = document.createElement('button');
                        button.className = 'mobile-quick-search-btn mobile-wine-type-btn';
                        button.dataset.type = type;
                        button.innerHTML = `<span>${name} (${count})</span>`;
                        
                        button.addEventListener('click', () => {
                            // If clicking the same button, deselect it
                            if (button.classList.contains('active')) {
                                button.classList.remove('active');
                                mobileCurrentWineType = null;
                                // Keep desktop/tablet state in sync
                                if (typeof currentWineType !== 'undefined') {
                                    currentWineType = null;
                                }
                                updateMobileMapColors(null);
                                closeMobileWineTypePopup();
                                return;
                            }
                            
                            // Remove active class from all wine type buttons
                            document.querySelectorAll('.mobile-wine-type-btn').forEach(b => {
                                b.classList.remove('active');
                            });
                            button.classList.add('active');
                            mobileCurrentWineType = type;
                            // Keep desktop/tablet state in sync (tablet uses regions panel)
                            if (typeof currentWineType !== 'undefined') {
                                currentWineType = type;
                            }
                            updateMobileMapColors(type);
                            // Popup is disabled on mobile/tablet (<=1023px), so use the regions panel flow there
                            if (window.innerWidth <= 1023 && typeof showRegionsPanel === 'function') {
                                showRegionsPanel(type);
                            } else {
                                // Desktop-only popup
                                openMobileWineTypePopup(type);
                            }
                        });
                        
                        // Hide wine type buttons by default - show only when Dynamic Mode is active
                        button.style.display = 'none';
                        
                        // Insert before the Compare Wines button if it exists, otherwise append
                        const compareBtn = document.getElementById('mobileCompareWinesBtn');
                        if (compareBtn) {
                            quickSearchButtons.insertBefore(button, compareBtn);
                        } else {
                            quickSearchButtons.appendChild(button);
                        }
                    }
                });
            });
        }
        
        // Function to toggle wine type buttons visibility based on Dynamic Mode
        function toggleWineTypeButtonsVisibility(isDynamicModeActive) {
            const wineTypeButtons = document.querySelectorAll('.mobile-wine-type-btn');
            wineTypeButtons.forEach(btn => {
                btn.style.display = isDynamicModeActive ? 'flex' : 'none';
            });
        }
        
        // Open Mobile Wine Type Popup
        function openMobileWineTypePopup(wineType) {
            // Disabilita il popup su mobile e tablet (max-width: 1023px)
            if (window.innerWidth <= 1023) {
                return; // Non aprire il popup su mobile e tablet
            }
            
            const popup = document.getElementById('mobileWineTypePopup');
            const popupTitle = document.getElementById('mobileWineTypePopupTitle');
            const popupRegions = document.getElementById('mobileWineTypePopupRegions');
            const popupVarietals = document.getElementById('mobileWineTypePopupVarietals');
            const popupClose = document.getElementById('mobileWineTypePopupClose');
            const tabRegions = document.getElementById('mobileWineTypePopupTabRegions');
            const tabVarietals = document.getElementById('mobileWineTypePopupTabVarietals');
            
            if (!popup || !popupTitle || !popupRegions || !popupVarietals) return;
            
            // Get wine type name
            const wineTypeNames = {
                'ROSSO': 'Red Wines',
                'BIANCO': 'White Wines',
                'ROSATO': 'Rosé Wines',
                'ARANCIONE': 'Orange Wines',
                'BOLLICINE': 'Sparkling',
                'NON ALCOLICO': 'Non-Alcoholic'
            };
            
            // Setup tab switching
            if (tabRegions && tabVarietals) {
                tabRegions.onclick = () => switchPopupTab('regions');
                tabVarietals.onclick = () => switchPopupTab('varietals');
            }
            
            // Check if there are regions or varietals with wines of this type
            if (!window.wineApp || !window.wineApp.wines) {
                waitForWineApp(() => {
                    if (window.wineApp && window.wineApp.wines) {
                        checkAndOpenPopup(wineType, wineTypeNames, popup, popupTitle, popupRegions, popupVarietals);
                    }
                });
            } else {
                checkAndOpenPopup(wineType, wineTypeNames, popup, popupTitle, popupRegions, popupVarietals);
            }
            
            // Close button handler
            if (popupClose) {
                popupClose.onclick = () => closeMobileWineTypePopup();
            }
        }
        
        // Switch between regions and varietals tabs
        function switchPopupTab(tab) {
            const tabRegions = document.getElementById('mobileWineTypePopupTabRegions');
            const tabVarietals = document.getElementById('mobileWineTypePopupTabVarietals');
            const sectionRegions = document.getElementById('mobileWineTypePopupRegions');
            const sectionVarietals = document.getElementById('mobileWineTypePopupVarietals');
            
            if (tab === 'regions') {
                if (tabRegions) tabRegions.classList.add('active');
                if (tabVarietals) tabVarietals.classList.remove('active');
                if (sectionRegions) sectionRegions.classList.add('active');
                if (sectionVarietals) sectionVarietals.classList.remove('active');
            } else {
                if (tabRegions) tabRegions.classList.remove('active');
                if (tabVarietals) tabVarietals.classList.add('active');
                if (sectionRegions) sectionRegions.classList.remove('active');
                if (sectionVarietals) sectionVarietals.classList.add('active');
            }
        }
        
        function checkAndOpenPopup(wineType, wineTypeNames, popup, popupTitle, popupRegions, popupVarietals) {
            // Filter wines by type
            const filteredWines = window.wineApp.wines.filter(wine => {
                return window.wineApp.wineMatchesFamily(wine, wineType);
            });
            
            // Get unique regions
            const regionSet = new Set();
            filteredWines.forEach(wine => {
                if (wine.region && wine.region.trim() !== '') {
                    const normalizedRegion = window.wineApp.normalizeRegionName(wine.region);
                    regionSet.add(normalizedRegion);
                }
            });
            
            const regions = Array.from(regionSet).sort();
            
            // Get unique varietals
            const varietalSet = new Set();
            filteredWines.forEach(wine => {
                if (wine.varietals && wine.varietals.trim() !== '') {
                    // Split varietals by comma and add each one
                    const varietals = wine.varietals.split(',').map(v => v.trim()).filter(v => v);
                    varietals.forEach(varietal => {
                        varietalSet.add(varietal);
                    });
                }
            });
            
            const varietals = Array.from(varietalSet).sort();
            
            // If no regions and no varietals found, don't open popup
            if (regions.length === 0 && varietals.length === 0) {
                closeMobileWineTypePopup();
                return;
            }
            
            // Update popup title
            popupTitle.textContent = wineTypeNames[wineType] || 'Select Filter';
            
            // Reset to regions tab
            switchPopupTab('regions');
            
            // Clear and populate regions
            popupRegions.innerHTML = '';
            
            if (regions.length > 0) {
                regions.forEach(region => {
                    // Count wines in this region and type
                    const count = filteredWines.filter(wine => {
                        const normalizedWineRegion = window.wineApp.normalizeRegionName(wine.region);
                        return normalizedWineRegion === region;
                    }).length;
                    
                    const regionItem = document.createElement('div');
                    regionItem.className = 'mobile-wine-type-popup-region';
                    regionItem.innerHTML = `
                        <div class="mobile-wine-type-popup-region-name">${region}</div>
                        <div class="mobile-wine-type-popup-region-count">${count} wine${count !== 1 ? 's' : ''}</div>
                    `;
                    
                    regionItem.addEventListener('click', () => {
                        // Close popup
                        closeMobileWineTypePopup();
                        // Select region directly with the correct wine type
                        if (mobileGeoJsonLayer && typeof selectMobileRegion === 'function') {
                            // Convert normalized region name to map region name
                            const mapRegionName = getMapRegionName(region);
                            let foundLayer = null;
                            
                            // Find the matching layer
                            mobileGeoJsonLayer.eachLayer(function(layer) {
                                // Check both normalized and map region names
                                if (layer._regionName === region || layer._regionName === mapRegionName) {
                                    foundLayer = layer;
                                }
                            });
                            
                            // Directly call selectMobileRegion with the correct region name and wine type
                            // This ensures the wines are filtered correctly by the selected wine type
                            if (foundLayer) {
                                // Use the normalized region name to ensure correct filtering
                                selectMobileRegion(foundLayer, region);
                            }
                        }
                    });
                    
                    popupRegions.appendChild(regionItem);
                });
            } else {
                popupRegions.innerHTML = '<div style="color: rgba(245, 245, 240, 0.5); text-align: center; padding: 2rem;">No regions available</div>';
            }
            
            // Clear and populate varietals
            popupVarietals.innerHTML = '';
            
            if (varietals.length > 0) {
                varietals.forEach(varietal => {
                    // Count wines with this varietal and type
                    // Use case-insensitive matching for consistency
                    const count = filteredWines.filter(wine => {
                        if (!wine.varietals) return false;
                        const wineVarietals = wine.varietals.split(',').map(v => v.trim().toLowerCase());
                        const searchVarietal = varietal.toLowerCase();
                        return wineVarietals.includes(searchVarietal);
                    }).length;
                    
                    const varietalItem = document.createElement('div');
                    varietalItem.className = 'mobile-wine-type-popup-varietal';
                    varietalItem.innerHTML = `
                        <div class="mobile-wine-type-popup-varietal-name">${varietal}</div>
                        <div class="mobile-wine-type-popup-varietal-count">${count} wine${count !== 1 ? 's' : ''}</div>
                    `;
                    
                    varietalItem.addEventListener('click', () => {
                        // Close popup
                        closeMobileWineTypePopup();
                        // Show wines filtered by varietal
                        showMobileWinesForVarietal(varietal);
                    });
                    
                    popupVarietals.appendChild(varietalItem);
                });
            } else {
                popupVarietals.innerHTML = '<div style="color: rgba(245, 245, 240, 0.5); text-align: center; padding: 2rem;">No varietals available</div>';
            }
            
            // Show popup
            popup.style.display = 'flex';
            // Trigger animation
            setTimeout(() => {
                popup.classList.add('show');
            }, 10);
        }
        
        // Close Mobile Wine Type Popup
        function closeMobileWineTypePopup() {
            const popup = document.getElementById('mobileWineTypePopup');
            if (!popup) return;
            
            popup.classList.remove('show');
            setTimeout(() => {
                popup.style.display = 'none';
            }, 300);
        }
        
        // Close popup when clicking outside
        document.addEventListener('click', (e) => {
            const popup = document.getElementById('mobileWineTypePopup');
            if (!popup || popup.style.display === 'none') return;
            
            // Check if click is outside the popup and not on wine type buttons
            if (!popup.contains(e.target) && !e.target.closest('.mobile-wine-type-chip') && !e.target.closest('.mobile-wine-type-btn')) {
                closeMobileWineTypePopup();
            }
        });
        
        // Initialize Mobile Map
        // IMPORTANT: This should ONLY be called on mobile devices (< 768px), NOT on tablets
        // Tablets (768-1023px) use the desktop layout with #map, not #mobileMap
        function initializeMobileMap() {
            // Prevent initialization on tablets - tablets should use desktop map (#map)
            if (isTabletDevice || window.innerWidth >= 768) {
                console.log('Skipping mobile map initialization on tablet - using desktop layout');
                return;
            }
            
            const mobileMapContainer = document.getElementById('mobileMap');
            if (!mobileMapContainer) {
                console.log('Mobile map container not found');
                return;
            }
            updateMobileMapHeight();
            // Wait a bit for container to be ready
            setTimeout(() => {
                if (mobileMapContainer._leaflet_id) {
                    console.log('Mobile map already initialized, skipping...');
                    return;
                }
                try {
                    // Limit max zoom to 5.8 (requested)
                    const mobileMaxZoom = 5.8;
                    const mobileInitialZoom = 5.8;
                    
                    // Ottimizzazioni per iPad e tablet - configurazioni pro
                    const isIPadDevice = DeviceDetector.isIPad();
                    const isTouchDevice = DeviceDetector.isTouchDevice();
                    
                    // Configurazioni avanzate per iPad/tablet
                    const tabletConfig = isTabletDevice ? {
                        tapTolerance: 15, // Maggiore tolleranza per touch su tablet
                        touchZoom: true,
                        doubleClickZoom: true,
                        scrollWheelZoom: false,
                        boxZoom: false,
                        keyboard: false,
                        dragging: true,
                        inertia: true,
                        inertiaDeceleration: 2500, // Più fluido su tablet
                        inertiaMaxSpeed: 2000, // Velocità maggiore per tablet
                        zoomAnimation: true,
                        zoomAnimationThreshold: 4,
                        fadeAnimation: true,
                        markerZoomAnimation: true
                    } : {
                        tap: true,
                        touchZoom: true,
                        doubleClickZoom: true,
                        scrollWheelZoom: false,
                        boxZoom: false,
                        dragging: true,
                        keyboard: false,
                        inertia: true,
                        inertiaDeceleration: 3000,
                        inertiaMaxSpeed: 1500
                    };
                    
                    mobileMapInstance = L.map('mobileMap', {
                        zoomControl: false,
                        zoomSnap: 0.1,
                        minZoom: 5,
                        maxZoom: mobileMaxZoom,
                        maxBounds: [[35.5, 5.0], [48.0, 20.0]],
                        maxBoundsViscosity: 0.5, // Reduced for smoother panning (matching desktop)
                        ...tabletConfig,
                        worldCopyJump: false // Prevent map from jumping when panning
                    }).setView([42.0, 12.5], mobileInitialZoom);
                    // Add tile layer with dark theme - maxZoom 32+ for tablets
                    const mobileTileMaxZoom = isTabletDevice ? 32 : 19;
                    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                        attribution: '© OpenStreetMap contributors',
                        maxZoom: mobileTileMaxZoom
                    }).addTo(mobileMapInstance);
                    // Invalidate size after a short delay to ensure proper rendering
                    setTimeout(() => {
                        mobileMapInstance.invalidateSize();
                    }, 100);
                    // Second pass per iOS Safari: viewport/layout si stabilizzano in ritardo
                    setTimeout(() => {
                        if (mobileMapInstance) {
                            mobileMapInstance.invalidateSize();
                        }
                    }, 500);
                    
                    // Load European countries borders for context (dark grey borders)
                    // Using Natural Earth simplified countries data
                    fetch('https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson')
                        .then(response => {
                            if (!response.ok) {
                                throw new Error(`HTTP error! status: ${response.status}`);
                            }
                            return response.json();
                        })
                        .then(worldGeoJson => {
                            // Filter to show only European countries (countries that intersect with European bounds)
                            const europeanCountries = worldGeoJson.features.filter(feature => {
                                // Get country name for filtering
                                const name = feature.properties?.name || feature.properties?.NAME || '';
                                
                                // List of European countries (excluding Italy as it will be shown separately)
                                const europeanCountryNames = [
                                    'France', 'Spain', 'Portugal', 'Switzerland', 'Austria', 'Germany',
                                    'Belgium', 'Netherlands', 'Luxembourg', 'Poland', 'Czech Republic',
                                    'Slovakia', 'Slovenia', 'Croatia', 'Bosnia and Herzegovina',
                                    'Serbia', 'Montenegro', 'Albania', 'Greece', 'Bulgaria', 'Romania',
                                    'Hungary', 'Moldova', 'Ukraine', 'Belarus', 'Lithuania', 'Latvia',
                                    'Estonia', 'Finland', 'Sweden', 'Norway', 'Denmark', 'United Kingdom',
                                    'Ireland', 'Malta', 'Cyprus', 'Monaco', 'San Marino', 'Vatican',
                                    'Liechtenstein', 'Andorra', 'North Macedonia', 'Kosovo'
                                ];
                                
                                // Check if country name matches European countries
                                if (europeanCountryNames.some(euName => 
                                    name.toLowerCase().includes(euName.toLowerCase()) ||
                                    euName.toLowerCase().includes(name.toLowerCase())
                                )) {
                                    return true;
                                }
                                
                                // Also check by coordinates if name doesn't match
                                const checkCoords = (coords, depth = 0) => {
                                    if (depth > 10) return false; // Prevent infinite recursion
                                    
                                    if (Array.isArray(coords[0]) && typeof coords[0][0] === 'number') {
                                        // This is a coordinate pair [lon, lat]
                                        const [lon, lat] = coords;
                                        return lat >= 35 && lat <= 72 && lon >= -10 && lon <= 40;
                                    } else if (Array.isArray(coords[0])) {
                                        // This is an array of coordinates
                                        return coords.some(coord => checkCoords(coord, depth + 1));
                                    }
                                    return false;
                                };
                                
                                if (feature.geometry.type === 'Polygon') {
                                    return checkCoords(feature.geometry.coordinates);
                                } else if (feature.geometry.type === 'MultiPolygon') {
                                    return feature.geometry.coordinates.some(poly => checkCoords(poly));
                                }
                                
                                return false;
                            });
                            
                            // Create filtered GeoJSON
                            const europeGeoJson = {
                                type: 'FeatureCollection',
                                features: europeanCountries
                            };
                            
                            // European borders layer removed - no borders for European countries
                            // const europeBordersLayer = L.geoJSON(europeGeoJson, {
                            //     style: function(feature) {
                            //         return {
                            //             color: '#666666', // Medium grey borders
                            //             weight: 1.5,
                            //             fillOpacity: 0.15, // Slight grey fill to show countries
                            //             fillColor: '#666666', // Grey fill color
                            //             lineCap: 'round',
                            //             lineJoin: 'round',
                            //             interactive: false // Disable interactions for context layer
                            //         };
                            //     }
                            // }).addTo(mobileMapInstance);
                            
                            console.log('✅ European borders layer added to mobile map');
                        })
                        .catch(error => {
                            console.warn('⚠️ Could not load European borders (non-critical):', error);
                            // Continue even if European borders fail to load
                        });
                    
                    fetch('https://raw.githubusercontent.com/openpolis/geojson-italy/master/geojson/limits_IT_regions.geojson')
                        .then(response => {
                            if (!response.ok) {
                                throw new Error(`HTTP error! status: ${response.status}`);
                            }
                            return response.json();
                        })
                        .then(geojson => {
                            console.log('🗺️ Mobile GeoJSON loaded successfully');
                            mobileGeoJsonLayer = L.geoJSON(geojson, {
                                style: function(feature) {
                                    return {
                                        color: mobileCurrentWineType ? currentColors.border : '#D4AF37',
                                        weight: 1.5,
                                        fillOpacity: 0.15,
                                        fillColor: mobileCurrentWineType ? currentColors.fill : 'transparent',
                                        lineCap: 'round',
                                        lineJoin: 'round'
                                    };
                                },
                                onEachFeature: onEachMobileFeature
                            }).addTo(mobileMapInstance);
                            console.log('✅ Mobile geoJsonLayer created and added to map');
                            
                            // Add region labels with connecting lines
                            addMobileRegionLabels(geojson);
                            
                            // Fit map to Italy, then force zoom 8 so user sees the requested zoom level
                            const mobileItalyBounds = mobileGeoJsonLayer.getBounds();
                            mobileMapInstance.fitBounds(mobileItalyBounds, {
                                paddingTopLeft: [12, 70],
                                paddingBottomRight: [24, 24],
                                paddingBottomLeft: [12, 24],
                                maxZoom: 5.8,
                                animate: false
                            });
                            const mobileCenter = mobileItalyBounds.getCenter();
                            mobileMapInstance.setView([mobileCenter.lat, mobileCenter.lng], 5.8, { animate: false });
                            
                            // Apply initial transform to mobile leaflet-proxy after map is loaded
                            const applyTransformToMobileProxy = (selector, retries = 10) => {
                                const mobileLeafletProxy = document.querySelector(selector);
                                if (mobileLeafletProxy) {
                                    mobileLeafletProxy.style.transform = 'translate3d(8761px, 6078px, 0px) scale(32)';
                                    console.log('✅ Applied initial transform to mobile leaflet-proxy');
                                } else if (retries > 0) {
                                    setTimeout(() => applyTransformToMobileProxy(selector, retries - 1), 100);
                                }
                            };
                            setTimeout(() => applyTransformToMobileProxy('#mobileMap .leaflet-proxy.leaflet-zoom-animated'), 500);
                            
                            // Invalidate size again after GeoJSON is added
                            setTimeout(() => {
                                mobileMapInstance.invalidateSize();
                            }, 200);
                            // Ricalcola dimensioni container quando layout è stabile (evita taglio Piemonte)
                            setTimeout(() => {
                                if (mobileMapInstance && mobileGeoJsonLayer) {
                                    mobileMapInstance.invalidateSize();
                                    const b = mobileGeoJsonLayer.getBounds();
                                    mobileMapInstance.fitBounds(b, {
                                        paddingTopLeft: [12, 70],
                                        paddingBottomRight: [24, 24],
                                        paddingBottomLeft: [12, 24],
                                        maxZoom: 5.8,
                                        animate: false
                                    });
                                    const c = b.getCenter();
                                    mobileMapInstance.setView([c.lat, c.lng], 5.8, { animate: false });
                                }
                            }, 800);
                            scheduleViewportRefresh();
                        })
                        .catch(error => {
                            console.error('❌ Error loading mobile GeoJSON:', error);
                            console.error('📍 GeoJSON URL:', 'https://raw.githubusercontent.com/openpolis/geojson-italy/master/geojson/limits_IT_regions.geojson');
                            console.error('📍 Current URL:', window.location.href);
                        });
                } catch (error) {
                    console.error('❌ Error initializing mobile map:', error);
                }
            }, 300);
        }
        // Handle each feature on mobile map
        function onEachMobileFeature(feature, layer) {
            const regionName = feature.properties.reg_name || feature.properties.NAME || feature.properties.name || 'Unknown';
            layer._regionName = regionName;
            // Check if region has wines for current type (or all types if none selected)
            const hasWines = regionHasWines(regionName, mobileCurrentWineType);
            const shouldEnable = hasWines || !mobileCurrentWineType;
            // Set initial style based on wine availability
            if (!shouldEnable) {
                layer.setStyle({
                    color: '#666',
                    fillColor: '#333',
                    weight: 1.5,
                    fillOpacity: 0.05,
                    opacity: 0.5
                });
            }
            layer.on({
                click: function(e) {
                    // Prevent default map behavior
                    if (e.originalEvent) {
                        e.originalEvent.preventDefault();
                        e.originalEvent.stopPropagation();
                    }
                    
                    // Check dynamically if region has wines for current wine type
                    // Don't rely on closure variable which may be stale
                    const rName = this._regionName || regionName;
                    const hasWinesForType = rName ? regionHasWines(rName, mobileCurrentWineType) : false;
                    const canEnable = hasWinesForType || !mobileCurrentWineType;
                    const isInteractive = this.options.interactive !== false;
                    
                    // Only allow selection if region has wines and is interactive
                    if (canEnable && isInteractive) {
                        selectMobileRegion(layer, regionName);
                    }
                },
                mouseover: function(e) {
                    // Check dynamically if region has wines for current wine type
                    const rName = this._regionName || regionName;
                    const hasWinesForType = rName ? regionHasWines(rName, mobileCurrentWineType) : false;
                    const canEnable = hasWinesForType || !mobileCurrentWineType;
                    const isInteractive = this.options.interactive !== false;
                    
                    if (this !== mobileSelectedRegion && canEnable && isInteractive) {
                        this.setStyle({
                            weight: 0, // Remove borders
                            fillOpacity: 0.35,
                            fillColor: mobileCurrentWineType ? currentColors.fill : '#D4AF37',
                            color: 'transparent', // Remove borders
                            opacity: 1
                        });
                        this.bringToFront();
                    }
                },
                mouseout: function(e) {
                    // Check dynamically if region has wines for current wine type
                    const rName = this._regionName || regionName;
                    const hasWinesForType = rName ? regionHasWines(rName, mobileCurrentWineType) : false;
                    const canEnable = hasWinesForType || !mobileCurrentWineType;
                    const isInteractive = this.options.interactive !== false;
                    
                    if (this !== mobileSelectedRegion && canEnable && isInteractive) {
                        // Restore to highlighted state if wine type is selected, otherwise use default
                        if (mobileCurrentWineType && hasWinesForType) {
                            this.setStyle({
                                color: 'transparent', // Remove borders
                                fillColor: currentColors.fill,
                                weight: 0, // Remove borders
                                fillOpacity: 0.25,
                                opacity: 0.9,
                                lineCap: 'round',
                                lineJoin: 'round'
                            });
                        } else {
                            this.setStyle({
                                weight: 0, // Remove borders
                                fillOpacity: 0.08,
                                fillColor: mobileCurrentWineType ? currentColors.fill : '#D4AF37',
                                color: 'transparent', // Remove borders
                                opacity: 0.8
                            });
                        }
                    } else if (!canEnable || !isInteractive) {
                        // Region doesn't have wines - return to disabled state
                        this.setStyle({
                            color: 'transparent', // Remove borders
                            fillColor: '#333',
                            weight: 0, // Remove borders
                            fillOpacity: 0.05,
                            opacity: 0.5
                        });
                    }
                }
            });
        }
        // Select Mobile Region
        function selectMobileRegion(layer, regionName) {
            if (!window.wineApp) {
                waitForWineApp(() => selectMobileRegion(layer, regionName));
                return;
            }
            if (mobileGeoJsonLayer && mobileSelectedRegion) {
                const hasWines = regionHasWines(mobileSelectedRegion._regionName, mobileCurrentWineType);
                if (hasWines || !mobileCurrentWineType) {
                    // Restore to highlighted state if wine type is selected, otherwise use default
                    if (mobileCurrentWineType && hasWines) {
                        mobileSelectedRegion.setStyle({
                            color: currentColors.border,
                            fillColor: currentColors.fill,
                            weight: 2,
                            fillOpacity: 0.25,
                            opacity: 0.9,
                            lineCap: 'round',
                            lineJoin: 'round'
                        });
                    } else {
                        mobileSelectedRegion.setStyle({
                            weight: 1.5,
                            fillOpacity: 0.08,
                            fillColor: mobileCurrentWineType ? currentColors.fill : '#D4AF37',
                            color: mobileCurrentWineType ? currentColors.border : '#D4AF37',
                            opacity: 0.8
                        });
                    }
                }
            }
            mobileSelectedRegion = layer;
            layer.setStyle({
                weight: 0, // Remove borders
                fillOpacity: 0.5,
                fillColor: mobileCurrentWineType ? currentColors.fill : '#D4AF37',
                color: 'transparent', // Remove borders
                opacity: 1,
                dashArray: null // Remove dash array
            });
            layer.bringToFront();
            // Get search term from mobile search input if present
            const mobileSearchInput = document.getElementById('mobileSearchInput');
            const searchTerm = mobileSearchInput ? mobileSearchInput.value.trim() : '';
            
            // Show wines list directly (popup removed)
            console.log('✅ Mobile region selected, showing wines list directly...');
            if (typeof showMobileWinesForRegion === 'function') {
                showMobileWinesForRegion(regionName, mobileCurrentWineType, searchTerm);
            }
        }
        
        // Add region labels centered within each region
        function addMobileRegionLabels(geojson) {
            if (!mobileMapInstance || !geojson) return;
            
            // Store labels layer
            if (!window.mobileRegionLabelsLayer) {
                window.mobileRegionLabelsLayer = L.layerGroup().addTo(mobileMapInstance);
            }
            
            // Clear existing labels
            window.mobileRegionLabelsLayer.clearLayers();
            
            // Calculate label width based on text length (approximate)
            const getLabelWidth = (text) => {
                // Approximate: ~8px per character + padding
                return Math.max(80, text.length * 8 + 20);
            };
            
            // Manual position adjustments to center labels within irregular region shapes
            // Values are offsets from geometric center: { lat: latOffset, lng: lngOffset }
            // Posizionamenti ottimizzati per evitare sovrapposizioni e leggibilità professionale
            const regionAdjustments = {
                'piemonte': { lat: -0.4, lng: -0.25 },           // Spostato più in basso a sinistra
                'valle d\'aosta': { lat: 0.3, lng: -0.8 },       // Spostato molto in alto a sinistra
                'lombardia': { lat: 0.45, lng: 0.15 },           // Spostato in alto
                'trentino-alto adige': { lat: 0.55, lng: -0.5 }, // Spostato molto in alto a sinistra
                'veneto': { lat: 0.35, lng: 0.6 },               // Spostato più a destra
                'friuli-venezia giulia': { lat: 0.55, lng: 1.0 },// Spostato +13px a destra
                'liguria': { lat: -0.3, lng: -1.3 },             // Spostato molto a sinistra fuori regione
                'emilia-romagna': { lat: 0.05, lng: 0.1 },       // Centrato
                'toscana': { lat: -0.2, lng: -0.55 },            // Spostato a sinistra
                'umbria': { lat: -0.15, lng: 0.05 },             // Centrato leggermente in basso
                'marche': { lat: 0.15, lng: 0.55 },              // Spostato a destra verso la costa
                'lazio': { lat: -0.35, lng: -0.35 },             // Spostato più in basso a sinistra
                'abruzzo': { lat: 0.2, lng: 0.5 },               // Spostato a destra
                'molise': { lat: 0.1, lng: 0.75 },               // Spostato molto a destra (regione piccola)
                'campania': { lat: -0.45, lng: -0.25 },          // Spostato più in basso
                'puglia': { lat: 0.15, lng: 0.85 },              // Spostato molto a destra
                'basilicata': { lat: 0.1, lng: 0.5 },            // Spostato a destra
                'calabria': { lat: -0.35, lng: 0.2 },            // Spostato più in basso
                'sicilia': { lat: -0.25, lng: 0 },               // Centrato, leggermente in basso
                'sardegna': { lat: 0, lng: 0 }                   // Centrato (isola isolata)
            };
            
            // Process each region
            geojson.features.forEach(feature => {
                const regionName = feature.properties.reg_name || feature.properties.NAME || feature.properties.name || 'Unknown';
                const displayRegionName = getItalianRegionNameForDisplay(regionName) || regionName;
                const normalizedName = regionName.trim().toLowerCase();
                
                // Create temporary layer to get bounds
                const layer = L.geoJSON(feature);
                const bounds = layer.getBounds();
                const center = bounds.getCenter();
                
                // Get manual adjustment if exists
                let adjustment = { lat: 0, lng: 0 };
                for (const [key, value] of Object.entries(regionAdjustments)) {
                    if (normalizedName.includes(key)) {
                        adjustment = value;
                        break;
                    }
                }
                
                // Calculate final position (center + adjustment)
                const finalLat = center.lat + adjustment.lat;
                const finalLng = center.lng + adjustment.lng;
                
                // Calculate icon size based on text length
                const labelWidth = getLabelWidth(displayRegionName);
                const iconSize = [labelWidth, 30];
                
                // 7px a destra per Valle d'Aosta, Piemonte, Liguria
                const offsetRight = REGION_LABEL_OFFSET_RIGHT_KEYS.some(k => normalizedName.includes(k));
                const labelClassName = 'mobile-region-label' + (offsetRight ? ' region-label-offset-right' : '');
                const labelIcon = L.divIcon({
                    className: labelClassName,
                    html: `<div class="mobile-region-label-text">${displayRegionName}</div>`,
                    iconSize: iconSize,
                    iconAnchor: [iconSize[0] / 2, iconSize[1] / 2]
                });
                
                // Create marker for label at centered position
                const labelMarker = L.marker([finalLat, finalLng], {
                    icon: labelIcon,
                    interactive: false,
                    zIndexOffset: 1000
                });
                
                // Add to labels layer
                window.mobileRegionLabelsLayer.addLayer(labelMarker);
            });
        }
        
        // Update Mobile Map Colors
        function updateMobileMapColors(wineType) {
            const colors = getWineTypeColors(wineType);
            currentColors = colors;
            if (mobileGeoJsonLayer) {
                mobileGeoJsonLayer.eachLayer(function(layer) {
                    const regionName = layer._regionName;
                    const hasWines = regionHasWines(regionName, wineType);
                    const isSelected = layer === mobileSelectedRegion;
                    
                    if (hasWines || !wineType) {
                        if (wineType && hasWines) {
                            // When a wine type is selected, highlight regions with that wine type using wine color
                            layer.setStyle({
                                color: colors.border,
                                fillColor: colors.fill,
                                weight: isSelected ? 3 : 2,
                                fillOpacity: isSelected ? 0.3 : 0.25,
                                opacity: isSelected ? 1 : 0.9,
                                dashArray: isSelected ? '10, 5' : null,
                                lineCap: 'round',
                                lineJoin: 'round'
                            });
                        } else {
                            // No wine type selected - use default style
                            layer.setStyle({
                                color: isSelected ? '#CCC' : '#999', // Light grey borders
                                fillColor: isSelected ? 'rgba(255, 255, 255, 0.1)' : 'transparent', // Transparent fill
                                weight: isSelected ? 3 : 1.5,
                                fillOpacity: isSelected ? 0.3 : 0.15,
                                opacity: isSelected ? 1 : 0.8,
                                dashArray: isSelected ? '10, 5' : null
                            });
                        }
                        // Re-enable interactions
                        layer.options.interactive = true;
                    } else {
                        layer.setStyle({
                            color: '#666',
                            fillColor: '#333',
                            weight: 1.5,
                            fillOpacity: 0.05,
                            opacity: 0.5
                        });
                        // Disable interactions for regions without wines
                        layer.options.interactive = false;
                    }
                });
            }
            // Update regions list to show dimmed regions
            updateRegionsListForWineType(wineType);
        }
        
        // Update regions list to show all regions with dimmed state for regions without wines
        function updateRegionsListForWineType(wineType) {
            const regionsList = document.getElementById('regionsList');
            if (!regionsList || !window.wineApp || !window.wineApp.wines) return;
            
            // Get all unique regions from all wines
            const allRegionsSet = new Set();
            window.wineApp.wines.forEach(wine => {
                if (wine.region && wine.region.trim() !== '') {
                    const normalizedRegion = window.wineApp.normalizeRegionName(wine.region);
                    allRegionsSet.add(normalizedRegion);
                }
            });
            
            const allRegions = Array.from(allRegionsSet).sort();
            
            // Get existing region items
            const regionItems = regionsList.querySelectorAll('.region-item');
            const existingRegions = new Map();
            
            regionItems.forEach(item => {
                const regionName = item.dataset.regionName || item.querySelector('.region-item-name')?.textContent;
                if (regionName) {
                    existingRegions.set(regionName, item);
                }
            });
            
            // If no wine type selected, show all regions normally
            if (!wineType) {
                regionItems.forEach(item => {
                    item.classList.remove('dimmed');
                });
                // If regions list is empty, populate it with all regions
                if (regionItems.length === 0) {
                    allRegions.forEach(region => {
                        const allWinesInRegion = window.wineApp.wines.filter(wine => {
                            const normalizedWineRegion = window.wineApp.normalizeRegionName(wine.region);
                            return normalizedWineRegion === region;
                        });
                        const count = allWinesInRegion.length;
                        
                        const regionItem = createRegionItem(region, count, true, null);
                        regionsList.appendChild(regionItem);
                    });
                }
                return;
            }
            
            // If regions list is empty, populate it with all regions first
            if (regionItems.length === 0) {
                allRegions.forEach(region => {
                    const filteredWines = window.wineApp.wines.filter(wine => {
                        const normalizedWineRegion = window.wineApp.normalizeRegionName(wine.region);
                        return normalizedWineRegion === region && window.wineApp.wineMatchesFamily(wine, wineType);
                    });
                    
                    const count = filteredWines.length;
                    const hasWines = count > 0;
                    
                    const regionItem = createRegionItem(region, count, hasWines, wineType);
                    regionsList.appendChild(regionItem);
                });
                return;
            }
            
            // Update existing region items
            existingRegions.forEach((item, regionName) => {
                const hasWines = regionHasWines(regionName, wineType);
                if (hasWines) {
                    item.classList.remove('dimmed');
                } else {
                    item.classList.add('dimmed');
                }
                // Update count for the selected wine type
                const filteredWines = window.wineApp.wines.filter(wine => {
                    const normalizedWineRegion = window.wineApp.normalizeRegionName(wine.region);
                    return normalizedWineRegion === regionName && window.wineApp.wineMatchesFamily(wine, wineType);
                });
                const countElement = item.querySelector('.region-item-count');
                if (countElement) {
                    countElement.textContent = `${filteredWines.length} wines`;
                }
            });
            
            // Add any missing regions
            allRegions.forEach(region => {
                if (!existingRegions.has(region)) {
                    const filteredWines = window.wineApp.wines.filter(wine => {
                        const normalizedWineRegion = window.wineApp.normalizeRegionName(wine.region);
                        return normalizedWineRegion === region && window.wineApp.wineMatchesFamily(wine, wineType);
                    });
                    
                    const count = filteredWines.length;
                    const hasWines = count > 0;
                    
                    const regionItem = createRegionItem(region, count, hasWines, wineType);
                    regionsList.appendChild(regionItem);
                }
            });
        }
        
        // Helper function to create a region item
        function createRegionItem(region, count, hasWines, wineType) {
            const regionItem = document.createElement('div');
            regionItem.className = 'region-item' + (hasWines ? '' : ' dimmed');
            regionItem.dataset.regionName = region;
            regionItem.innerHTML = `
                <div class="region-item-name">${region}</div>
                <div class="region-item-count">${count} wines</div>
            `;
            
            // Add click handler
            regionItem.addEventListener('click', function(e) {
                if (e) {
                    e.stopPropagation();
                    e.preventDefault();
                }
                
                if (hasWines) {
                    const clickedItem = e && e.currentTarget ? e.currentTarget : this;
                    const regionName = clickedItem.dataset.regionName || region;
                    
                    document.querySelectorAll('.region-item').forEach(item => {
                        item.classList.remove('active');
                    });
                    clickedItem.classList.add('active');
                    
                    // Select region on map (try both mobile and desktop maps)
                    if (mobileGeoJsonLayer) {
                        const mapRegionName = getMapRegionName(region);
                        mobileGeoJsonLayer.eachLayer(function(layer) {
                            if (layer._regionName === region || layer._regionName === mapRegionName) {
                                if (layer.fire) {
                                    layer.fire('click');
                                }
                            }
                        });
                    } else if (geoJsonLayer) {
                        const mapRegionName = getMapRegionName(region);
                        geoJsonLayer.eachLayer(function(layer) {
                            const mapRegion = layer.feature && layer.feature.properties.reg_name;
                            if (mapRegion === mapRegionName || mapRegion === region) {
                                if (layer.fire) {
                                    layer.fire('click');
                                }
                            }
                        });
                    }
                }
            });
            
            return regionItem;
        }
        // Show Mobile Wines for Region
        function showMobileWinesForRegion(regionName, wineType, searchTerm = '') {
            const mapView = document.getElementById('mobileMapView');
            const winesContainer = document.getElementById('mobileWinesCardsContainer');
            const winesGrid = document.getElementById('mobileWinesCardsGrid');
            const winesTitle = document.getElementById('mobileWinesCardsTitle');
            const backBtn = document.getElementById('mobileBackToMapBtn');
            const typeFiltersContainer = document.getElementById('mobileWinesCardsTypeFilters');
            if (!mapView || !winesContainer || !winesGrid || !window.wineApp) return;
            waitForWineApp(() => {
                if (!window.wineApp || !window.wineApp.wines) return;
                mapView.style.display = 'none';
                winesContainer.style.display = 'flex';
                // Add class to parent container to expand it fully
                const mapWinesContainer = document.getElementById('mobileMapWinesContainer');
                if (mapWinesContainer) {
                    mapWinesContainer.classList.add('wines-cards-expanded');
                }
                // Update height for iPhone Safari - multiple attempts to ensure it works
                setTimeout(() => {
                    updateMobileWinesCardsHeight();
                }, 50);
                setTimeout(() => {
                    updateMobileWinesCardsHeight();
                }, 200);
                setTimeout(() => {
                    updateMobileWinesCardsHeight();
                }, 500);
                if (winesTitle) {
                    const typeName = wineType ? getWineTypeName(wineType) : 'All';
                    winesTitle.textContent = `${regionName} - ${typeName}`;
                }
                
                // Get all wines for this region
                const regionWines = window.wineApp.wines.filter(wine => {
                    const normalizedWineRegion = window.wineApp.normalizeRegionName(wine.region);
                    const normalizedFilterRegion = window.wineApp.normalizeRegionName(regionName);
                    return normalizedWineRegion === normalizedFilterRegion;
                });
                
                // Extract unique wine types present in this region
                const wineTypes = ['ROSSO', 'BIANCO', 'ROSATO', 'ARANCIONE', 'BOLLICINE', 'NON ALCOLICO'];
                const availableTypes = wineTypes.filter(type => {
                    return regionWines.some(wine => window.wineApp.wineMatchesFamily(wine, type));
                });
                
                // Create type filter buttons
                if (typeFiltersContainer) {
                    typeFiltersContainer.innerHTML = '';
                    
                    // Add "All" button
                    const allButton = document.createElement('button');
                    allButton.className = 'mobile-wine-type-filter-btn';
                    allButton.textContent = 'All';
                    allButton.dataset.wineType = 'all';
                    if (!wineType) {
                        allButton.classList.add('active');
                    }
                    allButton.addEventListener('click', () => {
                        showMobileWinesForRegion(regionName, null, searchTerm);
                    });
                    typeFiltersContainer.appendChild(allButton);
                    
                    // Add buttons for each available type
                    availableTypes.forEach(type => {
                        const button = document.createElement('button');
                        button.className = 'mobile-wine-type-filter-btn';
                        button.textContent = getWineTypeName(type);
                        button.dataset.wineType = type;
                        if (wineType === type) {
                            button.classList.add('active');
                        }
                        button.addEventListener('click', () => {
                            showMobileWinesForRegion(regionName, type, searchTerm);
                        });
                        typeFiltersContainer.appendChild(button);
                    });
                }
                
                const filteredWines = regionWines.filter(wine => {
                    const matchesType = !wineType || window.wineApp.wineMatchesFamily(wine, wineType);
                    
                    // Apply search filter if search term is provided
                    const matchesSearch = !searchTerm || 
                        wine.wine_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        wine.region.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        (wine.varietals && wine.varietals.toLowerCase().includes(searchTerm.toLowerCase())) ||
                        (wine.wine_producer && wine.wine_producer.toLowerCase().includes(searchTerm.toLowerCase()));
                    
                    return matchesType && matchesSearch;
                });
                winesGrid.innerHTML = '';
                if (filteredWines.length === 0) {
                    const noResultsMsg = searchTerm 
                        ? `No wines found matching "${searchTerm}" for this region and type`
                        : 'No wines found for this region and type';
                    winesGrid.innerHTML = `<div style="color: rgba(245, 245, 240, 0.5); text-align: center; padding: 2rem;">${noResultsMsg}</div>`;
                    return;
                }
                
                // Raggruppa i vini per sub-categoria
                const groupedWines = groupWinesBySubcategory(filteredWines);
                renderGroupedWinesAsTable(groupedWines, winesGrid, wineType);
                if (backBtn) {
                    backBtn.onclick = () => {
                        mapView.style.display = 'flex';
                        winesContainer.style.display = 'none';
                        // Remove class when going back to map
                        const mapWinesContainer = document.getElementById('mobileMapWinesContainer');
                        if (mapWinesContainer) {
                            mapWinesContainer.classList.remove('wines-cards-expanded');
                        }
                        // Reset height when going back to map
                        winesContainer.style.height = '';
                        winesContainer.style.maxHeight = '';
                        winesContainer.style.minHeight = '';
                        // Update map height
                        setTimeout(() => {
                            updateMobileMapHeight();
                        }, 100);
                    };
                }
            });
        }
        
        // Show Mobile Wines Filtered by Varietal
        function showMobileWinesForVarietal(varietalName) {
            const mapView = document.getElementById('mobileMapView');
            const winesContainer = document.getElementById('mobileWinesCardsContainer');
            const winesGrid = document.getElementById('mobileWinesCardsGrid');
            const winesTitle = document.getElementById('mobileWinesCardsTitle');
            const backBtn = document.getElementById('mobileBackToMapBtn');
            const typeFiltersContainer = document.getElementById('mobileWinesCardsTypeFilters');
            if (!mapView || !winesContainer || !winesGrid || !window.wineApp) return;
            
            // Check dynamic mode status at function start
            const searchBarContainer = document.getElementById('mobileSearchBarContainer');
            const isDynamicMode = searchBarContainer && searchBarContainer.classList.contains('dynamic-mode-active');
            console.log('showMobileWinesForVarietal - Dynamic mode active:', isDynamicMode);
            waitForWineApp(() => {
                if (!window.wineApp || !window.wineApp.wines) return;
                mapView.style.display = 'none';
                winesContainer.style.display = 'flex';
                // Add class to parent container to expand it fully
                const mapWinesContainer = document.getElementById('mobileMapWinesContainer');
                if (mapWinesContainer) {
                    mapWinesContainer.classList.add('wines-cards-expanded');
                }
                // Update height for iPhone Safari
                setTimeout(() => {
                    updateMobileWinesCardsHeight();
                }, 100);
                if (winesTitle) {
                    winesTitle.textContent = varietalName;
                }
                
                // Get all wines for this varietal
                // Use the same logic as desktop: check if varietal appears as a complete varietal
                const varietalWines = window.wineApp.wines.filter(wine => {
                    if (!wine.varietals) return false;
                    // Split varietals by comma and check for exact match
                    const wineVarietals = wine.varietals.split(',').map(v => v.trim().toLowerCase());
                    const searchVarietal = varietalName.toLowerCase().trim();
                    // Check if the varietal appears as a complete varietal (exact match after splitting by comma)
                    return wineVarietals.some(v => v === searchVarietal);
                });
                
                // Extract unique wine types present for this varietal
                const wineTypes = ['ROSSO', 'BIANCO', 'ROSATO', 'ARANCIONE', 'BOLLICINE', 'NON ALCOLICO'];
                const availableTypes = wineTypes.filter(type => {
                    return varietalWines.some(wine => window.wineApp.wineMatchesFamily(wine, type));
                });
                
                // Create type filter buttons
                if (typeFiltersContainer) {
                    typeFiltersContainer.innerHTML = '';
                    
                    // Add "All" button
                    const allButton = document.createElement('button');
                    allButton.className = 'mobile-wine-type-filter-btn';
                    allButton.textContent = 'All';
                    allButton.dataset.wineType = 'all';
                    allButton.classList.add('active');
                    allButton.addEventListener('click', () => {
                        showMobileWinesForVarietal(varietalName);
                    });
                    typeFiltersContainer.appendChild(allButton);
                    
                    // Add buttons for each available type
                    availableTypes.forEach(type => {
                        const button = document.createElement('button');
                        button.className = 'mobile-wine-type-filter-btn';
                        button.textContent = getWineTypeName(type);
                        button.dataset.wineType = type;
                        button.addEventListener('click', () => {
                            showMobileWinesForVarietalWithType(varietalName, type);
                        });
                        typeFiltersContainer.appendChild(button);
                    });
                }
                
                winesGrid.innerHTML = '';
                if (varietalWines.length === 0) {
                    winesGrid.innerHTML = `<div style="color: rgba(245, 245, 240, 0.5); text-align: center; padding: 2rem;">No wines found for ${varietalName}</div>`;
                    return;
                }
                
                // Raggruppa i vini per sub-categoria
                const groupedWines = groupWinesBySubcategory(varietalWines);
                renderGroupedWinesAsTable(groupedWines, winesGrid);
                
                if (backBtn) {
                    backBtn.onclick = () => {
                        mapView.style.display = 'flex';
                        winesContainer.style.display = 'none';
                        // Remove class when going back to map
                        const mapWinesContainer = document.getElementById('mobileMapWinesContainer');
                        if (mapWinesContainer) {
                            mapWinesContainer.classList.remove('wines-cards-expanded');
                        }
                        // Reset height when going back to map
                        winesContainer.style.height = '';
                        winesContainer.style.maxHeight = '';
                        winesContainer.style.minHeight = '';
                        // Update map height
                        setTimeout(() => {
                            updateMobileMapHeight();
                        }, 100);
                    };
                }
            });
        }
        
        // Show Mobile Wines Filtered by Varietal and Type
        function showMobileWinesForVarietalWithType(varietalName, wineType) {
            const mapView = document.getElementById('mobileMapView');
            const winesContainer = document.getElementById('mobileWinesCardsContainer');
            const winesGrid = document.getElementById('mobileWinesCardsGrid');
            const winesTitle = document.getElementById('mobileWinesCardsTitle');
            const backBtn = document.getElementById('mobileBackToMapBtn');
            const typeFiltersContainer = document.getElementById('mobileWinesCardsTypeFilters');
            if (!mapView || !winesContainer || !winesGrid || !window.wineApp) return;
            waitForWineApp(() => {
                if (!window.wineApp || !window.wineApp.wines) return;
                mapView.style.display = 'none';
                winesContainer.style.display = 'flex';
                // Add class to parent container to expand it fully
                const mapWinesContainer = document.getElementById('mobileMapWinesContainer');
                if (mapWinesContainer) {
                    mapWinesContainer.classList.add('wines-cards-expanded');
                }
                // Update height for iPhone Safari
                setTimeout(() => {
                    updateMobileWinesCardsHeight();
                }, 100);
                if (winesTitle) {
                    const typeName = getWineTypeName(wineType);
                    winesTitle.textContent = `${varietalName} - ${typeName}`;
                }
                
                // Get all wines for this varietal
                // Use the same logic as desktop: check if varietal appears as a complete varietal
                const varietalWines = window.wineApp.wines.filter(wine => {
                    if (!wine.varietals) return false;
                    // Split varietals by comma and check for exact match
                    const wineVarietals = wine.varietals.split(',').map(v => v.trim().toLowerCase());
                    const searchVarietal = varietalName.toLowerCase().trim();
                    // Check if the varietal appears as a complete varietal (exact match after splitting by comma)
                    return wineVarietals.some(v => v === searchVarietal);
                });
                
                // Extract unique wine types present for this varietal
                const wineTypes = ['ROSSO', 'BIANCO', 'ROSATO', 'ARANCIONE', 'BOLLICINE', 'NON ALCOLICO'];
                const availableTypes = wineTypes.filter(type => {
                    return varietalWines.some(wine => window.wineApp.wineMatchesFamily(wine, type));
                });
                
                // Create type filter buttons
                if (typeFiltersContainer) {
                    typeFiltersContainer.innerHTML = '';
                    
                    // Add "All" button
                    const allButton = document.createElement('button');
                    allButton.className = 'mobile-wine-type-filter-btn';
                    allButton.textContent = 'All';
                    allButton.dataset.wineType = 'all';
                    allButton.addEventListener('click', () => {
                        showMobileWinesForVarietal(varietalName);
                    });
                    if (!wineType) {
                        allButton.classList.add('active');
                    }
                    typeFiltersContainer.appendChild(allButton);
                    
                    // Add buttons for each available type
                    availableTypes.forEach(type => {
                        const button = document.createElement('button');
                        button.className = 'mobile-wine-type-filter-btn';
                        button.textContent = getWineTypeName(type);
                        button.dataset.wineType = type;
                        if (wineType === type) {
                            button.classList.add('active');
                        }
                        button.addEventListener('click', () => {
                            showMobileWinesForVarietalWithType(varietalName, type);
                        });
                        typeFiltersContainer.appendChild(button);
                    });
                }
                
                // Filter by type
                const filteredWines = varietalWines.filter(wine => {
                    return window.wineApp.wineMatchesFamily(wine, wineType);
                });
                
                winesGrid.innerHTML = '';
                if (filteredWines.length === 0) {
                    winesGrid.innerHTML = `<div style="color: rgba(245, 245, 240, 0.5); text-align: center; padding: 2rem;">No wines found for ${varietalName} - ${getWineTypeName(wineType)}</div>`;
                    return;
                }
                
                // Raggruppa i vini per sub-categoria
                const groupedWines = groupWinesBySubcategory(filteredWines);
                renderGroupedWinesAsTable(groupedWines, winesGrid, wineType);
                
                if (backBtn) {
                    backBtn.onclick = () => {
                        mapView.style.display = 'flex';
                        winesContainer.style.display = 'none';
                        // Remove class when going back to map
                        const mapWinesContainer = document.getElementById('mobileMapWinesContainer');
                        if (mapWinesContainer) {
                            mapWinesContainer.classList.remove('wines-cards-expanded');
                        }
                        // Reset height when going back to map
                        winesContainer.style.height = '';
                        winesContainer.style.maxHeight = '';
                        winesContainer.style.minHeight = '';
                        // Update map height
                        setTimeout(() => {
                            updateMobileMapHeight();
                        }, 100);
                    };
                }
            });
        }
        
        // Get Wine Type Name
        function getWineTypeName(type) {
            const names = {
                'ROSSO': 'Red Wines',
                'BIANCO': 'White Wines',
                'ROSATO': 'Rosé Wines',
                'ARANCIONE': 'Orange Wines',
                'BOLLICINE': 'Sparkling',
                'NON ALCOLICO': 'Non-Alcoholic'
            };
            return names[type] || 'All Wines';
        }
        
        function extractDenominationLabel(vintage) {
            if (!vintage) return '';
            const match = vintage.match(/\b(DOCG|DOC|IGT)\b/i);
            return match ? match[1].toUpperCase() : '';
        }
        
        function formatWineMetaLabel(vintage, denomination) {
            const parts = [];
            if (vintage && vintage !== 'N/A') {
                parts.push(vintage);
            }
            if (denomination) {
                parts.push(denomination);
            }
            return parts.length ? ` (${parts.join(' ')})` : '';
        }
        
        function buildWineMetaHtml(vintage, denomination) {
            const vintageHtml = vintage && vintage !== 'N/A'
                ? `<div class="mobile-wine-card-grid-vintage">${vintage}</div>`
                : '';
            const denominationHtml = denomination
                ? `<div class="mobile-wine-card-grid-denomination">${denomination}</div>`
                : '';
            return `<div class="mobile-wine-card-grid-meta">${vintageHtml}${denominationHtml}</div>`;
        }

        function formatWineDenominationDisplay(vintage, denomination) {
            const parts = [];
            if (vintage && vintage !== 'N/A') {
                parts.push(vintage);
            }
            if (denomination) {
                parts.push(denomination);
            }
            return parts.join(' ');
        }

        /** Short gustatory/palate preview for list/card (max ~100 chars). Prefer tasting_notes.gustatory, else body, else first sentence of description. */
        function getGustatoryPreview(wine) {
            const maxLen = 100;
            let text = '';
            if (wine.tasting_notes && wine.tasting_notes.gustatory && String(wine.tasting_notes.gustatory).trim()) {
                text = String(wine.tasting_notes.gustatory).trim();
            } else if (wine.body && String(wine.body).trim()) {
                text = String(wine.body).trim();
            } else if (wine.wine_description && String(wine.wine_description).trim()) {
                text = String(wine.wine_description).trim().split(/[.!?]/)[0] || '';
            }
            if (!text) return '';
            if (text.length <= maxLen) return text;
            return text.slice(0, maxLen).trim().replace(/\s+\S*$/, '') + '…';
        }

        function createMobileWinesTableElement() {
            const table = document.createElement('table');
            table.className = 'wines-table mobile-wines-table';
            const thead = document.createElement('thead');
            thead.innerHTML = `
                <tr>
                    <th>Wine</th>
                    <th>Producer</th>
                    <th>Denomination</th>
                    <th>Palate</th>
                    <th>Price</th>
                </tr>
            `;
            table.appendChild(thead);

            const tbody = document.createElement('tbody');
            table.appendChild(tbody);
            return { table, tbody };
        }

        function createMobileWinesTable(winesGrid) {
            winesGrid.innerHTML = '';
            winesGrid.classList.add('mobile-wines-cards-grid--table');
            const { table, tbody } = createMobileWinesTableElement();
            winesGrid.appendChild(table);
            return tbody;
        }

        function buildMobileWinesTableSectionRow(group) {
            const sectionRow = document.createElement('tr');
            sectionRow.className = 'mobile-wines-table-section';
            const description = group.subcategoryInfo?.description
                ? ` — ${group.subcategoryInfo.description}`
                : '';
            sectionRow.innerHTML = `
                <td colspan="5">${group.subcategoryInfo.name}${description}</td>
            `;
            return sectionRow;
        }

        function buildMobileWinesTableRow(wine, wineType) {
            const row = document.createElement('tr');
            row.className = 'wine-table-row';
            row.dataset.wineId = wine.wine_number;

            const price = wine.wine_price || wine.wine_price_bottle || wine.wine_price_glass || 'N/A';
            const vintage = wine.wine_vintage ? wine.wine_vintage.match(/\b(19|20)\d{2}\b/)?.[0] || 'N/A' : 'N/A';
            const denomination = extractDenominationLabel(wine.wine_vintage);
            const denominationDisplay = formatWineDenominationDisplay(vintage, denomination);
            const producer = wine.wine_producer || 'Unknown Producer';
            const wineName = (wine.wine_name || 'Unknown Wine').replace(/\s+100%$/, '').trim();
            const gustatory = getGustatoryPreview(wine);
            const gustatoryEscaped = gustatory.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

            row.innerHTML = `
                <td class="wine-table-name">${wineName}</td>
                <td class="wine-table-producer">${producer}</td>
                <td class="wine-table-denomination">${denominationDisplay}</td>
                <td class="wine-table-gustatory">${gustatoryEscaped}</td>
                <td class="wine-table-price">$${price}</td>
            `;

            row.addEventListener('click', () => {
                const params = new URLSearchParams();
                params.set('id', wine.wine_number);
                if (wineType) {
                    params.set('type', wineType);
                }
                params.set('from', 'index');
                window.location.href = `wine-details.html?${params.toString()}`;
            });

            return row;
        }

        function renderGroupedWinesAsTable(groupedWines, winesGrid, wineType) {
            const tbody = createMobileWinesTable(winesGrid);

            groupedWines.forEach(group => {
                if (group.subcategoryInfo) {
                    tbody.appendChild(buildMobileWinesTableSectionRow(group));
                }
                group.wines.forEach(wine => {
                    tbody.appendChild(buildMobileWinesTableRow(wine, wineType));
                });
            });
        }
        
        // Show Mobile Wines for Quick Search (Organic or Fancy)
        // Helper function to extract varietal name and percentage
        function parseVarietal(varietalString) {
            // Match patterns like "Sangiovese 80%", "Sangiovese", "Merlot 20%", "40% Bosco"
            const match = varietalString.match(/^(.+?)(?:\s+(\d+)%)?$/);
            if (match) {
                let name = match[1].trim();
                let percentage = match[2] ? parseInt(match[2]) : 100;
                // If name looks like "40% Bosco" (percentage first), extract grape and percentage
                const leadingPct = name.match(/^(\d+)%\s*(.+)$/);
                if (leadingPct) {
                    percentage = parseInt(leadingPct[1]);
                    name = leadingPct[2].trim();
                }
                return {
                    name,
                    percentage,
                    original: varietalString
                };
            }
            return {
                name: varietalString.trim(),
                percentage: 100,
                original: varietalString
            };
        }
        
        // Returns grape name only, without leading percentage (e.g. "40% Bosco" -> "Bosco")
        function grapeNameOnly(displayName) {
            if (!displayName || typeof displayName !== 'string') return displayName || '';
            return displayName.replace(/^\d+%\s*/, '').trim() || displayName;
        }
        
        // Show mobile varietals list for selection with tree structure
        function showMobileVarietalsList(searchTerm = '') {
            const mapView = document.getElementById('mobileMapView');
            const winesContainer = document.getElementById('mobileWinesCardsContainer');
            const winesGrid = document.getElementById('mobileWinesCardsGrid');
            const winesTitle = document.getElementById('mobileWinesCardsTitle');
            const typeFiltersContainer = document.getElementById('mobileWinesCardsTypeFilters');
            const winesHeader = document.querySelector('.mobile-wines-cards-header');
            const backBtn = document.getElementById('mobileBackToMapBtn');
            
            if (!mapView || !winesContainer || !winesGrid || !window.wineApp) return;
            
            waitForWineApp(() => {
                if (!window.wineApp || !window.wineApp.wines) return;
                winesGrid.classList.remove('mobile-wines-cards-grid--table');
                
                mapView.style.display = 'none';
                winesContainer.style.display = 'flex';
                const mapWinesContainer = document.getElementById('mobileMapWinesContainer');
                if (mapWinesContainer) {
                    mapWinesContainer.classList.add('wines-cards-expanded');
                }
                
                setTimeout(() => {
                    updateMobileWinesCardsHeight();
                }, 100);
                
                if (winesTitle) {
                    winesTitle.textContent = 'Select Varietal';
                }
                
                // Hide type filters for varietals selection
                if (typeFiltersContainer) {
                    typeFiltersContainer.innerHTML = '';
                    typeFiltersContainer.style.display = 'none';
                }
                
                // Setup back button
                if (backBtn) {
                    // Remove any existing listeners by cloning the button
                    const newBackBtn = backBtn.cloneNode(true);
                    backBtn.parentNode.replaceChild(newBackBtn, backBtn);
                    
                    newBackBtn.addEventListener('click', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        
                        // Remove class when going back to map
                        const mapWinesContainer = document.getElementById('mobileMapWinesContainer');
                        if (mapWinesContainer) {
                            mapWinesContainer.classList.remove('wines-cards-expanded');
                        }
                        
                        // Reset height when going back to map
                        winesContainer.style.height = '';
                        winesContainer.style.maxHeight = '';
                        
                        mapView.style.display = 'flex';
                        winesContainer.style.display = 'none';
                        
                        setTimeout(() => {
                            updateMobileMapHeight();
                        }, 100);
                        
                        // Reset varietals button active state
                        const varietalsBtn = document.getElementById('mobileQuickSearchVarietals');
                        if (varietalsBtn) {
                            varietalsBtn.classList.remove('active');
                        }
                    });
                }
                
                // Add search bar if not exists
                let searchContainer = winesHeader?.querySelector('.mobile-varietals-search-container');
                if (!searchContainer && winesHeader) {
                    searchContainer = document.createElement('div');
                    searchContainer.className = 'mobile-varietals-search-container';
                    searchContainer.style.cssText = 'padding: 1rem; background: rgba(0, 0, 0, 0.3); border-bottom: 1px solid rgba(212, 175, 55, 0.2);';
                    searchContainer.innerHTML = `
                        <div style="position: relative;">
                            <i class="fas fa-search" style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: rgba(245, 245, 240, 0.5);"></i>
                            <input type="text" 
                                   id="mobileVarietalsSearchInput" 
                                   class="mobile-search-input" 
                                   placeholder="Search varietals (e.g., sangiovese)" 
                                   autocomplete="off"
                                   style="width: 100%; padding: 0.75rem 0.75rem 0.75rem 2.5rem; border: 1px solid rgba(212, 175, 55, 0.3); background: rgba(0, 0, 0, 0.5); color: #F2F2F2; border-radius: 4px; font-family: var(--font-body, 'Cormorant', serif);">
                        </div>
                    `;
                    winesHeader.insertBefore(searchContainer, winesHeader.firstChild);
                    
                    // Add search event listener
                    const searchInput = searchContainer.querySelector('#mobileVarietalsSearchInput');
                    if (searchInput) {
                        searchInput.value = searchTerm;
                        searchInput.addEventListener('input', (e) => {
                            showMobileVarietalsList(e.target.value.toLowerCase().trim());
                        });
                    }
                } else if (searchContainer) {
                    const searchInput = searchContainer.querySelector('#mobileVarietalsSearchInput');
                    if (searchInput) {
                        searchInput.value = searchTerm;
                    }
                }
                
                // Extract all varietals with percentages from all wines
                const varietalMap = new Map(); // key: normalized name, value: { name, percentages: Map<percentage, count> }
                
                window.wineApp.wines.forEach(wine => {
                    if (wine.varietals) {
                        const varietals = wine.varietals.split(',').map(v => v.trim()).filter(v => v);
                        varietals.forEach(varietalStr => {
                            const parsed = parseVarietal(varietalStr);
                            const normalized = parsed.name.toLowerCase();
                            
                            if (!varietalMap.has(normalized)) {
                                varietalMap.set(normalized, {
                                    displayName: parsed.name,
                                    percentages: new Map() // percentage -> count
                                });
                            }
                            
                            const varietalData = varietalMap.get(normalized);
                            const currentCount = varietalData.percentages.get(parsed.percentage) || 0;
                            varietalData.percentages.set(parsed.percentage, currentCount + 1);
                        });
                    }
                });
                
                // Filter by search term
                let filteredVarietals = Array.from(varietalMap.entries());
                if (searchTerm) {
                    filteredVarietals = filteredVarietals.filter(([normalized, data]) => {
                        return normalized.includes(searchTerm) || 
                               data.displayName.toLowerCase().includes(searchTerm);
                    });
                }
                
                // Sort by name
                filteredVarietals.sort((a, b) => a[1].displayName.localeCompare(b[1].displayName));
                
                winesGrid.innerHTML = '';
                
                if (filteredVarietals.length === 0) {
                    winesGrid.innerHTML = `<div style="color: rgba(245, 245, 240, 0.5); text-align: center; padding: 2rem;">No varietals found${searchTerm ? ` matching "${searchTerm}"` : ''}</div>`;
                    return;
                }
                
                // Create varietal selection cards - show only 100% initially
                filteredVarietals.forEach(([normalized, varietalData]) => {
                    const percentages = Array.from(varietalData.percentages.entries())
                        .sort((a, b) => b[0] - a[0]); // Sort by percentage descending
                    
                    const has100 = percentages.some(([pct]) => pct === 100);
                    const totalCount = Array.from(varietalData.percentages.values())
                        .reduce((sum, count) => sum + count, 0);
                    
                    // Show only 100% varietals initially
                    if (has100) {
                        const count100 = varietalData.percentages.get(100) || 0;
                        const varietalCard = createVarietalCard(
                            varietalData.displayName,
                            count100,
                            normalized,
                            varietalData,
                            true // is100Percent
                        );
                        winesGrid.appendChild(varietalCard);
                    }
                });
            });
        }
        
        // Create varietal card with tree structure support (layout aligned with wine cards)
        function createVarietalCard(displayName, count, normalized, varietalData, is100Percent = false) {
            const varietalCard = document.createElement('div');
            varietalCard.className = 'mobile-wine-card-grid';
            varietalCard.style.cursor = 'pointer';
            varietalCard.dataset.varietalName = normalized;
            varietalCard.dataset.is100Percent = is100Percent;
            
            const nameOnly = grapeNameOnly(displayName);
            const countText = `${count} wine${count !== 1 ? 's' : ''}`;
            varietalCard.innerHTML = `
                <div class="mobile-wine-card-grid-header">
                    <div class="mobile-wine-card-grid-name">${nameOnly}</div>
                    <div style="display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0;">
                        <span class="mobile-wine-card-grid-producer" style="font-size: 0.85em; opacity: 0.9;">${countText}</span>
                        <i class="fas fa-chevron-right" style="color: var(--gold); font-size: 0.9rem;"></i>
                    </div>
                </div>
            `;
            
                    varietalCard.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        
                        if (is100Percent) {
                            // Show wines for 100% varietal, then show lower percentages below
                            showMobileWinesForVarietalWithTree(displayName, normalized, varietalData);
                        } else {
                            // Extract percentage from card and show wines for that specific percentage
                            const percentageMatch = displayName.match(/(\d+)%/);
                            const percentage = percentageMatch ? parseInt(percentageMatch[1]) : 100;
                            showMobileWinesForVarietalWithPercentage(displayName, normalized, percentage);
                        }
                    });
            
            return varietalCard;
        }
        
        // Show wines for varietal with specific percentage
        function showMobileWinesForVarietalWithPercentage(varietalName, normalized, percentage) {
            const mapView = document.getElementById('mobileMapView');
            const winesContainer = document.getElementById('mobileWinesCardsContainer');
            const winesGrid = document.getElementById('mobileWinesCardsGrid');
            const winesTitle = document.getElementById('mobileWinesCardsTitle');
            const backBtn = document.getElementById('mobileBackToMapBtn');
            
            if (!winesGrid || !window.wineApp) return;
            
            waitForWineApp(() => {
                if (!window.wineApp || !window.wineApp.wines) return;
                
                // Setup back button - go back to 100% view
                if (backBtn) {
                    // Remove any existing listeners by cloning the button
                    const newBackBtn = backBtn.cloneNode(true);
                    backBtn.parentNode.replaceChild(newBackBtn, backBtn);
                    
                    newBackBtn.addEventListener('click', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        
                        // Get varietal data to go back to tree view
                        const varietalMap = new Map();
                        window.wineApp.wines.forEach(wine => {
                            if (wine.varietals) {
                                const varietals = wine.varietals.split(',').map(v => v.trim()).filter(v => v);
                                varietals.forEach(varietalStr => {
                                    const parsed = parseVarietal(varietalStr);
                                    const norm = parsed.name.toLowerCase();
                                    if (norm === normalized) {
                                        if (!varietalMap.has(norm)) {
                                            varietalMap.set(norm, {
                                                displayName: parsed.name,
                                                percentages: new Map()
                                            });
                                        }
                                        const data = varietalMap.get(norm);
                                        const currentCount = data.percentages.get(parsed.percentage) || 0;
                                        data.percentages.set(parsed.percentage, currentCount + 1);
                                    }
                                });
                            }
                        });
                        
                        const varietalData = varietalMap.get(normalized);
                        if (varietalData) {
                            showMobileWinesForVarietalWithTree(varietalName, normalized, varietalData);
                        } else {
                            showMobileVarietalsList();
                        }
                    });
                }
                
                if (winesTitle) {
                    winesTitle.textContent = `${grapeNameOnly(varietalName)} ${percentage}%`;
                }
                
                // Get wines with this specific percentage
                const wines = window.wineApp.wines.filter(wine => {
                    if (!wine.varietals) return false;
                    const varietals = wine.varietals.split(',').map(v => v.trim());
                    return varietals.some(v => {
                        const parsed = parseVarietal(v);
                        return parsed.name.toLowerCase() === normalized && parsed.percentage === percentage;
                    });
                });
                
                winesGrid.innerHTML = '';
                
                if (wines.length === 0) {
                    winesGrid.innerHTML = `<div style="color: rgba(245, 245, 240, 0.5); text-align: center; padding: 2rem;">No wines found for ${grapeNameOnly(varietalName)} ${percentage}%</div>`;
                    return;
                }
                
                const groupedWines = groupWinesBySubcategory(wines);
                renderGroupedWinesAsTable(groupedWines, winesGrid);
            });
        }
        
        // Show wines for varietal with tree structure (100% wines + lower percentages)
        function showMobileWinesForVarietalWithTree(varietalName, normalized, varietalData) {
            const winesGrid = document.getElementById('mobileWinesCardsGrid');
            const winesTitle = document.getElementById('mobileWinesCardsTitle');
            const backBtn = document.getElementById('mobileBackToMapBtn');
            
            if (!winesGrid || !window.wineApp) return;
            
            waitForWineApp(() => {
                if (!window.wineApp || !window.wineApp.wines) return;
                winesGrid.classList.remove('mobile-wines-cards-grid--table');
                
                // Setup back button
                if (backBtn) {
                    // Remove any existing listeners by cloning the button
                    const newBackBtn = backBtn.cloneNode(true);
                    backBtn.parentNode.replaceChild(newBackBtn, backBtn);
                    
                    newBackBtn.addEventListener('click', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        
                        // Go back to varietals list
                        showMobileVarietalsList();
                    });
                }
                
                if (winesTitle) {
                    winesTitle.textContent = grapeNameOnly(varietalName);
                }
                
                // Get wines with 100% of this varietal
                const wines100 = window.wineApp.wines.filter(wine => {
                    if (!wine.varietals) return false;
                    const varietals = wine.varietals.split(',').map(v => v.trim());
                    return varietals.some(v => {
                        const parsed = parseVarietal(v);
                        return parsed.name.toLowerCase() === normalized && parsed.percentage === 100;
                    });
                });
                
                winesGrid.innerHTML = '';
                
                // Show wines at 100%
                if (wines100.length > 0) {
                    const header = document.createElement('div');
                    header.className = 'mobile-wine-card-grid-subcategory-header';
                    const grapeOnly = grapeNameOnly(varietalName);
                    header.innerHTML = `
                        <div class="mobile-wine-card-grid-subcategory">${grapeOnly}</div>
                        <div class="mobile-wine-card-grid-subcategory-desc">${wines100.length} wine${wines100.length !== 1 ? 's' : ''}</div>
                    `;
                    winesGrid.appendChild(header);
                    
                    const groupedWines = groupWinesBySubcategory(wines100);
                    const { table, tbody } = createMobileWinesTableElement();
                    winesGrid.appendChild(table);
                    groupedWines.forEach(group => {
                        if (group.subcategoryInfo) {
                            tbody.appendChild(buildMobileWinesTableSectionRow(group));
                        }
                        group.wines.forEach(wine => {
                            tbody.appendChild(buildMobileWinesTableRow(wine));
                        });
                    });
                }
                
                // Show lower percentages as tree structure
                const percentages = Array.from(varietalData.percentages.entries())
                    .filter(([pct]) => pct < 100)
                    .sort((a, b) => b[0] - a[0]); // Descending
                
                if (percentages.length > 0) {
                    const treeHeader = document.createElement('div');
                    treeHeader.className = 'mobile-wine-card-grid-subcategory-header';
                    treeHeader.style.marginTop = '2rem';
                    treeHeader.innerHTML = `
                        <div class="mobile-wine-card-grid-subcategory">Other Percentages</div>
                    `;
                    winesGrid.appendChild(treeHeader);
                    
                    const grapeOnly = grapeNameOnly(varietalName);
                    percentages.forEach(([percentage, count]) => {
                        const percentageCard = document.createElement('div');
                        percentageCard.className = 'mobile-wine-card-grid';
                        percentageCard.style.cursor = 'pointer';
                        percentageCard.dataset.varietalName = normalized;
                        percentageCard.dataset.percentage = percentage;
                        const countText = `${percentage}% · ${count} wine${count !== 1 ? 's' : ''}`;
                        percentageCard.innerHTML = `
                            <div class="mobile-wine-card-grid-header">
                                <div class="mobile-wine-card-grid-name">${grapeOnly}</div>
                                <div style="display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0;">
                                    <span class="mobile-wine-card-grid-producer" style="font-size: 0.85em; opacity: 0.9;">${countText}</span>
                                    <i class="fas fa-chevron-right" style="color: var(--gold); font-size: 0.9rem;"></i>
                                </div>
                            </div>
                        `;
                        
                        percentageCard.addEventListener('click', (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            showMobileWinesForVarietalWithPercentage(varietalName, normalized, percentage);
                        });
                        
                        winesGrid.appendChild(percentageCard);
                    });
                }
            });
        }
        
        // Helper to create mobile wine card
        function createMobileWineCard(wine) {
            const wineCard = document.createElement('div');
            wineCard.className = 'mobile-wine-card-grid';
            wineCard.dataset.wineId = wine.wine_number;
            
            const price = wine.wine_price || wine.wine_price_bottle || wine.wine_price_glass || 'N/A';
            const vintage = wine.wine_vintage ? wine.wine_vintage.match(/\b(19|20)\d{2}\b/)?.[0] || 'N/A' : 'N/A';
            const denomination = extractDenominationLabel(wine.wine_vintage);
            const metaHtml = buildWineMetaHtml(vintage, denomination);
            const producer = wine.wine_producer || 'Unknown Producer';
            const gustatory = getGustatoryPreview(wine);
            const gustatoryEscaped = gustatory.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
            // Remove trailing "100%" from wine name
            const wineName = (wine.wine_name || 'Unknown Wine').replace(/\s+100%$/, '').trim();
            const gustatoryBlock = gustatory ? `<div class="mobile-wine-card-grid-gustatory">${gustatoryEscaped}</div>` : '';
            wineCard.innerHTML = `
                <div class="mobile-wine-card-grid-header">
                    <div class="mobile-wine-card-grid-name">${wineName}</div>
                    <div class="mobile-wine-card-grid-price">$${price}</div>
                </div>
                <div class="mobile-wine-card-grid-info">
                    <div class="mobile-wine-card-grid-producer">${producer}</div>
                    ${metaHtml}
                </div>
                ${gustatoryBlock}
            `;
            
            wineCard.addEventListener('click', (e) => {
                wineCard.classList.add('selected');
                const rect = wineCard.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                wineCard.style.setProperty('--ripple-x', `${x}px`);
                wineCard.style.setProperty('--ripple-y', `${y}px`);
                setTimeout(() => {
                    const params = new URLSearchParams();
                    params.set('id', wine.wine_number);
                    params.set('from', 'index');
                    window.location.href = `wine-details.html?${params.toString()}`;
                }, 300);
            });
            
            return wineCard;
        }
        
        function showMobileWinesForQuickSearch(filterType) {
            const mapView = document.getElementById('mobileMapView');
            const winesContainer = document.getElementById('mobileWinesCardsContainer');
            const winesGrid = document.getElementById('mobileWinesCardsGrid');
            const winesTitle = document.getElementById('mobileWinesCardsTitle');
            const backBtn = document.getElementById('mobileBackToMapBtn');
            const typeFiltersContainer = document.getElementById('mobileWinesCardsTypeFilters');
            const winesHeader = document.querySelector('.mobile-wines-cards-header');
            
            if (!mapView || !winesContainer || !winesGrid || !window.wineApp) return;
            
            waitForWineApp(() => {
                if (!window.wineApp || !window.wineApp.wines) return;
                
                mapView.style.display = 'none';
                winesContainer.style.display = 'flex';
                // Add class to parent container to expand it fully
                const mapWinesContainer = document.getElementById('mobileMapWinesContainer');
                if (mapWinesContainer) {
                    mapWinesContainer.classList.add('wines-cards-expanded');
                }
                
                setTimeout(() => {
                    updateMobileWinesCardsHeight();
                }, 100);
                
                if (winesTitle) {
                    if (filterType === 'organic') {
                        winesTitle.textContent = 'Organic Wines';
                    } else if (filterType === 'fancy') {
                        winesTitle.textContent = 'Feeling Fancy';
                    }
                }

                // Remove existing organic description if any
                const existingDescription = winesHeader?.querySelector('.mobile-wines-cards-organic-description');
                if (existingDescription) {
                    existingDescription.remove();
                }

                // Add organic description in header if filterType is organic
                if (filterType === 'organic' && winesHeader) {
                    const organicDescription = document.createElement('div');
                    organicDescription.className = 'mobile-wines-cards-organic-description';
                    organicDescription.innerHTML = `
                        <div class="mobile-wines-cards-organic-description-title">Organic Wine</div>
                        <div class="mobile-wines-cards-organic-description-text">Organic wines are made from grapes grown without synthetic pesticides, herbicides, or fertilizers. The winemaking process follows strict organic standards, ensuring a more natural and environmentally friendly product.</div>
                    `;
                    winesHeader.appendChild(organicDescription);
                }
                
                // Filter wines based on filter type
                let filteredWines = [];
                if (filterType === 'organic') {
                    filteredWines = window.wineApp.wines.filter(wine => {
                        return wine.organic === true;
                    });
                } else if (filterType === 'fancy') {
                    filteredWines = window.wineApp.wines.filter(wine => {
                        const price = parseFloat(wine.wine_price) || parseFloat(wine.wine_price_bottle) || parseFloat(wine.wine_price_glass) || 0;
                        return price > 150;
                    });
                }
                
                // Extract unique wine types present in filtered wines
                const wineTypes = ['ROSSO', 'BIANCO', 'ROSATO', 'ARANCIONE', 'BOLLICINE', 'NON ALCOLICO'];
                const availableTypes = wineTypes.filter(type => {
                    return filteredWines.some(wine => window.wineApp.wineMatchesFamily(wine, type));
                });
                
                // Create type filter buttons
                if (typeFiltersContainer) {
                    typeFiltersContainer.innerHTML = '';
                    
                    // Add "All" button
                    const allButton = document.createElement('button');
                    allButton.className = 'mobile-wine-type-filter-btn';
                    allButton.textContent = 'All';
                    allButton.dataset.wineType = 'all';
                    allButton.classList.add('active');
                    allButton.addEventListener('click', () => {
                        showMobileWinesForQuickSearch(filterType);
                    });
                    typeFiltersContainer.appendChild(allButton);
                    
                    // Add buttons for each available type
                    availableTypes.forEach(type => {
                        const button = document.createElement('button');
                        button.className = 'mobile-wine-type-filter-btn';
                        button.textContent = getWineTypeName(type);
                        button.dataset.wineType = type;
                        button.addEventListener('click', () => {
                            showMobileWinesForQuickSearchWithType(filterType, type);
                        });
                        typeFiltersContainer.appendChild(button);
                    });
                }
                
                winesGrid.innerHTML = '';
                if (filteredWines.length === 0) {
                    const noResultsMsg = filterType === 'organic' 
                        ? 'No organic wines found'
                        : 'No wines found above $150';
                    winesGrid.innerHTML = `<div style="color: rgba(245, 245, 240, 0.5); text-align: center; padding: 2rem;">${noResultsMsg}</div>`;
                    return;
                }
                
                // Raggruppa i vini per sub-categoria
                const groupedWines = groupWinesBySubcategory(filteredWines);
                renderGroupedWinesAsTable(groupedWines, winesGrid);
                
                if (backBtn) {
                    backBtn.onclick = () => {
                        mapView.style.display = 'flex';
                        winesContainer.style.display = 'none';
                        // Remove class when going back to map
                        const mapWinesContainer = document.getElementById('mobileMapWinesContainer');
                        if (mapWinesContainer) {
                            mapWinesContainer.classList.remove('wines-cards-expanded');
                        }
                        // Remove organic description when going back
                        const winesHeader = document.querySelector('.mobile-wines-cards-header');
                        const existingDescription = winesHeader?.querySelector('.mobile-wines-cards-organic-description');
                        if (existingDescription) {
                            existingDescription.remove();
                        }
                        winesContainer.style.height = '';
                        winesContainer.style.maxHeight = '';
                        winesContainer.style.minHeight = '';
                        setTimeout(() => {
                            updateMobileMapHeight();
                        }, 100);
                    };
                }
            });
        }
        
        // Show Mobile Wines for Quick Search with Type Filter
        function showMobileWinesForQuickSearchWithType(filterType, wineType) {
            const mapView = document.getElementById('mobileMapView');
            const winesContainer = document.getElementById('mobileWinesCardsContainer');
            const winesGrid = document.getElementById('mobileWinesCardsGrid');
            const winesTitle = document.getElementById('mobileWinesCardsTitle');
            const backBtn = document.getElementById('mobileBackToMapBtn');
            const typeFiltersContainer = document.getElementById('mobileWinesCardsTypeFilters');
            const winesHeader = document.querySelector('.mobile-wines-cards-header');
            
            if (!mapView || !winesContainer || !winesGrid || !window.wineApp) return;
            
            waitForWineApp(() => {
                if (!window.wineApp || !window.wineApp.wines) return;
                
                mapView.style.display = 'none';
                winesContainer.style.display = 'flex';
                // Add class to parent container to expand it fully
                const mapWinesContainer = document.getElementById('mobileMapWinesContainer');
                if (mapWinesContainer) {
                    mapWinesContainer.classList.add('wines-cards-expanded');
                }
                
                setTimeout(() => {
                    updateMobileWinesCardsHeight();
                }, 100);
                
                if (winesTitle) {
                    const typeName = getWineTypeName(wineType);
                    if (filterType === 'organic') {
                        winesTitle.textContent = `Organic - ${typeName}`;
                    } else if (filterType === 'fancy') {
                        winesTitle.textContent = `Fellenig Fancy - ${typeName}`;
                    }
                }

                // Remove existing organic description if any
                const existingDescription = winesHeader?.querySelector('.mobile-wines-cards-organic-description');
                if (existingDescription) {
                    existingDescription.remove();
                }

                // Add organic description in header if filterType is organic
                if (filterType === 'organic' && winesHeader) {
                    const organicDescription = document.createElement('div');
                    organicDescription.className = 'mobile-wines-cards-organic-description';
                    organicDescription.innerHTML = `
                        <div class="mobile-wines-cards-organic-description-title">Organic Wine</div>
                        <div class="mobile-wines-cards-organic-description-text">Organic wines are made from grapes grown without synthetic pesticides, herbicides, or fertilizers. The winemaking process follows strict organic standards, ensuring a more natural and environmentally friendly product.</div>
                    `;
                    winesHeader.appendChild(organicDescription);
                    // Setup scroll listener to hide organic description when user scrolls
                    setTimeout(() => {
                        if (window.setupOrganicDescriptionScrollListener) {
                            window.setupOrganicDescriptionScrollListener();
                        }
                    }, 100);
                }
                
                // Filter wines based on filter type and wine type
                let filteredWines = [];
                if (filterType === 'organic') {
                    filteredWines = window.wineApp.wines.filter(wine => {
                        return wine.organic === true && window.wineApp.wineMatchesFamily(wine, wineType);
                    });
                } else if (filterType === 'fancy') {
                    filteredWines = window.wineApp.wines.filter(wine => {
                        const price = parseFloat(wine.wine_price) || parseFloat(wine.wine_price_bottle) || parseFloat(wine.wine_price_glass) || 0;
                        return price > 150 && window.wineApp.wineMatchesFamily(wine, wineType);
                    });
                }
                
                // Extract unique wine types present in filtered wines
                const wineTypes = ['ROSSO', 'BIANCO', 'ROSATO', 'ARANCIONE', 'BOLLICINE', 'NON ALCOLICO'];
                const availableTypes = wineTypes.filter(type => {
                    return filteredWines.some(wine => window.wineApp.wineMatchesFamily(wine, type));
                });
                
                // Create type filter buttons
                if (typeFiltersContainer) {
                    typeFiltersContainer.innerHTML = '';
                    
                    // Add "All" button
                    const allButton = document.createElement('button');
                    allButton.className = 'mobile-wine-type-filter-btn';
                    allButton.textContent = 'All';
                    allButton.dataset.wineType = 'all';
                    allButton.addEventListener('click', () => {
                        showMobileWinesForQuickSearch(filterType);
                    });
                    typeFiltersContainer.appendChild(allButton);
                    
                    // Add buttons for each available type
                    availableTypes.forEach(type => {
                        const button = document.createElement('button');
                        button.className = 'mobile-wine-type-filter-btn';
                        button.textContent = getWineTypeName(type);
                        button.dataset.wineType = type;
                        if (wineType === type) {
                            button.classList.add('active');
                        }
                        button.addEventListener('click', () => {
                            showMobileWinesForQuickSearchWithType(filterType, type);
                        });
                        typeFiltersContainer.appendChild(button);
                    });
                }
                
                winesGrid.innerHTML = '';
                if (filteredWines.length === 0) {
                    const noResultsMsg = filterType === 'organic' 
                        ? `No organic ${getWineTypeName(wineType).toLowerCase()} found`
                        : `No wines above $150 in ${getWineTypeName(wineType).toLowerCase()}`;
                    winesGrid.innerHTML = `<div style="color: rgba(245, 245, 240, 0.5); text-align: center; padding: 2rem;">${noResultsMsg}</div>`;
                    return;
                }
                
                // Raggruppa i vini per sub-categoria
                const groupedWines = groupWinesBySubcategory(filteredWines);
                renderGroupedWinesAsTable(groupedWines, winesGrid, wineType);
                
                if (backBtn) {
                    backBtn.onclick = () => {
                        mapView.style.display = 'flex';
                        winesContainer.style.display = 'none';
                        // Remove class when going back to map
                        const mapWinesContainer = document.getElementById('mobileMapWinesContainer');
                        if (mapWinesContainer) {
                            mapWinesContainer.classList.remove('wines-cards-expanded');
                        }
                        // Remove organic description when going back
                        const winesHeader = document.querySelector('.mobile-wines-cards-header');
                        const existingDescription = winesHeader?.querySelector('.mobile-wines-cards-organic-description');
                        if (existingDescription) {
                            existingDescription.remove();
                        }
                        winesContainer.style.height = '';
                        winesContainer.style.maxHeight = '';
                        winesContainer.style.minHeight = '';
                        setTimeout(() => {
                            updateMobileMapHeight();
                        }, 100);
                    };
                }
            });
        }
        
        // Mobile Search Bar Toggle
        function toggleMobileSearchBar() {
            const searchBarContainer = document.getElementById('mobileSearchBarContainer');
            const contentWrapper = document.querySelector('.content-wrapper');
            const regionBackground = document.getElementById('mobileRegionBackground');
            
            if (searchBarContainer) {
                const isVisible = searchBarContainer.classList.contains('visible');
                
                if (isVisible) {
                    searchBarContainer.classList.remove('visible');
                    if (contentWrapper) {
                        contentWrapper.classList.remove('mobile-search-active');
                    }
                    if (regionBackground) {
                        regionBackground.classList.remove('search-bar-active');
                    }
                } else {
                    searchBarContainer.classList.add('visible');
                    if (contentWrapper) {
                        contentWrapper.classList.add('mobile-search-active');
                    }
                    if (regionBackground) {
                        regionBackground.classList.add('search-bar-active');
                    }
                    // Focus on search input when opened
                    const searchInput = document.getElementById('mobileSearchInput');
                    if (searchInput) {
                        setTimeout(() => searchInput.focus(), 100);
                    }
                }
            }
        }
        // Sidebar interactions (DOM is ready at this point)
        // Mobile menu event listeners
        const mobileMenuBtn = document.getElementById('mobileMenuBtn');
        const mobileMenuClose = document.getElementById('mobileMenuClose');
        const mobileOverlay = document.getElementById('mobileOverlay');
        const mobileBackToCategories = document.getElementById('mobileBackToCategories');
        const mobileBackToRegions = document.getElementById('mobileBackToRegions');
        const mobileSearchBtn = document.getElementById('mobileSearchBtn');
        
        // Menu search popup event listeners
        const menuSearchTrigger = document.getElementById('mobileMenuSearchTrigger');
        const menuSearchPopup = document.getElementById('mobileMenuSearchPopup');
        const menuSearchPopupClose = document.getElementById('mobileMenuSearchPopupClose');
        const menuSearchPopupOverlay = document.getElementById('mobileMenuSearchPopupOverlay');
        const menuSearchPopupOrganic = document.getElementById('mobileMenuSearchPopupOrganic');
        const menuSearchPopupFancy = document.getElementById('mobileMenuSearchPopupFancy');
        const menuQuickSearchOrganic = document.getElementById('mobileMenuQuickSearchOrganic');
        const menuQuickSearchFancy = document.getElementById('mobileMenuQuickSearchFancy');
        
        if (mobileMenuBtn) {
            mobileMenuBtn.addEventListener('click', toggleMobileMenu);
        }
        if (mobileMenuClose) {
            mobileMenuClose.addEventListener('click', closeMobileMenu);
        }
        if (mobileOverlay) {
            mobileOverlay.addEventListener('click', closeMobileMenu);
        }
        
        // Menu search trigger
        if (menuSearchTrigger) {
            menuSearchTrigger.addEventListener('click', openMobileMenuSearchPopup);
            
            // Also open popup when user tries to type in the readonly input
            const readonlyInput = menuSearchTrigger.querySelector('input[readonly]');
            if (readonlyInput) {
                readonlyInput.addEventListener('focus', openMobileMenuSearchPopup);
                readonlyInput.addEventListener('keydown', function(e) {
                    // Prevent any input and open popup instead
                    e.preventDefault();
                    openMobileMenuSearchPopup();
                });
            }
        }
        
        // Menu search popup close
        if (menuSearchPopupClose) {
            menuSearchPopupClose.addEventListener('click', closeMobileMenuSearchPopup);
        }
        
        if (menuSearchPopupOverlay) {
            menuSearchPopupOverlay.addEventListener('click', closeMobileMenuSearchPopup);
        }
        
        // Close popup with ESC key
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                const popup = document.getElementById('mobileMenuSearchPopup');
                if (popup && popup.style.display !== 'none') {
                    closeMobileMenuSearchPopup();
                }
            }
        });
        
        // Menu search popup quick buttons
        if (menuSearchPopupOrganic) {
            menuSearchPopupOrganic.addEventListener('click', function() {
                closeMobileMenuSearchPopup();
                closeMobileMenu();
                // Remove active from all buttons
                document.querySelectorAll('.mobile-quick-search-btn').forEach(btn => {
                    btn.classList.remove('active');
                });
                // Activate and trigger search
                if (menuQuickSearchOrganic) {
                    menuQuickSearchOrganic.classList.add('active');
                }
                showMobileWinesForQuickSearch('organic');
            });
        }
        
        if (menuSearchPopupFancy) {
            menuSearchPopupFancy.addEventListener('click', function() {
                closeMobileMenuSearchPopup();
                closeMobileMenu();
                // Remove active from all buttons
                document.querySelectorAll('.mobile-quick-search-btn').forEach(btn => {
                    btn.classList.remove('active');
                });
                // Activate and trigger search
                if (menuQuickSearchFancy) {
                    menuQuickSearchFancy.classList.add('active');
                }
                showMobileWinesForQuickSearch('fancy');
            });
        }
        
        // Menu quick search buttons (in menu, not popup)
        if (menuQuickSearchOrganic) {
            menuQuickSearchOrganic.addEventListener('click', function() {
                closeMobileMenu();
                // Remove active from all buttons
                document.querySelectorAll('.mobile-quick-search-btn').forEach(btn => {
                    btn.classList.remove('active');
                });
                // Activate and trigger search
                this.classList.add('active');
                showMobileWinesForQuickSearch('organic');
            });
        }
        
        if (menuQuickSearchFancy) {
            menuQuickSearchFancy.addEventListener('click', function() {
                closeMobileMenu();
                // Remove active from all buttons
                document.querySelectorAll('.mobile-quick-search-btn').forEach(btn => {
                    btn.classList.remove('active');
                });
                // Activate and trigger search
                this.classList.add('active');
                showMobileWinesForQuickSearch('fancy');
            });
        }
        
        // Setup search input in popup
        setupSearchInput('mobileMenuSearchPopupInput', 'mobileMenuSearchPopupAutocomplete', 'mobileMenuSearchPopupSuggestions', true);
        // Close menu with ESC key
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                const menu = document.getElementById('mobileSideMenu');
                if (menu && menu.classList.contains('open')) {
                    closeMobileMenu();
                }
            }
        });
        // Mobile search button is now hidden and disabled
        // if (mobileSearchBtn) {
        //     mobileSearchBtn.addEventListener('click', toggleMobileSearchBar);
        // }
        
        // Mobile search is now handled by setupSearchInput function above
        if (mobileBackToCategories) {
            mobileBackToCategories.addEventListener('click', () => {
                openMobileMenu();
                showMobileView('regions');
            });
        }
        if (mobileBackToRegions) {
            mobileBackToRegions.addEventListener('click', () => {
                if (currentMobileWineType) {
                    loadMobileRegions(currentMobileWineType);
                    showMobileView('regions');
                }
            });
        }
        // Load mobile menu categories when wineApp is ready
        // IMPORTANT: Only initialize mobile map on actual mobile devices (< 768px)
        // Tablets (768-1023px) should use desktop layout with #map
        waitForWineApp(() => {
            loadMobileMenuCategories();
            loadMobileWineTypeChips();
            
            // Check initial Dynamic Mode state and hide wine type buttons if not active
            const searchBarContainer = document.getElementById('mobileSearchBarContainer');
            const isDynamicModeInitiallyActive = searchBarContainer && searchBarContainer.classList.contains('dynamic-mode-active');
            if (!isDynamicModeInitiallyActive) {
                toggleWineTypeButtonsVisibility(false);
            }
            
            // Only initialize mobile map if NOT a tablet
            if (window.innerWidth < 768 && !isTabletDevice) {
                initializeMobileMap();
            }
        });
        
        // Note: initWineTypeFilters() is called globally at the end of the file
        // No need to call it here to avoid duplicate initialization
        // Back to map button
        const backToMapBtn = document.getElementById('backToMapBtn');
        if (backToMapBtn) {
            backToMapBtn.addEventListener('click', function(e) {
                e.preventDefault();
                backToMap();
            });
        }
        // getMapRegionName and regionHasWines are now global functions (defined above)
        // Helper function to get region data by name (handles variations)
        function getRegionData(regionName) {
            if (!regionName) return null;
            
            // Try direct match first
            if (regionData[regionName]) {
                return regionData[regionName];
            }
            
            // Try normalized version (remove special suffixes like "/Südtirol")
            const normalized = regionName.split('/')[0].trim();
            if (regionData[normalized]) {
                return regionData[normalized];
            }
            
            // Try case-insensitive match
            const lowerName = regionName.toLowerCase();
            for (const key in regionData) {
                if (key.toLowerCase() === lowerName || key.toLowerCase() === normalized.toLowerCase()) {
                    return regionData[key];
                }
            }
            
            return null;
        }
        
        // Expose getRegionData as global function so it can be used by showRegionInfo
        window.getRegionData = getRegionData;
        
        function onEachFeature(feature, layer) {
            // Use robust fallback like mobile version
            const regionName = feature.properties.reg_name || feature.properties.NAME || feature.properties.name || 'Unknown';
            layer._regionName = regionName;
            
            // Check if region has wines for current type (or all types if none selected)
            const hasWines = regionHasWines(regionName, currentWineType);
            const shouldEnable = hasWines || !currentWineType;
            
            // Set initial style based on wine availability (like mobile)
            if (!shouldEnable) {
                layer.setStyle({
                    color: '#666',
                    fillColor: '#333',
                    weight: 1.5,
                    fillOpacity: 0.05,
                    opacity: 0.5
                });
            }
            
            // Only add event handlers if we have region data
            if (getRegionData(regionName)) {
                // Add cursor pointer to indicate clickability
                layer.on({
                    mousemove: function(e) {
                        // Check dynamically if region has wines for current wine type
                        const rName = this._regionName || regionName;
                        const hasWinesForType = rName ? regionHasWines(rName, currentWineType) : false;
                        const canEnable = hasWinesForType || !currentWineType;
                        const isInteractive = this.options.interactive !== false;
                        
                        // Update tooltip position as mouse moves only if region is enabled
                        if (this !== selectedRegion && canEnable && isInteractive) {
                            showRegionTooltip(e, regionName);
                        }
                    },
                    mouseover: function(e) {
                        // Check dynamically if region has wines for current wine type
                        const rName = this._regionName || regionName;
                        const hasWinesForType = rName ? regionHasWines(rName, currentWineType) : false;
                        const canEnable = hasWinesForType || !currentWineType;
                        const isInteractive = this.options.interactive !== false;
                        
                        // Show region name tooltip only if region is enabled
                        if (canEnable && isInteractive) {
                            showRegionTooltip(e, regionName);
                        }
                        
                        if (this !== selectedRegion && canEnable && isInteractive) {
                            // Enhanced hover effect - brighter and more visible
                            this.setStyle({
                                weight: 3,
                                fillOpacity: 0.35,
                                fillColor: currentWineType ? currentColors.fill : '#D4AF37',
                                color: currentWineType ? currentColors.border : '#D4AF37',
                                opacity: 1,
                                dashArray: null
                            });
                            // Add a subtle glow effect
                            this.bringToFront();
                        }
                    },
                    mouseout: function(e) {
                        // Hide region name tooltip
                        hideRegionTooltip();
                        
                        // Check dynamically if region has wines for current wine type
                        const rName = this._regionName || regionName;
                        const hasWinesForType = rName ? regionHasWines(rName, currentWineType) : false;
                        const canEnable = hasWinesForType || !currentWineType;
                        const isInteractive = this.options.interactive !== false;
                        
                        if (this !== selectedRegion && canEnable && isInteractive) {
                            // Return to highlighted state if wine type is selected, otherwise use default
                            if (currentWineType && hasWinesForType) {
                                this.setStyle({
                                    color: currentColors.border,
                                    fillColor: currentColors.fill,
                                    weight: 2,
                                    fillOpacity: 0.3,
                                    opacity: 0.9,
                                    lineCap: 'round',
                                    lineJoin: 'round'
                                });
                            } else {
                                this.setStyle({
                                    weight: 1.5,
                                    fillOpacity: 0.08,
                                    fillColor: currentWineType ? currentColors.fill : '#D4AF37',
                                    color: currentWineType ? currentColors.border : '#D4AF37',
                                    opacity: 0.8
                                });
                            }
                        } else if (!canEnable || !isInteractive) {
                            // Region doesn't have wines - return to disabled state
                            this.setStyle({
                                color: '#666',
                                fillColor: '#333',
                                weight: 1.5,
                                fillOpacity: 0.05,
                                opacity: 0.5
                            });
                        }
                    },
                    click: function(e) {
                        // Prevent default map behavior (like mobile)
                        if (e.originalEvent) {
                            e.originalEvent.preventDefault();
                            e.originalEvent.stopPropagation();
                        }
                        
                        // Check dynamically if region has wines for current wine type
                        // Don't rely on closure variable which may be stale
                        const rName = this._regionName || regionName;
                        const hasWinesForType = rName ? regionHasWines(rName, currentWineType) : false;
                        const canEnable = hasWinesForType || !currentWineType;
                        
                        // Also check if layer interactions are disabled
                        const isInteractive = this.options.interactive !== false;
                        
                        // Only allow selection if region has wines and is interactive
                        if (canEnable && isInteractive) {
                            selectRegion(this, regionName);
                        }
                    }
                });
            }
        }
        function selectRegion(layer, regionName) {
            // Wait for wineApp to be ready (like mobile)
            if (!window.wineApp) {
                waitForWineApp(() => selectRegion(layer, regionName));
                return;
            }
            
            if (!geoJsonLayer) {
                console.warn('⚠️ geoJsonLayer is not available');
                return;
            }
            
            // Reset previously selected region (like mobile)
            if (selectedRegion && selectedRegion !== layer) {
                const hasWines = selectedRegion._regionName ? regionHasWines(selectedRegion._regionName, currentWineType) : false;
                if (hasWines || !currentWineType) {
                    selectedRegion.setStyle({
                        weight: 1.5,
                        fillOpacity: 0.08,
                        fillColor: currentWineType ? currentColors.fill : '#D4AF37',
                        color: currentWineType ? currentColors.border : '#D4AF37',
                        opacity: 0.8
                    });
                }
            }
            
            // Set new selected region
            selectedRegion = layer;
            layer.setStyle({
                weight: 4,
                fillOpacity: 0.5,
                fillColor: currentWineType ? currentColors.fill : '#D4AF37',
                color: currentWineType ? currentColors.border : '#D4AF37',
                opacity: 1,
                dashArray: '10, 5'
            });
            layer.bringToFront();
            
            // Show wines list directly
            console.log('✅ Region selected, showing wines list...');
            
            // Also highlight the region in the regions panel if it's open
            const regionsList = document.getElementById('regionsList');
            if (regionsList) {
                const regionItems = regionsList.querySelectorAll('.region-item');
                regionItems.forEach(item => {
                    const itemName = item.querySelector('.region-item-name').textContent;
                    if (itemName === regionName) {
                        document.querySelectorAll('.region-item').forEach(i => i.classList.remove('active'));
                        item.classList.add('active');
                    }
                });
            }
            
            // Show wines list directly
            if (typeof showWinesListForRegion === 'function') {
                showWinesListForRegion(regionName, currentWineType);
            }
        }
        
        // waitForWineApp is now a global function (defined above)
        
        function showWinesListForRegion(regionName, wineType) {
            console.log('🍷 showWinesListForRegion called with:', regionName, wineType);
            
            // Find exact region name from wines database to ensure correct matching
            let exactRegionName = regionName ? regionName.trim() : '';
            
            if (window.wineApp && window.wineApp.wines && exactRegionName) {
                // Try to find exact region name from wines database
                const regionSet = new Set();
                window.wineApp.wines.forEach(wine => {
                    if (wine.region) {
                        regionSet.add(wine.region.trim());
                    }
                });
                
                // Find matching region (case-insensitive)
                for (const region of regionSet) {
                    if (region.toLowerCase() === exactRegionName.toLowerCase()) {
                        exactRegionName = region;
                        break;
                    }
                }
            }
            
            console.log('📍 Using exact region name:', exactRegionName);
            
            const mapWrapper = document.getElementById('mapWrapper');
            const winesListContainer = document.getElementById('winesListContainer');
            const winesGridContainer = document.getElementById('winesGridContainer');
            const winesListTitle = document.getElementById('winesListTitle');
            const winesListSubtitle = document.getElementById('winesListSubtitle');
            
            console.log('📦 Elements found:', {
                mapWrapper: !!mapWrapper,
                winesListContainer: !!winesListContainer,
                winesGridContainer: !!winesGridContainer
            });
            
            if (!winesListContainer || !winesGridContainer) {
                console.error('❌ Missing required elements');
                return;
            }
            
            // Keep map visible underneath wines list as background
            if (mapWrapper) {
                console.log('🗺️ Keeping map visible as background');
                // Keep map visible but make it non-interactive
                mapWrapper.style.setProperty('display', 'flex', 'important');
                mapWrapper.style.setProperty('position', 'absolute', 'important');
                mapWrapper.style.setProperty('top', '0', 'important');
                mapWrapper.style.setProperty('left', '0', 'important');
                mapWrapper.style.setProperty('right', '0', 'important');
                mapWrapper.style.setProperty('bottom', '0', 'important');
                mapWrapper.style.setProperty('z-index', '0', 'important');
                mapWrapper.style.setProperty('pointer-events', 'none', 'important');
            }
            
            // Apply zoom to map on tablet when wines list opens (only on tablet: 820px-1023px)
            const isTablet = window.innerWidth >= 820 && window.innerWidth < 1024;
            if (isTablet && mapInstance && exactRegionName && geoJsonLayer) {
                console.log('📱 Tablet detected - applying zoom to region:', exactRegionName);
                
                // Store original zoom and center if not already stored
                if (originalMapZoom === null || originalMapCenter === null) {
                    originalMapZoom = mapInstance.getZoom();
                    originalMapCenter = mapInstance.getCenter();
                }
                
                // Find the layer for the selected region
                let targetLayer = null;
                geoJsonLayer.eachLayer(function(layer) {
                    const layerRegionName = layer._regionName || '';
                    // Try to match region name (case-insensitive, handle variations)
                    if (layerRegionName && (
                        layerRegionName.toLowerCase() === exactRegionName.toLowerCase() ||
                        layerRegionName.toLowerCase().includes(exactRegionName.toLowerCase()) ||
                        exactRegionName.toLowerCase().includes(layerRegionName.toLowerCase())
                    )) {
                        targetLayer = layer;
                    }
                });
                
                if (targetLayer) {
                    // Get bounds of the selected region
                    const bounds = targetLayer.getBounds();
                    
                    // Apply zoom - "quasi il doppio" means almost double zoom
                    // Current zoom is typically 5.8, so we want to zoom in significantly
                    // Using fitBounds with minimal padding to zoom in as much as possible
                    // Then optionally increase zoom level further
                    setTimeout(() => {
                        // Respect global max zoom limit (requested)
                        const maxZoomForRegion = 5.8;
                        
                        // First, fit bounds with minimal padding for maximum zoom
                        mapInstance.fitBounds(bounds, { 
                            padding: [10, 10], // Minimal padding for maximum zoom
                            maxZoom: maxZoomForRegion // Respect maxZoom limit (32 for tablets, 8 for others)
                        });
                        
                        // Then increase zoom level further (almost double)
                        const currentZoom = mapInstance.getZoom();
                        const targetZoom = Math.min(maxZoomForRegion, currentZoom * 1.8);
                        
                        if (targetZoom > currentZoom) {
                            mapInstance.setZoom(targetZoom, {
                                animate: true,
                                duration: 0.6 // Smooth animation
                            });
                        }
                        
                        console.log('✅ Zoom applied to region:', exactRegionName, 'from', currentZoom, 'to', targetZoom);
                    }, 100);
                } else {
                    console.warn('⚠️ Could not find layer for region:', exactRegionName);
                }
            }
            console.log('📋 Showing wines list container over map');
            // Show wines list as overlay above map
            winesListContainer.style.setProperty('display', 'flex', 'important');
            winesListContainer.style.setProperty('position', 'relative', 'important');
            winesListContainer.style.setProperty('width', '100%', 'important');
            winesListContainer.style.setProperty('height', '100%', 'important');
            winesListContainer.style.setProperty('flex', '1', 'important');
            winesListContainer.style.setProperty('z-index', '2', 'important');
            
            // Ensure wines grid container is visible
            if (winesGridContainer) {
                winesGridContainer.style.setProperty('display', 'flex', 'important');
                winesGridContainer.style.visibility = 'visible';
                winesGridContainer.style.opacity = '1';
                console.log('✅ Wines grid container displayed');
                console.log('📐 Container dimensions:', {
                    width: winesGridContainer.offsetWidth,
                    height: winesGridContainer.offsetHeight,
                    display: window.getComputedStyle(winesGridContainer).display,
                    visibility: window.getComputedStyle(winesGridContainer).visibility
                });
            }
            
            // Also ensure header is visible
            const winesListHeader = document.querySelector('.wines-list-header');
            if (winesListHeader) {
                winesListHeader.style.setProperty('display', 'flex', 'important');
            }
            
            // Set background image for the region
            const regionImages = {
                'TOSCANA': 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=1200',
                'PIEMONTE': 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200',
                'VENETO': 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200',
                'SICILIA': 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=1200',
                'LOMBARDIA': 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200',
                'EMILIA-ROMAGNA': 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200',
                'LAZIO': 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=1200',
                'CAMPANIA': 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=1200',
                'PUGLIA': 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=1200',
                'SARDEGNA': 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=1200',
                'FRIULI-VENEZIA GIULIA': 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200',
                'TRENTINO ALTO-ADIGE': 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200',
                'VALLE D\'AOSTA': 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200',
                'LE MARCHE': 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=1200',
                'UMBRIA': 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=1200',
                'ABRUZZO': 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=1200',
                'MOLISE': 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=1200',
                'BASILICATA': 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=1200',
                'CALABRIA': 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=1200',
                'LIGURIA': 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=1200'
            };
            
            // Use normalized region name to get image (use exact region name)
            const normalizedRegion = window.wineApp ? window.wineApp.normalizeRegionName(exactRegionName) : exactRegionName;
            const bgImage = regionImages[normalizedRegion] || 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200';
            
            // Create image element to test if image loads
            const testImg = new Image();
            testImg.onload = function() {
                winesListContainer.style.backgroundImage = `linear-gradient(180deg, rgba(26, 26, 26, 0.95) 0%, rgba(10, 10, 10, 0.98) 100%), url(${bgImage})`;
                winesListContainer.style.backgroundSize = 'cover';
                winesListContainer.style.backgroundPosition = 'center';
                winesListContainer.style.backgroundRepeat = 'no-repeat';
                winesListContainer.style.backgroundAttachment = 'fixed';
            };
            testImg.onerror = function() {
                // Fallback to gradient only if image fails
                winesListContainer.style.backgroundImage = 'linear-gradient(180deg, rgba(26, 26, 26, 0.98) 0%, rgba(10, 10, 10, 1) 100%)';
                winesListContainer.style.backgroundSize = 'cover';
                winesListContainer.style.backgroundPosition = 'center';
                winesListContainer.style.backgroundRepeat = 'no-repeat';
                winesListContainer.style.backgroundAttachment = 'fixed';
            };
            testImg.src = bgImage;
            
            // Update title and subtitle (use exact region name)
            if (winesListTitle) {
                winesListTitle.textContent = `${exactRegionName} Wines`;
            }
            if (winesListSubtitle) {
                winesListSubtitle.textContent = 'All Wine Types - Use filters below to filter by type';
            }
            
            // Show wine type filters and reset to "All"
            const winesListFilters = document.getElementById('winesListFilters');
            if (winesListFilters) {
                winesListFilters.style.display = 'flex';
                // Reset filter buttons to "All"
                const filterButtons = winesListFilters.querySelectorAll('.wine-type-filter-btn');
                filterButtons.forEach(btn => {
                    btn.classList.remove('active');
                    if (btn.dataset.wineType === 'all') {
                        btn.classList.add('active');
                    }
                });
                currentWineTypeFilter = 'all';
            }
            
            // Get search term from search input
            const searchInput = document.getElementById('desktopSearchInput');
            const searchTerm = searchInput ? searchInput.value.trim() : '';
            
            // Load wines for this region and type (use exact region name)
            if (!window.wineApp || !window.wineApp.wines || window.wineApp.wines.length === 0) {
                winesGridContainer.innerHTML = '<div style="color: rgba(245, 245, 240, 0.5); text-align: center; padding: 2rem;">Loading wines...</div>';
                waitForWineApp(() => {
                    if (window.wineApp && window.wineApp.wines && window.wineApp.wines.length > 0) {
                        loadWinesIntoGrid(exactRegionName, wineType, winesGridContainer, searchTerm);
                    } else {
                        winesGridContainer.innerHTML = '<div style="color: rgba(245, 245, 240, 0.5); text-align: center; padding: 2rem;">Unable to load wines. Please refresh the page.</div>';
                    }
                });
                return;
            }
            
            loadWinesIntoGrid(exactRegionName, wineType, winesGridContainer, searchTerm);
        }
        
        // Expose showWinesListForRegion as global function immediately after definition
        window.showWinesListForRegion = showWinesListForRegion;
        
        // Store current region and filter state
        let currentRegionForFilter = null;
        let currentWineTypeFilter = 'all';
        
        function loadWinesIntoGrid(regionName, wineType, container, searchTerm = '') {
            console.log('🍷 loadWinesIntoGrid called with:', regionName, wineType, searchTerm);
            
            // Store current region for filter updates
            currentRegionForFilter = regionName;
            currentWineTypeFilter = wineType || 'all';
            
            if (!window.wineApp || !window.wineApp.wines) {
                console.warn('⚠️ wineApp or wines not available');
                return;
            }
            
            console.log('📊 Total wines available:', window.wineApp.wines.length);
            
            // Filter wines by region, type, and search term
            const filteredWines = window.wineApp.wines.filter(wine => {
                const normalizedWineRegion = window.wineApp.normalizeRegionName(wine.region);
                const normalizedFilterRegion = window.wineApp.normalizeRegionName(regionName);
                const matchesRegion = normalizedWineRegion === normalizedFilterRegion;
                
                // Apply wine type filter (if not 'all')
                let matchesType = true;
                if (currentWineTypeFilter && currentWineTypeFilter !== 'all') {
                    matchesType = window.wineApp.wineMatchesFamily(wine, currentWineTypeFilter);
                }
                
                // Apply search filter if search term is provided
                const matchesSearch = !searchTerm || 
                    wine.wine_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    wine.region.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    (wine.varietals && wine.varietals.toLowerCase().includes(searchTerm.toLowerCase())) ||
                    (wine.wine_producer && wine.wine_producer.toLowerCase().includes(searchTerm.toLowerCase()));
                
                return matchesRegion && matchesType && matchesSearch;
            });
            
            console.log('✅ Filtered wines:', filteredWines.length);
            
            // Clear container
            container.innerHTML = '';
            
            if (filteredWines.length === 0) {
                console.warn('⚠️ No wines found for region:', regionName, 'type:', wineType);
                const noResultsMsg = searchTerm 
                    ? `No wines found matching "${searchTerm}" for this region and type`
                    : 'No wines found for this region and type';
                container.innerHTML = `<div style="color: rgba(245, 245, 240, 0.5); text-align: center; padding: 2rem;">${noResultsMsg}</div>`;
                return;
            }
            
            // Create table
            const table = document.createElement('table');
            table.className = 'wines-table';
            
            // Create table header
            const thead = document.createElement('thead');
            thead.innerHTML = `
                <tr>
                    <th>Tipo</th>
                    <th>Nome</th>
                    <th>Produttore</th>
                    <th>Denominazione</th>
                    <th>Prezzo</th>
                </tr>
            `;
            table.appendChild(thead);
            
            // Create table body
            const tbody = document.createElement('tbody');
            
            filteredWines.forEach(wine => {
                const row = document.createElement('tr');
                row.className = 'wine-table-row';
                row.dataset.wineId = wine.wine_number;
                row.dataset.wineType = wine.wine_type || '';
                
                const price = wine.wine_price || wine.wine_price_bottle || wine.wine_price_glass || 'N/A';
                const denomination = wine.wine_vintage || 'N/A';
                
                // Get wine type display name
                const wineTypeNames = {
                    'ROSSO': 'Red',
                    'BIANCO': 'White',
                    'ROSATO': 'Rosé',
                    'ARANCIONE': 'Orange',
                    'BOLLICINE': 'Sparkling',
                    'NON ALCOLICO': 'Non-Alc'
                };
                const wineTypeDisplay = wineTypeNames[wine.wine_type] || wine.wine_type || 'N/A';
                
                row.innerHTML = `
                    <td class="wine-table-type">${wineTypeDisplay}</td>
                    <td class="wine-table-name">${wine.wine_name || 'Unknown Wine'}</td>
                    <td class="wine-table-producer">${wine.wine_producer || 'Unknown Producer'}</td>
                    <td class="wine-table-denomination">${denomination}</td>
                    <td class="wine-table-price">$${price}</td>
                `;
                
                row.addEventListener('click', function() {
                    // Navigate to wine details page with from parameter
                    const params = new URLSearchParams();
                    params.set('id', wine.wine_number);
                    if (wineType) {
                        params.set('type', wineType);
                    }
                    params.set('from', 'index');
                    window.location.href = `wine-details.html?${params.toString()}`;
                });
                
                tbody.appendChild(row);
            });
            
            table.appendChild(tbody);
            container.appendChild(table);
            
            // Force container to be visible and scrollable
            container.style.setProperty('display', 'flex', 'important');
            container.style.setProperty('visibility', 'visible', 'important');
            container.style.setProperty('opacity', '1', 'important');
            
            // Ensure table is visible
            table.style.setProperty('display', 'table', 'important');
            table.style.setProperty('visibility', 'visible', 'important');
            table.style.setProperty('opacity', '1', 'important');
            
            console.log('✅ Table created with', filteredWines.length, 'rows');
            console.log('📋 Container element:', container);
            console.log('📊 Table element:', table);
            console.log('🔍 Container children:', container.children.length);
            console.log('🔍 Table visible:', window.getComputedStyle(table).display !== 'none');
            
            // Setup wine type filter buttons
            setupWineTypeFilters(container);
        }
        
        // Setup wine type filter buttons
        function setupWineTypeFilters(container) {
            const filterButtons = document.querySelectorAll('.wine-type-filter-btn');
            filterButtons.forEach(button => {
                button.addEventListener('click', function() {
                    // Update active state
                    filterButtons.forEach(btn => btn.classList.remove('active'));
                    this.classList.add('active');
                    
                    // Get selected wine type
                    const selectedType = this.dataset.wineType;
                    currentWineTypeFilter = selectedType;
                    
                    console.log('🍷 Filter changed to:', selectedType);
                    
                    // Reload wines with new filter
                    if (currentRegionForFilter) {
                        const searchInput = document.getElementById('desktopSearchInput');
                        const searchTerm = searchInput ? searchInput.value.trim() : '';
                        loadWinesIntoGrid(currentRegionForFilter, selectedType === 'all' ? null : selectedType, container, searchTerm);
                    }
                });
            });
        }
        
        // Expose loadWinesIntoGrid as global function for search functionality
        window.loadWinesIntoGrid = loadWinesIntoGrid;
        
        // Store current producer for filter updates
        let currentProducerForFilter = null;
        
        // Function to show wines list for a producer (similar to showWinesListForRegion)
        function showWinesListForProducer(producerName, wineType) {
            console.log('🍷 showWinesListForProducer called with:', producerName, wineType);
            
            const mapWrapper = document.getElementById('mapWrapper');
            const winesListContainer = document.getElementById('winesListContainer');
            const winesGridContainer = document.getElementById('winesGridContainer');
            const winesListTitle = document.getElementById('winesListTitle');
            const winesListSubtitle = document.getElementById('winesListSubtitle');
            
            if (!winesListContainer || !winesGridContainer) {
                console.error('❌ Missing required elements');
                return;
            }
            
            // Keep map visible underneath wines list as background
            if (mapWrapper) {
                mapWrapper.style.setProperty('display', 'flex', 'important');
                mapWrapper.style.setProperty('position', 'absolute', 'important');
                mapWrapper.style.setProperty('top', '0', 'important');
                mapWrapper.style.setProperty('left', '0', 'important');
                mapWrapper.style.setProperty('right', '0', 'important');
                mapWrapper.style.setProperty('bottom', '0', 'important');
                mapWrapper.style.setProperty('z-index', '0', 'important');
                mapWrapper.style.setProperty('pointer-events', 'none', 'important');
            }
            winesListContainer.style.setProperty('display', 'flex', 'important');
            winesListContainer.style.setProperty('position', 'relative', 'important');
            winesListContainer.style.setProperty('width', '100%', 'important');
            winesListContainer.style.setProperty('z-index', '2', 'important');
            winesListContainer.style.setProperty('height', '100%', 'important');
            winesListContainer.style.setProperty('flex', '1', 'important');
            
            // Set background image (generic wine background)
            winesListContainer.style.backgroundImage = 'linear-gradient(180deg, rgba(26, 26, 26, 0.95) 0%, rgba(10, 10, 10, 0.98) 100%), url(https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200)';
            winesListContainer.style.backgroundSize = 'cover';
            winesListContainer.style.backgroundPosition = 'center';
            winesListContainer.style.backgroundRepeat = 'no-repeat';
            winesListContainer.style.backgroundAttachment = 'fixed';
            
            // Ensure wines grid container is visible
            if (winesGridContainer) {
                winesGridContainer.style.setProperty('display', 'flex', 'important');
                winesGridContainer.style.visibility = 'visible';
                winesGridContainer.style.opacity = '1';
            }
            
            // Also ensure header is visible
            const winesListHeader = document.querySelector('.wines-list-header');
            if (winesListHeader) {
                winesListHeader.style.setProperty('display', 'flex', 'important');
            }
            
            // Find exact producer name from wines database (to handle case variations)
            let exactProducerName = producerName.trim();
            if (window.wineApp && window.wineApp.wines) {
                for (const wine of window.wineApp.wines) {
                    if (wine.wine_producer && wine.wine_producer.trim().toLowerCase() === producerName.toLowerCase().trim()) {
                        exactProducerName = wine.wine_producer.trim();
                        break;
                    }
                }
            }
            
            // Get producer information
            let producerDescription = '';
            if (window.WineriesDB && exactProducerName) {
                const winery = window.WineriesDB.findWinery(exactProducerName);
                if (winery) {
                    producerDescription = window.WineriesDB.getDescription(winery);
                }
            }
            
            // If no description from WineriesDB, try to get from first wine
            if (!producerDescription && window.wineApp && window.wineApp.wines) {
                const firstWine = window.wineApp.wines.find(w => 
                    w.wine_producer && w.wine_producer.trim().toLowerCase() === exactProducerName.toLowerCase()
                );
                if (firstWine && window.wineApp.getProducerDescription) {
                    producerDescription = window.wineApp.getProducerDescription(firstWine);
                }
            }
            
            // Update title and subtitle with producer info
            if (winesListTitle) {
                winesListTitle.textContent = exactProducerName;
            }
            if (winesListSubtitle) {
                if (producerDescription) {
                    winesListSubtitle.innerHTML = `<div style="margin-bottom: 1rem; padding: 1.5rem; background: rgba(212, 175, 55, 0.1); border-left: 3px solid var(--gold); border-radius: 5px; text-align: left; font-size: 1rem; line-height: 1.6; color: rgba(245, 245, 240, 0.9);">${producerDescription}</div>`;
                } else {
                    winesListSubtitle.textContent = 'All Wine Types - Use filters below to filter by type';
                }
            }
            
            // Show wine type filters and reset to "All"
            const winesListFilters = document.getElementById('winesListFilters');
            if (winesListFilters) {
                winesListFilters.style.display = 'flex';
                const filterButtons = winesListFilters.querySelectorAll('.wine-type-filter-btn');
                filterButtons.forEach(btn => {
                    btn.classList.remove('active');
                    if (btn.dataset.wineType === 'all') {
                        btn.classList.add('active');
                    }
                });
                currentWineTypeFilter = 'all';
            }
            
            // Load wines for this producer and type (use exact producer name)
            if (!window.wineApp || !window.wineApp.wines || window.wineApp.wines.length === 0) {
                winesGridContainer.innerHTML = '<div style="color: rgba(245, 245, 240, 0.5); text-align: center; padding: 2rem;">Loading wines...</div>';
                waitForWineApp(() => {
                    if (window.wineApp && window.wineApp.wines && window.wineApp.wines.length > 0) {
                        loadWinesIntoGridForProducer(exactProducerName, wineType, winesGridContainer);
                    } else {
                        winesGridContainer.innerHTML = '<div style="color: rgba(245, 245, 240, 0.5); text-align: center; padding: 2rem;">Unable to load wines. Please refresh the page.</div>';
                    }
                });
                return;
            }
            
            loadWinesIntoGridForProducer(exactProducerName, wineType, winesGridContainer);
        }
        
        // Function to load wines into grid filtered by producer
        function loadWinesIntoGridForProducer(producerName, wineType, container) {
            console.log('🍷 loadWinesIntoGridForProducer called with:', producerName, wineType);
            
            // Store current producer for filter updates
            currentProducerForFilter = producerName;
            currentWineTypeFilter = wineType || 'all';
            
            if (!window.wineApp || !window.wineApp.wines) {
                console.warn('⚠️ wineApp or wines not available');
                return;
            }
            
            // Filter wines by producer and type
            // First, find the exact producer name from the wines database to ensure correct matching
            const normalizedProducerName = producerName.trim();
            let exactProducerName = null;
            
            // Find exact producer name from wines (to handle case variations)
            for (const wine of window.wineApp.wines) {
                if (wine.wine_producer && wine.wine_producer.trim().toLowerCase() === normalizedProducerName.toLowerCase()) {
                    exactProducerName = wine.wine_producer.trim();
                    break;
                }
            }
            
            // If exact match not found, use the provided name
            const producerToMatch = exactProducerName || normalizedProducerName;
            
            const filteredWines = window.wineApp.wines.filter(wine => {
                // Match producer (case-insensitive, exact match)
                const wineProducer = wine.wine_producer ? wine.wine_producer.trim() : '';
                const matchesProducer = wineProducer.toLowerCase() === producerToMatch.toLowerCase();
                
                // Apply wine type filter (if not 'all')
                let matchesType = true;
                if (currentWineTypeFilter && currentWineTypeFilter !== 'all') {
                    matchesType = window.wineApp.wineMatchesFamily(wine, currentWineTypeFilter);
                }
                
                return matchesProducer && matchesType;
            });
            
            console.log('✅ Filtered wines:', filteredWines.length);
            
            // Clear container
            container.innerHTML = '';
            
            if (filteredWines.length === 0) {
                const noResultsMsg = 'No wines found for this producer and type';
                container.innerHTML = `<div style="color: rgba(245, 245, 240, 0.5); text-align: center; padding: 2rem;">${noResultsMsg}</div>`;
                return;
            }
            
            // Create table (same structure as loadWinesIntoGrid)
            const table = document.createElement('table');
            table.className = 'wines-table';
            
            const thead = document.createElement('thead');
            thead.innerHTML = `
                <tr>
                    <th>Tipo</th>
                    <th>Nome</th>
                    <th>Produttore</th>
                    <th>Denominazione</th>
                    <th>Prezzo</th>
                </tr>
            `;
            table.appendChild(thead);
            
            const tbody = document.createElement('tbody');
            
            filteredWines.forEach(wine => {
                const row = document.createElement('tr');
                row.className = 'wine-table-row';
                row.dataset.wineId = wine.wine_number;
                row.dataset.wineType = wine.wine_type || '';
                
                const price = wine.wine_price || wine.wine_price_bottle || wine.wine_price_glass || 'N/A';
                const denomination = wine.wine_vintage || 'N/A';
                
                const wineTypeNames = {
                    'ROSSO': 'Red',
                    'BIANCO': 'White',
                    'ROSATO': 'Rosé',
                    'ARANCIONE': 'Orange',
                    'BOLLICINE': 'Sparkling',
                    'NON ALCOLICO': 'Non-Alc'
                };
                const wineTypeDisplay = wineTypeNames[wine.wine_type] || wine.wine_type || 'N/A';
                
                row.innerHTML = `
                    <td class="wine-table-type">${wineTypeDisplay}</td>
                    <td class="wine-table-name">${wine.wine_name || 'Unknown Wine'}</td>
                    <td class="wine-table-producer">${wine.wine_producer || 'Unknown Producer'}</td>
                    <td class="wine-table-denomination">${denomination}</td>
                    <td class="wine-table-price">$${price}</td>
                `;
                
                row.addEventListener('click', function() {
                    const params = new URLSearchParams();
                    params.set('id', wine.wine_number);
                    if (wineType) {
                        params.set('type', wineType);
                    }
                    params.set('from', 'index');
                    window.location.href = `wine-details.html?${params.toString()}`;
                });
                
                tbody.appendChild(row);
            });
            
            table.appendChild(tbody);
            container.appendChild(table);
            
            container.style.setProperty('display', 'flex', 'important');
            container.style.setProperty('visibility', 'visible', 'important');
            container.style.setProperty('opacity', '1', 'important');
            
            table.style.setProperty('display', 'table', 'important');
            table.style.setProperty('visibility', 'visible', 'important');
            table.style.setProperty('opacity', '1', 'important');
            
            // Setup wine type filter buttons for producer
            setupWineTypeFiltersForProducer(container);
        }
        
        // Setup wine type filter buttons for producer
        function setupWineTypeFiltersForProducer(container) {
            const filterButtons = document.querySelectorAll('.wine-type-filter-btn');
            filterButtons.forEach(button => {
                // Remove existing listeners by cloning
                const newButton = button.cloneNode(true);
                button.parentNode.replaceChild(newButton, button);
                
                newButton.addEventListener('click', function() {
                    filterButtons.forEach(btn => btn.classList.remove('active'));
                    this.classList.add('active');
                    
                    const selectedType = this.dataset.wineType;
                    currentWineTypeFilter = selectedType;
                    
                    if (currentProducerForFilter) {
                        loadWinesIntoGridForProducer(currentProducerForFilter, selectedType === 'all' ? null : selectedType, container);
                    }
                });
            });
        }
        
        // Expose showWinesListForProducer as global function
        window.showWinesListForProducer = showWinesListForProducer;
        
        function backToMap() {
            const mapWrapper = document.getElementById('mapWrapper');
            const winesListContainer = document.getElementById('winesListContainer');
            
            // Hide wines list container completely
            if (winesListContainer) {
                winesListContainer.style.setProperty('display', 'none', 'important');
            }
            
            // Restore map wrapper to normal position (not absolute overlay)
            if (mapWrapper) {
                mapWrapper.style.setProperty('display', 'flex', 'important');
                mapWrapper.style.setProperty('position', 'relative', 'important');
                mapWrapper.style.removeProperty('top');
                mapWrapper.style.removeProperty('left');
                mapWrapper.style.removeProperty('right');
                mapWrapper.style.removeProperty('bottom');
                mapWrapper.style.setProperty('z-index', '1', 'important');
                mapWrapper.style.setProperty('pointer-events', 'auto', 'important');
                mapWrapper.style.setProperty('flex', '1', 'important');
                mapWrapper.style.setProperty('width', '100%', 'important');
                mapWrapper.style.setProperty('height', '100%', 'important');
            }
            
            // Hide region info
            const regionInfo = document.getElementById('regionInfo');
            if (regionInfo) {
                regionInfo.style.display = 'none';
            }
            
            // Restore original zoom and center on tablet (only if we zoomed in)
            const isTablet = window.innerWidth >= 820 && window.innerWidth < 1024;
            if (isTablet && mapInstance && originalMapZoom !== null && originalMapCenter !== null) {
                setTimeout(() => {
                    mapInstance.setView(originalMapCenter, originalMapZoom, {
                        animate: true,
                        duration: 0.6
                    });
                    console.log('✅ Map zoom restored to original:', originalMapZoom);
                }, 100);
            }
            
            // Reset selected region on map
            if (geoJsonLayer && selectedRegion) {
                geoJsonLayer.eachLayer(function(l) {
                    const regName = l._regionName;
                    const hasWines = regName ? regionHasWines(regName, currentWineType) : false;
                    
                    if (hasWines || !currentWineType) {
                        l.setStyle({
                            weight: 1.5,
                            fillOpacity: 0.08,
                            color: currentColors.border,
                            fillColor: currentColors.fill,
                            opacity: 0.8,
                            dashArray: null
                        });
                    } else {
                        l.setStyle({
                            weight: 1.5,
                            fillOpacity: 0.03,
                            color: '#666666',
                            fillColor: '#666666',
                            opacity: 0.5,
                            dashArray: '5, 5'
                        });
                    }
                });
                selectedRegion = null;
            }
        }
        // Store the pending region name to show wines list after closing
        let pendingRegionForWinesList = null;
        let pendingWineTypeForWinesList = null;

        function showRegionInfo(regionName, wineType = null) {
            const data = getRegionData(regionName);
            if (data) {
                const regionInfoElement = document.getElementById('regionInfo');
                if (!regionInfoElement) return;

                // Store region name for later use when closing
                pendingRegionForWinesList = regionName;
                pendingWineTypeForWinesList = wineType;

                // Update content
                document.getElementById('regionName').textContent = regionName;
                document.getElementById('regionCapital').textContent = data.capital;
                document.getElementById('regionPopulation').textContent = data.population;
                document.getElementById('regionArea').textContent = data.area;
                
                const factElement = document.getElementById('regionFact');
                const wineFactsElement = document.getElementById('regionWineFacts');
                
                if (factElement && data.fact) {
                    factElement.textContent = data.fact;
                }
                
                if (wineFactsElement && data.wineFacts) {
                    wineFactsElement.textContent = data.wineFacts;
                }
                
                // Show with animation
                regionInfoElement.style.display = 'block';
                // Trigger animation
                setTimeout(() => {
                    regionInfoElement.classList.add('show');
                }, 10);
            }
        }
        
        // Expose showRegionInfo as global function so it can be called from loadRegionsForWineType
        window.showRegionInfo = showRegionInfo;

        function closeRegionInfo() {
            const regionInfoElement = document.getElementById('regionInfo');
            if (!regionInfoElement) return;

            // Remove show class for fade out
            regionInfoElement.classList.remove('show');
            
            // Hide after animation
            setTimeout(() => {
                regionInfoElement.style.display = 'none';
                
                // If there's a pending region, show wines list now
                if (pendingRegionForWinesList) {
                    const regionName = pendingRegionForWinesList;
                    const wineType = pendingWineTypeForWinesList;
                    pendingRegionForWinesList = null;
                    pendingWineTypeForWinesList = null;
                    
                    console.log('✅ Showing wines list after closing region info:', regionName);
                    if (typeof showWinesListForRegion === 'function') {
                        showWinesListForRegion(regionName, wineType);
                    }
                }
            }, 400); // Match CSS transition duration
        }

        // Add event listener for close button (with retry if element not ready)
        function setupCloseButton() {
            const closeButton = document.getElementById('regionInfoClose');
            if (closeButton) {
                // Remove any existing listeners to avoid duplicates
                const newButton = closeButton.cloneNode(true);
                closeButton.parentNode.replaceChild(newButton, closeButton);
                
                newButton.addEventListener('click', function(e) {
                    e.stopPropagation();
                    e.preventDefault();
                    closeRegionInfo();
                });
            } else {
                // Retry if button not ready yet
                setTimeout(setupCloseButton, 100);
            }
        }
        setupCloseButton();

        // Mobile region info functions
        let pendingMobileRegionForWinesList = null;
        let pendingMobileWineTypeForWinesList = null;
        let pendingMobileSearchTerm = '';

        function showMobileRegionInfo(regionName, wineType = null) {
            const data = getRegionData(regionName);
            if (data) {
                const mobileRegionInfoElement = document.getElementById('mobileRegionInfo');
                if (!mobileRegionInfoElement) return;

                // Get search term from mobile search input if present
                const mobileSearchInput = document.getElementById('mobileSearchInput');
                const searchTerm = mobileSearchInput ? mobileSearchInput.value.trim() : '';
                
                // Store region name for later use when closing
                pendingMobileRegionForWinesList = regionName;
                pendingMobileWineTypeForWinesList = wineType;
                pendingMobileSearchTerm = searchTerm;

                // Update content
                document.getElementById('mobileRegionName').textContent = regionName;
                document.getElementById('mobileRegionCapital').textContent = data.capital;
                document.getElementById('mobileRegionPopulation').textContent = data.population;
                document.getElementById('mobileRegionArea').textContent = data.area;
                
                const factElement = document.getElementById('mobileRegionFact');
                const wineFactsElement = document.getElementById('mobileRegionWineFacts');
                
                if (factElement && data.fact) {
                    factElement.textContent = data.fact;
                }
                
                if (wineFactsElement && data.wineFacts) {
                    wineFactsElement.textContent = data.wineFacts;
                }
                
                // Show with animation
                mobileRegionInfoElement.style.display = 'block';
                // Trigger animation
                setTimeout(() => {
                    mobileRegionInfoElement.classList.add('show');
                }, 10);
            }
        }

        function closeMobileRegionInfo() {
            const mobileRegionInfoElement = document.getElementById('mobileRegionInfo');
            if (!mobileRegionInfoElement) return;

            // Remove show class for fade out
            mobileRegionInfoElement.classList.remove('show');
            
            // Hide after animation
            setTimeout(() => {
                mobileRegionInfoElement.style.display = 'none';
                
                // If there's a pending region, show wines list now
                if (pendingMobileRegionForWinesList) {
                    const regionName = pendingMobileRegionForWinesList;
                    const wineType = pendingMobileWineTypeForWinesList;
                    const searchTerm = pendingMobileSearchTerm;
                    pendingMobileRegionForWinesList = null;
                    pendingMobileWineTypeForWinesList = null;
                    pendingMobileSearchTerm = '';
                    
                    console.log('✅ Showing mobile wines list after closing region info:', regionName);
                    if (typeof showMobileWinesForRegion === 'function') {
                        showMobileWinesForRegion(regionName, wineType, searchTerm);
                    }
                }
            }, 400); // Match CSS transition duration
        }

        // Add event listener for mobile close button (with retry if element not ready)
        function setupMobileCloseButton() {
            const closeButton = document.getElementById('mobileRegionInfoClose');
            if (closeButton) {
                // Remove any existing listeners to avoid duplicates
                const newButton = closeButton.cloneNode(true);
                closeButton.parentNode.replaceChild(newButton, closeButton);
                
                newButton.addEventListener('click', function(e) {
                    e.stopPropagation();
                    e.preventDefault();
                    closeMobileRegionInfo();
                });
            } else {
                // Retry if button not ready yet
                setTimeout(setupMobileCloseButton, 100);
            }
        }
        setupMobileCloseButton();

        // Show region name tooltip on hover
        function showRegionTooltip(e, regionName) {
            const tooltip = document.getElementById('regionTooltip');
            if (!tooltip) return;
            
            tooltip.textContent = getItalianRegionNameForDisplay(regionName) || regionName;
            tooltip.style.display = 'block';
            
            // Position tooltip near cursor using map coordinates
            if (e && e.originalEvent) {
                const mapWrapper = document.getElementById('mapWrapper');
                if (mapWrapper) {
                    const rect = mapWrapper.getBoundingClientRect();
                    const offset = 15;
                    const x = e.originalEvent.clientX - rect.left;
                    const y = e.originalEvent.clientY - rect.top;
                    
                    // Center tooltip horizontally on cursor, position above cursor
                    tooltip.style.left = x + 'px';
                    tooltip.style.top = (y - tooltip.offsetHeight - offset) + 'px';
                }
            }
        }
        
        function hideRegionTooltip() {
            const tooltip = document.getElementById('regionTooltip');
            if (tooltip) {
                tooltip.style.display = 'none';
            }
        }
        // updateMapColors, showRegionsPanel, and loadRegionsForWineType are now global functions (defined above)
        function showWinesPanel(region, wineType) {
            currentSelectedRegion = region;
            const panel = document.getElementById('winesPanel');
            const title = document.getElementById('winesPanelTitle');
            const subtitle = document.getElementById('winesPanelSubtitle');
            const list = document.getElementById('winesList');
            
            if (!panel || !window.wineApp || !window.wineApp.wines) return;
            
            title.textContent = region;
            subtitle.textContent = wineType || 'Wines';
            
            // Filter wines by region and type
            const filteredWines = window.wineApp.wines.filter(wine => {
                const normalizedWineRegion = window.wineApp.normalizeRegionName(wine.region);
                const normalizedFilterRegion = window.wineApp.normalizeRegionName(region);
                const matchesRegion = normalizedWineRegion === normalizedFilterRegion;
                const matchesType = !wineType || window.wineApp.wineMatchesFamily(wine, wineType);
                return matchesRegion && matchesType;
            });
            
            // Clear and populate list
            list.innerHTML = '';
            
            if (filteredWines.length === 0) {
                list.innerHTML = '<div style="color: rgba(245, 245, 240, 0.5); text-align: center; padding: 2rem;">No wines found</div>';
                panel.classList.add('active');
                return;
            }
            
            filteredWines.forEach(wine => {
                const wineItem = document.createElement('div');
                wineItem.className = 'wine-item';
                
                const price = wine.wine_price || wine.wine_price_bottle || wine.wine_price_glass || 'N/A';
                const vintage = wine.wine_vintage ? wine.wine_vintage.match(/\b(19|20)\d{2}\b/)?.[0] || 'N/A' : 'N/A';
                
                wineItem.innerHTML = `
                    <div class="wine-item-name">${wine.wine_name || 'Unknown Wine'}</div>
                    <div class="wine-item-producer">${wine.wine_producer || 'Unknown Producer'}</div>
                    <div class="wine-item-details">
                        <span class="wine-item-vintage">${vintage}</span>
                        <span class="wine-item-price">$${price}</span>
                    </div>
                `;
                
                wineItem.addEventListener('click', function() {
                    // Navigate to wine details page with from parameter
                    const params = new URLSearchParams();
                    params.set('id', wine.wine_number);
                    if (wineType) {
                        params.set('type', wineType);
                    }
                    params.set('from', 'index');
                    window.location.href = `wine-details.html?${params.toString()}`;
                });
                
                list.appendChild(wineItem);
            });
            
            panel.classList.add('active');
            
            // Highlight region on map
            if (geoJsonLayer && getRegionData(region)) {
                geoJsonLayer.eachLayer(function(layer) {
                    if (layer.feature && layer.feature.properties.reg_name === region) {
                        selectRegion(layer, region);
                    }
                });
            }
        }
        // Update wine counts when wineApp is ready
        function updateWineCounts() {
            if (!window.wineApp || !window.wineApp.wines) return;
            
            document.querySelectorAll('.wine-card-sidebar').forEach(card => {
                const wineType = card.dataset.type;
                if (wineType) {
                    const count = window.wineApp.wines.filter(wine => {
                        return window.wineApp.wineMatchesFamily(wine, wineType);
                    }).length;
                    
                    const countElement = card.querySelector('.wine-card-count');
                    if (countElement) {
                        countElement.textContent = `${count} wines`;
                    }
                }
            });
        }
        // Wait for wineApp to be ready
        const checkWineApp = setInterval(() => {
            if (window.wineApp && window.wineApp.wines) {
                updateWineCounts();
                clearInterval(checkWineApp);
            }
        }, 500);
        
        // Function to update active filters badge
        function updateActiveFiltersBadge() {
            const badge = document.getElementById('activeFiltersBadge');
            if (!badge) return;
            
            const activeCard = document.querySelector('.wine-card-sidebar.active');
            const searchInput = document.getElementById('desktopSearchInput');
            const searchTerm = searchInput ? searchInput.value.trim() : '';
            
            const filters = [];
            if (activeCard) {
                const wineTypeNames = {
                    'ROSSO': 'Red',
                    'BIANCO': 'White',
                    'ROSATO': 'Rosé',
                    'ARANCIONE': 'Orange',
                    'BOLLICINE': 'Sparkling',
                    'NON ALCOLICO': 'Non-Alc'
                };
                const typeName = wineTypeNames[activeCard.dataset.type] || activeCard.dataset.type;
                filters.push(typeName);
            }
            if (searchTerm) {
                filters.push(`"${searchTerm}"`);
            }
            
            if (filters.length > 0) {
                badge.textContent = filters.join(' • ');
                badge.style.display = 'inline-flex';
            } else {
                badge.style.display = 'none';
            }
        }
        
        /* ==================== GLOBAL SEARCH SYSTEM ==================== */
        // Helper function to find exact producer match
        function findExactProducerMatch(searchTerm) {
            if (!window.wineApp || !window.wineApp.wines || !searchTerm) {
                return null;
            }
            
            const term = searchTerm.trim().toLowerCase();
            if (term.length < 2) {
                return null;
            }
            
            // Find exact producer match (case-insensitive)
            for (const wine of window.wineApp.wines) {
                if (wine.wine_producer && wine.wine_producer.trim().toLowerCase() === term) {
                    return wine.wine_producer.trim(); // Return exact producer name with original casing
                }
            }
            
            return null;
        }
        
        // Helper function to find exact region match
        function findExactRegionMatch(searchTerm) {
            if (!window.wineApp || !window.wineApp.wines || !searchTerm) {
                return null;
            }
            
            const term = searchTerm.trim().toLowerCase();
            if (term.length < 2) {
                return null;
            }
            
            // Find exact region match (case-insensitive, using normalizeRegionName if available)
            for (const wine of window.wineApp.wines) {
                if (wine.region) {
                    let wineRegion = wine.region.trim();
                    let searchRegion = term;
                    
                    // Use normalizeRegionName if available for better matching
                    if (window.wineApp.normalizeRegionName) {
                        const normalizedWineRegion = window.wineApp.normalizeRegionName(wineRegion);
                        const normalizedSearchRegion = window.wineApp.normalizeRegionName(searchTerm.trim());
                        if (normalizedWineRegion === normalizedSearchRegion) {
                            return wineRegion; // Return exact region name with original casing
                        }
                    } else {
                        // Fallback to simple case-insensitive comparison
                        if (wineRegion.toLowerCase() === term) {
                            return wineRegion;
                        }
                    }
                }
            }
            
            return null;
        }
        
        // Global search function - independent from filters
        function performGlobalSearch(searchTerm) {
            if (!window.wineApp || !window.wineApp.wines || !searchTerm) {
                return [];
            }
            
            const term = searchTerm.toLowerCase().trim();
            if (term.length < 2) {
                return [];
            }
            
            return window.wineApp.wines.filter(wine => {
                const matchesName = wine.wine_name && wine.wine_name.toLowerCase().includes(term);
                const matchesProducer = wine.wine_producer && wine.wine_producer.toLowerCase().includes(term);
                const matchesVarietal = wine.varietals && wine.varietals.toLowerCase().includes(term);
                const matchesRegion = wine.region && wine.region.toLowerCase().includes(term);
                const matchesDescription = wine.wine_description && wine.wine_description.toLowerCase().includes(term);
                
                return matchesName || matchesProducer || matchesVarietal || matchesRegion || matchesDescription;
            });
        }
        
        // Generate autocomplete suggestions
        function generateAutocompleteSuggestions(searchTerm) {
            if (!window.wineApp || !window.wineApp.wines || !searchTerm || searchTerm.length < 2) {
                return [];
            }
            
            const term = searchTerm.toLowerCase().trim();
            const suggestions = [];
            const seen = new Set();
            
            // Collect unique suggestions
            window.wineApp.wines.forEach(wine => {
                // Wine names
                if (wine.wine_name && wine.wine_name.toLowerCase().includes(term)) {
                    const key = `wine:${wine.wine_name}`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        const matchingWines = window.wineApp.wines.filter(w => w.wine_name === wine.wine_name);
                        const count = matchingWines.length;
                        // Get the first wine's ID for direct navigation
                        const firstWine = matchingWines[0];
                        const wineNumber = firstWine ? (firstWine.wine_number || firstWine.id || null) : null;
                        
                        if (wineNumber) {
                        suggestions.push({
                            type: 'wine',
                            text: wine.wine_name,
                            icon: '🍷',
                            count: count,
                                subtitle: wine.wine_producer || '',
                                wineNumber: wineNumber,
                                wineId: wineNumber
                        });
                        } else {
                            console.warn('⚠️ Wine number not found for wine:', wine.wine_name, firstWine);
                        }
                    }
                }
                
                // Producers
                if (wine.wine_producer && wine.wine_producer.toLowerCase().includes(term)) {
                    const key = `producer:${wine.wine_producer}`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        const matchingWines = window.wineApp.wines.filter(w => 
                            w.wine_producer && w.wine_producer === wine.wine_producer
                        );
                        const count = matchingWines.length;
                        
                        suggestions.push({
                            type: 'producer',
                            text: wine.wine_producer,
                            icon: '🏭',
                            count: count,
                            subtitle: `${count} wine${count !== 1 ? 's' : ''}`
                        });
                    }
                }
                
                // Varietals/Grapes
                if (wine.varietals && wine.varietals.toLowerCase().includes(term)) {
                    // Split varietals by comma and process each one
                    const varietals = wine.varietals.split(',').map(v => v.trim()).filter(v => v);
                    varietals.forEach(varietal => {
                        if (varietal.toLowerCase().includes(term)) {
                            const key = `varietal:${varietal}`;
                            if (!seen.has(key)) {
                                seen.add(key);
                                const matchingWines = window.wineApp.wines.filter(w => 
                                    w.varietals && w.varietals.toLowerCase().includes(varietal.toLowerCase())
                                );
                                const count = matchingWines.length;
                                
                                suggestions.push({
                                    type: 'varietal',
                                    text: varietal,
                                    icon: '🍇',
                                    count: count,
                                    subtitle: `${count} wine${count !== 1 ? 's' : ''}`
                                });
                            }
                        }
                    });
                }
            });
            
            // Sort by relevance (exact matches first, then by count)
            return suggestions.sort((a, b) => {
                const aExact = a.text.toLowerCase().startsWith(term);
                const bExact = b.text.toLowerCase().startsWith(term);
                if (aExact && !bExact) return -1;
                if (!aExact && bExact) return 1;
                return b.count - a.count;
            }).slice(0, 8); // Limit to 8 suggestions
        }
        
        // Display autocomplete suggestions
        function showAutocompleteSuggestions(searchTerm, dropdownId, suggestionsId) {
            const dropdown = document.getElementById(dropdownId);
            const suggestionsContainer = document.getElementById(suggestionsId);
            
            if (!dropdown || !suggestionsContainer) return;
            
            if (!searchTerm || searchTerm.length < 2) {
                dropdown.style.display = 'none';
                return;
            }
            
            const suggestions = generateAutocompleteSuggestions(searchTerm);
            
            if (suggestions.length === 0) {
                suggestionsContainer.innerHTML = `
                    <div class="autocomplete-suggestions-empty">
                        No suggestions found for "${searchTerm}"
                    </div>
                `;
                dropdown.style.display = 'block';
                return;
            }
            
            suggestionsContainer.innerHTML = suggestions.map((suggestion, index) => `
                <div class="autocomplete-suggestion" 
                     data-suggestion-type="${suggestion.type}" 
                     data-suggestion-text="${suggestion.text}" 
                     data-index="${index}"
                     ${suggestion.wineNumber ? `data-wine-number="${suggestion.wineNumber}"` : ''}
                     ${suggestion.wineId ? `data-wine-id="${suggestion.wineId}"` : ''}>
                    <div class="autocomplete-suggestion-icon">${suggestion.icon}</div>
                    <div class="autocomplete-suggestion-content">
                        <div class="autocomplete-suggestion-main">${highlightMatch(suggestion.text, searchTerm)}</div>
                        <div class="autocomplete-suggestion-sub">${suggestion.subtitle}</div>
                    </div>
                    <div class="autocomplete-suggestion-count">${suggestion.count}</div>
                </div>
            `).join('');
            
            dropdown.style.display = 'block';
            
            // Add click handlers
            suggestionsContainer.querySelectorAll('.autocomplete-suggestion').forEach(suggestionEl => {
                
                // Add touchstart handler for mobile devices
                suggestionEl.addEventListener('touchstart', function(e) {
                }, { passive: true });
                
                suggestionEl.addEventListener('click', function(e) {
                    
                    e.preventDefault();
                    e.stopPropagation();
                    
                    const suggestionType = this.dataset.suggestionType;
                    const wineNumber = this.dataset.wineNumber || this.dataset.wineId;
                    const text = this.dataset.suggestionText;
                    
                    console.log('🔍 Suggestion clicked:', { suggestionType, wineNumber, text });
                    
                    
                    // If it's a wine suggestion and we have a wine number, navigate directly to the wine page
                    if (suggestionType === 'wine' && wineNumber) {
                        console.log('🍷 Navigating to wine:', wineNumber);
                        
                        // Check if we're navigating from menu popup
                        const popupInput = document.getElementById('mobileMenuSearchPopupInput');
                        if (popupInput && dropdown.closest('#mobileMenuSearchPopup')) {
                            closeMobileMenuSearchPopup();
                            closeMobileMenu();
                        }
                        
                        // Navigate to wine details page
                        const wineDetailsUrl = `wine-details.html?id=${wineNumber}&from=search`;
                        window.location.href = wineDetailsUrl;
                        return;
                    }
                    
                    // For other types (producer, varietal/grape, region), perform search immediately
                    const searchInput = document.getElementById('desktopSearchInput') || 
                                       document.getElementById('mobileSearchInput') || 
                                       document.getElementById('mobileMenuSearchPopupInput');
                    
                    
                    if (searchInput) {
                        searchInput.value = text;
                        dropdown.style.display = 'none';
                        
                        // If searching from menu popup, close menu and popup
                        if (searchInput.id === 'mobileMenuSearchPopupInput') {
                            closeMobileMenuSearchPopup();
                            closeMobileMenu();
                        }
                        
                        // Perform search immediately without debounce
                        waitForWineApp(() => {
                            let results = [];
                            const term = text.toLowerCase().trim();
                            
                            if (!window.wineApp || !window.wineApp.wines) {
                                console.warn('⚠️ wineApp not ready for autocomplete search');
                                return;
                            }
                            
                            // Specialised behaviour so that:
                            // - clicking a producer suggestion shows producer info and ALL wines from that producer
                            // - clicking a region suggestion shows ALL wines from that region (same view as map click)
                            // - clicking a grape/varietal suggestion shows ALL wines containing that grape
                            const isMobile = searchInput.id === 'mobileSearchInput' || searchInput.id === 'mobileMenuSearchPopupInput';
                            
                            
                            if (suggestionType === 'producer') {
                                // For producer: show popup with all wines from that producer
                                if (isMobile) {
                                    // Mobile: show popup with producer wines
                                    showMobileProducerPopup(text.trim());
                                } else {
                                    // Desktop: use showWinesListForProducer
                                    if (typeof showWinesListForProducer === 'function') {
                                        showWinesListForProducer(text.trim(), null);
                                    } else {
                                        // Fallback to search results
                                        results = window.wineApp.wines.filter(w => 
                                            w.wine_producer && w.wine_producer.toLowerCase().includes(term)
                                        );
                                        displaySearchResults(text, results);
                                    }
                                }
                            } else if (suggestionType === 'region') {
                                // For region: use showWinesListForRegion (same view as map click)
                                // Find exact region name from wines database to ensure correct matching
                                let exactRegionName = text.trim();
                                
                                // Find exact region name from wines (to handle case variations)
                                if (window.wineApp && window.wineApp.wines) {
                                    for (const wine of window.wineApp.wines) {
                                        if (wine.region && wine.region.trim().toLowerCase() === text.trim().toLowerCase()) {
                                            exactRegionName = wine.region.trim();
                                            break;
                                        }
                                    }
                                }
                                
                                if (isMobile) {
                                    // Mobile: use search results display for now
                                    results = window.wineApp.wines.filter(w => 
                                        w.region && w.region.toLowerCase().includes(term)
                                    );
                                    displayMobileSearchResults(text, results);
                                } else {
                                    // Desktop: use showWinesListForRegion (check both window and local scope)
                                    // Wait for wineApp to be ready and function to be available
                                    waitForWineApp(() => {
                                        const showWinesFn = window.showWinesListForRegion;
                                        
                                        if (showWinesFn && typeof showWinesFn === 'function') {
                                            console.log('🗺️ Calling showWinesListForRegion with region:', exactRegionName);
                                            showWinesFn(exactRegionName, null);
                                        } else {
                                            console.warn('⚠️ showWinesListForRegion not available, using fallback');
                                            // Fallback to search results with normalized region matching
                                            if (window.wineApp && window.wineApp.wines) {
                                                results = window.wineApp.wines.filter(w => {
                                                    if (!w.region) return false;
                                                    const normalizedWineRegion = window.wineApp.normalizeRegionName(w.region);
                                                    const normalizedFilterRegion = window.wineApp.normalizeRegionName(exactRegionName);
                                                    return normalizedWineRegion === normalizedFilterRegion;
                                                });
                                                displaySearchResults(text, results);
                                            }
                                        }
                                    });
                                }
                            } else if (suggestionType === 'varietal') {
                                // For varietal: show search results
                                results = window.wineApp.wines.filter(w => 
                                    w.varietals && w.varietals.toLowerCase().includes(term)
                                );
                                if (isMobile) {
                                    displayMobileSearchResults(text, results);
                                } else {
                                    displaySearchResults(text, results);
                                }
                            } else {
                                // Fallback: generic global search (name, producer, varietal, region, description)
                                results = performGlobalSearch(text);
                                if (isMobile) {
                                    displayMobileSearchResults(text, results);
                                } else {
                                    displaySearchResults(text, results);
                                }
                            }
                        });
                    }
                });
            });
        }
        
        // Highlight matching text in suggestions
        function highlightMatch(text, searchTerm) {
            const regex = new RegExp(`(${searchTerm})`, 'gi');
            return text.replace(regex, '<mark style="background: rgba(212, 175, 55, 0.3); color: var(--gold);">$1</mark>');
        }
        
        // Display search results (desktop main search bar)
        function displaySearchResults(searchTerm, results) {
            const winesListContainer = document.getElementById('winesListContainer');
            const winesGridContainer = document.getElementById('winesGridContainer');
            const mapWrapper = document.getElementById('mapWrapper');
            
            if (!winesGridContainer) return;
            
            // Keep map visible underneath search results as background
            if (mapWrapper) {
                mapWrapper.style.setProperty('display', 'flex', 'important');
                mapWrapper.style.setProperty('position', 'absolute', 'important');
                mapWrapper.style.setProperty('top', '0', 'important');
                mapWrapper.style.setProperty('left', '0', 'important');
                mapWrapper.style.setProperty('right', '0', 'important');
                mapWrapper.style.setProperty('bottom', '0', 'important');
                mapWrapper.style.setProperty('z-index', '0', 'important');
                mapWrapper.style.setProperty('pointer-events', 'none', 'important');
            }
            if (winesListContainer) {
                winesListContainer.style.setProperty('display', 'flex', 'important');
                winesListContainer.style.setProperty('z-index', '2', 'important');
            }
            
            // Update title
            const winesListTitle = document.getElementById('winesListTitle');
            const winesListSubtitle = document.getElementById('winesListSubtitle');
            // Determine if this is a specific producer or grape search to better match user intent
            let displayResults = Array.isArray(results) ? [...results] : [];
            let contextLabel = '';
            
            if (window.wineApp && window.wineApp.wines && searchTerm) {
                const term = searchTerm.toLowerCase().trim();
                
                // Exact producer search: show all wines from that producer
                const producerMatches = window.wineApp.wines.filter(w =>
                    w.wine_producer && w.wine_producer.toLowerCase().trim() === term
                );
                
                // Exact grape/varietal search: show all wines containing that grape
                const varietalMatches = window.wineApp.wines.filter(w =>
                    w.varietals && w.varietals.toLowerCase().trim() === term
                );
                
                if (producerMatches.length > 0) {
                    displayResults = producerMatches;
                    contextLabel = 'producer';
                } else if (varietalMatches.length > 0) {
                    displayResults = varietalMatches;
                    contextLabel = 'grape';
                }
            }
            
            if (winesListTitle) {
                winesListTitle.textContent = contextLabel === 'producer'
                    ? `Producer: ${searchTerm}`
                    : contextLabel === 'grape'
                        ? `Grape: ${searchTerm}`
                        : `Search Results`;
            }
            if (winesListSubtitle) {
                winesListSubtitle.textContent = `${displayResults.length} wine${displayResults.length !== 1 ? 's' : ''} found for "${searchTerm}"`;
            }
            
            // Display results
            if (displayResults.length === 0) {
                winesGridContainer.innerHTML = `
                    <div style="color: rgba(245, 245, 240, 0.5); text-align: center; padding: 3rem;">
                        <i class="fas fa-search" style="font-size: 3rem; color: var(--gold); opacity: 0.3; margin-bottom: 1rem; display: block;"></i>
                        <p style="font-size: 1.1rem; margin: 0;">No wines found matching "${searchTerm}"</p>
                        <p style="font-size: 0.9rem; margin-top: 0.5rem; opacity: 0.7;">Try searching by wine name, producer, varietal, or region</p>
                    </div>
                `;
                return;
            }
            
            // Create table with results
            const table = document.createElement('table');
            table.className = 'wines-table';
            
            const thead = document.createElement('thead');
            thead.innerHTML = `
                <tr>
                    <th>Wine</th>
                    <th>Producer</th>
                    <th>Region</th>
                    <th>Varietal</th>
                    <th>Price</th>
                </tr>
            `;
            table.appendChild(thead);
            
            const tbody = document.createElement('tbody');
            displayResults.forEach(wine => {
                const row = document.createElement('tr');
                row.className = 'wine-table-row';
                row.dataset.wineId = wine.wine_number;
                
                const price = wine.wine_price || wine.wine_price_bottle || wine.wine_price_glass || 'N/A';
                
                row.innerHTML = `
                    <td class="wine-table-name">${wine.wine_name || 'Unknown Wine'}</td>
                    <td class="wine-table-producer">${wine.wine_producer || 'Unknown Producer'}</td>
                    <td class="wine-table-region">${wine.region || 'N/A'}</td>
                    <td class="wine-table-varietal">${wine.varietals || 'N/A'}</td>
                    <td class="wine-table-price">$${price}</td>
                `;
                
                row.addEventListener('click', function() {
                    const params = new URLSearchParams();
                    params.set('id', wine.wine_number);
                    params.set('from', 'search');
                    window.location.href = `wine-details.html?${params.toString()}`;
                });
                
                tbody.appendChild(row);
            });
            
            table.appendChild(tbody);
            winesGridContainer.innerHTML = '';
            winesGridContainer.appendChild(table);
        }
        
        // Helper function to setup search input with autocomplete
        function setupSearchInput(inputId, dropdownId, suggestionsId, isMobile = false) {
            const searchInput = document.getElementById(inputId);
            if (!searchInput) return;
            
            let searchTimeout = null;
            let selectedSuggestionIndex = -1;
            
            searchInput.addEventListener('input', function(e) {
                const searchTerm = e.target.value.trim();
                
                // Clear previous timeout
                if (searchTimeout) {
                    clearTimeout(searchTimeout);
                }
                
                // Add/remove active class for visual feedback
                if (searchTerm) {
                    this.classList.add('search-active');
                } else {
                    this.classList.remove('search-active');
                    const dropdown = document.getElementById(dropdownId);
                    if (dropdown) dropdown.style.display = 'none';
                    
                    // Show map again if search is cleared (desktop only)
                    if (!isMobile) {
                        const mapWrapper = document.getElementById('mapWrapper');
                        const winesListContainer = document.getElementById('winesListContainer');
                        if (mapWrapper && winesListContainer) {
                            mapWrapper.style.display = 'flex';
                            winesListContainer.style.display = 'none';
                        }
                    }
                }
                
                // Update active filters badge (desktop only)
                if (!isMobile && typeof updateActiveFiltersBadge === 'function') {
                    updateActiveFiltersBadge();
                }
                
                // Show autocomplete suggestions
                if (searchTerm.length >= 2) {
                    waitForWineApp(() => {
                        showAutocompleteSuggestions(searchTerm, dropdownId, suggestionsId);
                    });
                } else {
                    const dropdown = document.getElementById(dropdownId);
                    if (dropdown) dropdown.style.display = 'none';
                }
                
                // Perform search after user stops typing (debounce) – delay allows finishing typing
                searchTimeout = setTimeout(() => {
                    if (searchTerm.length >= 2) {
                        waitForWineApp(() => {
                            // Only show search results list here; producer/region views are opened
                            // when user selects a suggestion (click or Enter), not automatically
                            const results = performGlobalSearch(searchTerm);
                            if (isMobile) {
                                displayMobileSearchResults(searchTerm, results);
                            } else {
                                displaySearchResults(searchTerm, results);
                            }
                        });
                    }
                }, 1300);
            });
            
            // Keyboard navigation for autocomplete
            searchInput.addEventListener('keydown', function(e) {
                const dropdown = document.getElementById(dropdownId);
                const suggestions = dropdown ? dropdown.querySelectorAll('.autocomplete-suggestion') : [];
                
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    selectedSuggestionIndex = Math.min(selectedSuggestionIndex + 1, suggestions.length - 1);
                    updateSuggestionSelection(suggestions, selectedSuggestionIndex);
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    selectedSuggestionIndex = Math.max(selectedSuggestionIndex - 1, -1);
                    updateSuggestionSelection(suggestions, selectedSuggestionIndex);
                } else if (e.key === 'Enter' && selectedSuggestionIndex >= 0 && suggestions[selectedSuggestionIndex]) {
                    e.preventDefault();
                    const selectedSuggestion = suggestions[selectedSuggestionIndex];
                    const suggestionType = selectedSuggestion.dataset.suggestionType;
                    const wineNumber = selectedSuggestion.dataset.wineNumber || selectedSuggestion.dataset.wineId;
                    
                    // If it's a wine suggestion, navigate directly
                    if (suggestionType === 'wine' && wineNumber) {
                        // Close menu and popup if we're in menu search popup
                        if (inputId === 'mobileMenuSearchPopupInput') {
                            closeMobileMenuSearchPopup();
                            closeMobileMenu();
                        }
                        const wineDetailsUrl = `wine-details.html?id=${wineNumber}&from=search`;
                        window.location.href = wineDetailsUrl;
                        return;
                    }
                    
                    // Otherwise, click the suggestion (which will trigger search)
                    selectedSuggestion.click();
                } else if (e.key === 'Escape') {
                    this.value = '';
                    this.classList.remove('search-active');
                    if (dropdown) dropdown.style.display = 'none';
                    this.dispatchEvent(new Event('input'));
                }
            });
            
            // Close dropdown when clicking outside
            document.addEventListener('click', function(e) {
                if (!searchInput.contains(e.target) && 
                    !document.getElementById(dropdownId)?.contains(e.target)) {
                    const dropdown = document.getElementById(dropdownId);
                    if (dropdown) dropdown.style.display = 'none';
                }
            });
        }
        
        // Show mobile producer popup with all wines from that producer
        function showMobileProducerPopup(producerName) {
            
            const mapView = document.getElementById('mobileMapView');
            const winesContainer = document.getElementById('mobileWinesCardsContainer');
            const winesGrid = document.getElementById('mobileWinesCardsGrid');
            const winesTitle = document.getElementById('mobileWinesCardsTitle');
            const typeFiltersContainer = document.getElementById('mobileWinesCardsTypeFilters');
            const backBtn = document.getElementById('mobileBackToMapBtn');
            
            
            if (!mapView || !winesContainer || !winesGrid || !window.wineApp) {
                return;
            }
            
            waitForWineApp(() => {
                if (!window.wineApp || !window.wineApp.wines) return;
                
                // Hide map and show wines container
                mapView.style.display = 'none';
                winesContainer.style.display = 'flex';
                const mapWinesContainer = document.getElementById('mobileMapWinesContainer');
                if (mapWinesContainer) {
                    mapWinesContainer.classList.add('wines-cards-expanded');
                }
                
                setTimeout(() => {
                    updateMobileWinesCardsHeight();
                }, 100);
                
                if (winesTitle) {
                    winesTitle.textContent = producerName;
                }
                
                // Setup back button
                if (backBtn) {
                    // Remove any existing listeners by cloning the button
                    const newBackBtn = backBtn.cloneNode(true);
                    backBtn.parentNode.replaceChild(newBackBtn, backBtn);
                    
                    newBackBtn.addEventListener('click', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        
                        // Remove class when going back to map
                        if (mapWinesContainer) {
                            mapWinesContainer.classList.remove('wines-cards-expanded');
                        }
                        
                        // Reset height when going back to map
                        winesContainer.style.height = '';
                        winesContainer.style.maxHeight = '';
                        winesContainer.style.minHeight = '';
                        
                        mapView.style.display = 'flex';
                        winesContainer.style.display = 'none';
                        
                        // Clear search input
                        const searchInput = document.getElementById('mobileSearchInput');
                        if (searchInput) {
                            searchInput.value = '';
                        }
                        
                        // Update map height
                        setTimeout(() => {
                            updateMobileMapHeight();
                        }, 100);
                    });
                }
                
                // Get all wines from this producer (case-insensitive to handle data inconsistencies)
                const producerNameNorm = (producerName || '').trim().toLowerCase();
                const producerWines = window.wineApp.wines.filter(wine => {
                    return wine.wine_producer && wine.wine_producer.trim().toLowerCase() === producerNameNorm;
                });
                
                // Extract unique wine types present for this producer
                const wineTypes = ['ROSSO', 'BIANCO', 'ROSATO', 'ARANCIONE', 'BOLLICINE', 'NON ALCOLICO'];
                const availableTypes = wineTypes.filter(type => {
                    return producerWines.some(wine => window.wineApp.wineMatchesFamily(wine, type));
                });
                
                // Create type filter buttons
                if (typeFiltersContainer) {
                    typeFiltersContainer.innerHTML = '';
                    typeFiltersContainer.style.display = 'flex';
                    
                    // Add "All" button
                    const allButton = document.createElement('button');
                    allButton.className = 'mobile-wine-type-filter-btn';
                    allButton.textContent = 'All';
                    allButton.dataset.wineType = 'all';
                    allButton.classList.add('active');
                    allButton.addEventListener('click', () => {
                        showMobileProducerPopup(producerName);
                    });
                    typeFiltersContainer.appendChild(allButton);
                    
                    // Add buttons for each available type
                    availableTypes.forEach(type => {
                        const button = document.createElement('button');
                        button.className = 'mobile-wine-type-filter-btn';
                        button.textContent = getWineTypeName(type);
                        button.dataset.wineType = type;
                        button.addEventListener('click', () => {
                            showMobileProducerPopupWithType(producerName, type);
                        });
                        typeFiltersContainer.appendChild(button);
                    });
                }
                
                winesGrid.innerHTML = '';
                
                if (producerWines.length === 0) {
                    winesGrid.innerHTML = `<div style="color: rgba(245, 245, 240, 0.5); text-align: center; padding: 2rem;">No wines found for ${producerName}</div>`;
                    return;
                }
                
                // Group wines by subcategory
                const groupedWines = groupWinesBySubcategory(producerWines);
                renderGroupedWinesAsTable(groupedWines, winesGrid);
            });
        }
        
        // Show mobile producer popup filtered by wine type
        function showMobileProducerPopupWithType(producerName, wineType) {
            const mapView = document.getElementById('mobileMapView');
            const winesContainer = document.getElementById('mobileWinesCardsContainer');
            const winesGrid = document.getElementById('mobileWinesCardsGrid');
            const winesTitle = document.getElementById('mobileWinesCardsTitle');
            const typeFiltersContainer = document.getElementById('mobileWinesCardsTypeFilters');
            const backBtn = document.getElementById('mobileBackToMapBtn');
            
            if (!mapView || !winesContainer || !winesGrid || !window.wineApp) return;
            
            waitForWineApp(() => {
                if (!window.wineApp || !window.wineApp.wines) return;
                
                mapView.style.display = 'none';
                winesContainer.style.display = 'flex';
                const mapWinesContainer = document.getElementById('mobileMapWinesContainer');
                if (mapWinesContainer) {
                    mapWinesContainer.classList.add('wines-cards-expanded');
                }
                
                setTimeout(() => {
                    updateMobileWinesCardsHeight();
                }, 100);
                
                if (winesTitle) {
                    const typeName = getWineTypeName(wineType);
                    winesTitle.textContent = `${producerName} - ${typeName}`;
                }
                
                // Setup back button
                if (backBtn) {
                    const newBackBtn = backBtn.cloneNode(true);
                    backBtn.parentNode.replaceChild(newBackBtn, backBtn);
                    
                    newBackBtn.addEventListener('click', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        
                        if (mapWinesContainer) {
                            mapWinesContainer.classList.remove('wines-cards-expanded');
                        }
                        
                        winesContainer.style.height = '';
                        winesContainer.style.maxHeight = '';
                        winesContainer.style.minHeight = '';
                        
                        mapView.style.display = 'flex';
                        winesContainer.style.display = 'none';
                        
                        const searchInput = document.getElementById('mobileSearchInput');
                        if (searchInput) {
                            searchInput.value = '';
                        }
                        
                        setTimeout(() => {
                            updateMobileMapHeight();
                        }, 100);
                    });
                }
                
                // Get wines from this producer filtered by type
                const producerWines = window.wineApp.wines.filter(wine => {
                    const matchesProducer = wine.wine_producer && wine.wine_producer.trim() === producerName.trim();
                    const matchesType = window.wineApp.wineMatchesFamily(wine, wineType);
                    return matchesProducer && matchesType;
                });
                
                // Extract unique wine types
                const wineTypes = ['ROSSO', 'BIANCO', 'ROSATO', 'ARANCIONE', 'BOLLICINE', 'NON ALCOLICO'];
                const availableTypes = wineTypes.filter(type => {
                    return window.wineApp.wines.filter(w => 
                        w.wine_producer && w.wine_producer.trim() === producerName.trim()
                    ).some(wine => window.wineApp.wineMatchesFamily(wine, type));
                });
                
                // Create type filter buttons
                if (typeFiltersContainer) {
                    typeFiltersContainer.innerHTML = '';
                    typeFiltersContainer.style.display = 'flex';
                    
                    const allButton = document.createElement('button');
                    allButton.className = 'mobile-wine-type-filter-btn';
                    allButton.textContent = 'All';
                    allButton.dataset.wineType = 'all';
                    allButton.addEventListener('click', () => {
                        showMobileProducerPopup(producerName);
                    });
                    typeFiltersContainer.appendChild(allButton);
                    
                    availableTypes.forEach(type => {
                        const button = document.createElement('button');
                        button.className = 'mobile-wine-type-filter-btn';
                        button.textContent = getWineTypeName(type);
                        button.dataset.wineType = type;
                        if (wineType === type) {
                            button.classList.add('active');
                        }
                        button.addEventListener('click', () => {
                            showMobileProducerPopupWithType(producerName, type);
                        });
                        typeFiltersContainer.appendChild(button);
                    });
                }
                
                winesGrid.innerHTML = '';
                
                if (producerWines.length === 0) {
                    winesGrid.innerHTML = `<div style="color: rgba(245, 245, 240, 0.5); text-align: center; padding: 2rem;">No ${getWineTypeName(wineType)} wines found for ${producerName}</div>`;
                    return;
                }
                
                const groupedWines = groupWinesBySubcategory(producerWines);
                renderGroupedWinesAsTable(groupedWines, winesGrid, wineType);
            });
        }
        
        function displayMobileSearchResults(searchTerm, results) {
            const mobileWinesContainer = document.getElementById('mobileWinesContainer');
            const mobileWinesCards = document.getElementById('mobileWinesCards');
            const mapView = document.getElementById('mobileMapView');
            const winesContainer = document.getElementById('mobileWinesCardsContainer');
            const winesGrid = document.getElementById('mobileWinesCardsGrid');
            const winesTitle = document.getElementById('mobileWinesCardsTitle');
            const typeFiltersContainer = document.getElementById('mobileWinesCardsTypeFilters');
            const backBtn = document.getElementById('mobileBackToMapBtn');
            const isMapPage = !!(mapView && winesContainer && winesGrid);

            if (isMapPage) {
                // Wine-map page: use map-style layout (hide map, show wines container)
                mapView.style.display = 'none';
                winesContainer.style.display = 'flex';
                const mapWinesContainer = document.getElementById('mobileMapWinesContainer');
                if (mapWinesContainer) {
                    mapWinesContainer.classList.add('wines-cards-expanded');
                }
                setTimeout(() => updateMobileWinesCardsHeight(), 100);

                if (winesTitle) {
                    winesTitle.textContent = results.length > 0 ? `Search: "${searchTerm}"` : 'Search';
                }
                if (typeFiltersContainer) {
                    typeFiltersContainer.innerHTML = '';
                    typeFiltersContainer.style.display = 'none';
                }

                if (backBtn) {
                    const newBackBtn = backBtn.cloneNode(true);
                    backBtn.parentNode.replaceChild(newBackBtn, backBtn);
                    newBackBtn.addEventListener('click', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        if (mapWinesContainer) {
                            mapWinesContainer.classList.remove('wines-cards-expanded');
                        }
                        winesContainer.style.height = '';
                        winesContainer.style.maxHeight = '';
                        winesContainer.style.minHeight = '';
                        mapView.style.display = 'flex';
                        winesContainer.style.display = 'none';
                        const searchInput = document.getElementById('mobileSearchInput');
                        if (searchInput) searchInput.value = '';
                        setTimeout(() => updateMobileMapHeight(), 100);
                    });
                }

                winesGrid.innerHTML = '';
                if (results.length === 0) {
                    winesGrid.innerHTML = `
                        <div style="color: rgba(245, 245, 240, 0.5); text-align: center; padding: 3rem 1.5rem;">
                            <i class="fas fa-search" style="font-size: 2.5rem; color: var(--gold); opacity: 0.3; margin-bottom: 1rem; display: block;"></i>
                            <p style="font-size: 1rem; margin: 0;">No wines found matching "${searchTerm}"</p>
                            <p style="font-size: 0.85rem; margin-top: 0.5rem; opacity: 0.7;">Try searching by wine name, producer, varietal, or region</p>
                        </div>
                    `;
                    return;
                }

                const groupedWines = typeof groupWinesBySubcategory === 'function' ? groupWinesBySubcategory(results) : [{ subcategoryInfo: null, wines: results }];
                if (typeof renderGroupedWinesAsTable === 'function') {
                    renderGroupedWinesAsTable(groupedWines, winesGrid);
                } else {
                    winesGrid.innerHTML = results.map(wine => {
                        const price = wine.wine_price || wine.wine_price_bottle || wine.wine_price_glass || 'N/A';
                        const producer = wine.wine_producer || 'Unknown';
                        return `<div class="mobile-wine-card" data-wine-id="${wine.wine_number}" onclick="window.location.href='wine-details.html?id=${wine.wine_number}&from=search'"><div class="mobile-wine-card-header"><h3 class="mobile-wine-card-name">${(wine.wine_name || 'Unknown Wine').replace(/</g, '&lt;')} <span class="mobile-wine-card-producer-inline">- ${(producer || '').replace(/</g, '&lt;')}</span></h3><span class="mobile-wine-card-price">$${price}</span></div><div class="mobile-wine-card-info"><p class="mobile-wine-card-region"><strong>Region:</strong> ${(wine.region || 'N/A').replace(/</g, '&lt;')}</p><p class="mobile-wine-card-varietal"><strong>Varietal:</strong> ${(wine.varietals || 'N/A').replace(/</g, '&lt;')}</p></div></div>`;
                    }).join('');
                }
                return;
            }

            // Other pages (e.g. index): use mobileWinesCards if present
            if (!mobileWinesCards) return;

            if (results.length === 0) {
                mobileWinesCards.innerHTML = `
                    <div style="color: rgba(245, 245, 240, 0.5); text-align: center; padding: 3rem 1.5rem;">
                        <i class="fas fa-search" style="font-size: 2.5rem; color: var(--gold); opacity: 0.3; margin-bottom: 1rem; display: block;"></i>
                        <p style="font-size: 1rem; margin: 0;">No wines found matching "${searchTerm}"</p>
                        <p style="font-size: 0.85rem; margin-top: 0.5rem; opacity: 0.7;">Try searching by wine name, producer, varietal, or region</p>
                    </div>
                `;
                if (mobileWinesContainer) {
                    mobileWinesContainer.style.display = 'block';
                }
                return;
            }

            // Display results as cards
            mobileWinesCards.innerHTML = results.map(wine => {
                const price = wine.wine_price || wine.wine_price_bottle || wine.wine_price_glass || 'N/A';
                const producer = wine.wine_producer || 'Unknown';
                const subcategory = wine.subcategory || '';
                const subcategoryInfo = typeof formatSubcategoryForDisplay === 'function' ? formatSubcategoryForDisplay(subcategory, wine) : null;
                return `
                    <div class="mobile-wine-card" data-wine-id="${wine.wine_number}" onclick="window.location.href='wine-details.html?id=${wine.wine_number}&from=search'">
                        <div class="mobile-wine-card-header">
                            <h3 class="mobile-wine-card-name">${(wine.wine_name || 'Unknown Wine').replace(/</g, '&lt;')} <span class="mobile-wine-card-producer-inline">- ${(producer || '').replace(/</g, '&lt;')}</span></h3>
                            <span class="mobile-wine-card-price">$${price}</span>
                        </div>
                        <div class="mobile-wine-card-info">
                            ${subcategoryInfo ? `
                                <div class="mobile-wine-card-subcategory-wrapper">
                                    <div class="mobile-wine-card-subcategory">${subcategoryInfo.name}</div>
                                    ${subcategoryInfo.description ? `<div class="mobile-wine-card-subcategory-desc">${subcategoryInfo.description}</div>` : ''}
                                </div>
                            ` : ''}
                            <p class="mobile-wine-card-region"><strong>Region:</strong> ${(wine.region || 'N/A').replace(/</g, '&lt;')}</p>
                            <p class="mobile-wine-card-varietal"><strong>Varietal:</strong> ${(wine.varietals || 'N/A').replace(/</g, '&lt;')}</p>
                        </div>
                    </div>
                `;
            }).join('');

            if (mobileWinesContainer) {
                mobileWinesContainer.style.display = 'block';
            }
        }
        
        // Update suggestion selection
        function updateSuggestionSelection(suggestions, index) {
            suggestions.forEach((s, i) => {
                if (i === index) {
                    s.classList.add('selected');
                    s.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                } else {
                    s.classList.remove('selected');
                }
            });
        }
        
        // Setup desktop search
        setupSearchInput('desktopSearchInput', 'searchAutocompleteDropdown', 'autocompleteSuggestions', false);
        
        // Setup mobile search
        setupSearchInput('mobileSearchInput', 'mobileSearchAutocompleteDropdown', 'mobileAutocompleteSuggestions', true);
        
        // Initial badge update
        setTimeout(() => {
            if (typeof updateActiveFiltersBadge === 'function') {
                updateActiveFiltersBadge();
            }
        }, 500);
        
        scheduleViewportRefresh();
        
        // Initial update for wines cards height if container is visible
        setTimeout(() => {
            updateMobileWinesCardsHeight();
        }, 500);
        
        // Expose showWinesListForRegion as global function so it can be called from loadRegionsForWineType
        window.showWinesListForRegion = showWinesListForRegion;
        
        // Setup Dynamic Mode Button
        // Note: Map transformations are now always active, this button only toggles wine type cards and search bar
        const dynamicModeBtn = document.getElementById('mobileDynamicModeBtn');
        const wineTypeSelector = document.getElementById('mobileWineTypeSelector');
        const searchBarContainer = document.getElementById('mobileSearchBarContainer');
        const searchInputWrapper = document.querySelector('.mobile-search-input-wrapper');
        
        if (dynamicModeBtn && wineTypeSelector && searchBarContainer) {
            // Ensure it starts hidden
            wineTypeSelector.style.display = 'none';
            if (searchInputWrapper) {
                searchInputWrapper.style.display = 'none';
            }
            
            dynamicModeBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                // Check current state - check inline style first, then computed style
                const inlineDisplay = wineTypeSelector.style.display;
                const computedDisplay = window.getComputedStyle(wineTypeSelector).display;
                const currentDisplay = inlineDisplay || computedDisplay;
                const isVisible = currentDisplay !== 'none';
                
                if (isVisible) {
                    // Hide wine type selector and search input
                    wineTypeSelector.style.display = 'none';
                    if (searchInputWrapper) {
                        searchInputWrapper.style.display = 'none';
                    }
                    searchBarContainer.classList.remove('dynamic-mode-active');
                    this.classList.remove('active');
                    // Hide wine type buttons
                    toggleWineTypeButtonsVisibility(false);
                } else {
                    // Show wine type selector and search input
                    wineTypeSelector.style.display = 'flex';
                    if (searchInputWrapper) {
                        searchInputWrapper.style.display = 'block';
                    }
                    searchBarContainer.classList.add('dynamic-mode-active');
                    this.classList.add('active');
                    // Show wine type buttons
                    toggleWineTypeButtonsVisibility(true);
                }
            });
        } else {
            console.warn('Dynamic Mode Button, Wine Type Selector or Search Bar Container not found:', {
                dynamicModeBtn: !!dynamicModeBtn,
                wineTypeSelector: !!wineTypeSelector,
                searchBarContainer: !!searchBarContainer
            });
        }
        
        // Setup custom placeholder for mobile search input
        const mobileSearchInput = document.getElementById('mobileSearchInput');
        const mobileSearchPlaceholder = document.getElementById('mobileSearchPlaceholder');
        
        if (mobileSearchInput && mobileSearchPlaceholder) {
            // Hide/show placeholder based on input value
            function updatePlaceholder() {
                if (mobileSearchInput.value.trim() === '') {
                    mobileSearchPlaceholder.style.display = 'block';
                } else {
                    mobileSearchPlaceholder.style.display = 'none';
                }
            }
            
            mobileSearchInput.addEventListener('input', updatePlaceholder);
            mobileSearchInput.addEventListener('focus', updatePlaceholder);
            mobileSearchInput.addEventListener('blur', updatePlaceholder);
            
            // Initial check
            updatePlaceholder();
        }
        
        // Setup Quick Search Buttons
        const organicBtn = document.getElementById('mobileQuickSearchOrganic');
        const fancyBtn = document.getElementById('mobileQuickSearchFancy');
        const varietalsBtn = document.getElementById('mobileQuickSearchVarietals');
        
        if (organicBtn) {
            organicBtn.addEventListener('click', function() {
                // Toggle active state
                const isActive = this.classList.contains('active');
                document.querySelectorAll('.mobile-quick-search-btn').forEach(btn => {
                    btn.classList.remove('active');
                });
                
                if (!isActive) {
                    this.classList.add('active');
                    showMobileWinesForQuickSearch('organic');
                } else {
                    // If already active, go back to map
                    const mapView = document.getElementById('mobileMapView');
                    const winesContainer = document.getElementById('mobileWinesCardsContainer');
                    if (mapView && winesContainer) {
                        mapView.style.display = 'flex';
                        winesContainer.style.display = 'none';
                        // Remove organic description when going back
                        const winesHeader = document.querySelector('.mobile-wines-cards-header');
                        const existingDescription = winesHeader?.querySelector('.mobile-wines-cards-organic-description');
                        if (existingDescription) {
                            existingDescription.remove();
                        }
                        setTimeout(() => {
                            updateMobileMapHeight();
                        }, 100);
                    }
                }
            });
        }
        
        if (fancyBtn) {
            fancyBtn.addEventListener('click', function() {
                // Toggle active state
                const isActive = this.classList.contains('active');
                document.querySelectorAll('.mobile-quick-search-btn').forEach(btn => {
                    btn.classList.remove('active');
                });
                
                if (!isActive) {
                    this.classList.add('active');
                    showMobileWinesForQuickSearch('fancy');
                } else {
                    // If already active, go back to map
                    const mapView = document.getElementById('mobileMapView');
                    const winesContainer = document.getElementById('mobileWinesCardsContainer');
                    if (mapView && winesContainer) {
                        mapView.style.display = 'flex';
                        winesContainer.style.display = 'none';
                        setTimeout(() => {
                            updateMobileMapHeight();
                        }, 100);
                    }
                }
            });
        }
        
        if (varietalsBtn) {
            varietalsBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                // Toggle active state
                const isActive = this.classList.contains('active');
                document.querySelectorAll('.mobile-quick-search-btn').forEach(btn => {
                    btn.classList.remove('active');
                });
                
                if (!isActive) {
                    this.classList.add('active');
                    showMobileVarietalsList();
                } else {
                    // If already active, go back to map
                    const mapView = document.getElementById('mobileMapView');
                    const winesContainer = document.getElementById('mobileWinesCardsContainer');
                    if (mapView && winesContainer) {
                        mapView.style.display = 'flex';
                        winesContainer.style.display = 'none';
                        setTimeout(() => {
                            updateMobileMapHeight();
                        }, 100);
                    }
                }
            });
        }
}

// Initialize wine type filters on page load (independent of map)
// Only initialize on pages that have wine cards
const shouldInitFilters = () => {
    const currentPage = window.location.pathname;
    const isWineListPage = currentPage.includes('index.html') || 
                          currentPage.includes('wine-map.html') || 
                          currentPage === '/' || 
                          currentPage.endsWith('/');
    return isWineListPage;
};

if (shouldInitFilters()) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initWineTypeFilters);
    } else {
        initWineTypeFilters();
    }
}

// Initialize interactive map if on index page
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initInteractiveMap);
} else {
    initInteractiveMap();
}

// Zoom is set to 6 for all devices (removed tablet-specific zoom forcing)

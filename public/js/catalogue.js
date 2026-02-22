// ====================================
// Script catalogue - le p'tit bout de bois
// ====================================

let allProducts = [];
let allCategories = [];
let allWoodTypes = [];
let currentCategory = 'all';
let currentSubCategory = 'all';
let currentWoodType = 'all';
let currentSearch = '';
let currentMaxPrice = 100;

// Charger les catégories
async function loadCategories() {
  try {
    // Utiliser l'API settings pour avoir toutes les catégories définies dans l'admin
    const response = await fetch('/api/settings/categories');
    const categoriesData = await response.json();

    // Garder les objets complets {id, name, parent_id, ...} pour gérer les sous-catégories
    allCategories = categoriesData.map(c => typeof c === 'object' ? c : { id: null, name: c, parent_id: null });

    renderCategoryFilters();
  } catch (error) {
    console.error('Erreur chargement catégories:', error);
    // Fallback sur l'API products si settings échoue
    try {
      const resp = await fetch('/api/products/meta/categories');
      const fallbackData = await resp.json();
      allCategories = fallbackData.map(c => typeof c === 'object' ? c : { id: null, name: c, parent_id: null });
      renderCategoryFilters();
    } catch (e) { console.error('Erreur fallback catégories:', e); }
  }
}

// Charger les types de bois
async function loadWoodTypes() {
  try {
    // Utiliser l'API settings pour avoir tous les types de bois définis
    const response = await fetch('/api/settings/wood-types');
    const woodTypesData = await response.json();

    allWoodTypes = woodTypesData.map(w => typeof w === 'object' ? w.name : w);

    renderWoodTypeFilters();
  } catch (error) {
    console.error('Erreur chargement types de bois:', error);
    // Fallback
    try {
      const resp = await fetch('/api/products/meta/wood-types');
      allWoodTypes = await resp.json();
      renderWoodTypeFilters();
    } catch (e) { console.error('Erreur fallback bois:', e); }
  }
}

// Générer les boutons de filtres de catégories (niveau 1 — parents uniquement)
function renderCategoryFilters() {
  const container = document.getElementById('category-filters');
  if (!container) return;

  // Bouton "Tous"
  let html = `
    <button class="category-filter-btn active" data-category="all"
            style="padding: 0.5rem 1rem; border: 2px solid var(--wood-medium); border-radius: 8px;
                   background: var(--wood-medium); color: white; cursor: pointer; font-weight: 600;
                   transition: all 0.2s ease;">
      Tous
    </button>
  `;

  // Noms des sous-catégories (pour inclure les produits qui utilisent une sous-cat dans le filtre parent)
  const childNames = new Set(allCategories.filter(c => c.parent_id).map(c => c.name));

  // Catégories dont les produits sont présents (directement ou via sous-catégorie)
  const categoriesWithProducts = new Set(allProducts.map(p => p.category));

  // Afficher uniquement les catégories parentes (sans parent_id)
  const parentCategories = allCategories
    .filter(c => !c.parent_id)
    .filter(c => {
      // Garder si des produits sont dans cette catégorie OU dans une de ses sous-catégories
      if (categoriesWithProducts.has(c.name)) return true;
      const mySubs = allCategories.filter(sub => sub.parent_id === c.id).map(sub => sub.name);
      return mySubs.some(sub => categoriesWithProducts.has(sub));
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  parentCategories.forEach(cat => {
    html += `
      <button class="category-filter-btn" data-category="${cat.name}"
              style="padding: 0.5rem 1rem; border: 2px solid var(--wood-medium); border-radius: 8px;
                     background: white; color: var(--wood-medium); cursor: pointer; font-weight: 600;
                     transition: all 0.2s ease;">
        ${cat.name}
      </button>
    `;
  });

  container.innerHTML = html;

  // Réactiver les event listeners
  setupCategoryFilters();

  // Mettre à jour l'état actif selon la catégorie courante
  updateFilterButtons();

  // Afficher les sous-catégories si une catégorie était déjà sélectionnée
  if (currentCategory !== 'all') {
    renderSubCategoryFilters(currentCategory);
  }
}

// Générer les boutons de filtres de sous-catégories
function renderSubCategoryFilters(parentName) {
  let subContainer = document.getElementById('subcategory-filters');

  // Créer le container si nécessaire
  const catContainer = document.getElementById('category-filters');
  if (!subContainer && catContainer) {
    subContainer = document.createElement('div');
    subContainer.id = 'subcategory-filters';
    subContainer.style.cssText = 'display:none;margin-top:0.5rem;display:flex;flex-wrap:wrap;gap:0.5rem;';
    catContainer.parentNode.insertBefore(subContainer, catContainer.nextSibling);
  }
  if (!subContainer) return;

  // Trouver la catégorie parente pour obtenir son id
  const parentCat = allCategories.find(c => c.name === parentName && !c.parent_id);
  if (!parentCat) {
    subContainer.style.display = 'none';
    return;
  }

  // Trouver les sous-catégories
  const categoriesWithProducts = new Set(allProducts.map(p => p.category));
  const subs = allCategories
    .filter(c => c.parent_id === parentCat.id)
    .filter(c => categoriesWithProducts.has(c.name))
    .sort((a, b) => a.name.localeCompare(b.name));

  if (subs.length === 0) {
    subContainer.style.display = 'none';
    return;
  }

  let html = '';
  subs.forEach(sub => {
    const isActive = currentSubCategory === sub.name;
    html += `
      <button class="subcategory-filter-btn" data-subcategory="${sub.name}"
              style="padding: 0.4rem 0.9rem; border: 2px solid var(--wood-light); border-radius: 8px;
                     background: ${isActive ? 'var(--wood-light)' : 'white'}; color: var(--wood-dark);
                     cursor: pointer; font-weight: 500; font-size: 0.9rem;
                     transition: all 0.2s ease;">
        ${sub.name}
      </button>
    `;
  });

  subContainer.innerHTML = html;
  subContainer.style.display = 'flex';

  setupSubCategoryFilters();
}

// Générer les boutons de filtres de types de bois
function renderWoodTypeFilters() {
  const container = document.getElementById('wood-type-filters');
  if (!container) return;

  // Bouton "Tous"
  let html = `
    <button class="wood-type-filter-btn active" data-wood-type="all"
            style="padding: 0.5rem 1rem; border: 2px solid var(--wood-medium); border-radius: 8px;
                   background: var(--wood-medium); color: white; cursor: pointer; font-weight: 600;
                   transition: all 0.2s ease;">
      Tous
    </button>
  `;

  // Boutons pour chaque type de bois
  // Filtrer les doublons, exclure ceux sans produits, et trier
  const woodTypesWithProducts = new Set(allProducts.map(p => p.wood_type));
  const uniqueWoodTypes = [...new Set(allWoodTypes)].filter(w => woodTypesWithProducts.has(w)).sort();

  uniqueWoodTypes.forEach(woodType => {
    html += `
      <button class="wood-type-filter-btn" data-wood-type="${woodType}"
              style="padding: 0.5rem 1rem; border: 2px solid var(--wood-medium); border-radius: 8px;
                     background: white; color: var(--wood-medium); cursor: pointer; font-weight: 600;
                     transition: all 0.2s ease;">
        ${woodType}
      </button>
    `;
  });

  container.innerHTML = html;

  // Réactiver les event listeners
  setupWoodTypeFilters();

  // Mettre à jour l'état actif selon le type de bois courant
  updateFilterButtons();
}

// Charger les produits
async function loadProducts() {
  try {
    const response = await fetch('/api/products');
    allProducts = await response.json();

    // Initialiser le filtre de prix avec le maximum
    initializePriceFilter();

    // Vérifier les paramètres URL
    const urlParams = new URLSearchParams(window.location.search);
    const categoryParam = urlParams.get('category');
    const subcategoryParam = urlParams.get('subcategory');
    const woodTypeParam = urlParams.get('woodType');
    const searchParam = urlParams.get('search');

    if (categoryParam) {
      currentCategory = categoryParam;
      updateFilterButtons();
    }

    if (subcategoryParam) {
      currentSubCategory = subcategoryParam;
    }

    if (woodTypeParam) {
      currentWoodType = woodTypeParam;
      updateFilterButtons();
    }

    if (searchParam) {
      currentSearch = searchParam;
      document.getElementById('search-input').value = searchParam;
    }

    // Re-rendre les filtres maintenant que les produits sont chargés
    // (pour exclure les catégories/bois sans produits)
    renderCategoryFilters();
    renderWoodTypeFilters();

    displayProducts();
  } catch (error) {
    console.error('Erreur chargement produits:', error);
    showError('Erreur lors du chargement des produits');
  }
}

// Initialiser le filtre de prix avec le prix maximum des produits
function initializePriceFilter() {
  if (allProducts.length === 0) return;

  const maxPrice = Math.max(...allProducts.map(p => p.price));
  const roundedMax = Math.ceil(maxPrice / 10) * 10; // Arrondir au multiple de 10 supérieur

  const priceFilter = document.getElementById('price-filter');
  const priceValue = document.getElementById('price-value');

  priceFilter.max = roundedMax;
  priceFilter.value = roundedMax;
  priceValue.textContent = roundedMax;
  currentMaxPrice = roundedMax;

  updateSliderBackground(priceFilter);
}

// Mettre à jour le background du slider (effet rempli/vide)
function updateSliderBackground(slider) {
  const min = parseFloat(slider.min) || 0;
  const max = parseFloat(slider.max);
  const value = parseFloat(slider.value);

  // Calculer le pourcentage en tenant compte de la taille du thumb
  // Pour que le gradient s'arrête exactement au centre du thumb
  const percentage = ((value - min) / (max - min)) * 100;

  // Gradient avec partie foncée (remplie) à gauche et claire (vide) à droite
  slider.style.background = `linear-gradient(to right, var(--wood-medium) ${percentage}%, #e0e0e0 ${percentage}%)`;
}

// Mettre à jour l'affichage du prix
function updatePriceDisplay() {
  const priceFilter = document.getElementById('price-filter');
  const priceValue = document.getElementById('price-value');
  priceValue.textContent = priceFilter.value;
  updateSliderBackground(priceFilter);
  displayProducts();
}

// Afficher les produits
function displayProducts() {
  const container = document.getElementById('products-container');
  const noProductsDiv = document.getElementById('no-products');
  const countDiv = document.getElementById('product-count');

  // Récupérer le filtre de prix
  const priceFilter = document.getElementById('price-filter');
  const maxPrice = priceFilter ? parseFloat(priceFilter.value) : currentMaxPrice;

  // Filtrer les produits
  let filteredProducts = allProducts;

  // Filtre par catégorie / sous-catégorie
  if (currentSubCategory !== 'all') {
    filteredProducts = filteredProducts.filter(p => p.category === currentSubCategory);
  } else if (currentCategory !== 'all') {
    // Inclure les produits de la catégorie parente + tous ceux de ses sous-catégories
    const parentCat = allCategories.find(c => c.name === currentCategory && !c.parent_id);
    const childNames = parentCat
      ? allCategories.filter(c => c.parent_id === parentCat.id).map(c => c.name)
      : [];
    filteredProducts = filteredProducts.filter(p =>
      p.category === currentCategory || childNames.includes(p.category)
    );
  }

  // Filtre par type de bois
  if (currentWoodType !== 'all') {
    filteredProducts = filteredProducts.filter(p => p.wood_type === currentWoodType);
  }

  // Filtre par recherche
  if (currentSearch) {
    const searchLower = currentSearch.toLowerCase();
    filteredProducts = filteredProducts.filter(p =>
      p.name.toLowerCase().includes(searchLower) ||
      p.description.toLowerCase().includes(searchLower) ||
      p.wood_type.toLowerCase().includes(searchLower) ||
      p.category.toLowerCase().includes(searchLower)
    );
  }

  // Filtre par prix
  filteredProducts = filteredProducts.filter(p => p.price <= maxPrice);

  // Mettre à jour le compteur avec une police adaptée
  countDiv.textContent = `${filteredProducts.length} produit${filteredProducts.length > 1 ? 's' : ''} trouvé${filteredProducts.length > 1 ? 's' : ''}`;
  countDiv.style.fontWeight = '600';
  countDiv.style.fontSize = '1.2rem';

  // Afficher ou masquer le message "aucun produit"
  if (filteredProducts.length === 0) {
    container.style.display = 'none';
    noProductsDiv.style.display = 'block';
    return;
  } else {
    container.style.display = 'grid';
    noProductsDiv.style.display = 'none';
  }

  // Générer les cartes produits
  container.innerHTML = filteredProducts.map(product => {
    // Utiliser la première image du tableau images, ou image_url en fallback
    let imageUrl;
    if (product.images && product.images.length > 0) {
      const imgPath = product.images[0].image_path;
      imageUrl = imgPath.startsWith('https://') ? imgPath : `/images/uploads/${imgPath}`;
    } else if (product.image_url) {
      imageUrl = product.image_url.startsWith('https://') ? product.image_url : `/images/uploads/${product.image_url}`;
    } else {
      imageUrl = '/images/placeholder.jpg';
    }

    return `
    <div class="product-card">
      <img src="${imageUrl}"
           alt="${product.name}"
           class="product-image"
           onclick="window.location.href='/produit/${product.id}'"
           style="cursor: pointer; filter: blur(20px); transform: scale(1.1); transition: filter 0.5s ease-out, transform 0.5s ease-out; background: linear-gradient(135deg, var(--wood-light), var(--cream));"
           loading="lazy" decoding="async"
           onload="this.style.filter='blur(0)'; this.style.transform='scale(1)'"
           onerror="this.style.filter='blur(0)'; this.style.transform='scale(1)'"
           onmouseover="if(this.style.filter==='blur(0px)' || this.style.filter==='blur(0)') this.style.transform='scale(1.05)'"
           onmouseout="this.style.transform='scale(1)'">

      <div class="product-info">
        <span class="product-category">${product.category}</span>
        <h3 class="product-name">${product.name}</h3>
        <p class="product-wood">🪵 ${product.wood_type}</p>
        <p class="product-description">${truncateText(product.description, 80)}</p>
        <p class="product-price">${product.price.toFixed(2)} €</p>

        ${product.perlouze_link ? `
          <a href="${product.perlouze_link}" class="perlouze-link" onclick="event.stopPropagation();">
            ✨ Voir les bijoux assortis
          </a>
        ` : ''}

        <div style="display: flex; gap: 0.5rem; margin-top: auto; padding-top: 1rem;">
          <button onclick="window.location.href='/produit/${product.id}'" class="btn btn-secondary" style="flex: 1; font-weight: 600; font-size: 1rem;">
            Détails
          </button>
          <button onclick="addToCart(${product.id})" class="btn btn-primary btn-add-cart" style="flex: 1; font-weight: 600; font-size: 1rem;">
            <span class="cart-icon">🛒</span><span class="cart-text"> Ajouter</span>
          </button>
        </div>
      </div>
    </div>
  `;
  }).join('');
}

// Tronquer le texte
function truncateText(text, maxLength) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

// Gestion des filtres de catégories
function setupCategoryFilters() {
  const filterButtons = document.querySelectorAll('.category-filter-btn');

  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      // Mettre à jour l'état actif
      filterButtons.forEach(b => {
        b.classList.remove('active');
        b.style.background = 'white';
        b.style.color = 'var(--wood-medium)';
      });

      btn.classList.add('active');
      btn.style.background = 'var(--wood-medium)';
      btn.style.color = 'white';

      // Mettre à jour la catégorie et réinitialiser la sous-catégorie
      currentCategory = btn.dataset.category;
      currentSubCategory = 'all';

      // Mettre à jour l'URL
      const url = new URL(window.location);
      if (currentCategory === 'all') {
        url.searchParams.delete('category');
        url.searchParams.delete('subcategory');
        const subContainer = document.getElementById('subcategory-filters');
        if (subContainer) subContainer.style.display = 'none';
      } else {
        url.searchParams.set('category', currentCategory);
        url.searchParams.delete('subcategory');
        renderSubCategoryFilters(currentCategory);
      }
      window.history.pushState({}, '', url);

      // Réafficher les produits
      displayProducts();
    });
  });
}

// Gestion des filtres de sous-catégories
function setupSubCategoryFilters() {
  const filterButtons = document.querySelectorAll('.subcategory-filter-btn');

  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      // Toggle : cliquer sur la sous-cat active la désélectionne
      const clickedSub = btn.dataset.subcategory;
      if (currentSubCategory === clickedSub) {
        currentSubCategory = 'all';
      } else {
        currentSubCategory = clickedSub;
      }

      // Mettre à jour l'état actif
      filterButtons.forEach(b => {
        const isActive = b.dataset.subcategory === currentSubCategory;
        b.style.background = isActive ? 'var(--wood-light)' : 'white';
      });

      // Mettre à jour l'URL
      const url = new URL(window.location);
      if (currentSubCategory === 'all') {
        url.searchParams.delete('subcategory');
      } else {
        url.searchParams.set('subcategory', currentSubCategory);
      }
      window.history.pushState({}, '', url);

      // Réafficher les produits
      displayProducts();
    });
  });
}

// Gestion des filtres de types de bois
function setupWoodTypeFilters() {
  const filterButtons = document.querySelectorAll('.wood-type-filter-btn');

  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      // Mettre à jour l'état actif
      filterButtons.forEach(b => {
        b.classList.remove('active');
        b.style.background = 'white';
        b.style.color = 'var(--wood-medium)';
      });

      btn.classList.add('active');
      btn.style.background = 'var(--wood-medium)';
      btn.style.color = 'white';

      // Mettre à jour le type de bois
      currentWoodType = btn.dataset.woodType;

      // Mettre à jour l'URL
      const url = new URL(window.location);
      if (currentWoodType === 'all') {
        url.searchParams.delete('woodType');
      } else {
        url.searchParams.set('woodType', currentWoodType);
      }
      window.history.pushState({}, '', url);

      // Réafficher les produits
      displayProducts();
    });
  });
}

// Gestion de la recherche
function setupSearch() {
  const searchInput = document.getElementById('search-input');
  let searchTimeout;

  searchInput.addEventListener('input', (e) => {
    // Debounce pour éviter trop de requêtes
    clearTimeout(searchTimeout);

    searchTimeout = setTimeout(() => {
      currentSearch = e.target.value.trim();

      // Mettre à jour l'URL
      const url = new URL(window.location);
      if (currentSearch) {
        url.searchParams.set('search', currentSearch);
      } else {
        url.searchParams.delete('search');
      }
      window.history.pushState({}, '', url);

      // Réafficher les produits
      displayProducts();
    }, 300);
  });
}

// Mettre à jour les boutons de filtre selon l'URL
function updateFilterButtons() {
  // Mettre à jour les filtres de catégories
  const categoryButtons = document.querySelectorAll('.category-filter-btn');
  categoryButtons.forEach(btn => {
    if (btn.dataset.category === currentCategory) {
      btn.classList.add('active');
      btn.style.background = 'var(--wood-medium)';
      btn.style.color = 'white';
    } else {
      btn.classList.remove('active');
      btn.style.background = 'white';
      btn.style.color = 'var(--wood-medium)';
    }
  });

  // Mettre à jour les filtres de types de bois
  const woodTypeButtons = document.querySelectorAll('.wood-type-filter-btn');
  woodTypeButtons.forEach(btn => {
    if (btn.dataset.woodType === currentWoodType) {
      btn.classList.add('active');
      btn.style.background = 'var(--wood-medium)';
      btn.style.color = 'white';
    } else {
      btn.classList.remove('active');
      btn.style.background = 'white';
      btn.style.color = 'var(--wood-medium)';
    }
  });
}

// Afficher les erreurs
function showError(message) {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'alert alert-error';
  errorDiv.textContent = message;
  errorDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 10000;
    padding: 1rem 2rem;
    background: #FEE2E2;
    color: #991B1B;
    border: 2px solid #FCA5A5;
    border-radius: 8px;
    box-shadow: var(--shadow-medium);
    animation: slideInRight 0.3s ease, slideOutRight 0.3s ease 2.7s;
  `;

  document.body.appendChild(errorDiv);

  setTimeout(() => {
    errorDiv.remove();
  }, 3000);
}

// Réinitialiser les filtres
function resetFilters() {
  // Réinitialiser la catégorie et sous-catégorie
  currentCategory = 'all';
  currentSubCategory = 'all';
  const subContainer = document.getElementById('subcategory-filters');
  if (subContainer) subContainer.style.display = 'none';

  // Réinitialiser le type de bois
  currentWoodType = 'all';

  updateFilterButtons();

  // Réinitialiser la recherche
  currentSearch = '';
  document.getElementById('search-input').value = '';

  // Réinitialiser le prix
  const priceFilter = document.getElementById('price-filter');
  const priceValue = document.getElementById('price-value');
  if (priceFilter) {
    priceFilter.value = priceFilter.max;
    priceValue.textContent = priceFilter.max;
    updateSliderBackground(priceFilter);
  }

  // Réafficher les produits
  displayProducts();
}

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
  loadCategories();
  loadWoodTypes();
  loadProducts();
  setupSearch();

  // Écouter les changements du curseur de prix
  const priceFilter = document.getElementById('price-filter');
  if (priceFilter) {
    priceFilter.addEventListener('input', updatePriceDisplay);
  }
});

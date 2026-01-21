// ====================================
// Script admin - le p'tit bout de bois
// ====================================

// URL secrète admin (doit correspondre au ADMIN_PATH du serveur)
const ADMIN_PATH = '/backoffice-bout-de-bois';

let allProducts = [];
let allOrders = [];
let allWoodTypes = [];
let currentEditingProduct = null;
let existingImages = []; // Images déjà enregistrées
let newImageFiles = []; // Nouveaux fichiers sélectionnés
let imagesToDelete = []; // IDs des images à supprimer (appliqué à la sauvegarde)

// Injection des styles pour les skeletons et loaders
const adminStyles = document.createElement('style');
adminStyles.innerHTML = `
@keyframes skeletonPulse { 0% { opacity: 0.6; } 50% { opacity: 0.8; } 100% { opacity: 0.6; } }
@keyframes spin { to { transform: rotate(360deg); } }

.skeleton-loading {
  color: transparent !important;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: skeletonPulse 1.5s infinite;
  border-radius: 4px;
  pointer-events: none;
  user-select: none;
}
.skeleton-loading::placeholder { color: transparent; }

.btn-loading {
  position: relative;
  pointer-events: none;
  opacity: 0.8;
}
.btn-loading span { opacity: 0; }
.btn-loading::after {
  content: "";
  position: absolute;
  top: 50%;
  left: 50%;
  width: 20px;
  height: 20px;
  margin-top: -10px;
  margin-left: -10px;
  border: 3px solid rgba(255,255,255,0.3);
  border-radius: 50%;
  border-top: 3px solid white;
  animation: spin 1s linear infinite;
}

/* Skeleton Thread View */
.thread-skeleton-header { width: 60%; height: 30px; margin-bottom: 10px; }
.thread-skeleton-sub { width: 40%; height: 20px; }
.thread-skeleton-msg { 
    margin-bottom: 20px; 
    border-radius: 15px; 
    padding: 1rem;
    height: 80px;
    width: 70%;
}
.thread-skeleton-msg.left { float: left; clear: both; background: white; }
.thread-skeleton-msg.right { float: right; clear: both; background: var(--wood-dark); opacity: 0.3; }
`;
document.head.appendChild(adminStyles);

// Variable globale pour garder l'ordre mixte des images
if (typeof window.allImagesOrderBoutDeBois === 'undefined') {
    window.allImagesOrderBoutDeBois = [];
}

// ═══════════════════════════════════════════════════
// Popup de confirmation personnalisée
// ═══════════════════════════════════════════════════

function showConfirm(messageOrOptions, titleFallback = 'Confirmation') {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirm-modal');
        const titleElement = document.getElementById('confirm-title');
        const messageElement = document.getElementById('confirm-message');
        const cancelBtn = document.getElementById('confirm-cancel');
        const okBtn = document.getElementById('confirm-ok');

        // Support pour les deux formats: showConfirm(string) ou showConfirm({title, message, icon})
        let title, message, icon;
        if (typeof messageOrOptions === 'string') {
            title = titleFallback;
            message = messageOrOptions;
            icon = '';
        } else {
            title = messageOrOptions.title || 'Confirmation';
            message = messageOrOptions.message || '';
            icon = messageOrOptions.icon || '';
        }

        titleElement.textContent = (icon ? icon + ' ' : '') + title;
        messageElement.textContent = message;
        modal.classList.add('active');

        // Gérer les clics
        const handleCancel = () => {
            modal.classList.remove('active');
            cancelBtn.removeEventListener('click', handleCancel);
            okBtn.removeEventListener('click', handleOk);
            resolve(false);
        };

        const handleOk = () => {
            modal.classList.remove('active');
            cancelBtn.removeEventListener('click', handleCancel);
            okBtn.removeEventListener('click', handleOk);
            resolve(true);
        };

        cancelBtn.addEventListener('click', handleCancel);
        okBtn.addEventListener('click', handleOk);

        // Fermer aussi si on clique en dehors
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                handleCancel();
            }
        }, { once: true });
    });
}

// Vérifier l'authentification
async function checkAuth() {
    try {
        const response = await fetch('/api/admin/check-session');
        const data = await response.json();

        if (!data.authenticated) {
            window.location.href = ADMIN_PATH;
            return false;
        }

        document.getElementById('admin-username').textContent = data.username;
        return true;
    } catch (error) {
        console.error('Erreur auth:', error);
        window.location.href = ADMIN_PATH;
        return false;
    }
}

// Déconnexion
async function logout() {
    try {
        await fetch('/api/admin/logout', { method: 'POST' });
        window.location.href = ADMIN_PATH;
    } catch (error) {
        console.error('Erreur logout:', error);
    }
}

// Charger les statistiques
async function loadStats() {
    try {
        const response = await fetch('/api/admin/stats');
        const stats = await response.json();

        document.getElementById('stat-products').textContent = stats.totalProducts;
        document.getElementById('stat-orders').textContent = stats.ongoingOrders;
        document.getElementById('stat-revenue').textContent = stats.totalRevenue.toFixed(2) + ' €';
        document.getElementById('stat-outofstock').textContent = stats.outOfStock;
    } catch (error) {
        console.error('Erreur stats:', error);
    }
}

// Charger les produits
async function loadProducts() {
    try {
        const response = await fetch('/api/admin/products');
        allProducts = await response.json();
        displayProducts();
    } catch (error) {
        console.error('Erreur chargement produits:', error);
    }
}

// Afficher les produits
function displayProducts() {
    const tbody = document.getElementById('products-table-body');

    if (allProducts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem;">Aucun produit</td></tr>';
        return;
    }

    tbody.innerHTML = allProducts.map(product => {
        // Utiliser la première image du tableau images, ou image_url en fallback
        const imageUrl = (product.images && product.images.length > 0)
            ? product.images[0].image_path
            : (product.image_url || '/images/placeholder.jpg');

        return `
    <tr>
      <td data-label="Image"><img src="${imageUrl}" alt="${product.name}"></td>
      <td data-label="Nom">${product.name}</td>
      <td data-label="Catégorie"><span class="product-category">${product.category}</span></td>
      <td data-label="Bois">${product.wood_type}</td>
      <td data-label="Prix">${product.price.toFixed(2)} €</td>
      <td data-label="Stock">${product.stock > 0 ? product.stock : '<span style="color: #DC2626;">Rupture</span>'}</td>
      <td data-label="Actions">
        <button onclick="editProduct(${product.id})" class="btn-icon btn-edit" title="Modifier">✏️</button>
        <button onclick="deleteProduct(${product.id})" class="btn-icon btn-delete" title="Supprimer">🗑️</button>
      </td>
    </tr>
  `;
    }).join('');
}

// Afficher le modal d'ajout de produit
function showAddProductModal() {
    currentEditingProduct = null;
    existingImages = [];
    newImageFiles = [];
    imagesToDelete = [];
    window.allImagesOrderBoutDeBois = [];
    document.getElementById('modal-title').textContent = 'Ajouter un produit';
    document.getElementById('product-form').reset();
    document.getElementById('product-id').value = '';

    // Réinitialiser l'input file
    const imageInput = document.getElementById('product-images');
    if (imageInput) {
        imageInput.value = '';
    }

    document.getElementById('existing-images-container').style.display = 'none';
    document.getElementById('new-images-preview').style.display = 'none';
    document.getElementById('product-modal').classList.add('active');
}

// Modifier un produit
async function editProduct(productId) {
    // 1. Afficher immédiatement le modal en mode "skeleton"
    currentEditingProduct = allProducts.find(p => p.id === productId);

    document.getElementById('modal-title').textContent = 'Modifier le produit';

    // Si on a les données de base dans allProducts, on peut pré-remplir partiellement
    if (currentEditingProduct) {
        document.getElementById('product-name').value = currentEditingProduct.name;
        // Mais on va quand même mettre l'état skeleton pour charger les images et détails complets
    }

    const modal = document.getElementById('product-modal');
    const form = document.getElementById('product-form');

    // Ajouter classes skeleton aux inputs
    const inputs = form.querySelectorAll('input, select, textarea');
    inputs.forEach(input => input.classList.add('skeleton-loading'));

    modal.classList.add('active');

    // Réinitialiser l'input file et images
    newImageFiles = [];
    imagesToDelete = [];
    window.allImagesOrderBoutDeBois = [];
    const imageInput = document.getElementById('product-images');
    if (imageInput) imageInput.value = '';

    document.getElementById('existing-images-container').style.display = 'none';
    document.getElementById('new-images-preview').style.display = 'none';

    // 2. Charger les données complètes
    try {
        const response = await fetch(`/api/products/${productId}`);
        const product = await response.json();

        currentEditingProduct = product; // Mise à jour avec détails complets

        // Remplir les champs
        document.getElementById('product-id').value = product.id;
        document.getElementById('product-name').value = product.name;
        document.getElementById('product-category').value = product.category;
        document.getElementById('product-wood').value = product.wood_type;
        document.getElementById('product-price').value = product.price;
        document.getElementById('product-stock').value = product.stock;
        document.getElementById('product-description').value = product.description || '';
        document.getElementById('product-perlouze-link').value = product.perlouze_link || '';

        existingImages = (product.images || []).sort((a, b) => a.display_order - b.display_order);

        // 3. Retirer skeleton et afficher images
        inputs.forEach(input => input.classList.remove('skeleton-loading'));
        displayExistingImages();

    } catch (error) {
        console.error('Erreur chargement produit:', error);
        inputs.forEach(input => input.classList.remove('skeleton-loading'));
        showError('Impossible de charger les détails du produit');
        closeProductModal();
    }
}

// Fermer le modal
function closeProductModal() {
    document.getElementById('product-modal').classList.remove('active');
    currentEditingProduct = null;
    existingImages = [];
    newImageFiles = [];
    imagesToDelete = [];
    window.allImagesOrderBoutDeBois = [];

    // Réinitialiser l'input file
    const imageInput = document.getElementById('product-images');
    if (imageInput) {
        imageInput.value = '';
    }

    // Cacher les conteneurs d'images
    document.getElementById('existing-images-container').style.display = 'none';
    document.getElementById('new-images-preview').style.display = 'none';
}

// Afficher les images existantes (redirige vers displayNewImages qui affiche tout)
function displayExistingImages() {
    displayNewImages();
}

// Déplacer une image existante
function moveExistingImage(fromIndex, direction) {
    const toIndex = fromIndex + direction;
    if (toIndex < 0 || toIndex >= existingImages.length) return;

    // Ajouter classe d'animation
    const container = document.getElementById('existing-images');
    container.classList.add('reordering');

    // Échanger les positions dans le tableau
    const temp = existingImages[fromIndex];
    existingImages[fromIndex] = existingImages[toIndex];
    existingImages[toIndex] = temp;

    // Mettre à jour display_order pour refléter les nouvelles positions
    existingImages.forEach((img, idx) => {
        img.display_order = idx + 1; // Commence à 1, pas à 0
        img.is_primary = idx === 0 ? 1 : 0;
    });

    // Réafficher pour montrer le nouvel ordre visuel
    displayExistingImages();

    // Retirer classe d'animation après l'animation
    setTimeout(() => {
        container.classList.remove('reordering');
    }, 300);
}

// Supprimer une image existante (marque pour suppression, appliqué à la sauvegarde)
function deleteExistingImage(imageId) {
    // Pas de confirmation ici, juste marquer pour suppression
    // Ajouter à la liste des images à supprimer
    if (!imagesToDelete.includes(imageId)) {
        imagesToDelete.push(imageId);
    }

    // Retirer visuellement de allImagesOrderBoutDeBois
    if (window.allImagesOrderBoutDeBois && window.allImagesOrderBoutDeBois.length > 0) {
        window.allImagesOrderBoutDeBois = window.allImagesOrderBoutDeBois.filter(item =>
            !(item.type === 'existing' && item.data.id === imageId)
        );

        // Reconstruire les tableaux à partir de allImagesOrderBoutDeBois mis à jour
        existingImages = [];
        newImageFiles = [];

        window.allImagesOrderBoutDeBois.forEach((item, index) => {
            if (item.type === 'existing') {
                item.data.display_order = index + 1;
                item.data.is_primary = index === 0 ? 1 : 0;
                existingImages.push(item.data);
            } else {
                newImageFiles.push(item.data);
            }
        });
    } else {
        // Si pas de allImagesOrderBoutDeBois, retirer de existingImages
        existingImages = existingImages.filter(img => img.id !== imageId);
        existingImages.forEach((img, idx) => {
            img.display_order = idx + 1;
            img.is_primary = idx === 0 ? 1 : 0;
        });
    }

    displayNewImages();
}

// Afficher toutes les images (existantes + nouvelles) de manière intégrée
function displayNewImages() {
    const existingContainer = document.getElementById('existing-images');
    const existingContainerDiv = document.getElementById('existing-images-container');
    const newContainerDiv = document.getElementById('new-images-preview');

    // Utiliser allImagesOrderBoutDeBois s'il existe, sinon créer le tableau
    let allImages = [];

    if (window.allImagesOrderBoutDeBois && window.allImagesOrderBoutDeBois.length > 0) {
        // Utiliser l'ordre global sauvegardé
        allImages = window.allImagesOrderBoutDeBois.map((item, index) => ({
            type: item.type,
            data: item.data,
            originalIndex: index
        }));
    } else {
        // Créer un nouveau tableau mixte et l'enregistrer
        existingImages.forEach((image, index) => {
            allImages.push({
                type: 'existing',
                data: image,
                originalIndex: index
            });
        });

        newImageFiles.forEach((file, index) => {
            allImages.push({
                type: 'new',
                data: file,
                originalIndex: index
            });
        });

        // Sauvegarder dans allImagesOrderBoutDeBois
        window.allImagesOrderBoutDeBois = allImages;
    }

    const totalImages = allImages.length;

    if (totalImages === 0) {
        existingContainerDiv.style.display = 'none';
        newContainerDiv.style.display = 'none';
        return;
    }

    // Afficher tout dans le conteneur des images existantes
    existingContainerDiv.style.display = 'block';
    newContainerDiv.style.display = 'none';
    existingContainer.innerHTML = '';

    // Afficher toutes les images de manière intégrée (même style que la-ptite-perlouze)
    allImages.forEach((item, globalIndex) => {
        const imageDiv = document.createElement('div');
        imageDiv.className = 'image-item';
        imageDiv.style.position = 'relative';
        imageDiv.style.display = 'inline-block';
        imageDiv.style.width = '120px';
        imageDiv.style.height = '120px';
        imageDiv.style.marginRight = '0.35rem';
        imageDiv.style.marginBottom = '0.35rem';
        imageDiv.style.overflow = 'hidden';
        imageDiv.style.borderRadius = '10px';

        const img = document.createElement('img');
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        img.style.display = 'block';

        // Badge de position
        const badge = document.createElement('span');
        badge.style.position = 'absolute';
        badge.style.top = '5px';
        badge.style.left = '5px';
        badge.style.color = 'white';
        badge.style.padding = '3px 8px';
        badge.style.borderRadius = '5px';
        badge.style.fontSize = '0.75rem';
        badge.style.fontWeight = 'bold';
        badge.style.zIndex = '2';

        // Bouton de suppression
        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '✕';
        deleteBtn.type = 'button';
        deleteBtn.style.position = 'absolute';
        deleteBtn.style.top = '5px';
        deleteBtn.style.right = '5px';
        deleteBtn.style.background = '#C17B7B';
        deleteBtn.style.color = 'white';
        deleteBtn.style.border = 'none';
        deleteBtn.style.borderRadius = '50%';
        deleteBtn.style.width = '24px';
        deleteBtn.style.height = '24px';
        deleteBtn.style.cursor = 'pointer';
        deleteBtn.style.fontSize = '14px';
        deleteBtn.style.fontWeight = 'bold';
        deleteBtn.style.display = 'flex';
        deleteBtn.style.alignItems = 'center';
        deleteBtn.style.justifyContent = 'center';
        deleteBtn.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
        deleteBtn.style.zIndex = '2';

        // Boutons de réorganisation
        const controlsDiv = document.createElement('div');
        controlsDiv.style.position = 'absolute';
        controlsDiv.style.bottom = '5px';
        controlsDiv.style.left = '50%';
        controlsDiv.style.transform = 'translateX(-50%)';
        controlsDiv.style.display = 'flex';
        controlsDiv.style.gap = '5px';
        controlsDiv.style.zIndex = '2';

        let moveUpBtn = null;
        let moveDownBtn = null;

        if (globalIndex > 0) {
            moveUpBtn = document.createElement('button');
            moveUpBtn.innerHTML = '◀';
            moveUpBtn.type = 'button';
            moveUpBtn.style.background = 'rgba(255, 255, 255, 0.9)';
            moveUpBtn.style.border = 'none';
            moveUpBtn.style.borderRadius = '50%';
            moveUpBtn.style.width = '24px';
            moveUpBtn.style.height = '24px';
            moveUpBtn.style.cursor = 'pointer';
            moveUpBtn.style.fontSize = '12px';
            moveUpBtn.style.fontWeight = 'bold';
            moveUpBtn.style.display = 'flex';
            moveUpBtn.style.alignItems = 'center';
            moveUpBtn.style.justifyContent = 'center';
            moveUpBtn.style.boxShadow = '0 2px 4px rgba(0,0,0,0.15)';
            moveUpBtn.onclick = () => moveImageGlobally(globalIndex, globalIndex - 1);
            controlsDiv.appendChild(moveUpBtn);
        }

        if (globalIndex < totalImages - 1) {
            moveDownBtn = document.createElement('button');
            moveDownBtn.innerHTML = '▶';
            moveDownBtn.type = 'button';
            moveDownBtn.style.background = 'rgba(255, 255, 255, 0.9)';
            moveDownBtn.style.border = 'none';
            moveDownBtn.style.borderRadius = '50%';
            moveDownBtn.style.width = '24px';
            moveDownBtn.style.height = '24px';
            moveDownBtn.style.cursor = 'pointer';
            moveDownBtn.style.fontSize = '12px';
            moveDownBtn.style.fontWeight = 'bold';
            moveDownBtn.style.display = 'flex';
            moveDownBtn.style.alignItems = 'center';
            moveDownBtn.style.justifyContent = 'center';
            moveDownBtn.style.boxShadow = '0 2px 4px rgba(0,0,0,0.15)';
            moveDownBtn.onclick = () => moveImageGlobally(globalIndex, globalIndex + 1);
            controlsDiv.appendChild(moveDownBtn);
        }

        if (item.type === 'existing') {
            // Image existante
            const image = item.data;
            img.src = image.image_path;
            img.alt = `Image ${globalIndex + 1}`;

            // Bordure sur le conteneur
            imageDiv.style.border = globalIndex === 0 ? '3px solid var(--accent-orange)' : '2px solid var(--wood-light)';

            badge.textContent = globalIndex === 0 ? '★ Principale' : `${globalIndex + 1}`;
            badge.style.background = globalIndex === 0 ? 'var(--accent-orange)' : 'var(--wood-medium)';

            moveUpBtn && (moveUpBtn.style.color = 'var(--wood-dark)');
            moveDownBtn && (moveDownBtn.style.color = 'var(--wood-dark)');

            deleteBtn.onclick = () => deleteExistingImage(image.id);
        } else {
            // Nouvelle image
            const file = item.data;
            img.alt = `Nouvelle image ${globalIndex + 1}`;

            // Bordure sur le conteneur
            imageDiv.style.border = globalIndex === 0 ? '3px solid var(--accent-orange)' : '3px solid var(--wood-medium)';
            img.style.opacity = '0.95';

            badge.textContent = globalIndex === 0 ? '★ Nouvelle' : `✨ ${globalIndex + 1}`;
            badge.style.background = 'var(--wood-medium)';

            moveUpBtn && (moveUpBtn.style.color = 'var(--wood-medium)');
            moveDownBtn && (moveDownBtn.style.color = 'var(--wood-medium)');

            deleteBtn.onclick = () => removeNewImageGlobally(globalIndex);

            // Lire le fichier et afficher l'image
            const reader = new FileReader();
            reader.onload = function (e) {
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }

        imageDiv.appendChild(img);
        imageDiv.appendChild(badge);
        imageDiv.appendChild(deleteBtn);
        imageDiv.appendChild(controlsDiv);
        existingContainer.appendChild(imageDiv);
    });

    // Message informatif
    if (totalImages > 0) {
        const infoDiv = document.createElement('div');
        infoDiv.style.gridColumn = '1 / -1';
        infoDiv.style.padding = '0.5rem';
        infoDiv.style.background = 'var(--cream)';
        infoDiv.style.borderRadius = '8px';
        infoDiv.style.fontSize = '0.9rem';
        infoDiv.style.color = 'var(--wood-dark)';
        infoDiv.style.marginTop = '0.5rem';
        infoDiv.innerHTML = `
      <strong>💡 Astuce :</strong> Utilisez les boutons ◀ ▶ pour réorganiser toutes les images ensemble. Les images avec ✨ seront ajoutées lors de la sauvegarde.
    `;
        existingContainer.appendChild(infoDiv);
    }
}

// Déplacer une image dans l'ordre global (existantes + nouvelles mélangées)
function moveImageGlobally(fromIndex, toIndex) {
    // Si allImagesOrderBoutDeBois est vide, le créer
    if (!window.allImagesOrderBoutDeBois || window.allImagesOrderBoutDeBois.length === 0) {
        window.allImagesOrderBoutDeBois = [];
        existingImages.forEach(img => window.allImagesOrderBoutDeBois.push({ type: 'existing', data: img }));
        newImageFiles.forEach(file => window.allImagesOrderBoutDeBois.push({ type: 'new', data: file }));
    }

    // Échanger les positions dans le tableau global
    const temp = window.allImagesOrderBoutDeBois[fromIndex];
    window.allImagesOrderBoutDeBois[fromIndex] = window.allImagesOrderBoutDeBois[toIndex];
    window.allImagesOrderBoutDeBois[toIndex] = temp;

    // Reconstruire les tableaux séparés à partir de allImagesOrderBoutDeBois
    existingImages = [];
    newImageFiles = [];

    window.allImagesOrderBoutDeBois.forEach((item, index) => {
        if (item.type === 'existing') {
            // Mettre à jour display_order et is_primary
            item.data.display_order = index + 1;
            item.data.is_primary = index === 0 ? 1 : 0;
            existingImages.push(item.data);
        } else {
            newImageFiles.push(item.data);
        }
    });

    // Ne plus sauvegarder immédiatement, l'ordre sera appliqué à la sauvegarde du formulaire

    displayNewImages();
}

// Supprimer une nouvelle image de la liste (globalIndex = position dans l'affichage complet)
function removeNewImageGlobally(globalIndex) {
    // Supprimer de allImagesOrderBoutDeBois
    if (window.allImagesOrderBoutDeBois && window.allImagesOrderBoutDeBois.length > globalIndex) {
        window.allImagesOrderBoutDeBois.splice(globalIndex, 1);
    }

    // Reconstruire les tableaux séparés à partir de allImagesOrderBoutDeBois
    existingImages = [];
    newImageFiles = [];

    window.allImagesOrderBoutDeBois.forEach((item, index) => {
        if (item.type === 'existing') {
            item.data.display_order = index + 1;
            item.data.is_primary = index === 0 ? 1 : 0;
            existingImages.push(item.data);
        } else {
            newImageFiles.push(item.data);
        }
    });

    displayNewImages();
}

// Enregistrer un produit
async function saveProduct(event) {
    event.preventDefault();

    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.textContent;

    // État de chargement sur le bouton
    submitBtn.classList.add('btn-loading');
    submitBtn.innerHTML = '<span>' + originalBtnText + '</span>'; // Envelopper texte pour cacher


    const productId = document.getElementById('product-id').value;
    const formData = new FormData();

    formData.append('name', document.getElementById('product-name').value);
    formData.append('category', document.getElementById('product-category').value);
    formData.append('wood_type', document.getElementById('product-wood').value);
    formData.append('price', document.getElementById('product-price').value);
    formData.append('stock', document.getElementById('product-stock').value);
    formData.append('description', document.getElementById('product-description').value);
    formData.append('perlouze_link', document.getElementById('product-perlouze-link').value);

    // Vérifier le nombre total d'images
    const totalImages = existingImages.length + newImageFiles.length;
    if (totalImages > 10) {
        showError(`Vous ne pouvez avoir que 10 images maximum (actuellement ${existingImages.length} existantes + ${newImageFiles.length} nouvelles)`);
        return;
    }

    // Ajouter les nouvelles images
    newImageFiles.forEach((file) => {
        formData.append('images', file);
    });

    try {
        const url = productId ? `/api/admin/products/${productId}` : '/api/admin/products';
        const method = productId ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            body: formData
        });

        if (!response.ok) {
            throw new Error('Erreur lors de l\'enregistrement');
        }

        const result = await response.json();

        // Traiter d'abord les suppressions d'images
        if (productId && imagesToDelete.length > 0) {
            for (const imageId of imagesToDelete) {
                try {
                    await fetch(`/api/admin/product-images/${imageId}`, {
                        method: 'DELETE'
                    });
                } catch (error) {
                    console.error(`Erreur suppression image ${imageId}:`, error);
                }
            }
        }

        // Si on a uploadé de nouvelles images et qu'on a un ordre global mixte
        if (newImageFiles.length > 0 && window.allImagesOrderBoutDeBois && window.allImagesOrderBoutDeBois.length > 0) {
            const finalProductId = result.id || productId;

            if (finalProductId) {
                // Attendre un peu que les images soient bien enregistrées
                await new Promise(resolve => setTimeout(resolve, 500));

                // Recharger le produit pour obtenir les IDs des nouvelles images
                const productResponse = await fetch(`/api/products/${finalProductId}`);
                const productData = await productResponse.json();

                if (productData && productData.images) {
                    const allUploadedImages = productData.images;

                    // Reconstruire l'ordre selon allImagesOrderBoutDeBois
                    const finalOrder = [];
                    let newImageIndex = 0;

                    window.allImagesOrderBoutDeBois.forEach((item, globalIndex) => {
                        if (item.type === 'existing') {
                            // Trouver l'image existante par son ID
                            const existingImg = allUploadedImages.find(img => img.id === item.data.id);
                            if (existingImg) {
                                finalOrder.push({
                                    id: existingImg.id,
                                    display_order: globalIndex + 1,
                                    is_primary: globalIndex === 0 ? 1 : 0
                                });
                            }
                        } else {
                            // Pour les nouvelles images, on prend les dernières images uploadées
                            const newImages = allUploadedImages.filter(img =>
                                !existingImages.find(existing => existing.id === img.id)
                            );

                            if (newImages[newImageIndex]) {
                                finalOrder.push({
                                    id: newImages[newImageIndex].id,
                                    display_order: globalIndex + 1,
                                    is_primary: globalIndex === 0 ? 1 : 0
                                });
                                newImageIndex++;
                            }
                        }
                    });

                    // Envoyer la réorganisation finale
                    if (finalOrder.length > 0) {
                        await fetch(`/api/admin/products/${finalProductId}/reorder-images`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ images: finalOrder })
                        });
                    }
                }
            }
        } else if (productId) {
            // Si c'est une modification sans nouvelles images, sauvegarder l'ordre des existantes
            // et traiter les suppressions (déjà fait plus haut)
            if (existingImages.length > 0) {
                await saveImageOrder(productId);
            }
        }

        showSuccess('Produit enregistré avec succès');
        closeProductModal();
        loadProducts();
        loadStats();

    } catch (error) {
        console.error('Erreur:', error);
        showError('Erreur lors de l\'enregistrement du produit');
    } finally {
        // Restaurer le bouton
        if (submitBtn) {
            submitBtn.classList.remove('btn-loading');
            submitBtn.textContent = originalBtnText;
        }
    }
}

// Enregistrer l'ordre des images
async function saveImageOrder(productId) {
    try {
        const response = await fetch(`/api/admin/products/${productId}/reorder-images`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                images: existingImages.map(img => ({
                    id: img.id,
                    display_order: img.display_order,
                    is_primary: img.is_primary
                }))
            })
        });

        if (!response.ok) {
            throw new Error('Erreur lors de la réorganisation');
        }

    } catch (error) {
        console.error('Erreur réorganisation images:', error);
    }
}

// Supprimer un produit
async function deleteProduct(productId) {
    const confirmed = await showConfirm({
        title: 'Supprimer le produit',
        message: 'Voulez-vous vraiment supprimer ce produit ? Cette action est irréversible.',
        icon: '🗑️',
        confirmText: '🗑️ Supprimer',
        cancelText: 'Annuler'
    });

    if (!confirmed) return;

    try {
        const response = await fetch(`/api/admin/products/${productId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error('Erreur lors de la suppression');
        }

        showSuccess('Produit supprimé avec succès');
        loadProducts();
        loadStats();

    } catch (error) {
        console.error('Erreur:', error);
        showError('Erreur lors de la suppression du produit');
    }
}

// Charger les commandes
async function loadOrders() {
    try {
        const response = await fetch('/api/orders');
        allOrders = await response.json();
        displayOrders();
        updateOrdersBadge();
    } catch (error) {
        console.error('Erreur chargement commandes:', error);
    }
}

// Mettre à jour la bulle de notification des commandes
function updateOrdersBadge() {
    const pendingCount = allOrders.filter(o => o.status === 'pending').length;
    const badge = document.getElementById('orders-badge');

    if (badge) {
        if (pendingCount > 0) {
            badge.textContent = pendingCount;
            badge.style.display = 'inline-block';
        } else {
            badge.style.display = 'none';
        }
    }
}

// Afficher les commandes
function displayOrders() {
    const tbody = document.getElementById('orders-table-body');
    const hideDelivered = document.getElementById('hide-delivered')?.checked || false;

    const statusLabels = {
        'pending': 'En attente',
        'confirmed': 'Confirmée',
        'shipped': 'Expédiée',
        'delivered': 'Livrée'
    };

    // Filtrer les commandes selon le checkbox
    const filteredOrders = hideDelivered
        ? allOrders.filter(order => order.status !== 'delivered')
        : allOrders;

    if (filteredOrders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem;">Aucune commande</td></tr>';
        return;
    }

    tbody.innerHTML = filteredOrders.map(order => `
    <tr>
      <td data-label="N°">#${order.id}</td>
      <td data-label="Client">${order.customer_name}</td>
      <td data-label="Email">${order.customer_email}</td>
      <td data-label="Total">${order.total_amount.toFixed(2)} €</td>
      <td data-label="Statut"><span class="status-badge status-${order.status}">${statusLabels[order.status] || order.status}</span></td>
      <td data-label="Date">${new Date(order.created_at).toLocaleDateString('fr-FR')}</td>
      <td data-label="Actions">
        <button onclick="viewOrder(${order.id})" class="btn-icon btn-edit" title="Voir">👁️</button>
      </td>
    </tr>
  `).join('');
}

// Voir une commande
function viewOrder(orderId) {
    const order = allOrders.find(o => o.id === orderId);
    if (!order) return;

    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>Commande #${order.id}</h3>
        <button class="modal-close" onclick="this.closest('.modal').remove()">×</button>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem;">
        <div>
          <h4 style="color: var(--wood-dark); margin-bottom: 0.5rem;">Client</h4>
          <p style="margin: 0.25rem 0;"><strong>Nom:</strong> ${order.customer_name}</p>
          <p style="margin: 0.25rem 0;"><strong>Email:</strong> ${order.customer_email}</p>
          <p style="margin: 0.25rem 0;"><strong>Téléphone:</strong> ${order.customer_phone || 'Non renseigné'}</p>
        </div>

        <div>
          <h4 style="color: var(--wood-dark); margin-bottom: 0.5rem;">Livraison</h4>
          <p style="margin: 0;">${order.customer_address || 'Non renseignée'}</p>
        </div>
      </div>

      <div style="margin-top: 1.5rem;">
        <h4 style="color: var(--wood-dark); margin-bottom: 0.5rem;">Articles commandés</h4>
        ${order.items.map(item => `
          <div style="display: flex; justify-content: space-between; padding: 0.5rem; border-bottom: 1px solid var(--cream);">
            <span>${item.name} x ${item.quantity}</span>
            <span style="font-weight: 600;">${(item.price * item.quantity).toFixed(2)} €</span>
          </div>
        `).join('')}
        <div style="display: flex; justify-content: space-between; padding: 1rem 0.5rem; font-weight: 700; font-size: 1.2rem;">
          <span>Total</span>
          <span style="color: var(--accent-orange);">${order.total_amount.toFixed(2)} €</span>
        </div>
      </div>

      <div style="margin-top: 1.5rem;">
        <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Statut de la commande</label>
        <select id="order-status-${order.id}" onchange="updateOrderStatus(${order.id}, this.value, '${order.status}')" class="form-control"
                style="width: 100%; padding: 0.75rem; border: 2px solid var(--wood-light);
                       border-radius: 8px; background: var(--cream);">
          <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>⏳ En attente</option>
          <option value="confirmed" ${order.status === 'confirmed' ? 'selected' : ''}>✅ Confirmée</option>
          <option value="shipped" ${order.status === 'shipped' ? 'selected' : ''}>📦 Expédiée</option>
          <option value="delivered" ${order.status === 'delivered' ? 'selected' : ''}>✔️ Livrée</option>
        </select>
      </div>
    </div>
  `;

    document.body.appendChild(modal);
}

// Mettre à jour le statut d'une commande
async function updateOrderStatus(orderId, newStatus, oldStatus) {
    // Restaurer l'ancien statut dans le select temporairement
    const selectElement = document.getElementById(`order-status-${orderId}`);
    if (selectElement) {
        selectElement.value = oldStatus;
    }

    // Messages selon le statut
    const statusMessages = {
        'pending': {
            emoji: '⏳',
            title: 'Mettre en attente ?',
            message: 'La commande sera marquée comme en attente. Le client recevra un email l\'informant que la commande sera bientôt prise en charge.'
        },
        'confirmed': {
            emoji: '✅',
            title: 'Confirmer la commande ?',
            message: 'La commande sera confirmée. Le client recevra un email l\'informant que vous préparez sa commande avec soin.'
        },
        'shipped': {
            emoji: '📦',
            title: 'Marquer comme expédiée ?',
            message: 'La commande sera marquée comme expédiée. Le client recevra un email l\'informant que sa commande est en route.'
        },
        'delivered': {
            emoji: '✔️',
            title: 'Marquer comme livrée ?',
            message: 'La commande sera marquée comme livrée.'
        }
    };

    const statusInfo = statusMessages[newStatus] || { emoji: '❓', title: 'Modifier le statut ?', message: 'Le statut de la commande va être modifié.' };

    // Demander confirmation
    const confirmed = await showConfirm({
        title: statusInfo.title,
        message: statusInfo.message,
        icon: statusInfo.emoji,
        confirmText: 'Confirmer',
        cancelText: 'Annuler'
    });

    if (!confirmed) {
        // L'utilisateur a annulé, le select est déjà restauré
        return;
    }

    // L'utilisateur a confirmé, mettre à jour le statut
    try {
        const response = await fetch(`/api/orders/${orderId}/status`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: newStatus })
        });

        if (!response.ok) {
            throw new Error('Erreur lors de la mise à jour');
        }

        // Mettre à jour le select avec le nouveau statut
        if (selectElement) {
            selectElement.value = newStatus;
        }

        showSuccess('Statut mis à jour avec succès ! Un email a été envoyé au client.');
        loadOrders();

    } catch (error) {
        console.error('Erreur:', error);
        showError('Erreur lors de la mise à jour du statut');
        // Restaurer l'ancien statut en cas d'erreur
        if (selectElement) {
            selectElement.value = oldStatus;
        }
    }
}

// Enregistrer les paramètres
async function saveSettings() {
    // À implémenter selon les besoins
    showSuccess('Paramètres enregistrés');
}

// Afficher succès
function showSuccess(message) {
    cart.showNotification(message);
}

// Afficher erreur
function showError(message) {
    const errorDiv = document.createElement('div');

    // Détecter si on est sur mobile
    const isMobile = window.innerWidth <= 768;

    if (isMobile) {
        errorDiv.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #FEE2E2;
      color: #991B1B;
      padding: 1rem 2rem;
      border-radius: 8px;
      box-shadow: var(--shadow-strong);
      z-index: 10000;
      animation: slideInBottom 0.3s ease;
      width: calc(100% - 2rem);
      max-width: 400px;
      text-align: center;
    `;
    } else {
        errorDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #FEE2E2;
      color: #991B1B;
      padding: 1rem 2rem;
      border-radius: 8px;
      box-shadow: var(--shadow-strong);
      z-index: 10000;
      animation: slideInRight 0.3s ease;
    `;
    }

    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);

    setTimeout(() => {
        errorDiv.remove();
    }, 3000);
}

// ====================================
// STATISTIQUES DÉTAILLÉES
// ====================================

// Charger les statistiques détaillées
async function loadDetailedStats() {
    try {
        const response = await fetch('/api/admin/stats');
        const stats = await response.json();

        document.getElementById('stat-detail-products').textContent = stats.totalProducts;
        document.getElementById('stat-detail-orders').textContent = stats.ongoingOrders;
        document.getElementById('stat-detail-revenue').textContent = stats.totalRevenue.toFixed(2) + ' €';
        document.getElementById('stat-detail-outofstock').textContent = stats.outOfStock;
    } catch (error) {
        console.error('Erreur chargement statistiques détaillées:', error);
    }
}

// ====================================
// GESTION DES CONVERSATIONS (THREADS)
// ====================================

let allThreads = [];

// Charger les threads de conversation
async function loadThreads() {
    try {
        const response = await fetch('/api/messages/threads');
        allThreads = await response.json();
        updateMessagesBadge();

        const tbody = document.querySelector('#threads-table-body');
        tbody.innerHTML = '';

        // Filtrer les threads si la checkbox est cochée
        const hideClosed = document.getElementById('hide-closed-threads')?.checked;
        const filteredThreads = hideClosed ? allThreads.filter(t => t.status !== 'closed') : allThreads;

        if (filteredThreads.length === 0) {
            tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; padding: 3rem;">
            <div style="font-size: 3rem; margin-bottom: 1rem;">💬</div>
            <p style="font-size: 1.2rem; margin-bottom: 0.5rem;">Aucune conversation</p>
            <p style="font-size: 0.9rem;">Les conversations avec les clients apparaîtront ici</p>
          </td>
        </tr>
      `;
            return;
        }

        filteredThreads.forEach(thread => {
            const row = document.createElement('tr');
            const date = new Date(thread.last_message_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            const unreadCount = thread.unread_count || 0;

            row.innerHTML = `
        <td data-label="Statut">
          <div>
            ${thread.status === 'open'
                    ? '<span style="display: inline-block; padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.85rem; font-weight: 600; background: #10B981; color: white;">Ouvert</span>'
                    : '<span style="display: inline-block; padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.85rem; font-weight: 600; background: #6B7280; color: white;">Fermé</span>'
                }
          </div>
          ${unreadCount > 0 ? `<div style="margin-top: 0.5rem;"><span style="display: inline-block; padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.85rem; font-weight: 600; background: #F59E0B; color: white;">${unreadCount} nouveau(x)</span></div>` : ''}
        </td>
        <td data-label="Client">
          <div><strong>${thread.customer_name}</strong></div>
          <small style="color: var(--slate-gray);">${thread.customer_email}</small>
        </td>
        <td data-label="Dernier message" style="max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          <span style="font-weight: ${thread.last_sender === 'customer' ? 'bold' : 'normal'};">
            ${thread.last_message || '-'}
          </span>
        </td>
        <td data-label="Date">${date}</td>
        <td data-label="Actions">
          <button onclick="viewThread(${thread.id})" class="btn-icon btn-edit" title="Voir la conversation">👁️</button>
          ${thread.status === 'open'
                    ? `<button onclick="closeThread(${thread.id})" class="btn-icon btn-close" title="Fermer">✓</button>`
                    : `<button onclick="reopenThread(${thread.id})" class="btn-icon btn-close" title="Rouvrir">↻</button>`
                }
          <button onclick="deleteThread(${thread.id})" class="btn-icon btn-delete" title="Supprimer">🗑️</button>
        </td>
      `;

            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Erreur:', error);
    }
}

// Mettre à jour la bulle de notification des messages
function updateMessagesBadge() {
    const unreadCount = allThreads.reduce((sum, thread) => sum + (thread.unread_count || 0), 0);
    const badge = document.getElementById('messages-badge');

    if (badge) {
        if (unreadCount > 0) {
            badge.textContent = unreadCount;
            badge.style.display = 'inline-block';
        } else {
            badge.style.display = 'none';
        }
    }
}

// Voir une conversation complète
async function viewThread(threadId) {
    // 1. Ouvrir modal skeleton immédiatement
    const threadStub = allThreads.find(t => t.id === threadId) || { subject: 'Chargement...', customer_name: '...' };

    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.style.zIndex = '10001';
    modal.id = `thread-modal-${threadId}`;

    // Contenu Skeleton
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 800px; max-height: 90vh; display: flex; flex-direction: column;">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1.5rem;">
          <div style="width: 100%">
            <h3 style="margin: 0; color: var(--wood-dark); font-size: 1.8rem;">
               <div class="skeleton-loading thread-skeleton-header"></div>
            </h3>
            <p style="margin: 0.5rem 0 0 0; color: var(--slate-gray); font-size: 0.9rem;">
               <div class="skeleton-loading thread-skeleton-sub"></div>
            </p>
          </div>
          <button onclick="this.closest('.modal').remove()" style="background: none; border: none; font-size: 2rem; cursor: pointer; color: var(--slate-gray);">×</button>
        </div>

        <div id="thread-messages-container" style="flex: 1; overflow-y: auto; background: var(--cream); border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem; height: 400px; max-height: 50vh;">
           <!-- Skeletons messages -->
           <div class="skeleton-loading thread-skeleton-msg left"></div>
           <div class="skeleton-loading thread-skeleton-msg right"></div>
           <div class="skeleton-loading thread-skeleton-msg left"></div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    try {
        // Marquer comme lu
        await fetch(`/api/messages/threads/${threadId}/mark-read`, { method: 'POST' });
        loadThreads();

        const response = await fetch(`/api/messages/threads/${threadId}/messages`);
        const messages = await response.json();
        const thread = allThreads.find(t => t.id === threadId);

        if (!thread && !messages) {
            modal.remove();
            return;
        }

        // Remplacer le contenu du modal avec les vraies données
        modal.innerHTML = `
      <div class="modal-content" style="max-width: 800px; max-height: 90vh; display: flex; flex-direction: column;">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1.5rem;">
          <div>
            <h3 style="margin: 0; color: var(--wood-dark); font-size: 1.8rem;">
              ${thread ? thread.subject : 'Conversation'}
            </h3>
            <p style="margin: 0.5rem 0 0 0; color: var(--slate-gray); font-size: 0.9rem;">
              <strong>${thread ? thread.customer_name : ''}</strong> (${thread ? thread.customer_email : ''})
            </p>
          </div>
          <button onclick="this.closest('.modal').remove()" style="background: none; border: none; font-size: 2rem; cursor: pointer; color: var(--slate-gray);">×</button>
        </div>

        <div style="flex: 1; overflow-y: auto; background: var(--cream); border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem; max-height: 50vh;">
          ${messages.map(msg => {
            const isCustomer = msg.sender_type === 'customer';
            return `
              <div style="margin-bottom: 1.5rem; display: flex; justify-content: ${isCustomer ? 'flex-start' : 'flex-end'};">
                <div style="max-width: 70%; background: ${isCustomer ? 'white' : 'var(--wood-dark)'}; color: ${isCustomer ? 'var(--slate-gray)' : 'white'}; padding: 1rem; border-radius: 15px; box-shadow: var(--shadow-light);">
                  <div style="margin-bottom: 0.5rem;">
                    <strong>${msg.sender_name}</strong>
                    <span style="font-size: 0.85rem; opacity: 0.8; margin-left: 0.5rem;">
                      ${new Date(msg.created_at).toLocaleString('fr-FR')}
                    </span>
                  </div>
                  <div style="white-space: pre-wrap; line-height: 1.5;">${msg.message}</div>
                  ${msg.has_attachments && msg.attachments ? `
                    <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid ${isCustomer ? '#eee' : 'rgba(255,255,255,0.3)'};">
                      <strong style="font-size: 0.9rem;">📎 Pièces jointes:</strong>
                      ${msg.attachments.map(att => `
                        <div style="margin-top: 0.5rem;">
                          <a href="/attachments/${att.file_path}" target="_blank" style="color: ${isCustomer ? 'var(--wood-dark)' : 'white'}; text-decoration: underline;">
                            ${att.filename}
                          </a>
                        </div>
                      `).join('')}
                    </div>
                  ` : ''}
                </div>
              </div>
            `;
        }).join('')}
        </div>

        <div>
          <button onclick="replyToThread(${threadId})" class="btn btn-primary" style="width: 100%; padding: 1rem;">
            💬 Répondre
          </button>
        </div>
      </div>
    `;

    } catch (error) {
        console.error('Erreur:', error);
        showError('Erreur lors du chargement de la conversation');
        modal.remove();
    }
}

// Répondre à un thread
function replyToThread(threadId) {
    const thread = allThreads.find(t => t.id === threadId);
    if (!thread) return;

    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.style.zIndex = '10002';
    modal.innerHTML = `
    <div class="modal-content" style="max-width: 700px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
        <h3 style="margin: 0; color: var(--wood-dark); font-size: 1.8rem;">
          Répondre à ${thread.customer_name}
        </h3>
        <button onclick="this.closest('.modal').remove()" style="background: none; border: none; font-size: 2rem; cursor: pointer; color: var(--slate-gray);">×</button>
      </div>

      <form id="reply-form" onsubmit="sendReply(event, ${threadId})">
        <div style="margin-bottom: 1.5rem;">
          <label style="display: block; margin-bottom: 0.5rem; color: var(--wood-dark); font-weight: 600;">
            Votre message
          </label>
          <textarea id="reply-message" required rows="8"
            style="width: 100%; padding: 1rem; border: 2px solid var(--wood-light); border-radius: 12px; resize: vertical;"
            placeholder="Écrivez votre réponse..."></textarea>
        </div>

        <div style="margin-bottom: 1.5rem;">
          <label style="display: block; margin-bottom: 0.5rem; color: var(--wood-dark); font-weight: 600;">
            Pièces jointes (optionnel)
          </label>
          <input type="file" id="reply-attachments" multiple accept="image/*,.pdf"
            style="width: 100%; padding: 0.75rem; border: 2px solid var(--wood-light); border-radius: 12px;">
          <small style="display: block; margin-top: 0.5rem; color: var(--slate-gray);">
            Jusqu'à 5 fichiers (images ou PDF, 10 Mo maximum par fichier)
          </small>
        </div>

        <div style="display: flex; gap: 1rem;">
          <button type="submit" class="btn btn-primary" style="flex: 1;">
            Envoyer la réponse
          </button>
          <button type="button" onclick="this.closest('.modal').remove()" class="btn btn-secondary" style="flex: 1;">
            Annuler
          </button>
        </div>
      </form>
    </div>
  `;

    document.body.appendChild(modal);
}

// Envoyer une réponse
async function sendReply(event, threadId) {
    event.preventDefault();

    const messageInput = document.getElementById('reply-message');
    const attachmentsInput = document.getElementById('reply-attachments');
    const message = messageInput.value.trim();

    if (!message) {
        showError('Le message est requis');
        return;
    }

    const formData = new FormData();
    formData.append('message', message);

    // Ajouter les pièces jointes
    if (attachmentsInput.files.length > 0) {
        for (let i = 0; i < Math.min(attachmentsInput.files.length, 5); i++) {
            formData.append('attachments', attachmentsInput.files[i]);
        }
    }

    try {
        const response = await fetch(`/api/messages/threads/${threadId}/reply`, {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            showSuccess('Réponse envoyée avec succès');
            // Fermer tous les modals
            document.querySelectorAll('.modal').forEach(m => m.remove());
            // Recharger les threads
            loadThreads();
        } else {
            showError(result.error || 'Erreur lors de l\'envoi');
        }
    } catch (error) {
        console.error('Erreur:', error);
        showError('Erreur lors de l\'envoi de la réponse');
    }
}

// Fermer un thread
async function closeThread(threadId) {
    try {
        const response = await fetch(`/api/messages/threads/${threadId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'closed' })
        });

        const result = await response.json();

        if (result.success) {
            showSuccess('Conversation fermée');
            loadThreads();
        }
    } catch (error) {
        console.error('Erreur:', error);
        showError('Erreur lors de la fermeture');
    }
}

// Rouvrir un thread
async function reopenThread(threadId) {
    try {
        const response = await fetch(`/api/messages/threads/${threadId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'open' })
        });

        const result = await response.json();

        if (result.success) {
            showSuccess('Conversation rouverte');
            loadThreads();
        }
    } catch (error) {
        console.error('Erreur:', error);
        showError('Erreur lors de la réouverture');
    }
}

// Supprimer un thread
async function deleteThread(threadId) {
    const confirmed = await showConfirm({
        title: 'Supprimer cette conversation ?',
        message: 'Cette action est irréversible. Tous les messages et pièces jointes seront définitivement supprimés.',
        icon: '🗑️',
        confirmText: '🗑️ Supprimer',
        cancelText: 'Annuler'
    });

    if (!confirmed) return;

    try {
        const response = await fetch(`/api/messages/threads/${threadId}`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (result.success) {
            showSuccess('Conversation supprimée avec succès');
            loadThreads();
        } else {
            showError('Erreur lors de la suppression');
        }
    } catch (error) {
        console.error('Erreur:', error);
        showError('Erreur lors de la suppression');
    }
}

// ====================================
// GESTION DES CATÉGORIES
// ====================================

let allCategories = [];

// Charger les catégories
async function loadCategories() {
    try {
        const response = await fetch('/api/settings/categories');
        allCategories = await response.json();
        displayCategories();
        updateCategorySelect();
    } catch (error) {
        console.error('Erreur chargement catégories:', error);
    }
}

// Afficher les catégories
function displayCategories() {
    const container = document.getElementById('categories-list');

    if (allCategories.length === 0) {
        container.innerHTML = '<span style="color: var(--slate-gray);">Aucune catégorie</span>';
        return;
    }

    container.innerHTML = allCategories.map(cat => `
    <div style="display: flex; align-items: center; gap: 1rem; padding: 1rem;
                background: white; border: 2px solid var(--wood-light); border-radius: 12px;">
      <div style="font-size: 2rem;">${cat.emoji || '🪵'}</div>
      <div style="flex: 1;">
        <div style="font-weight: 600; color: var(--wood-dark);">${cat.name}</div>
        <div style="font-size: 0.9rem; color: var(--slate-gray);">${cat.description || ''}</div>
      </div>
      <button onclick="editCategory(${cat.id}, '${cat.name.replace(/'/g, "\\'")}', '${(cat.emoji || '🪵').replace(/'/g, "\\'")}', '${(cat.description || '').replace(/'/g, "\\'")}')"
              class="btn btn-secondary" style="padding: 0.5rem 1rem; font-size: 0.9rem;">
        Modifier
      </button>
      <button onclick="deleteCategory(${cat.id})"
              style="background: #C17B7B; color: white; border: none; padding: 0.5rem; border-radius: 8px;
                     cursor: pointer; font-weight: 600; font-size: 1.2rem; transition: all 0.2s ease;
                     width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;"
              onmouseover="this.style.background='#A86565'; this.style.transform='scale(1.1) rotate(90deg)'; this.style.boxShadow='0 4px 10px rgba(193, 123, 123, 0.3)'"
              onmouseout="this.style.background='#C17B7B'; this.style.transform='scale(1) rotate(0deg)'; this.style.boxShadow='none'"
              title="Supprimer">
        ✕
      </button>
    </div>
  `).join('');
}

// Mettre à jour le select de catégories dans le formulaire produit
function updateCategorySelect() {
    const select = document.getElementById('product-category');
    if (!select) return;

    select.innerHTML = allCategories.map(cat =>
        `<option value="${cat.name}">${cat.name}</option>`
    ).join('');
}

// Ajouter une catégorie
async function addCategory() {
    const nameInput = document.getElementById('new-category-input');
    const emojiInput = document.getElementById('new-category-emoji');
    const descriptionInput = document.getElementById('new-category-description');

    const name = nameInput.value.trim();
    const emoji = emojiInput.value.trim() || '🪵';
    const description = descriptionInput.value.trim();

    if (!name) {
        showError('Veuillez entrer un nom de catégorie');
        return;
    }

    try {
        const response = await fetch('/api/settings/categories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, emoji, description })
        });

        const data = await response.json();

        if (data.success) {
            showSuccess('Catégorie ajoutée');
            nameInput.value = '';
            emojiInput.value = '';
            descriptionInput.value = '';
            loadCategories();
        } else {
            showError('Erreur: ' + data.error);
        }
    } catch (error) {
        console.error('Erreur:', error);
        showError('Erreur lors de l\'ajout');
    }
}

// Annuler la modification d'une catégorie
function cancelEditCategory() {
    const nameInput = document.getElementById('new-category-input');
    const emojiInput = document.getElementById('new-category-emoji');
    const descriptionInput = document.getElementById('new-category-description');
    const submitButton = document.getElementById('category-submit-btn');
    const cancelButton = document.getElementById('category-cancel-btn');

    // Réinitialiser les champs
    nameInput.value = '';
    emojiInput.value = '';
    descriptionInput.value = '';

    // Remettre le bouton en mode "Ajouter"
    submitButton.textContent = 'Ajouter la catégorie';
    submitButton.onclick = addCategory;

    // Cacher le bouton annuler
    cancelButton.style.display = 'none';
}

// Modifier une catégorie
async function editCategory(id, currentName, currentEmoji, currentDescription) {
    const nameInput = document.getElementById('new-category-input');
    const emojiInput = document.getElementById('new-category-emoji');
    const descriptionInput = document.getElementById('new-category-description');
    const submitButton = document.getElementById('category-submit-btn');
    const cancelButton = document.getElementById('category-cancel-btn');

    // Pré-remplir les champs
    nameInput.value = currentName;
    emojiInput.value = currentEmoji;
    descriptionInput.value = currentDescription;

    // Afficher le bouton annuler
    cancelButton.style.display = 'block';

    // Changer le bouton en mode "Mettre à jour"
    submitButton.textContent = 'Mettre à jour';
    submitButton.onclick = async () => {
        const name = nameInput.value.trim();
        const emoji = emojiInput.value.trim() || '🪵';
        const description = descriptionInput.value.trim();

        if (!name) {
            showError('Veuillez entrer un nom de catégorie');
            return;
        }

        try {
            const response = await fetch(`/api/settings/categories/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, emoji, description })
            });

            const data = await response.json();

            if (data.success) {
                showSuccess('Catégorie modifiée');
                nameInput.value = '';
                emojiInput.value = '';
                descriptionInput.value = '';
                loadCategories();
                // Remettre le bouton en mode "Ajouter"
                submitButton.textContent = 'Ajouter la catégorie';
                submitButton.onclick = addCategory;
                // Cacher le bouton annuler
                cancelButton.style.display = 'none';
            } else {
                showError('Erreur: ' + data.error);
            }
        } catch (error) {
            console.error('Erreur:', error);
            showError('Erreur lors de la modification');
        }
    };

    // Scroll vers le haut pour voir les champs
    nameInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// Supprimer une catégorie
async function deleteCategory(categoryId) {
    const confirmed = await showConfirm({
        title: 'Supprimer cette catégorie ?',
        message: 'Les produits utilisant cette catégorie ne pourront pas être supprimés.',
        icon: '🗑️',
        confirmText: '🗑️ Supprimer',
        cancelText: 'Annuler'
    });

    if (!confirmed) return;

    try {
        const response = await fetch(`/api/settings/categories/${categoryId}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (data.success) {
            showSuccess('Catégorie supprimée');
            loadCategories();
        } else {
            showError('Erreur: ' + data.error);
        }
    } catch (error) {
        console.error('Erreur:', error);
        showError('Erreur lors de la suppression');
    }
}

// ═══════════════════════════════════════════════════
// Gestion des types de bois
// ═══════════════════════════════════════════════════

// Charger les types de bois
async function loadWoodTypes() {
    try {
        const response = await fetch('/api/settings/wood-types');
        allWoodTypes = await response.json();
        displayWoodTypes();
        updateWoodTypeSelect();
    } catch (error) {
        console.error('Erreur chargement types de bois:', error);
    }
}

// Afficher les types de bois
function displayWoodTypes() {
    const container = document.getElementById('wood-types-list');

    if (allWoodTypes.length === 0) {
        container.innerHTML = '<span style="color: var(--slate-gray);">Aucun type de bois</span>';
        return;
    }

    container.innerHTML = allWoodTypes.map(woodType => `
    <div style="display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem;
                background: var(--wood-light); border-radius: 8px; border: 2px solid var(--wood-medium);">
      <span style="color: var(--wood-dark); font-weight: 600;">${woodType.name}</span>
      <button onclick="deleteWoodType(${woodType.id})"
              style="background: none; border: none; cursor: pointer; color: #991B1B; font-size: 1.2rem; padding: 0; line-height: 1;"
              title="Supprimer">×</button>
    </div>
  `).join('');
}

// Mettre à jour le select des types de bois dans le formulaire
function updateWoodTypeSelect() {
    const select = document.getElementById('product-wood');
    if (!select) return;

    const currentValue = select.value;

    select.innerHTML = '<option value="">-- Sélectionner --</option>';
    allWoodTypes.forEach(woodType => {
        const option = document.createElement('option');
        option.value = woodType.name;
        option.textContent = woodType.name;
        select.appendChild(option);
    });

    if (currentValue) {
        select.value = currentValue;
    }
}

// Ajouter un type de bois
async function addWoodType() {
    const input = document.getElementById('new-wood-type-input');
    const name = input.value.trim();

    if (!name) {
        showError('Veuillez entrer un nom de type de bois');
        return;
    }

    try {
        const response = await fetch('/api/settings/wood-types', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });

        const data = await response.json();

        if (data.success) {
            showSuccess('Type de bois ajouté');
            input.value = '';
            loadWoodTypes();
        } else {
            showError('Erreur: ' + data.error);
        }
    } catch (error) {
        console.error('Erreur:', error);
        showError('Erreur lors de l\'ajout');
    }
}

// Supprimer un type de bois
async function deleteWoodType(woodTypeId) {
    const confirmed = await showConfirm({
        title: 'Supprimer ce type de bois ?',
        message: 'Les produits utilisant ce type de bois ne pourront pas être supprimés.',
        icon: '🗑️',
        confirmText: '🗑️ Supprimer',
        cancelText: 'Annuler'
    });

    if (!confirmed) return;

    try {
        const response = await fetch(`/api/settings/wood-types/${woodTypeId}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (data.success) {
            showSuccess('Type de bois supprimé');
            loadWoodTypes();
        } else {
            showError('Erreur: ' + data.error);
        }
    } catch (error) {
        console.error('Erreur:', error);
        showError('Erreur lors de la suppression');
    }
}

// Gestion des onglets
document.addEventListener('DOMContentLoaded', async () => {
    // Vérifier l'authentification
    const isAuth = await checkAuth();
    if (!isAuth) return;

    // Charger les données
    loadStats();
    loadProducts();
    loadOrders();
    loadThreads();
    loadCategories();
    loadWoodTypes();

    // Gérer la sélection de nouvelles images
    const imageInput = document.getElementById('product-images');
    if (imageInput) {
        imageInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            if (files.length > 0) {
                // Ajouter les nouveaux fichiers au tableau existant (accumulation)
                files.forEach(file => {
                    newImageFiles.push(file);

                    // Ajouter aussi à allImagesOrderBoutDeBois
                    if (!window.allImagesOrderBoutDeBois) {
                        window.allImagesOrderBoutDeBois = [];
                    }
                    window.allImagesOrderBoutDeBois.push({
                        type: 'new',
                        data: file
                    });
                });

                // Réinitialiser l'input pour permettre de sélectionner à nouveau
                e.target.value = '';
                displayNewImages();
            }
        });
    }

    // Gestion des onglets
    const tabs = document.querySelectorAll('.admin-tab');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Désactiver tous les onglets
            tabs.forEach(t => {
                t.classList.remove('active');
            });
            contents.forEach(c => {
                c.classList.remove('active');
                c.classList.remove('fade-in');
            });

            // Activer l'onglet cliqué
            tab.classList.add('active');
            const tabName = tab.dataset.tab;
            const activeContent = document.getElementById(`tab-${tabName}`);
            activeContent.classList.add('active');
            activeContent.classList.add('fade-in');

            // Charger les données si nécessaire
            if (tabName === 'stats') {
                loadStats();
            } else if (tabName === 'orders') {
                loadOrders();
            } else if (tabName === 'messages') {
                loadThreads();
            } else if (tabName === 'boutique') {
                loadBoutiqueImages();
            } else if (tabName === 'settings') {
                loadCategories();
                loadWoodTypes();
            }
        });
    });
});

// ═══════════════════════════════════════════════════
// Gestion de la boutique (images)
// ═══════════════════════════════════════════════════

let boutiqueImages = [];

// Charger les images de la boutique
async function loadBoutiqueImages() {
    try {
        const response = await fetch('/api/boutique/images');
        boutiqueImages = await response.json();
        displayBoutiqueImages();
    } catch (error) {
        console.error('Erreur chargement images boutique:', error);
        showNotification('Erreur lors du chargement des images', 'error');
    }
}

// Afficher les images de la boutique
function displayBoutiqueImages() {
    const grid = document.getElementById('boutique-images-grid');
    const noImagesMsg = document.getElementById('no-boutique-images');
    const hint = document.getElementById('boutique-images-hint');

    if (boutiqueImages.length === 0) {
        grid.style.display = 'none';
        noImagesMsg.style.display = 'block';
        if (hint) hint.style.display = 'none';
        return;
    }

    grid.style.display = 'grid';
    noImagesMsg.style.display = 'none';
    if (hint) hint.style.display = 'block';

    grid.innerHTML = boutiqueImages.map((img, index) => `
    <div class="boutique-image-item" data-id="${img.id}" data-order="${img.display_order}"
         style="position: relative; background: white; border-radius: 12px; padding: 0.5rem;
                box-shadow: var(--shadow-light); border: 3px solid var(--wood-light);">

      <!-- Bouton supprimer en haut à droite -->
      <button onclick="deleteBoutiqueImage(${img.id})"
              style="position: absolute; top: 0.75rem; right: 0.75rem; z-index: 10;
                     background: var(--wood-medium); color: white; border: none;
                     width: 32px; height: 32px; border-radius: 8px; cursor: pointer;
                     display: flex; align-items: center; justify-content: center;
                     font-size: 1.2rem; font-weight: 700; transition: all 0.3s ease;
                     box-shadow: 0 2px 8px rgba(139, 90, 60, 0.3);"
              onmouseover="this.style.transform='scale(1.1) rotate(90deg)'; this.style.boxShadow='0 4px 12px rgba(139, 90, 60, 0.5)'; this.style.opacity='0.9'"
              onmouseout="this.style.transform='scale(1) rotate(0deg)'; this.style.boxShadow='0 2px 8px rgba(139, 90, 60, 0.3)'; this.style.opacity='1'">
        ✕
      </button>

      <img src="${img.image_path}" alt="Boutique"
           style="width: 100%; height: 200px; object-fit: cover; border-radius: 8px; margin-bottom: 0.5rem;">

      <div style="display: flex; gap: 0.5rem; justify-content: center; align-items: center;">
        <button onclick="moveBoutiqueImage(${img.id}, -1)"
                class="btn btn-secondary"
                ${index === 0 ? 'disabled' : ''}
                style="padding: 0.5rem; font-size: 1rem; border-radius: 8px; width: 36px; height: 36px;
                       display: flex; align-items: center; justify-content: center; cursor: pointer;">
          ◀
        </button>
        <div style="display: flex; align-items: center; gap: 0.3rem;">
          <span style="color: var(--slate-gray); font-size: 0.85rem; white-space: nowrap;">Position</span>
          <input type="number"
                 value="${index + 1}"
                 min="1"
                 max="${boutiqueImages.length}"
                 onchange="changeBoutiqueImagePosition(${img.id}, this.value)"
                 style="width: 45px; padding: 0.4rem; text-align: center; border: 2px solid var(--wood-medium);
                        border-radius: 8px; font-size: 0.9rem; font-weight: 600; -moz-appearance: textfield;"
                 onwheel="this.blur()">
        </div>
        <button onclick="moveBoutiqueImage(${img.id}, 1)"
                class="btn btn-secondary"
                ${index === boutiqueImages.length - 1 ? 'disabled' : ''}
                style="padding: 0.5rem; font-size: 1rem; border-radius: 8px; width: 36px; height: 36px;
                       display: flex; align-items: center; justify-content: center; cursor: pointer;">
          ▶
        </button>
      </div>
    </div>
  `).join('');
}

// Ajouter une image de la boutique
async function uploadBoutiqueImage() {
    const input = document.getElementById('boutique-image-input');
    const file = input.files[0];

    if (!file) {
        showNotification('Veuillez sélectionner une image', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('image', file);

    try {
        const response = await fetch('/api/boutique/images', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error('Erreur lors de l\'upload');
        }

        const newImage = await response.json();
        boutiqueImages.push(newImage);
        displayBoutiqueImages();
        input.value = '';
        showNotification('Image ajoutée avec succès !', 'success');
    } catch (error) {
        console.error('Erreur upload image:', error);
        showNotification('Erreur lors de l\'ajout de l\'image', 'error');
    }
}

// Supprimer une image de la boutique
async function deleteBoutiqueImage(id) {
    if (!confirm('Voulez-vous vraiment supprimer cette image ?')) {
        return;
    }

    try {
        const response = await fetch(`/api/boutique/images/${id}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error('Erreur lors de la suppression');
        }

        boutiqueImages = boutiqueImages.filter(img => img.id !== id);
        displayBoutiqueImages();
        showNotification('Image supprimée avec succès !', 'success');
    } catch (error) {
        console.error('Erreur suppression image:', error);
        showNotification('Erreur lors de la suppression', 'error');
    }
}

// Déplacer une image de la boutique
async function moveBoutiqueImage(id, direction) {
    const index = boutiqueImages.findIndex(img => img.id === id);

    if (index === -1) return;

    const newIndex = index + direction;

    if (newIndex < 0 || newIndex >= boutiqueImages.length) return;

    // Échanger les positions
    [boutiqueImages[index], boutiqueImages[newIndex]] = [boutiqueImages[newIndex], boutiqueImages[index]];

    // Mettre à jour les display_order
    const updatedImages = boutiqueImages.map((img, idx) => ({
        id: img.id,
        display_order: idx + 1
    }));

    try {
        const response = await fetch('/api/boutique/images/reorder', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ images: updatedImages })
        });

        if (!response.ok) {
            throw new Error('Erreur lors de la réorganisation');
        }

        // Mettre à jour l'affichage local
        boutiqueImages.forEach((img, idx) => {
            img.display_order = idx + 1;
        });

        displayBoutiqueImages();
    } catch (error) {
        console.error('Erreur réorganisation:', error);
        showNotification('Erreur lors de la réorganisation', 'error');
        loadBoutiqueImages(); // Recharger pour rétablir l'ordre
    }
}

// Changer directement la position d'une image de boutique
async function changeBoutiqueImagePosition(id, newPosition) {
    const newPos = parseInt(newPosition);

    // Validation
    if (isNaN(newPos) || newPos < 1 || newPos > boutiqueImages.length) {
        showNotification('Position invalide', 'error');
        displayBoutiqueImages(); // Réafficher pour rétablir la valeur
        return;
    }

    const currentIndex = boutiqueImages.findIndex(img => img.id === id);
    if (currentIndex === -1) return;

    // Si c'est déjà la bonne position, ne rien faire
    if (currentIndex + 1 === newPos) return;

    // Déplacer l'élément à la nouvelle position
    const [movedImage] = boutiqueImages.splice(currentIndex, 1);
    boutiqueImages.splice(newPos - 1, 0, movedImage);

    // Mettre à jour les display_order
    const updatedImages = boutiqueImages.map((img, idx) => ({
        id: img.id,
        display_order: idx + 1
    }));

    try {
        const response = await fetch('/api/boutique/images/reorder', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ images: updatedImages })
        });

        if (!response.ok) {
            throw new Error('Erreur lors de la réorganisation');
        }

        // Mettre à jour l'affichage local
        boutiqueImages.forEach((img, idx) => {
            img.display_order = idx + 1;
        });

        displayBoutiqueImages();
        showNotification('Position mise à jour', 'success');
    } catch (error) {
        console.error('Erreur réorganisation:', error);
        showNotification('Erreur lors de la réorganisation', 'error');
        loadBoutiqueImages(); // Recharger pour rétablir l'ordre
    }
}

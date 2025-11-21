import Sigma from "sigma";
import forceAtlas2 from "graphology-layout-forceatlas2";

let renderer = null;
let currentGraphKey = null;
let currentSearchHandler = null; // Stoque la référence de la fonction d'écouteur pour la suppression

/**
 * Stops and cleans up the previous Sigma instance and search listener.
 */
export function killRenderer() {
    if (renderer) {
        // Supprimer tous les écouteurs de Sigma
        renderer.removeAllListeners(); 
        renderer.kill();
        renderer = null;
        currentGraphKey = null;
        
        // FIX CLÉ : Suppression explicite de l'écouteur de recherche du DOM
        const searchInput = document.getElementById("search-input");
        if (searchInput && currentSearchHandler) {
            searchInput.removeEventListener("keydown", currentSearchHandler);
            currentSearchHandler = null; // Nettoyer la référence
        }

        const tooltip = document.getElementById("tooltip");
        if (tooltip) tooltip.style.display = "none";
        if (searchInput) searchInput.value = "";
    }
}

/**
 * Applies the ForceAtlas2 layout and normalizes coordinates.
 * @param {Graph} graph - The graphology instance.
 */
function applyLayout(graph) {
  // Apply ForceAtlas2 layout
  forceAtlas2.assign(graph, { iterations: 100, settings: { gravity: 1 } });

  // Normalize coordinates (-1 to 1) for better initial view
  const xs = [], ys = [];
  graph.forEachNode((n, attr) => { xs.push(attr.x); ys.push(attr.y); });
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);

  let tempMaxX = maxX;
  let tempMaxY = maxY;
  if (tempMaxX === minX) tempMaxX = minX + 1; 
  if (tempMaxY === minY) tempMaxY = minY + 1; 

  graph.forEachNode((n, attr) => {
    const nx = (attr.x - minX) / (tempMaxX - minX) * 2 - 1;
    const ny = (attr.y - minY) / (tempMaxY - minY) * 2 - 1;
    graph.setNodeAttribute(n, "x", nx);
    graph.setNodeAttribute(n, "y", ny);
  });
}

/**
 * Registers all graph interaction listeners (hover, click, search).
 * @param {Graph} graph - The graphology instance.
 * @param {Sigma} renderer - The Sigma renderer instance.
 */
function registerEventListeners(graph, renderer) {
  // Références au DOM (cherchées ici pour plus de sécurité)
  const tooltip = document.getElementById("tooltip");
  const searchInput = document.getElementById("search-input");

  // --- Node Hover + Tooltip Logic ---
  renderer.on("enterNode", ({ node }) => {
    const neighbors = new Set(graph.neighbors(node));
    neighbors.add(node);

    // Dim non-neighbors (Logic omise pour la brièveté, mais elle doit être ici)
    graph.forEachNode(n => {
      if (neighbors.has(n)) {
        graph.setNodeAttribute(n, "color", graph.getNodeAttribute(n, "originalColor"));
        graph.setNodeAttribute(n, "size", graph.getNodeAttribute(n, "originalSize"));
      } else {
        graph.setNodeAttribute(n, "color", "#555");
        graph.setNodeAttribute(n, "size", graph.getNodeAttribute(n, "originalSize") * 0.7);
      }
    });

    // Dim non-incident edges
    graph.forEachEdge(e => {
      const source = graph.source(e);
      const target = graph.target(e);
      if (neighbors.has(source) && neighbors.has(target)) {
        graph.setEdgeAttribute(e, "color", graph.getEdgeAttribute(e, "originalColor"));
      } else {
        graph.setEdgeAttribute(e, "color", "#444");
      }
    });

    if (tooltip) {
        tooltip.innerHTML = `<strong>${graph.getNodeAttribute(node, "label")}</strong>`;
        tooltip.style.display = "block";
    }
  });

  renderer.on("leaveNode", () => {
    // Restore all node and edge colors/sizes
    graph.forEachNode(n => {
      graph.setNodeAttribute(n, "color", graph.getNodeAttribute(n, "originalColor"));
      graph.setNodeAttribute(n, "size", graph.getNodeAttribute(n, "originalSize"));
    });
    graph.forEachEdge(e => {
      graph.setEdgeAttribute(e, "color", graph.getEdgeAttribute(e, "originalColor"));
    });
    if (tooltip) tooltip.style.display = "none";
  });

  renderer.getMouseCaptor().on("mousemovebody", (event) => {
    if (tooltip) {
        tooltip.style.left = event.clientX + 10 + "px";
        tooltip.style.top = event.clientY + 10 + "px";
    }
  });

  // --- Node Click → Open Wiki ---
  renderer.on("clickNode", ({ node }) => {
    const nodeLabel = graph.getNodeAttribute(node, "label");
    const url = `https://stardewvalleywiki.com/${encodeURIComponent(nodeLabel.replace(/\s/g, "_"))}`;
    window.open(url, "_blank");
  });

  // --- Search Functionality ---
  if (searchInput) {
    // Définition de la fonction d'écouteur
    const searchHandler = (e) => {
      if (e.key === "Enter") {
        let query = searchInput.value.trim();
        if (!query) return;

        // Standardiser la requête
        query = query.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()); 

        // Filtrer
        let matches = graph.nodes().filter(n => graph.getNodeAttribute(n, "label") === query);
        if (matches.length === 0) {
          matches = graph.nodes().filter(n => graph.getNodeAttribute(n, "label").startsWith(query));
        }

        if (matches.length === 1) {
          const nodeId = matches[0];
          const camera = renderer.getCamera();

          // FIX CLÉ : Tente d'utiliser les coordonnées du rendu (préféré), sinon utilise les coordonnées logiques (fallback)
          let nodeDisplay = renderer.getNodeDisplayData(nodeId);
          let targetX, targetY;
          
          if (nodeDisplay) {
            targetX = nodeDisplay.x;
            targetY = nodeDisplay.y;
          } else {
            // Solution de repli pour éviter le crash au chargement du graphe
            const nodeAttributes = graph.getNodeAttributes(nodeId);
            targetX = nodeAttributes.x;
            targetY = nodeAttributes.y;
          }

          // Animation
          camera.animate({ x: targetX, y: targetY, ratio: 0.1 }, { duration: 600 });

          // Surbrillance
          graph.forEachNode(n => {
            if (n === nodeId) {
              graph.setNodeAttribute(n, "size", graph.getNodeAttribute(n, "originalSize") * 1.5);
              graph.setNodeAttribute(n, "color", "#ff0000"); 
            } else {
              graph.setNodeAttribute(n, "size", graph.getNodeAttribute(n, "originalSize"));
              graph.setNodeAttribute(n, "color", graph.getNodeAttribute(n, "originalColor"));
            }
          });

          // Clear highlight
          setTimeout(() => {
              graph.setNodeAttribute(nodeId, "size", graph.getNodeAttribute(nodeId, "originalSize"));
              graph.setNodeAttribute(nodeId, "color", graph.getNodeAttribute(nodeId, "originalColor"));
          }, 800);

        } else if (matches.length > 1) {
          alert(`Multiple nodes match "${query}": ${matches.map(n => graph.getNodeAttribute(n, "label")).join(", ")}`);
        } else {
          alert("Node not found!");
        }
      }
    };
    
    // **FIX CLÉ** : Stocker la référence et attacher le nouvel écouteur.
    currentSearchHandler = searchHandler;
    searchInput.addEventListener("keydown", currentSearchHandler);
  }
}


/**
 * Initializes the Sigma renderer and registers all interactions.
 * @param {Graph} graph - The fully populated graphology instance.
 * @param {string} key - The key of the current graph.
 */
export function initGraphRenderer(graph, key) {
  currentGraphKey = key;

  // 1. Apply Layout
  applyLayout(graph);

  // 2. Initialize Renderer
  const container = document.getElementById("graph-container");
  if (!container) {
    console.error("Graph container not found.");
    return;
  }
  
  renderer = new Sigma(graph, container, {
    minCameraRatio: 0.01,
    maxCameraRatio: 10,
  });

  // 3. Register Interactions
  registerEventListeners(graph, renderer);

  console.log(`Graph renderer initialized for: ${key}`);
}
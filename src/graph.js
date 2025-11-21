import Sigma from "sigma";
import forceAtlas2 from "graphology-layout-forceatlas2";

// Déclarer les variables DOM/Renderer pour qu'elles soient gérées localement.
// NE FAITES PLUS de document.getElementById ici.
let renderer = null;
let currentGraphKey = null; // Nouvelle variable pour suivre le graphe actif

/**
 * Arrête et nettoie l'instance Sigma précédente.
 */
export function killRenderer() {
    if (renderer) {
        renderer.kill();
        renderer = null;
        currentGraphKey = null;
        // Optionnel: masquer le tooltip et vider la recherche
        document.getElementById("tooltip").style.display = "none";
        document.getElementById("search-input").value = "";
    }
}

/**
 * Applique le ForceAtlas2 layout et normalise les coordonnées.
 * @param {Graph} graph - The graphology instance.
 */
function applyLayout(graph) {
  // ... (Pas de changement dans cette fonction) ...
  forceAtlas2.assign(graph, { iterations: 100, settings: { gravity: 1 } });

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
  // Références au DOM (recherchées ici pour plus de sécurité)
  const tooltip = document.getElementById("tooltip");
  const searchInput = document.getElementById("search-input");

  // --- Node Hover + Tooltip Logic ---
  // ... (Le reste du code de hover, leave et mousemove reste le même) ...
  renderer.on("enterNode", ({ node }) => {
    const neighbors = new Set(graph.neighbors(node));
    neighbors.add(node);

    // Dim non-neighbors
    graph.forEachNode(n => {
      if (neighbors.has(n)) {
        // Restore original attributes for neighbors
        graph.setNodeAttribute(n, "color", graph.getNodeAttribute(n, "originalColor"));
        graph.setNodeAttribute(n, "size", graph.getNodeAttribute(n, "originalSize"));
      } else {
        // Dim non-neighbors
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

    // Update and show tooltip
    tooltip.innerHTML = `<strong>${graph.getNodeAttribute(node, "label")}</strong>`;
    tooltip.style.display = "block";
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
    tooltip.style.display = "none";
  });

  // Position tooltip next to cursor
  renderer.getMouseCaptor().on("mousemovebody", (event) => {
    tooltip.style.left = event.clientX + 10 + "px";
    tooltip.style.top = event.clientY + 10 + "px";
  });

  // --- Node Click → Open Wiki ---
  renderer.on("clickNode", ({ node }) => {
    const nodeLabel = graph.getNodeAttribute(node, "label");
    const url = `https://stardewvalleywiki.com/${encodeURIComponent(nodeLabel.replace(/\s/g, "_"))}`;
    window.open(url, "_blank");
  });

  // --- Search Functionality ---
  if (searchInput) {
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        let query = searchInput.value.trim();
        if (!query) return;

        // Capitalize the first letter of each word (better matching with graph labels)
        query = query.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()); 

        // Filter all nodes that match the query
        let matches = graph.nodes().filter(n => graph.getNodeAttribute(n, "label") === query);
        if (matches.length === 0) {
          matches = graph.nodes().filter(n => graph.getNodeAttribute(n, "label").startsWith(query));
        }
        // ... (Le reste de la logique de recherche reste le même) ...

        if (matches.length === 1) {
          const nodeId = matches[0];
          const nodeDisplay = renderer.getNodeDisplayData(nodeId);
          const camera = renderer.getCamera();

          // Animate camera to center on the found node
          camera.animate({ x: nodeDisplay.x, y: nodeDisplay.y, ratio: 0.1 }, { duration: 600 });

          // Temporary highlight
          graph.forEachNode(n => {
            if (n === nodeId) {
              graph.setNodeAttribute(n, "size", graph.getNodeAttribute(n, "originalSize") * 1.5);
              graph.setNodeAttribute(n, "color", "#ff0000"); // Highlight in Red
            } else {
              // Restore others
              graph.setNodeAttribute(n, "size", graph.getNodeAttribute(n, "originalSize"));
              graph.setNodeAttribute(n, "color", graph.getNodeAttribute(n, "originalColor"));
            }
          });

          // Clear highlight after animation duration
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
    });
  }
}


/**
 * Initializes the Sigma renderer and registers all interactions.
 * @param {Graph} graph - The fully populated graphology instance.
 * @param {string} key - La clé du graphe actuel (pour référence future).
 */
export function initGraphRenderer(graph, key) {
  currentGraphKey = key; // Stocker la clé

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
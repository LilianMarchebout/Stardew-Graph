import Sigma from "sigma";
import forceAtlas2 from "graphology-layout-forceatlas2";

const tooltip = document.getElementById("tooltip");
const searchInput = document.getElementById("search-input");
let renderer = null;

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

  if (maxX === minX) maxX = minX + 1; // Prevent division by zero
  if (maxY === minY) maxY = minY + 1; // Prevent division by zero

  graph.forEachNode((n, attr) => {
    const nx = (attr.x - minX) / (maxX - minX) * 2 - 1;
    const ny = (attr.y - minY) / (maxY - minY) * 2 - 1;
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
  // --- Node Hover + Tooltip Logic ---
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


/**
 * Initializes the Sigma renderer and registers all interactions.
 * This function is the entry point from main.js.
 * @param {Graph} graph - The fully populated graphology instance.
 */
export function initGraphRenderer(graph) {
  // 1. Apply Layout
  applyLayout(graph);

  // 2. Initialize Renderer
  const container = document.getElementById("graph-container");
  renderer = new Sigma(graph, container, {
    minCameraRatio: 0.01,
    maxCameraRatio: 10,
  });

  // 3. Register Interactions
  registerEventListeners(graph, renderer);

  console.log("Graph renderer initialized and interactions registered.");
}
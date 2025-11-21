import Graph from "graphology";
import Sigma from "sigma";
import Papa from "papaparse";
import forceAtlas2 from "graphology-layout-forceatlas2";

const graph = new Graph();
let renderer; // pour la recherche

// Tooltip
const tooltip = document.getElementById("tooltip");

// Barre de recherche
const searchInput = document.getElementById("search");

// Charger le CSV
Papa.parse("/Crafting.csv", {
  download: true,
  header: true,
  complete: function(results) {
    results.data.forEach((row, i) => {
      if (row["0%"] !== "") {
        const recipe = (row[""] || `Recipe${i}`).replace(/\s*\(.*?\)\s*/g, "").trim();
        const ingredients = (row["_1"] || "")
          .split(",")
          .map(item => item.replace(/\s*\(.*?\)\s*/g, "").trim());

        // Nœud recette
        if (!graph.hasNode(recipe)) {
          graph.addNode(recipe, {
            x: Math.random(),
            y: Math.random(),
            size: 10,
            type: "circle",
            color: "#33aaff",
            originalColor: "#33aaff",
            originalSize: 10,
            label: recipe
          });
        }

        // Nœuds ingrédients
        ingredients.forEach(ing => {
          if (!graph.hasNode(ing)) {
            graph.addNode(ing, {
              x: Math.random(),
              y: Math.random(),
              size: 8,
              type: "circle",
              color: "#d86c00ff",
              originalColor: "#d86c00ff",
              originalSize: 10,
              label: ing
            });
          }
          const edgeId = `${ing}->${recipe}`;
          if (!graph.hasEdge(edgeId)) {
            graph.addEdge(ing, recipe, { id: edgeId, color: "#999", originalColor: "#999" });
          }
        });
      }
    });

    // Layout ForceAtlas2
    forceAtlas2.assign(graph, { iterations: 100, settings: { gravity: 1 } });

    // Normaliser coordonnées (-1 à 1)
    const xs = [], ys = [];
    graph.forEachNode((n, attr) => { xs.push(attr.x); ys.push(attr.y); });
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    graph.forEachNode((n, attr) => {
      const nx = (attr.x - minX) / (maxX - minX) * 2 - 1;
      const ny = (attr.y - minY) / (maxY - minY) * 2 - 1;
      graph.setNodeAttribute(n, "x", nx);
      graph.setNodeAttribute(n, "y", ny);
    });

    // Sigma
    const container = document.getElementById("graph-container");
    renderer = new Sigma(graph, container);

    // Hover + tooltip
    renderer.on("enterNode", ({ node }) => {
      const neighbors = new Set(graph.neighbors(node));
      neighbors.add(node);

      graph.forEachNode(n => {
        if (neighbors.has(n)) {
          graph.setNodeAttribute(n, "color", graph.getNodeAttribute(n, "originalColor"));
          graph.setNodeAttribute(n, "size", graph.getNodeAttribute(n, "originalSize"));
        } else {
          graph.setNodeAttribute(n, "color", "#555");
          graph.setNodeAttribute(n, "size", graph.getNodeAttribute(n, "originalSize") * 0.7);
        }
      });

      graph.forEachEdge(e => {
        const source = graph.source(e);
        const target = graph.target(e);
        if (neighbors.has(source) && neighbors.has(target)) {
          graph.setEdgeAttribute(e, "color", graph.getEdgeAttribute(e, "originalColor"));
        } else {
          graph.setEdgeAttribute(e, "color", "#444");
        }
      });

      tooltip.innerHTML = `<strong>${graph.getNodeAttribute(node, "label")}</strong>`;
      tooltip.style.display = "block";
    });

    renderer.on("leaveNode", () => {
      graph.forEachNode(n => {
        graph.setNodeAttribute(n, "color", graph.getNodeAttribute(n, "originalColor"));
        graph.setNodeAttribute(n, "size", graph.getNodeAttribute(n, "originalSize"));
      });
      graph.forEachEdge(e => {
        graph.setEdgeAttribute(e, "color", graph.getEdgeAttribute(e, "originalColor"));
      });
      tooltip.style.display = "none";
    });

    renderer.getMouseCaptor().on("mousemovebody", (event) => {
      tooltip.style.left = event.clientX + 10 + "px";
      tooltip.style.top = event.clientY + 10 + "px";
    });

    // Click nœud → wiki
    renderer.on("clickNode", ({ node }) => {
      const nodeLabel = graph.getNodeAttribute(node, "label");
      const url = `https://stardewvalleywiki.com/${encodeURIComponent(nodeLabel.replace(/\s/g, "_"))}`;
      window.open(url, "_blank");
    });

    // Recherche
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        let query = searchInput.value.trim().toLowerCase();
        query = query.replace(/\b\w/g, c => c.toUpperCase()); // Capitalize

        // Filtrer tous les nœuds qui commencent par la query
        const matches = graph.nodes().filter(n => n.startsWith(query));

        if (matches.length === 1) {
          const nodeId = matches[0];
          const nodeDisplay = renderer.getNodeDisplayData(nodeId);
          const camera = renderer.getCamera();

          camera.animate({ x: nodeDisplay.x, y: nodeDisplay.y, ratio: 0.1 }, { duration: 600 });

          // Surbrillance temporaire
          graph.forEachNode(n => {
            if (n === nodeId) {
              graph.setNodeAttribute(n, "size", graph.getNodeAttribute(n, "originalSize") * 1.5);
              graph.setNodeAttribute(n, "color", "#ff0000");
            } else {
              graph.setNodeAttribute(n, "size", graph.getNodeAttribute(n, "originalSize"));
              graph.setNodeAttribute(n, "color", graph.getNodeAttribute(n, "originalColor"));
            }
          });

        } else if (matches.length > 1) {
          alert(`Plusieurs nœuds correspondent à "${query}" : ${matches.join(", ")}`);
        } else {
          alert("Nœud non trouvé !");
        }
      }
    });
  }
});

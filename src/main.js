import Papa from "papaparse";
import Graph from "graphology";
import { initGraphRenderer } from "./graph.js";

// Main function to load data and build the graph
function loadAndBuildGraph() {
  const graph = new Graph();
  const csvPath = import.meta.env.BASE_URL + "Crafting.csv";

  Papa.parse(csvPath, {
    download: true,
    header: true,
    complete: function(results) {
      processData(graph, results.data);
      initGraphRenderer(graph);
    },
    error: function(error) {
      console.error("Error loading or parsing CSV:", error);
    }
  });
}

// Function to process the parsed CSV data and populate the graph
function processData(graph, data) {
  data.forEach((row, i) => {
    // Only process rows that define a recipe (0% column is not empty)
    if (row["0%"] !== "") {
      // Clean recipe name: remove content in parentheses and trim whitespace
      const recipe = (row[""] || `Recipe${i}`).replace(/\s*\(.*?\)\s*/g, "").trim();
      
      // Clean ingredient list
      const ingredients = (row["_1"] || "")
        .split(",")
        .map(item => item.replace(/\s*\(.*?\)\s*/g, "").trim())
        .filter(item => item.length > 0); // Remove empty strings

      // Recipe Node (Blue)
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

      // Ingredient Nodes (Orange) and Edges
      ingredients.forEach(ing => {
        if (!graph.hasNode(ing)) {
          graph.addNode(ing, {
            x: Math.random(),
            y: Math.random(),
            size: 8,
            type: "circle",
            color: "#d86c00ff",
            originalColor: "#d86c00ff",
            originalSize: 8,
            label: ing
          });
        }
        
        // Add edge from ingredient to recipe (if not already present)
        const edgeId = `${ing}->${recipe}`;
        if (!graph.hasEdge(edgeId)) {
          graph.addEdge(ing, recipe, { id: edgeId, color: "#999", originalColor: "#999" });
        }
      });
    }
  });
}

// Execute the main function
loadAndBuildGraph();
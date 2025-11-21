/**
 * Configurations pour les différents graphes.
 * Chaque configuration inclut le nom, le chemin du CSV et la fonction de parsing spécifique.
 */
// Cette structure permet d'ajouter facilement de nouveaux graphes avec des règles de parsing uniques.
export const GRAPH_CONFIGS = {
  crafting: {
    name: "Crafting",
    csvPath: "Crafting.csv",
    parser: processData,
    recipeColor: "#33aaff",
    ingredientColor: "#d86c00ff",
    recipeSize: 10,
    ingredientSize: 8,
  },
  cooking: {
    name: "Cooking",
    csvPath: "Cooking.csv",
    parser: processData,
    recipeColor: "#ff44aa",
    ingredientColor: "#aaff44",
    recipeSize: 12,
    ingredientSize: 7,
  },
};


/**
 * Fonction de parsing spécifique pour le graphe de Crafting de Stardew Valley.
 * @param {Graph} graph - L'instance graphology.
 * @param {Array<Object>} data - Les données CSV parsées.
 * @param {Object} config - La configuration du graphe actuel.
 */
function processData(graph, data, config) {
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

      // Recipe Node
      if (!graph.hasNode(recipe)) {
        graph.addNode(recipe, {
          x: Math.random(),
          y: Math.random(),
          size: config.recipeSize,
          type: "circle",
          color: config.recipeColor,
          originalColor: config.recipeColor,
          originalSize: config.recipeSize,
          label: recipe
        });
      }

      // Ingredient Nodes and Edges
      ingredients.forEach(ing => {
        if (!graph.hasNode(ing)) {
          graph.addNode(ing, {
            x: Math.random(),
            y: Math.random(),
            size: config.ingredientSize,
            type: "circle",
            color: config.ingredientColor,
            originalColor: config.ingredientColor,
            originalSize: config.ingredientSize,
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
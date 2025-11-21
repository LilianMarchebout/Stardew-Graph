import Papa from "papaparse";
import Graph from "graphology";
// Importation de la fonction d'initialisation et de la nouvelle fonction d'arrêt/nettoyage
import { initGraphRenderer, killRenderer } from "./graph.js"; 
// Importation des configurations
import { GRAPH_CONFIGS } from "./config.js";

const graphSelect = document.getElementById("graph-select");

/**
 * Charge les données CSV, les parse et construit le graphe.
 * @param {string} graphKey - La clé de la configuration du graphe.
 */
function loadAndBuildGraph(graphKey) {
  // Arrêter l'ancien renderer avant d'en créer un nouveau
  killRenderer(); 

  const config = GRAPH_CONFIGS[graphKey];
  if (!config) {
    console.error(`Configuration for ${graphKey} not found.`);
    return;
  }

  const graph = new Graph();
  // Utiliser le chemin CSV de la configuration
  const csvPath = import.meta.env.BASE_URL + config.csvPath; 

  console.log(`Loading CSV for: ${config.name} from: ${csvPath}`);

  Papa.parse(csvPath, {
    download: true,
    header: true,
    complete: function(results) {
      // Utiliser la fonction de parsing spécifique de la configuration
      config.parser(graph, results.data, config); 
      // Initialiser le renderer, en passant la clé pour la gestion des événements
      initGraphRenderer(graph, graphKey); 
    },
    error: function(error) {
      console.error("Error loading or parsing CSV:", error);
    }
  });
}

/**
 * Initialise le sélecteur d'interface utilisateur et les événements.
 */
function initUI() {
  const keys = Object.keys(GRAPH_CONFIGS);
  
  // Remplir le sélecteur
  keys.forEach(key => {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = GRAPH_CONFIGS[key].name;
    graphSelect.appendChild(option);
  });

  // Ajouter l'écouteur de changement
  graphSelect.addEventListener("change", (e) => {
    loadAndBuildGraph(e.target.value);
  });

  // Charger le premier graphe par défaut
  if (keys.length > 0) {
    loadAndBuildGraph(keys[0]);
  }
}

// Exécuter la fonction d'initialisation de l'interface utilisateur
initUI();
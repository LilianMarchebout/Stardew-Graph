# Stardew Valley Graph Visualizer

This project is an interactive web application designed to visualize the Crafting and Cooking recipe networks from the game Stardew Valley. 
It allows you to navigate the relationships between ingredients and final products easily.

## Code Structure

The project is built modularly to simplify adding new datasets.

- `main.js` : Handles the initialization and management of graph switching.
- `graph.js` : The core logic for rendering (Sigma.js) and all interactions (hover, click, search).
- `config.js` : Defines the different graph types and their specific parsing rules.
- `index.html` : The simple user interface (graph container, selector, search bar).

## Data Source

Recipe and ingredient data are pulled from local CSV files. These files are derived from detailed information, primarily based on the following resource:

Source Spreadsheet: [Stardew Valley Crafting Data](https://docs.google.com/spreadsheets/d/1MqtboZQwj_2jAAbHu5LVfs0Jw4ZwmE2oQWTSMRyQ2gU/edit?gid=436387290#gid=436387290)

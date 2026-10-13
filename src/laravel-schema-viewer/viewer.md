---
title: Using the Viewer
description: The floating bar, the Browse, Details and Hints tabs, focus mode, shared links and keyboard shortcuts of Laravel Schema Viewer.
aside: false
---

# Using the Viewer

Each card is a table, and each line a relationship between two of them. Referenced tables sit to the left of the tables that point at them. Drag cards to arrange them, scroll or pinch to zoom, and drag the background to move around. The **?** button in the bar takes a one-minute tour.

<LiveDemo title="The live demo on its Browse tab: switch between tables, relationships and columns, and pick one" shortcut="a" />

The viewer shows the snapshot `php artisan schema-viewer:build` last wrote; it never reads the database or the models itself, so there is no button to read them again. After you migrate, alter a table by hand or change a model, run the build again and reload the page. See [The schema snapshot](./installation#the-schema-snapshot).

## The floating bar

The bar at the bottom of the diagram holds every view control:

| Control | What it does |
|---|---|
| **−** / **100%** / **+** | Zoom out and in. Click the percentage to type a zoom from 2 to 200%. |
| Fit | Fits the whole diagram on screen (<kbd>F</kbd>). |
| Hand | Pan mode: drag anywhere, even over a table, to move around. Or hold <kbd>Space</kbd>. |
| Arrange | Arranges the tables automatically (<kbd>Shift</kbd> <kbd>A</kbd>). |
| **Relationships** | Shows or hides each kind of line, with its legend: FK + relation, relation only, FK only, through (<kbd>1</kbd>–<kbd>4</kbd>). The button says **N off** while kinds are hidden. |
| **Tables** | Shows or hides **Framework tables** (<kbd>G</kbd>) and **Package tables** (<kbd>P</kbd>). |
| **Show** | **Relation names** on every line (<kbd>L</kbd>), the **Grid**, and **Columns**: **All**, only the **Keys** and the columns relations use, or only the table **Names** (<kbd>C</kbd>). A card's own arrow folds just that card. |
| **?** | Takes the tour. |

When the diagram is narrow, as on a phone or beside a wide panel, the three menus show as icons.

Large schemas stay readable: a connection with more than 40 tables is laid out in packed columns, and with more than 60 tables on screen the lines are thin and muted and the relation names show only on the picked table's lines, until **Relation names** puts them back.

## The side panel

The panel on the right has three tabs:

- **Browse** (<kbd>A</kbd>) lists every **Table**, **Relationship** or **Column**, with one filter. Pick a row to show it on the diagram.
- **Details** (<kbd>D</kbd>) shows what is picked, with **Focus** and **Copy link** at the top:
  - a table: its columns, relations, the tables that use it, indexes and model;
  - a relationship: its keys, its state (FK + relation, relation only or FK only), the foreign key's name, on update and on delete actions and index, and the relations that use it;
  - a column: its type, null, default, casts, indexes, foreign keys in and out, and the relationships that use it.
- **Hints** (<kbd>H</kbd>) lists where the database and the models disagree; see [Hints](./hints).

Drag the grip on the panel's edge to widen or narrow it; double-click it to reset. The diagram always keeps room for the bar. With an [editor](./configuration) set, model and relation names open in it at their line.

## Picking and focus

Click a table, a line or a column row on the diagram to pick it, and its details open. Picking a relationship or a column lights it up and dims the rest.

Double-click a table, a line or a column to focus on it: only it and the tables around it stay on the diagram. The bar at the top chooses **1**, **2** or **3 links** away; for a relationship or a column, **1 link** keeps just the tables it touches. <kbd>Shift</kbd> <kbd>F</kbd> focuses on what is picked, or leaves focus mode. <kbd>Esc</kbd> leaves focus mode first, then clears the pick.

## Sharing a view

The viewer keeps what is on screen in the URL, so a link opens the same place:

| Hash | Opens |
|---|---|
| `#connection=mysql` | A connection, or `all` for every one side by side |
| `table=mysql:orders` | A table |
| `relationship=mysql:<link id>` | A relationship; the link id is in the JSON export's `links` |
| `column=mysql:orders.user_id` | A column |
| `focus=1` | Focus mode, 1 to 3 links away |

**Copy link** in the details panel, next to **Focus**, copies a link to exactly this view (<kbd>Shift</kbd> <kbd>C</kbd>). It adds `at=x,y,zoom` and `columns=keys` or `columns=none`, so the link opens the same view, zoom included. Links work in an [exported HTML file](./exports#standalone-viewer) too. A link to something the schema no longer has opens the whole diagram and says so.

## Keyboard shortcuts

<kbd>S</kbd> lists them in the viewer, and can show each key next to its control.

| Key | Action |
|---|---|
| <kbd>/</kbd>, <kbd>⌘</kbd> <kbd>K</kbd> | Search tables, columns, models and relations |
| <kbd>Esc</kbd> | Leave focus mode, clear the pick, close a panel |
| <kbd>F</kbd> | Fit the diagram |
| <kbd>+</kbd> <kbd>−</kbd> | Zoom in or out |
| <kbd>Space</kbd> | Hold to pan |
| <kbd>1</kbd>–<kbd>4</kbd> | Show or hide each kind of line |
| <kbd>G</kbd> <kbd>P</kbd> | Show or hide framework or package tables |
| <kbd>L</kbd> | Relation names on every line |
| <kbd>C</kbd> | All columns, keys only, or names only |
| <kbd>A</kbd> <kbd>D</kbd> <kbd>H</kbd> | Browse, Details or Hints |
| <kbd>[</kbd> <kbd>]</kbd> | Previous or next connection |
| <kbd>Shift</kbd> <kbd>F</kbd> | Focus on what is picked, or leave focus |
| <kbd>Shift</kbd> <kbd>A</kbd> | Arrange automatically |
| <kbd>Shift</kbd> <kbd>R</kbd> | Read the schema again (app only) |
| <kbd>Shift</kbd> <kbd>C</kbd> | Copy a link to this view |
| <kbd>?</kbd> | Take the tour |

## Light and dark

The viewer opens light. The switch in the top bar turns on dark mode, remembered in this browser. The demos on this site follow the site's theme.

## Phones

On a phone the viewer says once that the diagram is easier on a larger screen; every table and its details are still there. The panel becomes a bottom sheet: tap a table, a column or a line, or open Browse from the sheet's bar. Download, the connection, the theme and the shortcuts move into the **⋯** menu.

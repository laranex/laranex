---
title: Using the Viewer
description: Read the diagram, find tables, read a table's details and use the keyboard.
---

# Using the Viewer

The viewer opens with every table arranged automatically: referenced tables on the left, the tables that point at them on the right. With more than one connection it opens on **All connections**, each connection in its own labeled region.

## Tables

Each card is a table. The header shows the table name and the model that uses it, or "no model" and "framework table". Columns are marked:

| Mark | Meaning |
|---|---|
| `PK` | Primary key |
| `FK` | Foreign key |
| `?` after the name | Nullable |
| Right column | The column type, or the cast when the model casts it |
| Amber number | Hints for this table |

Click a card to open its details: every column with its type, default and cast, the relations its model declares, the relations on other models that point at it, its indexes, and the model's settings (key, timestamps, soft deletes, fillable, hidden, appends, scopes, global scopes and observers).

<Screenshot src="/laravel-schema-viewer/table" alt="The posts table selected, with its hints, columns, casts and relations in the details panel" />

## Finding a table

Search matches table names, column names, models and relations. Pick a result to jump to the table. The connection picker switches between connections; a relation to a table on another connection shows as a dashed card you can click. **All connections**, where the viewer starts when there is more than one, puts every connection on one diagram with relations across connections drawn as lines; search and hints then cover them all.

<Screenshot src="/laravel-schema-viewer/search" alt="Searching for user lists matching tables, columns and relations" />

## Arranging

Drag cards anywhere. Zoom with the buttons, or the mouse wheel. The last button below the zoom controls arranges every table automatically again.

## Tour and shortcuts

The `?` button starts a short tour of every part of the viewer.

<Screenshot src="/laravel-schema-viewer/tour" alt="A step of the tour spotlighting a relationship label" />

The Keyboard shortcuts button lists every key; its switch also shows each key next to its control.

| Key | Action |
|---|---|
| `/` or `Ctrl K` / `⌘ K` | Search |
| `Esc` | Clear the search or selection, close a panel |
| `F` | Fit the diagram to the screen |
| `+` / `-` | Zoom in or out |
| `1` `2` `3` `4` | Show or hide each kind of line |
| `G` | Show or hide framework tables |
| `L` | Relation names on every line, or only on the selected table |
| `T` / `H` | The Table or Hints tab |
| `[` / `]` | Previous or next connection |
| `Shift A` | Arrange tables automatically |
| `S` | The shortcut list |
| `?` | The tour |

<Screenshot src="/laravel-schema-viewer/shortcuts" alt="The Keyboard shortcuts dialog with its switch for showing keys next to controls" />

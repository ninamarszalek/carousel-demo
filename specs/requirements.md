# Requirements — Film Browser (Frontend Engineer Technical Challenge)

Source: _GOCODE – Frontend – Technical Challenge.pdf_, Version 1 (2026-10-01).
This document lists every requirement from the source, grouped by area. Each requirement has an ID so later specs, tasks and tests can refer to it.

## 0. Context and goal

| ID    | Requirement                                                                                                |
| ----- | ---------------------------------------------------------------------------------------------------------- |
| CTX-1 | The challenge is part of the recruitment for the **Frontend Engineer** position.                           |
| CTX-2 | Its purpose is to assess the candidate's knowledge and problem-solving skills.                             |
| CTX-3 | Build a web application to **browse films by categories** and **open a specific film to see its details**. |

## 1. Functional requirements

### 1.1 Homepage

| ID        | Requirement                                                                   |
| --------- | ----------------------------------------------------------------------------- |
| FR-HOME-1 | The homepage contains **3 carousels** with films.                             |
| FR-HOME-2 | Each carousel shows a **different category** of films.                        |
| FR-HOME-3 | Clicking an item in a carousel **navigates to the detail page** of that item. |

### 1.2 Film detail page

| ID       | Requirement                                           |
| -------- | ----------------------------------------------------- |
| FR-DET-1 | The detail page includes a **description**.           |
| FR-DET-2 | The detail page includes an **image**.                |
| FR-DET-3 | The detail page includes a **button**.                |
| FR-DET-4 | The button triggers an **"add to wish list"** action. |

### 1.3 Category-based differentiation of the detail page

The detail page looks different depending on the film's category:

| ID       | Requirement                                                                   |
| -------- | ----------------------------------------------------------------------------- |
| FR-CAT-1 | A **different font** per category.                                            |
| FR-CAT-2 | A **different button** per category.                                          |
| FR-CAT-3 | **Any other differentiation** we think can be added (open-ended, our choice). |

### 1.4 Wish list

| ID        | Requirement                                                                       |
| --------- | --------------------------------------------------------------------------------- |
| FR-WISH-1 | There is a **wish list section** that shows **all items added** to the wish list. |

## 2. Layout (wireframes)

The source gives wireframes for which components each page contains.

### 2.1 Homepage layout

| ID        | Requirement                                                                                              |
| --------- | -------------------------------------------------------------------------------------------------------- |
| UI-HOME-1 | A **header** at the top.                                                                                 |
| UI-HOME-2 | **Carousel 1**, **Carousel 2** and **Carousel 3** below the header, stacked vertically, each full width. |

```
+--------------------------------+
| header                         |
+--------------------------------+
| carousel 1                     |
+--------------------------------+
| carousel 2                     |
+--------------------------------+
| carousel 3                     |
+--------------------------------+
```

### 2.2 Detail page layout

| ID       | Requirement                                                                        |
| -------- | ---------------------------------------------------------------------------------- |
| UI-DET-1 | A **header** at the top.                                                           |
| UI-DET-2 | An **image area** on the left (the wider column).                                  |
| UI-DET-3 | A **button and description area** on the right of the image (the narrower column). |
| UI-DET-4 | An **additional info area** below, full width.                                     |

```
+--------------------------------+
| header                         |
+--------------------+-----------+
| image area         | button    |
|                    | and       |
|                    | descript. |
|                    | area      |
+--------------------+-----------+
| additional info area           |
+--------------------------------+
```

## 3. Tech stack requirements

> The source says: "Read them very carefully!"

### 3.1 Language and framework

| ID     | Requirement                                                                                              |
| ------ | -------------------------------------------------------------------------------------------------------- |
| TECH-1 | Use **React with TypeScript**. (JavaScript is accepted only if the candidate has never used TypeScript.) |

### 3.2 Styling

| ID         | Requirement                                                              |
| ---------- | ------------------------------------------------------------------------ |
| TECH-CSS-1 | Use **CSS** for styling.                                                 |
| TECH-CSS-2 | Bundled CSS **may (and probably should) be split** into different files. |
| TECH-CSS-3 | ❌ **Not allowed:** Styled Components, CSS Modules, Tailwind.            |
| TECH-CSS-4 | ✅ **Allowed:** SCSS.                                                    |

### 3.3 Build and rendering

| ID           | Requirement                                          |
| ------------ | ---------------------------------------------------- |
| TECH-BUILD-1 | Use **Vite** for bundling.                           |
| TECH-SSR-1   | **SSR (server-side rendering) support is required.** |

### 3.4 Handcrafted codebase

| ID          | Requirement                                                                                                                                                     |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TECH-HAND-1 | The codebase must be **handcrafted**. The exercise assesses the ability to **structure a frontend project** and to manage **server-side and client-side code**. |
| TECH-HAND-2 | ❌ **Not allowed:** full-stack frameworks such as **Next.js**.                                                                                                  |
| TECH-HAND-3 | ❌ **Not allowed:** scaffolding tools that define the whole project structure (e.g. _create-react-app-vite_). ℹ️ `npm create vite@latest` **is allowed**.       |
| TECH-HAND-4 | ❌ **Not allowed:** any other tool that defines the whole project structure and provides lots of abstraction.                                                   |

### 3.5 Libraries

| ID         | Requirement                                                                                                               |
| ---------- | ------------------------------------------------------------------------------------------------------------------------- |
| TECH-LIB-1 | ✅ **Allowed:** routing libraries (React Router, TanStack Router, or any other).                                          |
| TECH-LIB-2 | ✅ **Allowed:** data-loading libraries (TanStack Query, or any other).                                                    |
| TECH-LIB-3 | ✅ **Allowed:** state-management libraries (Redux, Zustand, or any other).                                                |
| TECH-LIB-4 | ⚠️ **Allowed, but extra points for not using them:** UI libraries that provide component primitives (e.g. Shadcn, Radix). |

### 3.6 Data source

| ID         | Requirement                                                                        |
| ---------- | ---------------------------------------------------------------------------------- |
| TECH-API-1 | Any **open film API** may be used. **TheMovieDatabase (TMDB) API** is recommended. |

## 4. Delivery requirements

| ID    | Requirement                                                                                             |
| ----- | ------------------------------------------------------------------------------------------------------- |
| DEL-1 | Publish the code to a **git repository** and share the link. Suggested host: **GitFront**.              |
| DEL-2 | Write **markdown documentation** that explains **very thoroughly** the steps needed to run the project. |

## 5. Evaluation criteria

The solution is assessed on:

| ID     | Criterion                                                |
| ------ | -------------------------------------------------------- |
| EVAL-1 | How **clean** the code is and how **reusable** it is.    |
| EVAL-2 | The **complexity of the layout** built.                  |
| EVAL-3 | How **clean and ordered** the final CSS-like styles are. |
| EVAL-4 | How the **components are structured**.                   |
| EVAL-5 | Whether **DRY** principles are followed.                 |
| EVAL-6 | **How much, what, and how** the solution is tested.      |
| EVAL-7 | The **SSR strategy** implemented.                        |

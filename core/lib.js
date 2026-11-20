// Preact + htm from a CDN (the only UI library; NeatSystem prompt 2).
// Every module imports UI primitives from here, so the CDN URL lives in one place.
export {
  h, html, render, Component, createContext,
  useState, useReducer, useEffect, useLayoutEffect, useRef, useMemo, useCallback, useContext,
} from 'https://unpkg.com/htm@3.1.1/preact/standalone.module.js';

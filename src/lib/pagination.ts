/**
 * Page size for the public index + inline search "Load more". Shared by the
 * server read (`getInitialIndex`) and the client fetch (`RecipeBrowser`) so the
 * first static page and subsequent API pages line up. Kept in its own tiny,
 * server-free module so importing it into a client component pulls no server code.
 */
export const PAGE_SIZE = 24;

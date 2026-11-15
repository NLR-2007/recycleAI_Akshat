/**
 * The shared contract between the serverless AI endpoint and the React client.
 *
 * The definitions live in `api/_schema.ts` so that the Vercel Function has no
 * imports outside its own directory: Vercel traces a function's dependencies
 * rather than bundling them, and files outside `api/` are not reliably included
 * in the deployed bundle. Keeping the source there and re-exporting it here
 * preserves a single source of truth while letting the client keep importing
 * `@/types/analysis` as before.
 */
export * from '../../api/_schema';

/*
 * Deployment mode for this copy of the Classification Explorer app.
 *
 * This is the ONE file that intentionally differs between the two deployments
 * of this otherwise byte-identical app source:
 *   - AzurePrivilegedIAM/ClassificationExplorer/js/mode.js        -> 'standalone'
 *   - <EntraOps repo>/Reports/ClassificationExplorer/js/mode.js   -> 'entraops'
 *
 * Scripts/Sync-EntraOpsClassificationExplorerSource.ps1 copies every other app file
 * between the two repositories and always skips this one - do not overwrite it
 * with the sync script's output, and do not delete it.
 */
window.EOCE_MODE = 'standalone';

/**
 * Universal File Import/Export & URL Resolver
 * 
 * A comprehensive, extensible solution for file import/export operations
 * Works across multiple file types, scenarios, and environments
 * 
 * Features:
 * - Multi-format support (JSON, CSV, XML, YAML, etc.) via plugins
 * - URL sanitization and normalization
 * - Automatic relative path resolution to base URL
 * - Multi-strategy CORS handling with fallbacks
 * - File import/export (File, Blob, FileReader, etc.)
 * - Transformation pipelines and hooks
 * - Plugin/extension system
 * - Input type detection and auto-routing
 * - Configurable options
 * 
 * URL Resolution:
 * - Relative paths (e.g., 'sets/file.json') are automatically resolved to the current page's base URL
 * - Automatically detects base URL from window.location
 * - Can be explicitly set with: URLResolver.setBaseUrl('https://example.com/path/')
 * 
 * Architecture:
 * - Type handlers: Register parsers/exporters for different file types
 * - Transformers: Chain transformations on data
 * - Hooks: Lifecycle callbacks for customization
 * - Plugins: Extend functionality without modifying core
 */

// ==================== CONFIGURATION ====================
const URL_RESOLVER_CONFIG = {
    // CORS proxy options (tried in order)
    corsProxies: [
        'https://corsproxy.io/?',
        'https://api.allorigins.win/raw?url=',
        'https://cors-anywhere.herokuapp.com/',
        null // Direct fetch (no proxy)
    ],
    
    // Request timeout in milliseconds
    timeout: 30000,
    
    // Base URL for resolving relative paths
    // If null, uses window.location.origin + window.location.pathname (current page base)
    baseUrl: null, // e.g., 'https://example.com/path/'
    
    // Default CDN base URL
    defaultCdnBase: null, // Will use window.location.origin if not set
    
    // Retry configuration
    maxRetries: 2,
    retryDelay: 1000,
    
    // Auto-detect input type
    autoDetect: true,
    
    // Default export filename
    defaultExportFilename: 'export',
    
    // Enable hooks
    enableHooks: true,
    
    // Default MIME type
    defaultMimeType: 'application/json'
};

// ==================== TYPE HANDLER REGISTRY ====================

/**
 * Registry for file type handlers
 * Each handler provides: parse, stringify, mimeTypes, extensions, detect
 */
const TYPE_HANDLERS = new Map();

/**
 * Hooks registry for lifecycle events
 */
const HOOKS = {
    beforeImport: [],
    afterImport: [],
    beforeExport: [],
    afterExport: [],
    beforeParse: [],
    afterParse: [],
    beforeStringify: [],
    afterStringify: [],
    onError: []
};

/**
 * Transformers registry
 */
const TRANSFORMERS = [];

// ==================== PLUGIN SYSTEM ====================

/**
 * Registers a file type handler
 * 
 * @param {string} type - Type identifier (e.g., 'json', 'csv', 'xml')
 * @param {object} handler - Handler object with parse, stringify, mimeTypes, extensions, detect
 * @example
 * registerTypeHandler('json', {
 *   parse: (text) => JSON.parse(text),
 *   stringify: (data) => JSON.stringify(data, null, 2),
 *   mimeTypes: ['application/json', 'text/json'],
 *   extensions: ['.json'],
 *   detect: (text) => text.trim().startsWith('{') || text.trim().startsWith('[')
 * });
 */
function registerTypeHandler(type, handler) {
    if (!handler.parse || !handler.stringify) {
        throw new Error(`Type handler for '${type}' must provide parse and stringify functions`);
    }
    
    TYPE_HANDLERS.set(type, {
        type,
        parse: handler.parse,
        stringify: handler.stringify,
        mimeTypes: handler.mimeTypes || [],
        extensions: handler.extensions || [],
        detect: handler.detect || (() => false),
        transform: handler.transform || null,
        ...handler // Allow additional properties
    });
}

/**
 * Registers a hook callback
 * 
 * @param {string} hookName - Hook name (beforeImport, afterImport, etc.)
 * @param {function} callback - Callback function
 */
function registerHook(hookName, callback) {
    if (!HOOKS[hookName]) {
        HOOKS[hookName] = [];
    }
    HOOKS[hookName].push(callback);
}

/**
 * Registers a transformer function
 * 
 * @param {function} transformer - Transformer function (data, context) => transformedData
 * @param {number} priority - Priority order (lower = earlier, default: 100)
 */
function registerTransformer(transformer, priority = 100) {
    TRANSFORMERS.push({ transformer, priority });
    TRANSFORMERS.sort((a, b) => a.priority - b.priority);
}

/**
 * Executes hooks for a given event
 * 
 * @param {string} hookName - Hook name
 * @param {*} data - Data to pass to hooks
 * @param {object} context - Context object
 * @returns {*} - Potentially modified data
 */
async function executeHooks(hookName, data, context = {}) {
    if (!URL_RESOLVER_CONFIG.enableHooks || !HOOKS[hookName]) {
        return data;
    }
    
    let result = data;
    for (const hook of HOOKS[hookName]) {
        try {
            const hookResult = await hook(result, context);
            if (hookResult !== undefined) {
                result = hookResult;
            }
        } catch (error) {
            console.warn(`Hook '${hookName}' error:`, error);
        }
    }
    return result;
}

/**
 * Applies all registered transformers
 * 
 * @param {*} data - Data to transform
 * @param {object} context - Context object
 * @returns {*} - Transformed data
 */
function applyTransformers(data, context = {}) {
    let result = data;
    for (const { transformer } of TRANSFORMERS) {
        try {
            result = transformer(result, context);
        } catch (error) {
            console.warn('Transformer error:', error);
        }
    }
    return result;
}

// ==================== DEFAULT JSON HANDLER ====================

registerTypeHandler('json', {
    parse: (text) => {
        try {
            return JSON.parse(text);
        } catch (error) {
            throw new Error(`Invalid JSON: ${error.message}`);
        }
    },
    stringify: (data, options = {}) => {
        const { pretty = true } = options;
        return pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
    },
    mimeTypes: ['application/json', 'text/json'],
    extensions: ['.json'],
    detect: (text) => {
        if (!text || typeof text !== 'string') return false;
        const trimmed = text.trim();
        return trimmed.startsWith('{') || trimmed.startsWith('[');
    }
});

// ==================== INPUT DETECTION ====================

/**
 * Detects if a string is a URL
 */
function isUrl(input) {
    if (!input || typeof input !== 'string') return false;
    
    const trimmed = input.trim();
    
    return (
        trimmed.startsWith('http://') ||
        trimmed.startsWith('https://') ||
        trimmed.startsWith('//') ||
        trimmed.match(/^[a-z0-9.-]+\.[a-z]{2,}/i) ||
        trimmed.startsWith('/') ||
        trimmed.startsWith('./') ||
        trimmed.includes('://')
    );
}

/**
 * Detects file type from content or filename
 * 
 * @param {string} content - File content
 * @param {string} filename - Optional filename
 * @param {string} mimeType - Optional MIME type
 * @returns {string|null} - Detected type or null
 */
function detectFileType(content, filename = null, mimeType = null) {
    // Check by MIME type first
    if (mimeType) {
        for (const [type, handler] of TYPE_HANDLERS) {
            if (handler.mimeTypes.includes(mimeType)) {
                return type;
            }
        }
    }
    
    // Check by extension
    if (filename) {
        for (const [type, handler] of TYPE_HANDLERS) {
            if (handler.extensions.some(ext => filename.toLowerCase().endsWith(ext))) {
                return type;
            }
        }
    }
    
    // Check by content detection
    if (content && typeof content === 'string') {
        for (const [type, handler] of TYPE_HANDLERS) {
            if (handler.detect && handler.detect(content)) {
                return type;
            }
        }
    }
    
    // Default to JSON if no match
    return 'json';
}

/**
 * Detects the type of input and returns a type identifier
 */
function detectInputType(input) {
    if (!input) return 'unknown';
    
    if (input instanceof File) return 'file';
    if (input instanceof Blob) return 'blob';
    if (typeof input === 'object' && !Array.isArray(input)) return 'object';
    
    if (typeof input === 'string') {
        if (isUrl(input)) return 'url';
        // Check if it's a known file type string
        const detectedType = detectFileType(input);
        if (detectedType) return 'string';
        return 'string';
    }
    
    return 'unknown';
}

// ==================== URL SANITIZATION ====================

/**
 * Gets the base URL for resolving relative paths
 * Uses configured baseUrl, or falls back to current page base
 * 
 * @returns {string} - Base URL with trailing slash
 */
function getBaseUrl() {
    // Use configured base URL if set
    if (URL_RESOLVER_CONFIG.baseUrl) {
        const base = URL_RESOLVER_CONFIG.baseUrl.trim();
        return base.endsWith('/') ? base : base + '/';
    }
    
    // Fall back to current page base URL
    if (typeof window !== 'undefined' && window.location) {
        const origin = window.location.origin;
        const pathname = window.location.pathname;
        // Get directory path (remove filename if present)
        const basePath = pathname.substring(0, pathname.lastIndexOf('/') + 1);
        return origin + basePath;
    }
    
    // Last resort
    return '/';
}

/**
 * Sets the base URL for resolving relative paths
 * Useful when you want to explicitly set the base URL instead of auto-detection
 * 
 * @param {string} baseUrl - Base URL (e.g., 'https://example.com/path/')
 * @example
 * URLResolver.setBaseUrl('https://example.com/path/');
 */
function setBaseUrl(baseUrl) {
    if (!baseUrl || typeof baseUrl !== 'string') {
        throw new Error('Base URL must be a non-empty string');
    }
    URL_RESOLVER_CONFIG.baseUrl = baseUrl.trim();
}

/**
 * Sanitizes and normalizes a URL, resolving relative paths to base URL
 * Handles various URL formats and automatically resolves relative paths
 * 
 * @param {string} url - The URL to sanitize
 * @returns {string|null} - Sanitized URL or null if invalid
 */
function sanitizeUrl(url) {
    if (!url || typeof url !== 'string') return null;
    
    url = url.trim();
    if (!url) return null;
    url = url.replace(/\s+/g, '');
    
    // Case 1: Already absolute URL (http:// or https://)
    if (url.match(/^https?:\/\//i)) {
        try {
            const urlObj = new URL(url);
            // If URL points to the same base domain, ensure it's normalized
            const baseUrl = getBaseUrl();
            const baseUrlObj = new URL(baseUrl);
            if (urlObj.origin === baseUrlObj.origin) {
                // Same origin, return normalized
                return urlObj.href;
            }
            return urlObj.href;
        } catch (e) {
            return null;
        }
    }
    
    // Case 2: Protocol-relative URL (//example.com)
    if (url.startsWith('//')) {
        try {
            return new URL('https:' + url).href;
        } catch (e) {
            return null;
        }
    }
    
    // Case 3: Domain without protocol (example.com/path)
    if (url.match(/^[a-z0-9.-]+\.[a-z]{2,}/i) && !url.includes('://')) {
        try {
            return new URL('https://' + url).href;
        } catch (e) {
            return null;
        }
    }
    
    // Case 4: Relative path - resolve against base URL
    // This handles: 'sets/file.json', './sets/file.json', '/sets/file.json', etc.
    try {
        const baseUrl = getBaseUrl();
        // Ensure relative paths are resolved correctly
        let resolvedUrl = url;
        
        // If it doesn't start with /, it's relative to current directory
        if (!url.startsWith('/') && !url.startsWith('./')) {
            resolvedUrl = './' + url;
        }
        
        return new URL(resolvedUrl, baseUrl).href;
    } catch (e) {
        // If resolution fails, try as absolute
        try {
            return new URL('https://' + url).href;
        } catch (e2) {
            return null;
        }
    }
}

function isValidUrl(url) {
    if (!url) return false;
    if (!url.match(/^https?:\/\//i)) return false;
    
    const dangerousPatterns = [
        /javascript:/i,
        /data:/i,
        /vbscript:/i,
        /file:/i
    ];
    
    return !dangerousPatterns.some(pattern => pattern.test(url));
}

// ==================== CORS HANDLING ====================

async function fetchWithProxy(url, proxy, options = {}) {
    const proxyUrl = proxy + encodeURIComponent(url);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), URL_RESOLVER_CONFIG.timeout);
    
    try {
        const response = await fetch(proxyUrl, {
            ...options,
            signal: controller.signal,
            headers: {
                'Accept': '*/*',
                ...options.headers
            }
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

async function fetchDirect(url, options = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), URL_RESOLVER_CONFIG.timeout);
    
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
            mode: 'cors',
            headers: {
                'Accept': '*/*',
                ...options.headers
            }
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

async function fetchWithCors(url, options = {}) {
    const config = { ...URL_RESOLVER_CONFIG, ...options };
    const sanitizedUrl = sanitizeUrl(url);
    
    if (!sanitizedUrl || !isValidUrl(sanitizedUrl)) {
        throw new Error('Invalid or unsafe URL');
    }
    
    const proxies = config.corsProxies || [null];
    let lastError = null;
    
    for (const proxy of proxies) {
        try {
            let response;
            
            if (proxy) {
                response = await fetchWithProxy(sanitizedUrl, proxy, options);
            } else {
                response = await fetchDirect(sanitizedUrl, options);
            }
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return response;
            
        } catch (error) {
            lastError = error;
            if (error.name === 'AbortError') {
                throw new Error('Request timeout');
            }
            continue;
        }
    }
    
    throw new Error(`Failed to fetch: ${lastError?.message || 'Unknown error'}`);
}

// ==================== FILE HANDLING ====================

function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        if (!(file instanceof File)) {
            reject(new Error('Input is not a File object'));
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(new Error('Failed to read file'));
        reader.readAsText(file);
    });
}

function readBlobAsText(blob) {
    return new Promise((resolve, reject) => {
        if (!(blob instanceof Blob)) {
            reject(new Error('Input is not a Blob object'));
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(new Error('Failed to read blob'));
        reader.readAsText(blob);
    });
}

// ==================== IMAGE URL RESOLUTION (Legacy Support) ====================

function resolveImageUrl(imagePath, context, cdnBaseUrl = null) {
    if (!imagePath) return null;
    
    imagePath = String(imagePath).trim();
    
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
        return imagePath;
    }
    
    if (imagePath.startsWith('//')) {
        return 'https:' + imagePath;
    }
    
    if (imagePath.includes('://') || (imagePath.startsWith('cdn.') && imagePath.includes('/'))) {
        if (!imagePath.startsWith('http')) {
            return 'https://' + imagePath.replace(/^\/+/, '');
        }
        return imagePath;
    }
    
    if (!cdnBaseUrl) {
        cdnBaseUrl = URL_RESOLVER_CONFIG.defaultCdnBase || window.location.origin;
        
        if (typeof context === 'string') {
            try {
                const urlObj = new URL(context, window.location.origin);
                cdnBaseUrl = urlObj.origin;
            } catch {
                // Use default
            }
        }
    }
    
    let normalizedPath = imagePath.replace(/\\/g, '/').replace(/^\/+/, '');
    if (normalizedPath.startsWith('img/')) {
        normalizedPath = normalizedPath.substring(4);
    }
    
    let metaName = null;
    let setName = null;
    
    if (typeof context === 'object' && context !== null) {
        metaName = context.meta || context.metaName;
        setName = context.set || context.setName;
    } else if (typeof context === 'string') {
        try {
            const urlObj = new URL(context, window.location.origin);
            const pathParts = urlObj.pathname.split('/').filter(p => p);
            
            if (pathParts[0] === 'file' && pathParts.length >= 2) {
                metaName = pathParts[1];
                if (pathParts.length >= 3) {
                    setName = pathParts[2].replace(/\.(json|xml|csv|yaml|yml)$/i, '');
                }
            } else if (pathParts[0] === 'meta' && pathParts.length >= 2) {
                metaName = pathParts[1];
                if (pathParts.length >= 3 && pathParts[2] !== 'img' && pathParts[2] !== 'Deck') {
                    setName = pathParts[2];
                }
            }
        } catch (e) {
            console.warn('Error parsing source URL:', e);
        }
    }
    
    if (metaName && setName) {
        return `${cdnBaseUrl}/meta/${metaName}/${setName}/img/${normalizedPath}`;
    } else if (metaName) {
        return `${cdnBaseUrl}/meta/${metaName}/img/${normalizedPath}`;
    } else {
        try {
            const baseUrl = typeof context === 'string' ? context : window.location.href;
            const urlObj = new URL(baseUrl);
            const basePath = urlObj.pathname.substring(0, urlObj.pathname.lastIndexOf('/'));
            return new URL(normalizedPath, urlObj.origin + basePath + '/').href;
        } catch (e) {
            return normalizedPath;
        }
    }
}

function resolveImagesInJson(jsonData, sourceUrl, imageResolver = null) {
    if (!jsonData || typeof jsonData !== 'object') return jsonData;
    
    const resolver = imageResolver || resolveImageUrl;
    const processed = JSON.parse(JSON.stringify(jsonData));
    
    function processObject(obj) {
        if (Array.isArray(obj)) {
            return obj.map(item => processObject(item));
        } else if (obj && typeof obj === 'object') {
            const result = {};
            for (const [key, value] of Object.entries(obj)) {
                if (key === 'image' || key === 'imageUrl' || key.toLowerCase().includes('image')) {
                    if (typeof value === 'string') {
                        result[key] = resolver(value, sourceUrl) || value;
                    } else {
                        result[key] = processObject(value);
                    }
                } else if (key === 'images' && typeof value === 'object') {
                    result[key] = processObject(value);
                } else {
                    result[key] = processObject(value);
                }
            }
            return result;
        }
        return obj;
    }
    
    return processObject(processed);
}

// ==================== UNIFIED IMPORT FUNCTION ====================

/**
 * Universal import function
 * Automatically detects input type and file format, routes to appropriate handler
 * 
 * @param {*} input - Input to import (URL, string, File, Blob, object)
 * @param {object} options - Import options
 * @param {string} options.type - Force file type ('json', 'csv', 'xml', etc.)
 * @param {string} options.inputType - Force input type ('url', 'string', 'file', 'blob', 'object', 'auto')
 * @param {boolean} options.resolveImages - Resolve image URLs (default: true, JSON only)
 * @param {function} options.imageResolver - Custom image resolver
 * @param {string} options.sourceUrl - Source URL for context
 * @param {object} options.fetchOptions - Additional fetch options
 * @param {boolean} options.applyTransformers - Apply registered transformers (default: true)
 * @returns {Promise<*>} - Imported and processed data
 */
async function importData(input, options = {}) {
    const config = { ...URL_RESOLVER_CONFIG, ...options };
    const context = {
        sourceUrl: options.sourceUrl,
        filename: input instanceof File ? input.name : null,
        mimeType: input instanceof File || input instanceof Blob ? input.type : null,
        ...options.context
    };
    
    try {
        // Execute beforeImport hooks
        input = await executeHooks('beforeImport', input, context);
        
        // Detect input type
        let inputType = options.inputType || 'auto';
        if (inputType === 'auto' && config.autoDetect) {
            inputType = detectInputType(input);
        }
        
        // Get content based on input type
        let content = null;
        let detectedType = options.type || 'json';
        
        switch (inputType) {
            case 'url':
                const response = await fetchWithCors(input, options.fetchOptions);
                content = await response.text();
                detectedType = detectFileType(content, null, response.headers.get('content-type'));
                break;
                
            case 'string':
                content = input;
                detectedType = detectFileType(content, context.filename, context.mimeType);
                break;
                
            case 'file':
                content = await readFileAsText(input);
                detectedType = detectFileType(content, input.name, input.type);
                break;
                
            case 'blob':
                content = await readBlobAsText(input);
                detectedType = detectFileType(content, null, input.type);
                break;
                
            case 'object':
                // Already parsed, skip parsing
                let data = input;
                if (options.resolveImages && detectedType === 'json') {
                    data = resolveImagesInJson(data, context.sourceUrl, options.imageResolver);
                }
                data = applyTransformers(data, context);
                data = await executeHooks('afterImport', data, context);
                return data;
                
            default:
                throw new Error(`Unsupported input type: ${inputType}`);
        }
        
        // Execute beforeParse hooks
        content = await executeHooks('beforeParse', content, { ...context, type: detectedType });
        
        // Get handler for detected type
        const handler = TYPE_HANDLERS.get(detectedType);
        if (!handler) {
            throw new Error(`No handler registered for type: ${detectedType}`);
        }
        
        // Parse content
        let data = handler.parse(content);
        
        // Execute afterParse hooks
        data = await executeHooks('afterParse', data, { ...context, type: detectedType });
        
        // Apply type-specific transform if available
        if (handler.transform) {
            data = handler.transform(data, context);
        }
        
        // Resolve images (JSON-specific, legacy support)
        if (options.resolveImages !== false && detectedType === 'json') {
            data = resolveImagesInJson(data, context.sourceUrl, options.imageResolver);
        }
        
        // Apply transformers
        if (options.applyTransformers !== false) {
            data = applyTransformers(data, context);
        }
        
        // Execute afterImport hooks
        data = await executeHooks('afterImport', data, context);
        
        return data;
        
    } catch (error) {
        await executeHooks('onError', error, { ...context, input });
        throw error;
    }
}

// ==================== UNIFIED EXPORT FUNCTION ====================

/**
 * Universal export function
 * 
 * @param {*} data - Data to export
 * @param {object} options - Export options
 * @param {string} options.type - File type ('json', 'csv', 'xml', etc., default: 'json')
 * @param {string} options.filename - Filename for download
 * @param {string} options.format - Export format ('file', 'blob', 'dataUrl', 'string')
 * @param {object} options.stringifyOptions - Options to pass to stringify function
 * @returns {*} - Exported data (format depends on options.format)
 */
function exportData(data, options = {}) {
    const config = { ...URL_RESOLVER_CONFIG, ...options };
    const type = options.type || 'json';
    const format = options.format || 'file';
    const context = {
        type,
        format,
        ...options.context
    };
    
    // Execute beforeExport hooks
    let processedData = executeHooks('beforeExport', data, context);
    if (processedData === data) {
        processedData = data; // Sync hooks
    }
    
    // Get handler
    const handler = TYPE_HANDLERS.get(type);
    if (!handler) {
        throw new Error(`No handler registered for type: ${type}`);
    }
    
    // Execute beforeStringify hooks
    processedData = executeHooks('beforeStringify', processedData, context);
    if (processedData === data) {
        processedData = processedData; // Sync hooks
    }
    
    // Stringify
    const stringified = handler.stringify(processedData, options.stringifyOptions || {});
    
    // Execute afterStringify hooks
    const finalString = executeHooks('afterStringify', stringified, context);
    const output = finalString === stringified ? stringified : finalString;
    
    // Execute afterExport hooks
    executeHooks('afterExport', output, context);
    
    // Format output
    switch (format) {
        case 'blob':
            return new Blob([output], { type: handler.mimeTypes[0] || config.defaultMimeType });
            
        case 'dataUrl':
            const base64 = btoa(unescape(encodeURIComponent(output)));
            return `data:${handler.mimeTypes[0] || config.defaultMimeType};base64,${base64}`;
            
        case 'string':
            return output;
            
        case 'file':
        default:
            const blob = new Blob([output], { type: handler.mimeTypes[0] || config.defaultMimeType });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = options.filename || `${config.defaultExportFilename}.${handler.extensions[0]?.substring(1) || type}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            return blob;
    }
}

// ==================== LEGACY COMPATIBILITY FUNCTIONS ====================

// Keep old function names for backward compatibility
const importJson = importData;
const exportJsonToFile = (data, filename, options) => exportData(data, { ...options, filename, format: 'file' });
const exportJsonToBlob = (data, options) => exportData(data, { ...options, format: 'blob' });
const exportJsonToDataUrl = (data, options) => exportData(data, { ...options, format: 'dataUrl' });

async function fetchJsonFromUrl(url, options = {}) {
    return importData(url, { ...options, inputType: 'url', type: 'json' });
}

async function importJsonFromFile(file, options = {}) {
    return importData(file, { ...options, inputType: 'file', type: 'json' });
}

async function importJsonFromBlob(blob, options = {}) {
    return importData(blob, { ...options, inputType: 'blob', type: 'json' });
}

function parseJsonFromString(jsonString) {
    const handler = TYPE_HANDLERS.get('json');
    return handler.parse(jsonString);
}

// ==================== EXPORTS ====================

const exports = {
    // Main functions (generic)
    importData,
    exportData,
    
    // Legacy JSON functions (backward compatibility)
    importJson,
    exportJsonToFile,
    exportJsonToBlob,
    exportJsonToDataUrl,
    fetchJsonFromUrl,
    importJsonFromFile,
    importJsonFromBlob,
    parseJsonFromString,
    
    // Plugin system
    registerTypeHandler,
    registerHook,
    registerTransformer,
    
    // Utility functions
    detectInputType,
    detectFileType,
    isUrl,
    sanitizeUrl,
    isValidUrl,
    fetchWithCors,
    getBaseUrl,
    setBaseUrl,
    
    // File functions
    readFileAsText,
    readBlobAsText,
    
    // Image functions (legacy)
    resolveImageUrl,
    resolveImagesInJson,
    
    // Configuration
    URL_RESOLVER_CONFIG,
    TYPE_HANDLERS,
    HOOKS,
    TRANSFORMERS
};

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
}

// Export for browser
if (typeof window !== 'undefined') {
    window.URLResolver = exports;
}

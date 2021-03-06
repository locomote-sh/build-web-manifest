/*
   Copyright 2018 Locomote Limited

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/

// Generate service worker code from manifest configuration.

const Path = require('path');

const {
    SWCurrentVersion,
    SWPluginURLs
} = require('./settings');

const { loadManifest } = require('./manifest');

const { write } = require('./support');

/**
 * Make a service worker.
 * @param opts      Build options.
 * @param source    The build source path.
 * @param target    The build target path.
 * @param save      If true then write the result to file. The default
 *                  file location is '{target}/sw.js'.
 * @return A string with the generated service worker JS source.
 */
async function make( opts, source, target, save ) {

    try { 

        const { serviceWorker } = await loadManifest( opts, source );

        if( !serviceWorker ) {
            console.error('No service worker configuration');
            return;
        }

        // Default service worker config.
        const {
            version = SWCurrentVersion,     // Standard sw version.
            origin  = '.',                  // Default origin.
            origins = [ origin ],           // Default list of origins.
            plugins = [],                   // List of sw plugins.
            cache   = { static: [] }        // Default static caches.
        } = serviceWorker;

        if( !Array.isArray( origins ) ) {
            throw new Error("Setting 'serviceWorker.origins' must be an array");
        }
        if( !Array.isArray( plugins ) ) {
            throw new Error("Setting 'serviceWorker.plugins' must be an array");
        }

        const code = `// Auto-generated by Locomote.sh / ${new Date()}
self.importScripts(${makeImports( version, plugins )});
${makeAddOrigins( origins )}
${makeCacheStatements( cache )}
`;

        if( save ) {
            let path = Path.join( target, 'sw.js');
            console.error('Writing %s...', path );
            await write( path, code );
        }

        return code;
    }
    catch( e ) {
        console.error( e.message || e );
    }
}

// Generate the list of script imports.
function makeImports( version, plugins ) {
    // Import the actual service worker code.
    plugins.unshift('__sw');
    // Map plugin names to full URLs.
    plugins = plugins.map( ref => {
        let url;
        if( ref.startsWith('https:') ) {
            // Plugin reference is a URL, use as-is.
            url = ref;
        }
        else {
            // Lookup the URL generation function for the name.
            let make = SWPluginURLs[ref];
            if( !make ) {
                throw new Error('Bad plugin name: '+ref );
            }
            url = make( version );
        }
        return url;
    });
    return formatJSStringArray( plugins );
}

// Generate statements for adding content origins.
function makeAddOrigins( origins ) {
    if( origins.length == 0 ) {
        return '';
    }
    return `self.addOrigins([${formatJSONArray( origins )}]);`;
}

// Generate statements for additional cache operations.
function makeCacheStatements( cache ) {
    let { static } = cache;
    if( !(static && static.length) ) {
        return '';
    }
    return `self.staticCache([${formatJSStringArray( static )}]);`;
}

// Format an array of strings.
function formatJSStringArray( array ) {
    return `"${array.join('",\n\t"')}"`;
}

// Format an array of JSON objects.
function formatJSONArray( array ) {
    return array.map( JSON.stringify ).join(',\n\t');
}

exports.make = make;


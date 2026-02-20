import fs from 'fs';
import path from 'path';

async function validate() {
    try {
        await import('./js_modules/main.js');
        console.log("SUCCESS: modules loaded without ReferenceErrors.");
    } catch (e) {
        console.error("ERROR loading modules: ", e.message);
        // if the error is "DOM is not defined" or similar, we can catch it
        // Note: document, window won't be defined in Node, so it's expected to fail there.
        // But we want to see if it fails on import syntax first.
    }
}

validate();

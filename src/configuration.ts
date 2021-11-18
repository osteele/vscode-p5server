import path = require('path');

export const RESOURCE_DIR_PATH = path.join(__dirname, '../resources');

export const exclusions = ['.*', '*.lock', '*.log', 'node_modules', 'package.json'];

// Metro config — default Expo config + path aliases handled via tsconfig.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

module.exports = config;

// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Añadimos 'lottie' a la lista de extensiones de recursos (assets)
config.resolver.assetExts.push('lottie');

module.exports = config;
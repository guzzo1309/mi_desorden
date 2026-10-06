// Desde SDK 52 Expo detecta el monorepo solo (watchFolders y node_modules de la raíz).
const { getDefaultConfig } = require("expo/metro-config");

module.exports = getDefaultConfig(__dirname);

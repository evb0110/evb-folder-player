const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const landingPath = path.join(__dirname, 'landing').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const existing = config.resolver.blockList;

// The Nuxt app has its own dependencies and never belongs in Expo's file map.
config.resolver.blockList = [
  ...(Array.isArray(existing) ? existing : existing ? [existing] : []),
  new RegExp(`^${landingPath}[/\\\\].*`),
];

module.exports = config;

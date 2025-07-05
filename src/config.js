const fs = require('fs');
const path = require('path');

// Get config file path in user data directory
function getConfigPath() {
  const userData = (process.type === 'renderer')
    ? require('electron').remote.app.getPath('userData')
    : require('electron').app.getPath('userData');
  return path.join(userData, 'color-picker-config.json');
}

// Load config (returns object, or default if not found)
function loadConfig(defaults = {}) {
  const configPath = getConfigPath();
  if (fs.existsSync(configPath)) {
    try {
      const data = fs.readFileSync(configPath, 'utf-8');
      return { ...defaults, ...JSON.parse(data) };
    } catch (e) {
      return { ...defaults };
    }
  } else {
    // If config does not exist, create it with defaults
    fs.writeFileSync(configPath, JSON.stringify(defaults, null, 2), 'utf-8');
    return { ...defaults };
  }
}

// Save config (merges with existing)
function saveConfig(newConfig) {
  const configPath = getConfigPath();
  let config = {};
  if (fs.existsSync(configPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch (e) {}
  }
  config = { ...config, ...newConfig };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

module.exports = { getConfigPath, loadConfig, saveConfig };

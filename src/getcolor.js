const screenshot = require('screenshot-desktop');
const { default: Jimp } = require('jimp');

const { screen} = require('electron');



async function getColor() {
    const { x, y } = screen.getCursorScreenPoint();
    const imgBuffer = await screenshot({ format: 'png' });
    const img = await Jimp.read(imgBuffer);
    const pixel = img.getPixelColor(x, y);
    const { r, g, b } = Jimp.intToRGBA(pixel);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

module.exports = getColor;
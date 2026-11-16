const fs = require('fs');
const path = require('path');

const src0 = 'C:/Users/PC/.gemini/antigravity/brain/f8d0a571-ea9f-40ad-bf13-449733138a98/.user_uploaded/uploaded_media_0_1794844173517.mp3';
const src1 = 'C:/Users/PC/.gemini/antigravity/brain/f8d0a571-ea9f-40ad-bf13-449733138a98/.user_uploaded/uploaded_media_1_1794844173517.mp3';

const destDir = path.resolve(__dirname, '../../frontend/public/assets/audio');
fs.mkdirSync(destDir, { recursive: true });

// Copy footstep sound
fs.copyFileSync(src0, path.join(destDir, 'sfx_footstep.mp3'));
console.log('✔ Copied sfx_footstep.mp3 (' + fs.statSync(path.join(destDir, 'sfx_footstep.mp3')).size + ' bytes)');

// Copy BGM sound
fs.copyFileSync(src1, path.join(destDir, 'bgm_main.mp3'));
fs.copyFileSync(src1, path.join(destDir, 'bgm_plaza.mp3'));
for (const area of ['library', 'lab', 'garden', 'courtyard', 'hall']) {
  fs.copyFileSync(src1, path.join(destDir, 'bgm_' + area + '.mp3'));
}
console.log('✔ Copied bgm_main.mp3, bgm_plaza.mp3 and all areas (' + fs.statSync(path.join(destDir, 'bgm_plaza.mp3')).size + ' bytes)');
